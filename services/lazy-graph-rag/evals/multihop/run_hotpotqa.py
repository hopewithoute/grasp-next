#!/usr/bin/env python3
"""Lazy Graph RAG Multi-Hop Evaluation on HotpotQA.

Usage:
    python run_hotpotqa.py --samples 20 --budget balanced
    python run_hotpotqa.py --samples 10 --budget deep --skip-ingest
"""
import argparse
import asyncio
import json
import logging
import os
import random
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List

import httpx

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# CLI defaults
# ---------------------------------------------------------------------------
DEFAULT_URL = "http://localhost:8000"
COLLECTION_ID = "hotpotqa_multihop_eval"
TENANT_ID = "eval-tenant"


# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------
@dataclass
class MultiHopResult:
    question_id: str
    question: str
    hop_type: str
    gold_answer: str
    predicted_answer: str
    contexts: List[Dict[str, Any]]
    hit_at_k: bool
    answer_match: bool
    latency_ms: float


# ---------------------------------------------------------------------------
# HotpotQA loader (copied from frugal-rag/evals/run_multihop.py)
# ---------------------------------------------------------------------------
def load_hotpotqa(num_samples: int = 20, split: str = "validation") -> tuple[List[str], List[Dict]]:
    """Load HotpotQA distractor split and return documents + QA pairs."""
    try:
        from datasets import load_dataset
    except ImportError:
        logger.error("Please install datasets: pip install datasets")
        return [], []

    logger.info("Loading HotpotQA dataset (split=%s)...", split)
    try:
        ds = load_dataset("hotpotqa/hotpot_qa", "distractor", split=split)
    except Exception as e:
        logger.error("Failed to load dataset: %s", e)
        return [], []

    total = len(ds)
    logger.info("Dataset loaded. Total samples: %d", total)

    if num_samples < total:
        random.seed(42)
        indices = random.sample(range(total), num_samples)
        sampled = ds.select(indices)
    else:
        sampled = ds
        num_samples = total

    all_docs: set[str] = set()
    qa_pairs: List[Dict[str, Any]] = []

    for row in sampled:
        q = row.get("question", "")
        answer = row.get("answer", "")
        type_ = row.get("type", "bridge")

        context = row.get("context", {})
        titles = context.get("title", [])
        sentences = context.get("sentences", [])

        doc_texts: List[str] = []
        for title, sents in zip(titles, sentences):
            doc_text = f"Title: {title}\n" + "\n".join(sents)
            doc_texts.append(doc_text)
            all_docs.add(doc_text)

        # Gold paragraphs from supporting facts
        supporting_facts = row.get("supporting_facts", [])
        gold_paragraphs: List[str] = []
        for sf in supporting_facts:
            if isinstance(sf, (list, tuple)) and len(sf) >= 2:
                sf_title, sf_sent_idx = sf[0], sf[1]
                for title, sents in zip(titles, sentences):
                    if title == sf_title and sf_sent_idx < len(sents):
                        gold_paragraphs.append(f"Title: {title}\n{sents[sf_sent_idx]}")

        qa_pairs.append({
            "question": q,
            "answer": answer,
            "type": type_,
            "gold_paragraphs": gold_paragraphs,
            "gold_keywords": [w.lower() for w in answer.split()],
        })

    logger.info("Extracted %d unique documents, %d QA pairs", len(all_docs), len(qa_pairs))
    return list(all_docs), qa_pairs


