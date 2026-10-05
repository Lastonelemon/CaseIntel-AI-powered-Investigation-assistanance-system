# CaseIntel

CaseIntel is a local-first, AI-assisted cybercrime investigation workspace. It supports authenticated access, persistent complaint records, CSV ingestion with source-field preservation, case triage, multi-case correlation, inspector workload management, reports and database-grounded AI questions.

AI output is an investigative recommendation. Inspectors review and make all decisions; CaseIntel never assigns an inspector automatically.

## Requirements

- Node.js 22.13 or later (the server uses Node's built-in SQLite module)
- pnpm 9 or later, or npm
- A Gemini API key for AI analysis and assistant responses
- The Kaggle CSV to populate case records

## Run locally

1. Copy `.env.example` to `.env` and set `GEMINI_API_KEY`. The project includes a private local `.env` for this workspace; keep it out of source control.
2. Install packages with `pnpm install` (or `npm install`).
3. Start the API and Vite development server with `pnpm dev`.
4. Open `http://127.0.0.1:5173`.
5. Sign in with username `Team-2` and password `rpnss@25mei`.
6. Open **Settings → Dataset import** and select the Kaggle CSV.
7. Open **Case Correlation**, select 3–15 cases, review the suggested patterns and choose an inspector to assign the reviewed cases together.

For a production-style local build, run `pnpm build`, then `pnpm start`. The API serves the built React app at `http://127.0.0.1:5174`.

The server listens on loopback by default. Set `PORT` to change the API port. For local-only use, do not expose the server port to an untrusted network.

## CSV import and field mapping

The CSV is parsed from its actual first row; CaseIntel does not require a predefined Kaggle schema. Every header and row value is retained in each case's `source_data` JSON. Blank CSV cells are stored as `null` in that JSON. Mappable fields are also copied to indexed columns for search and summaries:

| CaseIntel field | Header patterns used when present |
| --- | --- |
| `external_id` | `case id`, `complaint number`, `report number`, `reference` |
| `summary` | `complaint`, `description`, `narrative`, `incident`, `details`, `message`, `remarks`, `summary`, `subject` |
| `category` | `category`, `crime type`, `offense/offence`, `classification`, `issue type` |
| `reported_at` | `date`, `time`, `reported`, `created`, `filed`, `timestamp` |
| `location` | `location`, `city`, `district`, `state`, `country`, `address`, `region`, `place` |
| `status` | `status`, `state`, `resolution`, `disposition` |
| `urgency` | `urgency`, `priority`, `severity`, `risk level` |
| source assignee | `inspector`, `assigned to`, `officer`, `investigator` |

The mapping is heuristic and intentionally conservative. Unmapped information remains in the original source data and is shown on the case detail page. When a date is clearly ISO-formatted or uses an unambiguous written month, the indexed date is normalized for sorting; the original date string remains in `source_data`. If no case reference field exists, CaseIntel assigns an internal `CASE-000001` style key; it does not alter the source values. Re-importing the exact same CSV bytes is idempotent. Distinct files may contain repeated source rows, which remain distinct records.

An import is wrapped in a SQLite transaction. CSV files are limited to 8 MB. The first detected header set is shown in Settings and used to adapt the new-case form. Additional fields can be entered on that form.

## Architecture

- **Client:** React 19, Vite, Recharts and Lucide icons; responsive dark SOC workspace.
- **Server:** Node.js with Express REST endpoints.
- **Database:** SQLite via Node's built-in `node:sqlite`. The database file defaults to `data/caseintel.sqlite` and is not tracked by Git.
- **Gemini:** `@google/genai` is called only by the server. Set `GEMINI_API_KEY` and optionally `GEMINI_MODEL`; the model default in the sample config is `gemini-3.8-flash`.
- **Authentication:** demo credentials come from environment configuration. Password checks use scrypt and do not store the password in the database. Sessions are random opaque tokens stored as hashes in SQLite and delivered using an HttpOnly, SameSite cookie.

The client never receives the Gemini API key. A Gemini failure after case submission does not roll back the case. The case remains in SQLite and exposes a retry action.

## Database schema

- `cases`: internal key, optional source ID, mapped filter columns, source-assignee name, complete original `source_data` JSON, AI status/result, timestamps and optional inspector assignment.
- `inspectors`: investigator name, specialization and availability.
- `timeline`: case-created, analysis-completed and investigator assignment/status events.
- `correlation_runs`: selected case IDs, validated multi-case analysis result and reviewer metadata.
- `imports`: CSV file hash and import summary, used to prevent accidental duplicate imports of the same file.
- `app_meta`: detected source header list.
- `sessions`: hashed session token and expiration time.

Indexes cover case key, category, urgency, status, report date and import fingerprint. The case model keeps dataset-specific fields in JSON while preserving indexed columns for common application queries.

## Gemini analysis and inspector recommendation

Case analysis asks Gemini for schema-constrained JSON containing category, urgency, a 0–100 score, rationale, suggested inspector type, next-step suggestions, keywords, candidate related case IDs and confidence. The server validates and bounds the returned values and filters related IDs to the candidate set it supplied. Complaint contents are treated as untrusted evidence, not instructions.

Related-case candidates are selected from existing records and limited before they are sent to Gemini. The model can report an investigative lead, shared keywords/entities, pattern overlap and possible common locations. CaseIntel labels these as unconfirmed leads.

Inspector recommendation combines Gemini's suggested specialty with roster specialization, availability and current assigned workload. It is displayed for review only. An investigator must explicitly assign or reassign the case.

## Multi-case correlation

The **Case Correlation** workspace accepts 3–15 selected cases per review. It sends only that selected group to the server-side Gemini service, validates returned case IDs against the selection, and saves the result and selected case IDs in `correlation_runs`. Original case records remain in `cases`. Results show potential shared patterns, evidence fields, confidence and suggested investigative steps. If the model finds no well-supported relationship, the result can contain no groups. Each selected case gets a timeline entry.

The inspector suggestion considers the suggested specialty, roster availability and workload. It does not assign anyone automatically. The investigator chooses an inspector and presses **Assign cases** to assign every case included in that review. The bulk change is transactional, clears any prior source-assignee label, updates workload counts and adds a timeline event to each case.

For a real cybercrime-oriented source, the FBI's Crime Data Explorer offers downloadable NIBRS datasets for 2020 onward. The FBI's 2024 cybercrime report counted 155,698 reported cyberspace incidents. These are structured law-enforcement statistics rather than narrative complaint records; inspect the selected download's columns before importing it. [FBI NIBRS dataset catalog](https://catalog.data.gov/dataset/national-incident-based-reporting-system-nibrs) · [FBI Reported Crimes in Cyberspace, NIBRS 2024](https://cde.ucr.cjis.gov/LATEST/resources/reports/Reported_Crimes_in_Cyberspace_NIBRS_2024.pdf).

For a larger individual-complaint source, the FCC's CGB complaints dataset provides a CSV with 1.8 million consumer complaints, primarily about unwanted calls. The FCC says complainant allegations are not verified, and this dataset is adjacent to fraud/robocalls rather than a cybercrime-case registry. [FCC dataset details and CSV](https://catalog.data.gov/dataset/cgb-consumer-complaints-data).

The chat endpoint uses controlled database retrieval and precomputed case aggregates. It sends at most 12 relevant case records, plus compact category/urgency/status/month metrics and inspector workloads. Gemini cannot execute SQL. The response includes source case IDs when relevant. Cases outside the recent search window may not be available to a free-form chat query; use the Cases filters for exhaustive review.

## REST API

Except for login and health checks, API routes require a valid session cookie.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API status and whether Gemini is configured |
| `POST` | `/api/auth/login` | Create authenticated session |
| `GET` | `/api/auth/session` | Current user |
| `POST` | `/api/auth/logout` | End current session |
| `GET` | `/api/meta` | Source columns, categories, statuses, inspectors and setup state |
| `POST` | `/api/import` | Import CSV text and preserve source headers/values |
| `GET` | `/api/dashboard` | Database-derived overview and chart data |
| `GET` | `/api/cases` | Paginated, filtered, sorted case list |
| `POST` | `/api/cases` | Persist new case, then attempt Gemini analysis |
| `GET` | `/api/cases/:id` | Case fields, AI result, assignment and timeline |
| `POST` | `/api/cases/:id/analyze` | Run or retry AI analysis |
| `POST` | `/api/cases/:id/assign` | Set or clear inspector assignment |
| `POST` | `/api/cases/bulk-assign` | Assign a reviewed group of cases to one inspector |
| `POST` | `/api/correlations` | Analyze 3–15 selected cases and save a correlation run |
| `GET` | `/api/correlations` | List recent saved reviews |
| `GET` | `/api/correlations/:id` | Load a saved review and its current case records |
| `PATCH` | `/api/cases/:id/status` | Update case status |
| `GET` | `/api/inspectors` | Inspector roster and workload |
| `POST` | `/api/inspectors` | Add an inspector |
| `POST` | `/api/chat` | Ask Gemini using bounded database context |
| `GET` | `/api/reports.csv` | Download a database-backed CSV report |

## Known limitations

- The Kaggle CSV was not included with the build brief in this workspace. CaseIntel is ready to import it, but the actual dataset still needs to be selected in Settings.
- Public dataset sources were researched, but their records have not been imported. Review the source's schema and coverage before choosing an import; the FBI NIBRS source is structured crime statistics, while the FCC source is individual consumer-reported unwanted-call complaints.
- Header mapping uses name patterns; review Settings after import to confirm the detected columns match the dataset's intended meanings.
- Native SQLite requires the Node version listed above.
- Inspector profiles are managed in the app; the dataset is not assumed to contain inspector specialization or availability.
- Gemini answers and analysis depend on API availability, configured quota, model availability and network access. Cases persist if these are unavailable.
- Chat retrieval is bounded for privacy and speed; it is not a substitute for exhaustive case filtering or record review.
- This demo uses a single-team credential and local storage. It is not a substitute for production identity management, encryption-at-rest policy or organizational case-data controls.
