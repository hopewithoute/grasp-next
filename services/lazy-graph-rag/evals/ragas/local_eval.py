import json
import asyncio
from pathlib import Path
from typing import List, Dict, Any

# Assuming standard execution path from services/lazy-graph-rag/
# We mock out a client for the eval harness, or just use httpx to hit the local server.
import httpx

async def index_fixtures(api_url: str, collection_id: str, golden_set_path: Path, api_key: str):
    with open(golden_set_path, "r") as f:
        dataset = json.load(f)
        
    fixtures_dir = golden_set_path.parent
    sources_indexed = set()
    
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    
    async with httpx.AsyncClient(base_url=api_url, headers=headers, timeout=60.0) as client:
        for item in dataset:
            source_files = item.get("sourceFixtures", [])
            if "sourceFixture" in item and item["sourceFixture"]:
                source_files.append(item["sourceFixture"])
                
            for source_file in source_files:
                if source_file not in sources_indexed:
                    file_path = fixtures_dir / source_file
                    if file_path.exists():
                        print(f"Indexing fixture: {source_file}")
                        with open(file_path, "r") as f:
                            content = f.read()
                        
                        resp = await client.post("/v1/sources/index", json={
                            "tenantId": "eval-tenant",
                            "collectionId": collection_id,
                            "sourceId": f"fixture-{source_file}",
                            "sourceType": "markdown" if source_file.endswith(".md") else "text",
                            "documentName": source_file,
                            "content": content,
                            "contentUri": None,
                            "contentMetadata": {}
                        }, headers=headers)
                        if resp.status_code != 200:
                            print(f"Failed to index {source_file}: {resp.text}")
                        else:
                            sources_indexed.add(source_file)
                    else:
                        print(f"Warning: Fixture file not found: {file_path}")

async def run_eval(api_url: str, collection_id: str, golden_set_path: Path, api_key: str = ""):
    print("--- Starting Eval ---")
    await index_fixtures(api_url, collection_id, golden_set_path, api_key)
    
    with open(golden_set_path, "r") as f:
        dataset = json.load(f)

    results = []
    mrr_sum = 0.0
    hit_at_k_sum = 0
    total = len(dataset)
    k = 8

    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}

    async with httpx.AsyncClient(base_url=api_url, headers=headers, timeout=60.0) as client:
        for item in dataset:
            print(f"Evaluating query: {item['question']}")
            
            # Send query request
            resp = await client.post("/v1/query", json={
                "tenantId": "eval-tenant",
                "collectionId": collection_id,
                "query": item["question"],
                "topK": k,
                "budgetPreset": "lite"
            })
            
            if resp.status_code != 200:
                print(f"Error querying: {resp.text}")
                continue
                
            data = resp.json()
            contexts = data.get("contexts", [])
            answer = data.get("answer", "")
            
            # Metric: Hit@k and MRR based on expected hints
            expected_hints = item.get("expectedChunkHints", [])
            hit = False
            reciprocal_rank = 0.0
            
            for idx, ctx in enumerate(contexts):
                content = ctx.get("content", "").lower()
                # Simple presence check of any hint
                found = any(hint.lower() in content for hint in expected_hints)
                if found:
                    hit = True
                    reciprocal_rank = 1.0 / (idx + 1)
                    break
            
            if hit:
                hit_at_k_sum += 1
            mrr_sum += reciprocal_rank
            
            # Export format for RAGAS
            results.append({
                "question": item["question"],
                "answer": answer,
                "contexts": [ctx.get("content", "") for ctx in contexts],
                "referenceAnswer": item["referenceAnswer"]
            })

    print("--- Eval Results ---")
    print(f"Total queries: {total}")
    if total > 0:
        print(f"Hit@{k}: {hit_at_k_sum / total:.2f}")
        print(f"MRR: {mrr_sum / total:.2f}")
        
    export_path = Path("eval_results.json")
    with open(export_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Exported results to {export_path.absolute()}")

if __name__ == "__main__":
    import os
    golden_path = Path("tests/fixtures/eval_golden_set.json")
    api_key = os.environ.get("LGS_API_KEY", "local-dev-key")
    asyncio.run(run_eval("http://localhost:8000", "eval_collection", golden_path, api_key))
