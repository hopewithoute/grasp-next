# Evidence KB

Evidence KB is an evidence-centric knowledgebase service for ingestion, recursive chunking, parsing, sidecar embedding, hybrid search, and batch curation of text and PDF sources. It provides a modular backend for RAG (Retrieval-Augmented Generation) applications.

---

## High-Level Architecture

The service coordinates ingestion and retrieval through the following data pipeline:

```
PDF / Text / HTML / Markdown Sources
              ↓
      Parsing (PyMuPDF for PDF, text blocks)
              ↓
      Chunking (recursive, overlap-aware splitting)
              ↓
      Quality checks + embedding (via embedding-sidecar)
              ↓
      Postgres (pgvector HNSW + tsvector GIN)
              ↓
      Hybrid retrieval (BM25 + vector + RRF reranking)
```

---

## Setup & Running Locally

### Prerequisites

- Python 3.12+
- A running PostgreSQL database with the `pgvector` extension installed.
- (Optional but highly recommended) A running instance of the `embedding-sidecar` service.

### 1. Installation

Navigate to the directory and set up a virtual environment:

```bash
cd services/evidence-kb

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies (development mode)
pip install -e .
```

### 2. Configure Environment Variables

Copy the template configuration file:

```bash
cp .env.example .env
```

Edit the `.env` file to match your environment. Key variables:

- `DATABASE_URL`: Postgres connection URI (e.g., `postgresql+asyncpg://postgres:postgres@localhost:5432/grasp`).
- `EMBEDDING_SERVICE_URL`: Base URL of the embedding sidecar (e.g., `http://localhost:8002`).

### 3. Initialize Database Schema

Run the initialization script to configure schemas, tables, and indexes:

```bash
python -m app.storage.schema_init
```

_(Alternatively, you can apply migrations using Alembic: `alembic upgrade head`)_

### 4. Start the Service

Launch the Uvicorn web server:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
```

---

## Configuration Reference

The following environment variables configure the service via `app/settings.py`:

| Variable                    | Type  | Default         | Description                                                                  |
| --------------------------- | ----- | --------------- | ---------------------------------------------------------------------------- |
| `API_KEY`                   | `str` | `None`          | Optional API key for authenticating incoming requests (`X-API-Key` header).  |
| `DATABASE_URL`              | `str` | `None`          | Postgres connection string (requires `asyncpg` dialect).                     |
| `DB_SCHEMA`                 | `str` | `"evidence_kb"` | Database schema namespace where tables are registered.                       |
| `STORAGE_BACKEND`           | `str` | `"memory"`      | Backend type. If set to `"postgres"`, `/health` will verify DB connectivity. |
| `EMBEDDING_DIMENSIONS`      | `int` | `1536`          | Dimension length of the generated embedding vectors.                         |
| `EMBEDDING_SERVICE_URL`     | `str` | `None`          | HTTP endpoint URL of the embedding sidecar microservice.                     |
| `EMBEDDING_SERVICE_API_KEY` | `str` | `None`          | Optional bearer token/API key for the embedding sidecar.                     |
| `CHUNK_SIZE_CHARS`          | `int` | `1200`          | Target size of individual passage chunks (in characters).                    |
| `CHUNK_OVERLAP_CHARS`       | `int` | `160`           | overlap boundary length between consecutive chunks.                          |
| `RRF_K`                     | `int` | `60`            | Rank constant parameter used in the Reciprocal Rank Fusion algorithm.        |
| `DEFAULT_TOP_K`             | `int` | `12`            | Default number of passages to return in retrieval calls.                     |

---

## API Catalog Summary

Detailed endpoint documentation, full schemas, and constraints can be read in the [docs/reference.md](file:///var/www/grasp-next/services/evidence-kb/docs/reference.md) guide.

### System & Health Endpoints

- `GET /health`: Basic health state and database connection check.
- `GET /metadata`: Configured metadata parameters (dimensions, chunk size, etc.).

### Ingestion Endpoints

- `POST /v1/ingest/source`: Ingest raw text, markdown, HTML, or web pages.
- `POST /v1/ingest/pdf`: Ingest PDF sources via multipart form uploads.
- `GET /v1/ingest/runs/{run_id}`: Retrieve processing state and stats for a specific ingestion run.

### Search & Retrieval

- `POST /v1/retrieve`: Execute hybrid, BM25-only, or vector-only queries with filtering.

### Source & Passage Inspections

- `GET /v1/projects/{project_id}/sources`: List all sources ingested for a given project.
- `GET /v1/projects/{project_id}/sources/stale`: Retrieve sources flagged as needing review (e.g. non-certified, warnings present).
- `GET /v1/sources/{source_id}/passages`: Retrieve all chunks/passages associated with a specific source.
- `GET /v1/passages/{passage_id}`: Inspect a single passage record.
- `GET /v1/passages/weak`: Retrieve passages flagged with quality warnings or low scores.

### Curation & Export

- `POST /v1/curation/bulk`: Apply a batch list of curation actions (e.g., certify, reject, toggle retrieval).
- `POST /v1/curation/export`: Export filtered passage databases.

---

## Common Workflow Examples

### 1. Ingesting a Source

**Text Ingestion:**

```bash
curl -X POST http://localhost:8003/v1/ingest/source \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "default",
    "projectId": "8b9de121-72f5-46b5-9db4-a95726df9487",
    "externalSourceId": "6c4598d1-52f5-46b5-9db4-a95726df9480",
    "title": "Introduction to RAG",
    "sourceType": "text",
    "text": "Retrieval-Augmented Generation (RAG) is an AI framework for retrieving facts from an external knowledge base..."
  }'
