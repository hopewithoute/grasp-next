import logging
from fastapi import FastAPI
from fastapi.routing import APIRoute
from fastapi.middleware.gzip import GZipMiddleware
from app.api import curation, health, ingest, passages, retrieve, sources, topics
from app.middleware import RequestLoggingMiddleware
from app.oban_ext import oban_lifespan

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")

def custom_generate_unique_id(route: APIRoute):
    return f"{route.name}"

app = FastAPI(
    title="Evidence KB", 
    description="Evidence-centric knowledgebase ingestion and retrieval service",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=oban_lifespan,
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RequestLoggingMiddleware)

app.include_router(health.router)
app.include_router(ingest.router)
app.include_router(sources.router)
app.include_router(sources.root_router)
app.include_router(passages.router)
app.include_router(retrieve.router)
app.include_router(curation.router)
app.include_router(topics.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8010)
