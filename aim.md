# AI-Powered CSV Importer — Assignment Brief

## Overview
Build an AI-powered CSV Importer that intelligently extracts CRM lead information from **any valid CSV format** — regardless of column names, layout, or structure — and converts it into the GrowEasy CRM format.

The core challenge is **not** parsing CSVs. It's building a system that can accurately map arbitrary, inconsistent column structures (Facebook Lead Exports, Google Ads Exports, Excel sheets, Real Estate CRM exports, sales reports, agency CSVs, manual spreadsheets) into a single standardized schema using AI.

---

## Functional Requirements

### Frontend

**Step 1 — Upload CSV**
- Accept valid CSV uploads via drag & drop and/or file picker.

**Step 2 — Preview**
- Parse the CSV **client-side only** — no AI processing at this stage.
- Show a preview of uploaded rows in a responsive table with:
  - Horizontal scrolling
  - Vertical scrolling
  - Sticky headers (preferred)
  - Responsive design

**Step 3 — Confirm Import**
- A "Confirm" button triggers the backend API call.
- No backend/AI call should happen before this step.

**Step 4 — Display Parsed Result**
- Show the backend's AI-extracted CRM records in a second responsive table.
- Display:
  - Successfully parsed records
  - Skipped records (if any)
  - Total imported count
  - Total skipped count

### Backend

1. **Accept CSV Upload** — any valid CSV, column names not assumed fixed.
2. **Parse CSV** — convert rows into structured records.
3. **AI Extraction** — send records to an LLM (OpenAI, Gemini, Claude, or equivalent) in **batches**; AI maps available fields into GrowEasy CRM format.
4. **Return Structured JSON** — extracted CRM records returned as JSON.

---

## CRM Target Schema

| Field | Description |
|---|---|
| `created_at` | Lead creation date |
| `name` | Lead name |
| `email` | Primary email |
| `country_code` | Country code |
| `mobile_without_country_code` | Mobile number |
| `company` | Company name |
| `city` | City |
| `state` | State |
| `country` | Country |
| `lead_owner` | Lead owner |
| `crm_status` | Lead status (enum) |
| `crm_note` | Notes/remarks |
| `data_source` | Source (enum) |
| `possession_time` | Property possession time |
| `description` | Additional description |

### Sample Record
```csv
created_at,name,email,country_code,mobile_without_country_code,company,city,state,country,lead_owner,crm_status,crm_note,data_source,possession_time,description
2026-05-13 14:20:48,John Doe,john.doe@example.com,+91,9876543210,GrowEasy,Mumbai,Maharashtra,India,test@gmail.com,GOOD_LEAD_FOLLOW_UP,Client is asking to reschedule demo,,,
```

---

## AI Extraction Rules

1. **Allowed `crm_status` values (enum, strict):**
   - `GOOD_LEAD_FOLLOW_UP`
   - `DID_NOT_CONNECT`
   - `BAD_LEAD`
   - `SALE_DONE`

2. **Allowed `data_source` values (enum, strict):**
   - `leads_on_demand`
   - `meridian_tower`
   - `eden_park`
   - `varah_swamy`
   - `sarjapur_plots`
   - If no confident match → leave blank.

3. **`created_at` format** — must be parseable by JavaScript's `new Date(created_at)`.

4. **`crm_note` usage** — catch-all for: remarks, follow-up notes, extra comments, extra phone numbers, extra email addresses, and any other info that doesn't map to a dedicated field.

5. **Multiple emails/phones**
   - Use the **first** email/mobile found for the dedicated field.
   - Append any additional emails/numbers into `crm_note`.

6. **CSV integrity**
   - Each record stays a single row.
   - No unintended line breaks; escape any necessary breaks (e.g. `\n`).

7. **Skip logic**
   - Skip any record missing **both** an email and a mobile number.

---

## Bonus Points

Additional credit for implementing:

- Drag & Drop upload
- Progress indicators during AI processing
- Streaming or incremental parsing
- Retry mechanism for failed AI batches
- Virtualized table for large CSVs
- Dark mode
- Unit tests
- Docker setup
- Deployment (Vercel, Railway, Render, or similar)
- Well-written README with setup instructions

---

## Evaluation Criteria

| Category | What's Assessed |
|---|---|
| **AI Prompt Engineering** | Field extraction accuracy, intelligent mapping, handling messy/ambiguous data |
| **Backend Quality** | API design, clean architecture, error handling, batch processing, maintainability |
| **Frontend Quality** | Modern UI, responsive layout, clean UX, preview experience, loading states, error handling |
| **Code Quality** | Readability, type safety, folder structure, reusability, best practices |
| **Overall Engineering** | Performance, edge-case handling, production readiness |

---

## Suggested Architecture (Reference)

**Frontend:** React + TypeScript + Vite, `react-dropzone` (upload), `papaparse` (client-side CSV parsing for preview), `@tanstack/react-table` (preview & result tables).

**Backend:** Node.js + Express + TypeScript, `multer` (upload handling), `csv-parse`/Papaparse (server-side parsing), batching + concurrency-limited AI calls, `zod` for response validation.

**AI Integration:** Claude API with **forced tool use** (`tool_choice` set to a schema-defined extraction tool) so responses are structurally guaranteed to match the CRM schema instead of relying on free-text JSON parsing.

**Flow:**
```
Upload → Client-side parse (preview only) → Confirm →
Backend re-parses → Batches rows → AI extraction (per batch) →
Validate (zod) → Aggregate → Return { imported, skipped, totals } →
Frontend renders result table
```