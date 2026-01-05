# AI Workflow Engine

A TypeScript monorepo for executing AI workflows with strict separation between API, engine, workers, and tools. LLM calls are isolated exclusively to background workers.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTP/REST (polling)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API SERVICE (Fastify)                           │
│   • Workflow CRUD    • Trigger runs    • Status polling                 │
│   • Request validation (Zod)    • Job enqueueing (producer only)        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ Enqueue jobs
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              ┌──────────┐   ┌──────────┐   ┌──────────┐
              │  Redis   │   │ Postgres │   │  Redis   │
              │ (BullMQ) │   │ (Prisma) │   │ (Cache)  │
              └────┬─────┘   └──────────┘   └──────────┘
                   │               ▲
                   ▼               │
┌─────────────────────────────────────────────────────────────────────────┐
│                        WORKER SERVICE (BullMQ)                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  WORKFLOW ORCHESTRATOR - Fetches definition, sequences steps    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  STEP EXECUTOR - Processes steps, handles retries via BullMQ   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  TOOLS LAYER - LLM | HTTP | Transform | Condition              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Workflow orchestration** with sequential step execution
- **Step-level retries** with exponential backoff via BullMQ
- **Tool system** with pluggable tools (HTTP, LLM, Transform, Condition)
- **Variable resolution** with template interpolation (`{{ input.name }}`, `{{ steps.step1.output }}`)
- **OpenAI-compatible LLM** support (LM Studio, Ollama, vLLM, etc.)
- **Type-safe** with Zod validation throughout

## Project Structure

```
ai-workflow-engine/
├── packages/
│   ├── api/          # Fastify REST API
│   ├── worker/       # BullMQ job processors
│   ├── engine/       # Orchestration logic
│   ├── tools/        # Tool implementations (LLM, HTTP, etc.)
│   ├── database/     # Prisma schema & client
│   ├── queue/        # BullMQ configuration
│   └── shared/       # Types, errors, logger
├── scripts/
│   └── test-workflow.ts  # E2E test script
└── docker/
    └── docker-compose.yml
```

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# Copy environment file
cp .env.example .env

# Push database schema
pnpm db:push

# Build all packages
pnpm build
```

### Running

```bash
# Start API server (port 3000)
pnpm dev:api

# Start worker (in another terminal)
pnpm dev:worker
```

### Testing

```bash
# Run unit tests
pnpm test

# Run e2e test (requires running API + worker)
pnpm test:e2e
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/workflows` | Create workflow |
| GET | `/workflows/:id` | Get workflow |
| PUT | `/workflows/:id` | Update workflow |
| DELETE | `/workflows/:id` | Delete workflow |
| POST | `/workflows/:id/steps` | Add step to workflow |
| POST | `/workflows/:id/runs` | Trigger workflow run |
| GET | `/runs/:id` | Get run status + steps |
| GET | `/tools` | List available tools |

## Example: Create and Run a Workflow

```bash
# 1. Create workflow
curl -X POST http://localhost:3000/workflows \
  -H "Content-Type: application/json" \
  -d '{"name": "My Workflow", "description": "Fetches data"}'

# 2. Activate workflow (use ID from response)
curl -X PUT http://localhost:3000/workflows/{id} \
  -H "Content-Type: application/json" \
  -d '{"status": "ACTIVE"}'

# 3. Add HTTP step
curl -X POST http://localhost:3000/workflows/{id}/steps \
  -H "Content-Type: application/json" \
  -d '{
    "name": "fetch-data",
    "type": "HTTP",
    "toolName": "http-fetch",
    "config": {},
    "order": 1,
    "inputMapping": {
      "url": "https://jsonplaceholder.typicode.com/posts/1",
      "method": "GET"
    }
  }'

# 4. Trigger run
curl -X POST http://localhost:3000/workflows/{id}/runs \
  -H "Content-Type: application/json" \
  -d '{}'

# 5. Check status (use run ID from response)
curl http://localhost:3000/runs/{runId}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `http-fetch` | Make HTTP requests (GET, POST, PUT, DELETE) |
| `llm-chat` | Chat completion via OpenAI-compatible API |
| `transform` | Transform data with JSONPath-like expressions |
| `condition` | Conditional branching based on expressions |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `API_HOST` | `0.0.0.0` | API server host |
| `API_PORT` | `3000` | API server port |
| `LLM_BASE_URL` | `http://localhost:1234/v1` | OpenAI-compatible API URL |
| `LLM_API_KEY` | `lm-studio` | API key for LLM service |
| `LLM_MODEL` | `local-model` | Model name to use |

## Package Dependencies

| Package | Imports | Purpose |
|---------|---------|---------|
| `@workflow/api` | shared, database, queue | HTTP endpoints, job producer |
| `@workflow/worker` | shared, database, queue, engine, tools | Job consumer |
| `@workflow/engine` | shared, database | Orchestration logic |
| `@workflow/tools` | shared | Tool implementations |
| `@workflow/database` | shared | Prisma client |
| `@workflow/queue` | shared | BullMQ queues |
| `@workflow/shared` | (none) | Types, errors, logger |

**Note**: `@workflow/tools` is only imported by `@workflow/worker` to enforce LLM isolation from the API.

## License

MIT
