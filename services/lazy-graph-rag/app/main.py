from fastapi import FastAPI
from app.api import health

app = FastAPI(title="LazyGraphRAG Service")

app.include_router(health.router)
from app.api import sources, search, graph, chunks, collections, query
app.include_router(sources.router)
app.include_router(search.router)
app.include_router(graph.router)
app.include_router(chunks.router)
app.include_router(collections.router)
app.include_router(query.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
