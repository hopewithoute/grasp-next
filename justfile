set shell := ["bash", "-c"]

# Start all development servers
dev:
	@echo "Starting frontend and Python services..."
	@trap 'kill 0' SIGINT; \
	just dev-next & \
	just dev-lgs & \
	just dev-gliner & \
	just dev-embedding & \
	wait

# Start the Next.js frontend
dev-next:
	pnpm dev

# Start LazyGraphRAG python service
dev-lgs:
	cd services/lazy-graph-rag && uv run --env-file ../../.env uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start GLiNER sidecar python service
dev-gliner:
	cd services/gliner-sidecar && uv run --env-file ../../.env uvicorn main:app --host 127.0.0.1 --port 8765 --reload

# Start Embedding sidecar python service
dev-embedding:
	cd services/embedding-sidecar && uv run --env-file ../../.env uvicorn main:app --host 127.0.0.1 --port 8766 --reload

# Start all evaluation servers
eval-servers:
	@echo "Starting Python servers for evaluation..."
	@trap 'kill 0' SIGINT; \
	just eval-lgs & \
	just eval-gliner & \
	just eval-embedding & \
	wait

# Start LazyGraphRAG python service for evaluation
eval-lgs:
	cd services/lazy-graph-rag && uv run --env-file ../../.env.eval uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# Start GLiNER sidecar python service for evaluation
eval-gliner:
	cd services/gliner-sidecar && uv run --env-file ../../.env.eval uvicorn main:app --host 127.0.0.1 --port 8765 --reload

# Start Embedding sidecar python service for evaluation
eval-embedding:
	cd services/embedding-sidecar && uv run --env-file ../../.env.eval uvicorn main:app --host 127.0.0.1 --port 8766 --reload
