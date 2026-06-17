import json
import asyncio
import argparse
import httpx
import os
import random
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)
from pathlib import Path

# Provide a fallback if 'datasets' is not installed yet
try:
    from datasets import load_dataset, Dataset
except ImportError:
    print("Please install datasets: rtk uv pip install datasets")
    exit(1)

import sys
from unittest.mock import MagicMock
# Mock out the missing module in newer langchain_community
sys.modules['langchain_community.chat_models.vertexai'] = MagicMock()
sys.modules['langchain_community.chat_models.vertexai'].ChatVertexAI = MagicMock()

try:
    from ragas import evaluate
    from ragas.metrics import faithfulness, context_precision, context_recall, answer_correctness
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
except ImportError as e:
    print(f"Please install ragas and langchain-openai. Error: {e}")
    exit(1)

async def index_ragbench_docs(api_url: str, collection_id: str, api_key: str, documents: list, skip_ingest: bool = False):
    """Ingests documents and builds the graph for LazyGraphRAG under a specific collection."""
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    
    async with httpx.AsyncClient(base_url=api_url, headers=headers, timeout=60.0) as client:
        if skip_ingest:
            print("Skipping document ingestion and graph building (--skip-ingest flag used).", flush=True)
            return

        # Check if collection already exists and has documents
        try:
            status_resp = await client.get(f"/v1/collections/{collection_id}/status?tenant_id=eval-tenant")
            if status_resp.status_code == 200:
                status_data = status_resp.json()
                if status_data.get("documentCount", 0) > 0:
                    print(f"Collection {collection_id} already contains {status_data['documentCount']} documents. Skipping ingestion phase.", flush=True)
                    return
        except Exception as e:
            print(f"Warning: Failed to check collection status: {e}", flush=True)

        # Prepare all ingestion tasks
        async def index_doc(idx: int, doc_text: str):
            source_id = f"ragbench-doc-{idx}"
            resp = await client.post("/v1/sources/index", json={
                "tenantId": "eval-tenant",
                "collectionId": collection_id,
                "sourceId": source_id,
                "sourceType": "text",
                "documentName": f"ragbench_doc_{idx}.txt",
                "content": doc_text,
                "contentUri": None,
                "contentMetadata": {}
            }, timeout=60.0)
            if resp.status_code != 200:
                print(f"Failed to index doc {idx}: {resp.text}", flush=True)
            else:
                print(f"Successfully indexed document {idx}/{len(documents)}", flush=True)

        # Execute in batches to avoid overwhelming the server
        batch_size = 5
        for i in range(0, len(documents), batch_size):
            batch = documents[i:i+batch_size]
            tasks = [index_doc(i + j, doc) for j, doc in enumerate(batch)]
            await asyncio.gather(*tasks)
            print(f"Batch {i//batch_size + 1} completed.", flush=True)
            
        print(f"Building Graph for collection {collection_id}...", flush=True)
        resp = await client.post("/v1/collections/build-graph", json={
            "collectionId": collection_id
        }, timeout=300.0)
        
        if resp.status_code != 200:
            print(f"Failed to build graph: {resp.text}", flush=True)
        else:
            data = resp.json()
            print(f"Graph built successfully! Cooccurrences: {data.get('cooccurrenceCount')}, Communities: {data.get('communityCount')}", flush=True)

async def gather_ragbench_data(topic: str, num_samples: int, budget: str, skip_ingest: bool = False):
    print(f"--- RAGBench Benchmark Evaluator (Topic: {topic}, Budget: {budget}) ---", flush=True)
    api_url = "http://localhost:8000"
    api_key = os.environ.get("LGS_API_KEY", "local-dev-key")
    collection_id = f"ragbench_{topic}_eval"
    
    print(f"Loading dataset 'galileo-ai/ragbench' for topic '{topic}'...", flush=True)
    try:
        ds = load_dataset("galileo-ai/ragbench", topic, split="test")
    except Exception as e:
        print(f"Failed to load dataset: {e}", flush=True)
        return

    total_available = len(ds)
    print(f"Dataset loaded. Total available test samples: {total_available}", flush=True)
    
    # Sample data
    if num_samples < total_available:
        # random seed for reproducibility
        random.seed(42)
        indices = random.sample(range(total_available), num_samples)
        sampled_ds = ds.select(indices)
    else:
        sampled_ds = ds
        num_samples = total_available

    print(f"Selected {num_samples} samples for evaluation.", flush=True)
    
    # Analyze columns to find context and questions
    columns = sampled_ds.column_names
    print(f"Dataset columns: {columns}", flush=True)
    
    # In RAGBench, usually 'question' contains the query, and 'documents' contains context.
    # We will gather all documents to ingest first.
    # We do a preliminary check on the first row:
    sample_row = sampled_ds[0]
    
    # Depending on the exact schema of ragbench, we extract documents.
    # Let's write a generic extractor based on common column names.
    all_docs = set()
    questions_and_answers = []
    
    for row in sampled_ds:
        q = row.get("question", row.get("query", ""))
        # 'documents' might be a list of strings or list of dicts
        docs = row.get("documents", [])
        if isinstance(docs, str):
            all_docs.add(docs)
        elif isinstance(docs, list):
            for d in docs:
                if isinstance(d, str):
                    all_docs.add(d)
                elif isinstance(d, dict) and "text" in d:
                    all_docs.add(d["text"])
                elif isinstance(d, dict) and "content" in d:
                    all_docs.add(d["content"])
        
        gt = row.get("response", "")
        questions_and_answers.append({
            "question": q,
            "ground_truth": gt
        })

    print(f"Found {len(all_docs)} unique documents across the {num_samples} samples.", flush=True)
    
    # Indexing Phase
    await index_ragbench_docs(api_url, collection_id, api_key, list(all_docs), skip_ingest)
    
    # Query Phase
    results = []
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    
    print("\n--- Starting Query Phase ---", flush=True)
    async with httpx.AsyncClient(base_url=api_url, headers=headers, timeout=300.0) as client:
        semaphore = asyncio.Semaphore(5)
        
        async def process_query(idx, qa):
            q = qa["question"]
            print(f"[{idx+1}/{num_samples}] Query: {q} (started)", flush=True)
            retrieval_mode = "hybrid" if budget == "hybrid" else f"graph_{budget}"
            
            async with semaphore:
                resp = await client.post("/v1/query", json={
                    "tenantId": "eval-tenant",
                    "collectionId": collection_id,
                    "query": q,
                    "topK": 5,
                    "budgetPreset": budget if budget != "hybrid" else "lite",
                    "retrievalMode": retrieval_mode
                })
                
            if resp.status_code != 200:
                print(f"[{idx+1}/{num_samples}] Error querying: {resp.text}", flush=True)
                return None
                
            data = resp.json()
            answer = data.get("answer", "")
            contexts = [ctx.get("content", "") for ctx in data.get("contexts", [])]
            
            print(f"[{idx+1}/{num_samples}] Finished query successfully.", flush=True)
            
            return {
                "question": q,
                "answer": answer,
                "contexts": contexts,
                "ground_truth": qa["ground_truth"]
            }
            
        tasks = [process_query(idx, qa) for idx, qa in enumerate(questions_and_answers)]
        query_results = await asyncio.gather(*tasks)
        
        for res in query_results:
            if res:
                results.append(res)
            
    # Save raw results
    output_file = Path(__file__).parent / f"ragbench_{topic}_results.json"
    with open(output_file, "w") as f:
        json.dump(results, f, indent=2)
        
    print(f"\nRaw results saved to {output_file.absolute()}", flush=True)
    return results, num_samples

