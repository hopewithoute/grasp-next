# 🧠 Grasp

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)]()
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)]()
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)]()
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat-square&logo=turborepo&logoColor=white)]()

> An adaptive learning studio built around project-based authoring, evidence-backed source ingestion, and concept graph workflows.

Grasp is an open-source platform designed to intelligently map and process knowledge. By leveraging Graph RAG (Retrieval-Augmented Generation) and intelligent concept extraction, Grasp allows users to ingest source materials, construct visual knowledge graphs, and build highly adaptive learning pathways.

---

## ✨ Key Features

- **📚 Evidence-Backed Ingestion**: Automatically process and chunk markdown, text, and web sources into high-quality passage embeddings.
- **🕸️ Concept Graph Workflows**: Generate topic and concept graphs from raw knowledge, allowing learners and authors to visualize and explore complex relationships.
- **⚡ High-Performance Architecture**: Powered by a robust Next.js frontend, highly modular Turborepo architecture, and a Python FastAPI backend for heavy AI/ML ingestion workloads.
- **🔍 Advanced Retrieval & Curation**: Native support for evidence retrieval, transparent curation controls, and local embedding sidecars.
- **🛠️ Project-Based Authoring**: Organize learning materials and context into distinct projects with isolated knowledge bases.

## 🏗️ Architecture & Repo Shape

Grasp is structured as a modern monorepo using `pnpm` workspaces and Turborepo:

- 🌐 `apps/web`: Next.js application for project authoring, concept graph workspace, evidence explorer, and review flows.
- 📦 `packages/domain`: Domain actions and cross-app business logic.
- 🤖 `packages/ai`: AI-facing tools and refinement integrations used by the web app.
- 💾 `packages/db`: Database repositories and persistence layer for app/domain concerns.
- 🐍 `services/evidence-kb`: Python FastAPI service for ingestion, passage storage, retrieval, curation, and topic graph generation.
- 🚀 `services/embedding-sidecar`: Local embedding runtime used by `evidence-kb` when OpenAI-compatible embeddings are needed.

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (compatible with `pnpm@10.33.0`)
- [pnpm](https://pnpm.io/)
- Python `3.14+` (for `services/evidence-kb`)
- PostgreSQL database

### 1. Installation

Install the workspace dependencies:

```bash
pnpm install
```

### 2. Environment Setup

Copy the example environment variables and configure them:

```bash
cp .env.example .env
```
*(Make sure to update `DATABASE_URL` and your AI Provider API keys in `.env`)*

### 3. Start the Development Server

Start the entire monorepo development loop:

```bash
pnpm dev
```

## 🛠️ Common Commands

From the root of the monorepo, you can orchestrate tasks across all apps and packages:

```bash
pnpm build      # Build all apps and packages
pnpm lint       # Run ESLint checks
pnpm test       # Run Vitest test suites
pnpm typecheck  # Run static TypeScript analysis
```

## 🧠 Working with `evidence-kb` (Python Backend)

The Python ingestion service has its own dedicated local runner for convenience.

```bash
cd services/evidence-kb

# Run the FastAPI dev server
./run dev

# Run Python tests
./run test
./run test-integration

# Manage DB migrations
./run db-migrate
```
*For deeper documentation on the backend API, see [services/evidence-kb/README.md](./services/evidence-kb/README.md).*
