set shell := ["bash", "-c"]
set dotenv-load := true

# Start all development servers
dev:
    @echo "Starting frontend and Python services..."
    @trap 'kill 0' SIGINT; \
    just dev-next & \
    just dev-lgs & \
    just dev-embedding & \
    wait

# Start the Next.js frontend
dev-next:
    pnpm dev

# Start LazyGraphRAG python service
dev-lgs:
    cd services/evidence-kb && set -a; source .env; set +a; uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start Embedding sidecar python service
dev-embedding:
    cd services/embedding-sidecar && set -a; source .env; set +a; uv run uvicorn main:app --host 127.0.0.1 --port 8766 --reload

# Start all evaluation servers
eval-servers:
    @echo "Starting Python servers for evaluation..."
    @trap 'kill 0' SIGINT; \
    just eval-lgs & \
    just eval-embedding & \
    wait

# Start LazyGraphRAG python service for evaluation
eval-lgs:
    set -a; source .env.eval; set +a; cd services/evidence-kb && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start Embedding sidecar python service for evaluation
eval-embedding:
    set -a; source .env.eval; set +a; cd services/embedding-sidecar && uv run uvicorn main:app --host 127.0.0.1 --port 8766 --reload
