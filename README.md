# GrowEasy CSV Importer

GrowEasy CSV Importer is a full-stack app that accepts **arbitrary CSV files** and converts them into a standardized GrowEasy CRM lead format using an LLM.

## Project overview

The app is built as a monorepo with:

- **Frontend (Next.js + React + TypeScript):** upload, preview, live progress, and final results UI.
- **Backend (Express + TypeScript):** CSV parsing, row filtering, batch AI extraction, validation, and response streaming.

## Architecture

```text
CSV Upload
  -> Frontend parses CSV for preview only (no AI call yet)
  -> User confirms import
  -> Backend parses CSV again
  -> Contact detection ignores owner/assignee fields (e.g. Assigned To)
  -> Skip rows missing both lead email and lead mobile
  -> Split rows into batches
  -> Send batches to AI with concurrency + retry
  -> Validate/normalize records against CRM schema
  -> Apply semantic fallback mapping (Business->company, Location->city, Region->state, Nation->country)
  -> Keep owner-assignment values in lead_owner only (never in lead email/mobile)
  -> Return:
       - JSON response (/api/imports), or
       - live SSE events (/api/imports/stream)
  -> Frontend renders imported + skipped records
```

## Tech stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| UI/Data handling | `react-dropzone`, `papaparse`, `@tanstack/react-table`, `@tanstack/react-virtual` |
| Backend | Node.js, Express, TypeScript |
| Backend libraries | `multer` (upload), `papaparse` (CSV parse), `zod` (schema validation), `cors`, `dotenv` |
| AI integration | OpenRouter Chat Completions API (configurable model) |
| Testing | Vitest (backend unit tests) |
| Containers | Dockerfiles for backend and frontend |

## Key features

- Drag-and-drop CSV upload
- Client-side preview before import
- Streaming extraction progress (SSE)
- Concurrent AI batch processing
- Retry with exponential backoff for AI requests
- Strict CRM enum enforcement via schema validation
- Semantic header mapping fallback for common aliases (Business/Location/Region/Nation, etc.)
- Owner-email leakage guard (`Assigned To` / `Lead Owner` values are not treated as lead contact)
- Skip tracking for invalid rows
- Contact-presence check excludes owner/assignee columns before skip/import decision
- `created_at` accepts empty when source date is unavailable (instead of fixed placeholder dates)
- Export imported/skipped records from UI
- Dark mode support

## Repository structure

```text
.
├── backend/
│   ├── src/
│   │   ├── ai/client.ts
│   │   ├── domain/
│   │   │   ├── csv.ts
│   │   │   ├── lead-schema.ts
│   │   │   └── concurrency.ts
│   │   ├── routes/
│   │   │   ├── imports.ts
│   │   │   └── imports-stream.ts
│   │   ├── app.ts
│   │   ├── config.ts
│   │   └── server.ts
│   └── src/__tests__/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   └── ...
├── aim.md
└── package.json
```

## Local development

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Backend (`backend/.env`):

```env
PORT=8000
CORS_ORIGIN=*
UPLOAD_LIMIT_MB=10
BATCH_SIZE=10
AI_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=auto
OPENROUTER_HTTP_REFERER=http://localhost:8000
OPENROUTER_APP_NAME=GrowEasy CSV Importer
```

Frontend (`frontend/.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3) Run app

```bash
npm run dev
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/api/imports` | Import CSV and return final JSON |
| POST | `/api/imports/stream` | Import CSV and stream progress/results with SSE |

## Scripts

Root:

- `npm run dev` - run frontend + backend together
- `npm run dev:frontend` - run frontend only
- `npm run dev:backend` - run backend only
- `npm run build` - build backend and frontend

Backend:

- `npm test`
- `npm run test:watch`
- `npm run test:coverage`

## Docker

This repo includes separate Dockerfiles:

- `backend/Dockerfile`
- `frontend/Dockerfile`

Build examples:

```bash
docker build -t groweasy-backend .\backend
docker build -t groweasy-frontend .\frontend
```

## DigitalOcean + Nginx deployment

This setup runs the backend on a private port and exposes it through Nginx with HTTPS.

### 1) Server prerequisites

```bash
sudo apt update
sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### 2) Clone and build

```bash
cd /var/www
git clone https://github.com/gagan771/Groweasy-CSV.git
cd Groweasy-CSV
npm install
cd backend
npm install
npm run build
```

### 3) Configure backend environment

Create `backend/.env`:

```env
PORT=8010
CORS_ORIGIN=https://groweasy-csv.vercel.app
UPLOAD_LIMIT_MB=10
BATCH_SIZE=10

AI_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=auto
OPENROUTER_HTTP_REFERER=https://api.zentrip.social
OPENROUTER_APP_NAME=GrowEasy CSV Importer
```

### 4) Start backend with PM2

```bash
cd /var/www/Groweasy-CSV/backend
pm2 start dist/server.js --name groweasy-backend
pm2 save
pm2 startup
```

Verify local health:

```bash
curl -i http://127.0.0.1:8010/health
```

### 5) Nginx reverse proxy

Create `/etc/nginx/sites-available/groweasy-api`:

```nginx
server {
    listen 80;
    server_name api.zentrip.social;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name api.zentrip.social;

    ssl_certificate /etc/letsencrypt/live/api.zentrip.social/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.zentrip.social/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

Enable and reload:

```bash
sudo ln -sf /etc/nginx/sites-available/groweasy-api /etc/nginx/sites-enabled/groweasy-api
sudo nginx -t
sudo systemctl reload nginx
```

### 6) TLS certificate (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.zentrip.social
```

Verify public health:

```bash
curl -i https://api.zentrip.social/health
```

### 7) Frontend (Vercel) environment

Set in Vercel project settings:

```env
NEXT_PUBLIC_API_URL=https://api.zentrip.social
```

After adding env vars, redeploy frontend. Next.js reads `NEXT_PUBLIC_*` values at build time.
