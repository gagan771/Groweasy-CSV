# GrowEasy CSV Importer

AI-powered CSV importer for GrowEasy CRM. Upload any CSV in any format — the AI maps it to the CRM schema automatically.

## Features

- **Drag & Drop** or file-picker CSV upload
- **Client-side preview** — CSV is parsed in the browser with no server calls until you confirm
- **Virtualized table** — handles CSVs with 100,000+ rows without lag
- **Streaming AI extraction** — results appear live as each batch completes (SSE)
- **Live progress bar** — shows batch-by-batch progress with running counts
- **Concurrent batch processing** — up to 3 AI batches run in parallel
- **Retry with exponential backoff** — 3 attempts per batch (1s, 2s delay)
- **Dark mode** — toggle persisted to localStorage, respects system preference
- **Skip logic** — rows without an email or mobile are skipped and explained
- **Full CRM schema** — all 15 fields including possession_time, description, crm_note

---

## Quick Start

```bash
# 1. Install dependencies (root, backend, frontend)
npm install

# 2. Configure environment
cp backend/.env.example backend/.env
# Edit backend/.env and set OPENROUTER_API_KEY=your_key_here

# 3. Start both servers
npm run dev
```

- **Backend** → `http://localhost:8000`
- **Frontend** → `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Server port |
| `OPENROUTER_API_KEY` | — | **Required.** Your OpenRouter API key |
| `OPENROUTER_MODEL` | `auto` | Model to use (e.g. `anthropic/claude-3-5-sonnet`) |
| `OPENROUTER_HTTP_REFERER` | `http://localhost:8000` | Referer header for OpenRouter |
| `OPENROUTER_APP_NAME` | `GrowEasy CSV Importer` | App name header |
| `CORS_ORIGIN` | `*` | Restrict to your frontend URL in production |
| `BATCH_SIZE` | `10` | Rows per AI batch |
| `UPLOAD_LIMIT_MB` | `10` | Max CSV upload size |

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Running Tests

```bash
cd backend
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # with v8 coverage report
```

**37 tests** across 3 suites:
- `csv.test.ts` — parseCsv, looksLikeEmail, looksLikeMobile, hasEmailOrMobile, chunkRows
- `lead-schema.test.ts` — Zod schema validation, enum defaults, normalizeLeadRecord
- `concurrency.test.ts` — runWithConcurrency ordering, error handling, concurrency cap

---

## Docker

```bash
# Start both services
OPENROUTER_API_KEY=your_key docker compose up --build

# Or set the key in a .env file at the project root:
# OPENROUTER_API_KEY=your_key
docker compose up --build
```

Services:
- `backend` at `http://localhost:8000`
- `frontend` at `http://localhost:3000`

The backend has a health check (`GET /health`) and the frontend waits for it before starting.

---

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/imports` | Upload CSV, returns JSON result |
| `POST` | `/api/imports/stream` | Upload CSV, returns SSE stream |

### `POST /api/imports` — JSON response

```json
{
  "imported": [{ "name": "...", "email": "...", "source_row_index": 0, ... }],
  "skipped":  [{ "source_row_index": 1, "reason": "..." }],
  "totals":   { "imported": 1, "skipped": 1, "processed": 2, "batches": 1 }
}
```

### `POST /api/imports/stream` — SSE events

| Event | Payload |
|---|---|
| `init` | `{ totalBatches, totalRows }` |
| `batch_start` | `{ batchNumber, totalBatches }` |
| `batch_done` | `{ batchNumber, totalBatches, imported[], skipped[] }` |
| `done` | Full import response (same shape as JSON endpoint) |
| `error` | `{ message }` |

---

## Architecture

```
Upload → Client-side parse (preview only) → Confirm
  → SSE stream opens
  → Backend re-parses CSV
  → Pre-filter: skip rows without email or mobile
  → Chunk into batches of 10
  → Run up to 3 batches concurrently (with 3-attempt exponential backoff)
  → Each batch_done event streams partial results to frontend
  → done event delivers final sorted result
  → Frontend renders results table
```

## Project Layout

```
/
├── backend/
│   ├── src/
│   │   ├── ai/client.ts          # OpenRouter AI extraction + retry
│   │   ├── domain/
│   │   │   ├── concurrency.ts    # runWithConcurrency utility
│   │   │   ├── csv.ts            # parseCsv, hasEmailOrMobile, chunkRows
│   │   │   └── lead-schema.ts    # Zod CRM schema + normalizeLeadRecord
│   │   ├── routes/
│   │   │   ├── imports.ts        # POST /api/imports (JSON)
│   │   │   └── imports-stream.ts # POST /api/imports/stream (SSE)
│   │   ├── app.ts
│   │   ├── config.ts
│   │   └── server.ts
│   └── src/__tests__/            # 37 unit tests (vitest)
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── layout.tsx        # Root layout with ThemeToggle
│       │   └── page.tsx          # 4-step orchestrator (streaming)
│       ├── components/
│       │   ├── UploadStep.tsx    # Drag & drop upload
│       │   ├── PreviewStep.tsx   # Virtualized preview table
│       │   ├── ProgressStep.tsx  # Live streaming progress
│       │   ├── ResultsStep.tsx   # Final results table
│       │   └── ThemeToggle.tsx   # Dark mode toggle
│       ├── lib/
│       │   ├── api.ts            # uploadCsv (non-streaming fallback)
│       │   ├── csv.ts            # Client-side CSV parser
│       │   └── stream.ts         # SSE consumer (Fetch + ReadableStream)
│       └── types/index.ts
├── docker-compose.yml
└── aim.md
```