```

**PDF Ingestion:**

```bash
curl -X POST http://localhost:8003/v1/ingest/pdf \
  -F "file=@/path/to/handbook.pdf" \
  -F "tenantId=default" \
  -F "projectId=8b9de121-72f5-46b5-9db4-a95726df9487" \
  -F "externalSourceId=7c4598d1-52f5-46b5-9db4-a95726df9481" \
  -F "title=Company Handbook"
```

### 2. Monitoring Ingestion

Check the run logs using the `ingestionRunId` returned during ingestion:

```bash
curl http://localhost:8003/v1/ingest/runs/3a8de121-72f5-46b5-9db4-a95726df948e
```

### 3. Retrieval Query

Perform a hybrid search over ingested passages:

```bash
curl -X POST http://localhost:8003/v1/retrieve \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "default",
    "projectId": "8b9de121-72f5-46b5-9db4-a95726df9487",
    "query": "What is RAG?",
    "topK": 5,
    "mode": "hybrid"
  }'
```

### 4. Curating Passages

Certify or reject passages, or toggle their retrieval status:

```bash
curl -X POST "http://localhost:8003/v1/curation/bulk?project_id=8b9de121-72f5-46b5-9db4-a95726df9487&tenant_id=default" \
  -H "Content-Type: application/json" \
  -d '{
    "actions": [
      {
        "type": "certify_passage",
        "passageId": "5c4598d1-52f5-46b5-9db4-a95726df9489"
      },
      {
        "type": "set_passage_retrieval_enabled",
        "passageId": "3b4598d1-52f5-46b5-9db4-a95726df948a",
        "enabled": false
      }
    ]
  }'
```

---

## Development & Utility Script

A unified helper script `./run` is available inside this directory for ease of running the service and performing common operations:

- **Interactive Selector**: Run `./run` without arguments to launch a keyboard-selectable menu.
- **Direct Command**: Run `./run <command>` to execute a specific operation directly.

### Available Commands:

- **Start the development server**:
  ```bash
  ./run dev
  ```
- **Run unit tests**:
  ```bash
  ./run test
  ```
- **Run integration tests** (requires running Postgres database):
  ```bash
  ./run test-integration
  ```
- **Check styling and lint errors**:
  ```bash
  ./run lint
  ```
- **Format Python code**:
  ```bash
  ./run format
  ```
- **Initialize database schema & indexes**:
  ```bash
  ./run db-init
  ```
- **Apply Alembic migrations**:
  ```bash
  ./run db-migrate
  ```

Alternatively, you can run the raw Python commands (e.g. `pytest`, `uvicorn`, `alembic`) directly inside your activated virtual environment. All terminal commands are automatically token-optimized under the hood.