# ---------------------------------------------------------------------------
# Retry helper (copied from frugal-rag/evals/aligned_eval.py)
# ---------------------------------------------------------------------------
async def _retry_request(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    **kwargs,
) -> httpx.Response:
    """Make an HTTP request with exponential backoff retry.

    Retries up to 3 times on TimeoutException, ConnectError, or HTTPStatusError
    for 5xx responses. Does NOT retry 4xx errors.
    """
    delays = [1.0, 2.0, 4.0]
    last_exc: Exception | None = None

    for attempt, delay in enumerate(delays):
        try:
            resp = await client.request(method, url, **kwargs)
            if resp.status_code < 500:
                return resp
            last_exc = httpx.HTTPStatusError(
                f"Server error {resp.status_code}: {resp.text}",
                request=resp.request,
                response=resp,
            )
        except (httpx.TimeoutException, httpx.ConnectError) as exc:
            last_exc = exc
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500:
                raise
            last_exc = exc
        except Exception as exc:
            last_exc = exc

        if attempt < len(delays) - 1:
            logger.warning(
                "Request failed (attempt %d/%d), retrying in %.1fs: %s",
                attempt + 1, len(delays), delay, last_exc,
            )
            await asyncio.sleep(delay)
        else:
            logger.error("Request failed after %d attempts: %s", len(delays), last_exc)

    raise last_exc if last_exc else RuntimeError("Unexpected retry failure")


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------
async def ingest_documents(
    api_url: str,
    documents: List[str],
    collection_id: str,
    *,
    skip_ingest: bool = False,
) -> None:
    """Ingest documents into LGS and build the graph.

    Args:
        api_url:       Base URL of the LGS server.
        documents:     List of document text strings to index.
        collection_id: Collection identifier.
        skip_ingest:   If True, skip ingestion entirely.
    """
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    api_key = os.environ.get("LGS_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(base_url=api_url, headers=headers, timeout=60.0) as client:
        if skip_ingest:
            logger.info("Skipping document ingestion (--skip-ingest flag used).")
        else:
            # Check if collection already has documents
            try:
                status_resp = await _retry_request(
                    client, "GET",
                    f"/v1/collections/{collection_id}/status",
                )
                if status_resp.status_code == 200:
                    data = status_resp.json()
                    doc_count = data.get("documentCount", 0)
                    if doc_count > 0:
                        logger.info(
                            "Collection %s already has %d documents. Skipping ingest.",
                            collection_id, doc_count,
                        )
                        skip_ingest = True
            except Exception as e:
                logger.warning("Could not check collection status: %s", e)

        if not skip_ingest:
            logger.info("Ingesting %d documents into collection '%s'...", len(documents), collection_id)

            # Index documents in small batches to avoid overwhelming the server
            batch_size = 5
            for batch_start in range(0, len(documents), batch_size):
                batch_end = min(batch_start + batch_size, len(documents))
                batch = documents[batch_start:batch_end]

                async def index_doc(idx: int, doc_text: str) -> None:
                    source_id = f"hotpotqa-doc-{idx}"
                    resp = await _retry_request(
                        client, "POST", "/v1/sources/index",
                        json={
                            "tenantId": TENANT_ID,
                            "collectionId": collection_id,
                            "sourceId": source_id,
                            "sourceType": "text",
                            "documentName": f"hotpotqa_doc_{idx}.txt",
                            "content": doc_text[:50000],
                        },
                    )
                    if resp.status_code != 200:
                        logger.warning(
                            "Failed to index doc %d: %s",
                            idx, resp.text,
                        )

                tasks = [
                    index_doc(batch_start + j, doc)
                    for j, doc in enumerate(batch)
                    if doc and len(doc.strip()) >= 10
                ]
                await asyncio.gather(*tasks, return_exceptions=True)
                logger.info(
                    "Batch %d-%d/%d indexed.",
                    batch_start + 1, batch_end, len(documents),
                )

        # Build graph
        logger.info("Building graph for collection '%s'...", collection_id)
        resp = await _retry_request(
            client, "POST", "/v1/collections/build-graph",
            json={"collectionId": collection_id},
        )
        if resp.status_code != 200:
            logger.error("Failed to build graph: %s", resp.text)
            sys.exit(1)

        data = resp.json()
        logger.info(
            "Graph built. Cooccurrences: %s, Communities: %s",
            data.get("cooccurrenceCount"), data.get("communityCount"),
        )


# ---------------------------------------------------------------------------
# Query runner
# ---------------------------------------------------------------------------
async def run_queries(
    api_url: str,
    qa_pairs: List[Dict],
    budget_preset: str = "balanced",
) -> List[MultiHopResult]:
    """Run queries against LGS and collect results.

    Args:
        api_url:       Base URL of the LGS server.
        qa_pairs:      List of QA dicts from load_hotpotqa.
        budget_preset: Budget preset passed to /v1/query (lite/balanced/deep).

    Returns:
        List of MultiHopResult objects.
    """
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    api_key = os.environ.get("LGS_API_KEY")
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    results: List[MultiHopResult] = []
    failures = 0
    total = len(qa_pairs)

    async with httpx.AsyncClient(base_url=api_url, headers=headers, timeout=300.0) as client:
        for idx, qa in enumerate(qa_pairs):
            q = qa.get("question", "")
            if not q or len(q.strip()) < 3:
                logger.warning("Skipping item %d — empty question", idx)
                continue

            start = time.monotonic()
            try:
                resp = await _retry_request(
                    client, "POST", "/v1/query",
                    json={
                        "tenantId": TENANT_ID,
                        "collectionId": COLLECTION_ID,
                        "query": q,
                        "topK": 10,
                        "budgetPreset": budget_preset,
                        "retrievalMode": f"graph_{budget_preset}",
                    },
                )
            except Exception as e:
                logger.error("Request failed for question %d: %s", idx, e)
                failures += 1
                continue

            latency_ms = (time.monotonic() - start) * 1000

            if resp.status_code != 200:
                logger.warning(
                    "Non-200 response for question %d: %s %s",
                    idx, resp.status_code, resp.text,
                )
                failures += 1
                continue

            data = resp.json()
            answer: str = data.get("answer", "")
            contexts: List[Dict[str, Any]] = data.get("contexts", [])

            # Hit@K: check if gold keywords appear in retrieved contexts
            all_text = " ".join(
                ctx.get("content", ctx.get("text", "")) for ctx in contexts
            ).lower()
            gold_keywords = qa.get("gold_keywords", [])
            hit_at_k = any(kw in all_text for kw in gold_keywords)

            # Answer match: check if gold answer appears in generated answer
            gold_answer = qa.get("answer", "").lower()
            raw_answer = answer.lower()
            answer_match = bool(gold_answer and gold_answer in raw_answer)

            results.append(MultiHopResult(
                question_id=f"q{idx}",
                question=q,
                hop_type=qa.get("type", "unknown"),
                gold_answer=qa.get("answer", ""),
                predicted_answer=answer,
                contexts=contexts,
                hit_at_k=hit_at_k,
                answer_match=answer_match,
                latency_ms=latency_ms,
            ))

            if idx % 5 == 0 or idx == total - 1:
                logger.info(
                    "[%d/%d] hit=%s answer_match=%s latency=%.0fms contexts=%d",
                    idx + 1, total, hit_at_k, answer_match, latency_ms, len(contexts),
                )

    if failures:
        logger.warning("Query failures: %d/%d", failures, total)

    return results


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
def compute_metrics(results: List[MultiHopResult]) -> Dict[str, Any]:
    """Compute multi-hop evaluation metrics."""
    if not results:
        return {}

    total = len(results)
    hits = sum(1 for r in results if r.hit_at_k)
    answer_matches = sum(1 for r in results if r.answer_match)
    avg_latency = sum(r.latency_ms for r in results) / total
    non_empty_answers = sum(1 for r in results if r.predicted_answer.strip())
    avg_answer_len = (
        sum(len(r.predicted_answer) for r in results) / non_empty_answers
        if non_empty_answers else 0
    )

    # Per-hop-type breakdown
    hop_types = set(r.hop_type for r in results)
    per_hop: Dict[str, Dict[str, Any]] = {}
    for ht in hop_types:
        ht_results = [r for r in results if r.hop_type == ht]
        per_hop[ht] = {
            "count": len(ht_results),
            "hit_rate": sum(1 for r in ht_results if r.hit_at_k) / len(ht_results),
            "answer_rate": sum(1 for r in ht_results if r.answer_match) / len(ht_results),
        }

    return {
        "total_queries": total,
        "hit_rate": hits / total,
        "answer_match_rate": answer_matches / total,
        "avg_latency_ms": avg_latency,
        "non_empty_answer_count": non_empty_answers,
        "avg_answer_length": avg_answer_len,
        "per_hop_type": per_hop,
    }


# ---------------------------------------------------------------------------
# RAGAS scoring
# ---------------------------------------------------------------------------
def run_ragas_on_results(results: List[MultiHopResult]) -> Dict[str, Any]:
    """Run RAGAS evaluation on query results.

    Requires environment variables:
        GENERATOR_API_KEY, GENERATOR_BASE_URL, GENERATOR_MODEL
        EMBEDDING_API_KEY, EMBEDDING_BASE_URL, EMBEDDING_MODEL

    Returns a dict with faithfulness, context_precision, context_recall scores.
    """
    # Filter to results with both answer and contexts
    valid = [r for r in results if r.predicted_answer.strip() and r.contexts]
    if not valid:
        logger.warning("No results with both answer and contexts — skipping RAGAS.")
        return {}

    logger.info("Running RAGAS evaluation on %d results...", len(valid))

    try:
        from datasets import Dataset
        from ragas import evaluate
        from ragas.metrics import faithfulness, context_precision, context_recall
        from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    except ImportError as e:
        logger.warning("RAGAS dependencies not installed: %s — skipping RAGAS scoring.", e)
        return {}

    # Validate required env vars
    required = ["GENERATOR_API_KEY", "GENERATOR_BASE_URL", "GENERATOR_MODEL"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        logger.warning("Missing env vars: %s — skipping RAGAS scoring.", missing)
        return {}

    generator_llm = ChatOpenAI(
        model=os.environ.get("GENERATOR_MODEL"),
        api_key=os.environ.get("GENERATOR_API_KEY"),
        base_url=os.environ.get("GENERATOR_BASE_URL"),
        max_retries=3,
    )

    embeddings = OpenAIEmbeddings(
        model=os.environ.get("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B"),
        base_url=os.environ.get("EMBEDDING_BASE_URL", "http://localhost:8766/v1"),
        api_key=os.environ.get("EMBEDDING_API_KEY", "local"),
        max_retries=3,
    )

    eval_dataset = Dataset.from_list([
        {
            "question": r.question,
            "answer": r.predicted_answer,
            "contexts": [
                ctx.get("content", ctx.get("text", ""))
                for ctx in r.contexts
            ],
            "ground_truth": r.gold_answer,
        }
        for r in valid
    ])

    metrics = [faithfulness, context_precision, context_recall]

    try:
        scores = evaluate(
            eval_dataset,
            metrics=metrics,
            llm=generator_llm,
            embeddings=embeddings,
            max_workers=2,
        )
    except TypeError:
        # Fallback if max_workers not supported in this ragas version
        scores = evaluate(
            eval_dataset,
            metrics=metrics,
            llm=generator_llm,
            embeddings=embeddings,
        )

    # Serialise scores
    try:
        scores_dict = scores.to_pandas().to_dict()
    except Exception:
        try:
            scores_dict = dict(scores)
        except Exception:
            scores_dict = {
                k: getattr(scores, k, None)
                for k in ["faithfulness", "context_precision", "context_recall"]
            }

    logger.info("RAGAS scores: %s", scores_dict)
    return scores_dict


# ---------------------------------------------------------------------------
# Comparison table printer
# ---------------------------------------------------------------------------
def print_comparison_table(
    metrics: Dict[str, Any],
    ragas_scores: Dict[str, Any],
) -> None:
    """Print a formatted comparison table to stdout."""
    logger.info("=" * 60)
    logger.info("HOTPOTQA MULTI-HOP EVALUATION RESULTS")
    logger.info("=" * 60)

    # Overall metrics
    logger.info(
        "%-22s %10s %14s %10s",
        "Metric", "Value", "Metric", "Value",
    )
    logger.info("-" * 60)
    logger.info("%-22s %10.1f%%", "Hit Rate", metrics.get("hit_rate", 0) * 100)
    logger.info("%-22s %10.1f%%", "Answer Match Rate", metrics.get("answer_match_rate", 0) * 100)
    logger.info("%-22s %10.0fms", "Avg Latency", metrics.get("avg_latency_ms", 0))
    logger.info(
        "%-22s %10d / %d",
        "Non-empty Answers",
        metrics.get("non_empty_answer_count", 0),
        metrics.get("total_queries", 0),
    )
    logger.info("%-22s %10.1f", "Avg Answer Length", metrics.get("avg_answer_length", 0))

    # Per-hop-type
    per_hop = metrics.get("per_hop_type", {})
    if per_hop:
        logger.info("")
        logger.info("Per-Hop-Type Breakdown")
        logger.info("%-15s %8s %10s %10s", "Hop Type", "Count", "Hit Rate", "Answer Rate")
        logger.info("-" * 50)
        for ht, ht_metrics in sorted(per_hop.items()):
            logger.info(
                "%-15s %8d %9.1f%% %9.1f%%",
                ht,
                ht_metrics["count"],
                ht_metrics["hit_rate"] * 100,
                ht_metrics["answer_rate"] * 100,
            )

    # RAGAS scores
    if ragas_scores:
        logger.info("")
        logger.info("RAGAS Scores")
        logger.info("-" * 40)
        try:
            df = scores_df = None
            if isinstance(ragas_scores, dict) and "faithfulness" in ragas_scores:
                # Per-sample scores — show means
                for key in ragas_scores:
                    val = ragas_scores[key]
                    if isinstance(val, list) and len(val) > 0:
                        mean_val = sum(val) / len(val)
                        logger.info("%-22s %10.3f", key, mean_val)
                    elif isinstance(val, (int, float)):
                        logger.info("%-22s %10.3f", key, val)
        except Exception as e:
            logger.warning("Could not format RAGAS scores: %s", e)
            logger.info("RAGAS scores: %s", ragas_scores)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Lazy Graph RAG Multi-Hop Evaluation on HotpotQA",
    )
    parser.add_argument(
        "--samples", type=int, default=10,
        help="Number of HotpotQA samples to evaluate (default: 10)",
    )
    parser.add_argument(
        "--budget", type=str, default="balanced",
        choices=["lite", "balanced", "deep"],
        help="Budget preset for query (default: balanced)",
    )
    parser.add_argument(
        "--skip-ingest", action="store_true",
        help="Skip document ingestion and graph build (use existing collection)",
    )
    parser.add_argument(
        "--url", type=str, default=DEFAULT_URL,
        help=f"LGS server URL (default: {DEFAULT_URL})",
    )
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("Lazy Graph RAG — HotpotQA Multi-Hop Evaluation")
    logger.info("URL: %s | Samples: %d | Budget: %s", args.url, args.samples, args.budget)
    logger.info("=" * 60)

    # Load dataset
    documents, qa_pairs = load_hotpotqa(num_samples=args.samples)
    if not documents or not qa_pairs:
        logger.error("No data loaded from HotpotQA — aborting.")
        sys.exit(1)

    # Ingest
    asyncio.run(ingest_documents(
        args.url, documents, COLLECTION_ID, skip_ingest=args.skip_ingest,
    ))

    # Run queries
    logger.info("Running queries (budget='%s')...", args.budget)
    results = asyncio.run(run_queries(args.url, qa_pairs, budget_preset=args.budget))
    if not results:
        logger.error("No query results — aborting.")
        sys.exit(1)

    # Compute metrics
    metrics = compute_metrics(results)
    logger.info(
        "Hit Rate: %.1f%% | Answer Match: %.1f%% | Avg Latency: %.0fms",
        metrics.get("hit_rate", 0) * 100,
        metrics.get("answer_match_rate", 0) * 100,
        metrics.get("avg_latency_ms", 0),
    )

    # RAGAS
    ragas_scores = run_ragas_on_results(results)

    # Print table
    print_comparison_table(metrics, ragas_scores)

    # Export JSON
    export_path = Path(__file__).parent / "multihop_hotpotqa_lgs_results.json"
    export: Dict[str, Any] = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset": "hotpotqa",
        "collection_id": COLLECTION_ID,
        "tenant_id": TENANT_ID,
        "samples": args.samples,
        "budget_preset": args.budget,
        "metrics": metrics,
        "ragas_scores": ragas_scores,
        "results": [
            {
                "id": r.question_id,
                "question": r.question,
                "hop_type": r.hop_type,
                "gold_answer": r.gold_answer,
                "predicted_answer": r.predicted_answer,
                "hit_at_k": r.hit_at_k,
                "answer_match": r.answer_match,
                "latency_ms": round(r.latency_ms),
                "contexts": [
                    ctx.get("content", ctx.get("text", ""))
                    for ctx in r.contexts
                ],
            }
            for r in results
        ],
    }

    try:
        with open(export_path, "w") as f:
            json.dump(export, f, indent=2, default=str)
        logger.info("Results saved to %s", export_path.absolute())
    except OSError as e:
        logger.error("Failed to write results: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()