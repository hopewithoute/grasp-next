#!/bin/bash
set -e

# Helper function
commit_group() {
    local msg=$1
    shift
    if [ "$#" -gt 0 ]; then
        git add "$@" 2>/dev/null || true
        if ! git diff --cached --quiet; then
            git commit -m "$msg"
            echo "Committed: $msg"
        fi
    fi
}

# Group 1: Agent & IDE Configuration
commit_group "chore: update agent and IDE configurations" .agents/ skills-lock.json .antigravitycli/ .kiro/ .env.example

# Group 2: Dependencies and Package Setup
commit_group "chore: update package dependencies and next config" pnpm-lock.yaml packages/ai/package.json apps/web/package.json apps/web/next.config.ts

# Group 3: Database schema updates and migrations
commit_group "feat(db): update schema and add migrations for knowledgebase" packages/db/src/schema.ts packages/db/migrations/

# Group 4: Knowledgebase & Domain Models (db, domain)
commit_group "feat(domain): implement knowledgebase and artifact domain models" packages/domain/src/knowledgebase/ packages/domain/src/artifacts/ packages/domain/src/constants.ts packages/domain/src/env.ts packages/domain/src/ingestion/ packages/domain/src/projects/ packages/db/src/knowledgebase-repository.ts packages/db/src/knowledgebase-repository.test.ts packages/db/src/index.ts

# Group 5: AI Engine - Core & Embeddings
commit_group "feat(ai): setup core embeddings and mastra gateway" packages/ai/src/embeddings.ts packages/ai/src/embeddings.test.ts packages/ai/src/load-env.ts packages/ai/src/mastra/ packages/ai/src/model-resolver.ts packages/ai/src/model-resolver.test.ts packages/ai/src/index.ts

# Group 6: AI Engine - Ingestion Workflow
commit_group "feat(ai): implement ingestion and source linking workflow" packages/ai/src/ingestion/

# Group 7: AI Engine - Refinement Workflow
commit_group "feat(ai): implement concept refinement agent" packages/ai/src/refinement/

# Group 8: Backend services (Web Server API)
commit_group "feat(web/server): implement ingestion runner and refinement chat streams" apps/web/server/ apps/web/app/api/v1/projects/ apps/web/lib/ui-message-stream.ts

# Group 9: Web UI - Shared Components, Layout, Theme
commit_group "feat(web/ui): update global styles, layout and theme provider" apps/web/app/globals.css apps/web/app/layout.tsx apps/web/components/theme-provider.tsx

# Group 10: Web UI - Auth & Home
commit_group "feat(web/auth): update landing page and authentication UI" apps/web/app/page.tsx apps/web/features/home/ apps/web/app/sign-in/ apps/web/features/auth/

# Group 11: Web UI - Dashboard & Navigation
commit_group "feat(web/dashboard): update dashboard layout and sidebar viewer" apps/web/app/dashboard/ apps/web/features/dashboard/

# Group 12: Web UI - Projects Feature
commit_group "feat(web/projects): update project concept graph, workspace, and lifecycle forms" apps/web/features/projects/

# Group 13: Documentation & Utilities
commit_group "docs: add architecture slides and design decisions" docs/ apps/web/test-usechat.js apps/web/server/graph-walk-real.integration.test.ts

# Any remaining files
git add .
if ! git diff --cached --quiet; then
    git commit -m "chore: miscellaneous updates and untracked files"
    echo "Committed miscellaneous updates"
fi

echo "All changes committed."
