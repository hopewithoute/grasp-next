import asyncio
import json
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.query.orchestrator import QueryOrchestrator
import os

# Ensure LGS environment is set
os.environ["LGS_DATABASE_URL"] = "postgresql+asyncpg://postgres:gas12kilo@localhost:5432/grasp_lgs"

async def run_search():
    engine = create_async_engine(os.environ["LGS_DATABASE_URL"])
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    
    query_text = "What are the common symptoms of COVID-19?"
    collection_id = "ragbench_covidqa_eval"
    
    print(f"Running search on collection: {collection_id}")
    print(f"Query: {query_text}")
    print(f"Mode: graph_balanced with balanced budget\n")
    
    async with async_session() as session:
        orchestrator = QueryOrchestrator(session)
        
        try:
            result = await orchestrator.execute_query(
                tenant_id="eval-tenant",
                collection_id=collection_id,
                query=query_text,
                top_k=8,
                budget_preset="balanced",
                retrieval_mode="graph_balanced"
            )
            
            print("=== SEARCH RESULTS ===")
            print(f"Answer:\n{result['answer']}\n")
            
            print("=== CONTEXTS ===")
            print(f"Found {len(result['contexts'])} contexts.")
            for i, ctx in enumerate(result['contexts'][:3]):
                print(f"{i+1}. [Chunk: {ctx['chunkId']}] {ctx['content'][:150]}...")
                
            print("\n=== TRACE ===")
            print(json.dumps(result['trace'], indent=2))
            
            await session.commit()
            
        except Exception as e:
            print(f"Error during search: {e}")
            raise
        finally:
            await engine.dispose()

if __name__ == "__main__":
    asyncio.run(run_search())