def main():
    parser = argparse.ArgumentParser(description="Run RAGBench evaluation on LazyGraphRAG")
    parser.add_argument("--topic", type=str, default="covidqa", help="Topical subset of RAGBench (e.g. covidqa, finqa, techqa)")
    parser.add_argument("--samples", type=int, default=10, help="Number of random samples to evaluate")
    parser.add_argument("--budget", type=str, default="lite", help="Budget preset: lite, balanced, deep, or hybrid")
    parser.add_argument("--skip-ingest", action="store_true", help="Skip document ingestion and graph building phase")
    args = parser.parse_args()
    
    results, num_samples = asyncio.run(gather_ragbench_data(args.topic, args.samples, args.budget, args.skip_ingest))
    
    if not results:
        print("No results to evaluate.")
        return
        
    # Ragas Evaluation
    print("\n--- Running Ragas Evaluation on RAGBench Results ---", flush=True)
    
    # Initialize Generator and Embeddings for Ragas
    generator_llm = ChatOpenAI(
        model=os.environ.get("GENERATOR_MODEL", "deepseek-v4-flash"),
        api_key=os.environ.get("GENERATOR_API_KEY", "sk-xxx"),
        base_url=os.environ.get("GENERATOR_BASE_URL", "https://api.deepseek.com/v1"),
        max_retries=3
    )
    
    embeddings = OpenAIEmbeddings(
        model=os.environ.get("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B"),
        base_url=os.environ.get("EMBEDDING_BASE_URL", "http://localhost:8766/v1"),
        api_key=os.environ.get("EMBEDDING_API_KEY", "local"),
        max_retries=3
    )
    
    eval_dataset = Dataset.from_list(results)
    
    # Base metrics that don't require heavy relevancy checking
    metrics = [faithfulness]
    
    # Check flag from .env.eval
    enable_relevancy = os.environ.get("RAGAS_ENABLE_ANSWER_RELEVANCY", "false").lower() == "true"
    
    if enable_relevancy:
        # Include relevancy metrics if flag is true
        metrics.extend([context_precision, context_recall, answer_correctness])
        print("Relevancy metrics (context_precision, context_recall, answer_correctness) are ENABLED.", flush=True)
    else:
        print("Relevancy metrics are DISABLED via RAGAS_ENABLE_ANSWER_RELEVANCY flag.", flush=True)

    
    # Run evaluation with limited workers to avoid OOM
    try:
        scores = evaluate(eval_dataset, metrics=metrics, llm=generator_llm, embeddings=embeddings, max_workers=2)
    except TypeError:
        # Fallback if max_workers is not supported in this version
        scores = evaluate(eval_dataset, metrics=metrics, llm=generator_llm, embeddings=embeddings)
        
    print("\n--- FINAL RAGBENCH EVALUATION SCORES ---", flush=True)
    print(f"Total Dataset Evaluated: {num_samples} samples from {args.topic}", flush=True)
    print(scores, flush=True)
    
    # Save scores
    score_file = Path(__file__).parent / f"ragbench_{args.topic}_{args.budget}_scores.json"
    with open(score_file, "w") as f:
        # Convert scores to dict if possible
        try:
            json.dump(scores.to_pandas().to_dict(), f, indent=2)
        except Exception:
            try:
                json.dump(dict(scores), f, indent=2)
            except Exception:
                f.write(str(scores))
    print(f"Scores saved to {score_file}", flush=True)

if __name__ == "__main__":
    main()
