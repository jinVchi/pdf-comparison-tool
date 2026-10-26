# 差分 sabun

A Japanese-first PDF comparison workspace built with **React + TypeScript + CSS**, **Spring Boot**, **Spring Security**, **Spring Data JPA**, **RabbitMQ**, and **PostgreSQL**.

Drop two PDFs, compare text and appearance, then inspect highlighted changes against the original pages. Built for estimates, application forms, contracts, and dense business documents.

## Run with Docker

Requires Docker Desktop with Linux containers. From the repository root:

```powershell
docker compose up --build -d
```

Open **http://localhost:3000**. The home page contains the login form; use **新規登録** to create an account. After signing in, click **サンプルPDFで試す** to submit two real Japanese estimates through RabbitMQ. Initial images and Maven dependencies may take several minutes to download.

```powershell
docker compose logs -f api
docker compose stop
```

PostgreSQL, RabbitMQ, and PDF storage use persistent Docker volumes. Stopping containers preserves data. Files and completed job records expire after 24 hours.

| Service | Local address |
| --- | --- |
| React / Nginx | http://localhost:3000 |
| Spring Boot API | http://localhost:8080/api/session |
| RabbitMQ management | http://localhost:15672 |
| PostgreSQL | localhost:5432, database `sabun` |

Development database and RabbitMQ credentials are `sabun` / `sabun-local`. These defaults are for local use. Ports bind only to loopback.

## Develop locally

Requires Node.js 22.12+ (Node 24 recommended), JDK 21+, Maven 3.9+, and Docker Desktop.

```powershell
docker compose up -d postgres rabbitmq
npm ci
```

Run the backend in one terminal:

```powershell
cd backend
mvn spring-boot:run
```

Run the frontend in another terminal, from the root:

```powershell
npm run dev
```

Open http://127.0.0.1:5173. Vite forwards `/api` to Spring Boot on port 8080. Use one hostname consistently; browser sessions for `localhost` and `127.0.0.1` are separate.

For development without infrastructure:

```powershell
cd backend
mvn spring-boot:run '-Dspring-boot.run.profiles=dev'
```

The **dev** profile explicitly uses file-backed H2 and a bounded, two-thread local dispatcher. The default profile uses PostgreSQL and RabbitMQ. It never silently falls back. Development data is separate from Docker volumes.

The demo generator uses a Japanese TrueType font. Windows automatically uses `C:/Windows/Fonts/msgothic.ttc`; the runtime Docker image includes IPA Gothic. On another local OS, set `JAPANESE_FONT` to a Japanese `.ttf` or TrueType `.ttc`. This is only necessary for generating sample documents; uploaded PDFs use their embedded fonts when available.

## Features

- Two drag-and-drop zones, file picker, two-file drop, and original/revised swap.
- File header validation, 25 MB per document, at most 60 pages per document, and page dimension limits.
- Japanese Unicode extraction and position-based highlights using Apache PDFBox.
- Numerical changes have a separate `NUMERIC` / 数値変更 category, actual before/after values, and CSV export. Image-only pages use local Tesseract OCR for printed numbers in combined/text mode.
- Text, appearance, and combined comparison modes.
- Optional whitespace ignoring and opt-in Unicode NFKC normalization for full/half-width forms.
- Table-like text runs split at large character gaps to keep changes near their field.
- Visual detection for stamps, graphics, rules, scans, and moved text.
- Durable database job records, RabbitMQ workers, progress polling, and idempotent atomic job claims.
- Side-by-side and opacity-controlled overlay views, zoom, page selection, and a filterable change list.
- UTF-8 BOM CSV reports, with spreadsheet formula escaping.
- Login home page with email/password registration and sign-in/sign-out. Authentication is required for the comparison workspace and all document APIs.
- Account-private history across browsers, manual deletion, and 24-hour expiry of comparison files/results.
- Spring Security CSRF protection, HttpOnly session cookies, ownership checks on every document endpoint, and same-origin frontend/API access.
- Japanese sample documents, loading/error/empty states, keyboard-accessible controls, responsive layouts, and reduced-motion support.

## How comparison works

1. The API validates both documents and stores them in a UUID-named directory, then persists a `QUEUED` job.
2. A database-backed dispatch loop publishes pending job IDs to durable `sabun.compare`. Jobs not claimed after 60 seconds are republished, covering publish failures and missed deliveries.
3. Two RabbitMQ consumers, each with prefetch 1, atomically claim a job. Duplicate messages cannot run the same queued job twice.
4. PDFBox extracts positioned text spans and renders previews at 108 DPI. A Myers sequence diff detects changed/added/deleted text runs. Matching text moved more than a small positional tolerance is an appearance change.
5. On image-only pages, local Tesseract recognizes changed printed-number regions. Full-page scans retain their original pixels to avoid degrading low-resolution digits. Repeated digit shapes in the same page/font provide a cross-check when all ten digits have repeated examples. OCR does not consult sample generators, answer keys, expected amounts, or accounting formulas. Recognized changes become `NUMERIC` values with normalized boxes. Unrecognized regions stay eligible for image comparison.
6. For appearance changes, the engine samples rendered pixels, thresholds color differences, and groups adjacent changed tiles into regions. Combined mode masks text areas and recognized numerical changes to avoid duplicate text/pixel highlights. Unclassified image changes are labeled 画像上の差分 rather than claiming that the layout moved.
7. Results and normalized coordinates are stored in PostgreSQL. The browser draws highlights over page PNGs without uploading documents to an external comparison service.

The fixed consumer count and prefetch bound concurrent PDF work; queued work stays in the database/broker. Three jobs per workspace may be active simultaneously. A worker interrupted for more than 15 minutes is marked failed rather than running indefinitely.

## Accuracy and deployment boundaries

- **OCR supports printed numbers, not Japanese prose or handwriting.** It runs locally for image-only pages in combined/text mode; appearance-only mode deliberately compares pixels. OCR can misread low-resolution or unusual fonts, and recognition is not a guarantee of numerical correctness. Review values against the page images. Unrecognized regions remain image differences in combined mode. Different scan sizes, rotations, and unsupported dense/large pages can fall back to visual comparison with a warning.
- Docker includes Tesseract and its English numeral model. For local Java development, install Tesseract and put it on `PATH` or set `TESSERACT_COMMAND` to its executable. Missing/disabled/timed-out OCR produces an explicit warning and preserves image differences in combined mode. Each OCR process is limited to 45 seconds, 250 changed regions per page, and four million input pixels; temporary crops are removed after recognition.
- Existing saved comparison results retain their original classifications. Submit a new comparison after upgrading to apply numerical recognition.
- Pages are paired by **page number**. Mid-document insertions, page reordering, skew, and scan registration are not automatically aligned.
- Text extraction depends on the PDF's Unicode mappings. Vertical writing, unusual fonts, and ambiguous reading order can produce imperfect text grouping. Inspect appearance mode for these documents.
- Visual comparison uses sampled pixels and tiles. It is a review aid, not a guarantee that every sub-pixel mark will be found. Different renderings/scanner noise may produce extra differences.
- Accounts are persisted in PostgreSQL (file-backed H2 in dev). Sessions expire after eight hours or an API restart; signing in again restores the account's unexpired history. Sign-out invalidates the session and returns to the login home page. The app waits for session validation before rendering any workspace and clears the workspace when protected API access expires. It also checks for account changes when the tab regains focus or becomes visible.
- Anonymous clients may only bootstrap a CSRF token (`GET /api/session`), check health (`GET /api/health`), or submit sign-in/sign-up requests. All other `/api/**` routes require authentication, including uploads, demos, history, PNG previews, CSV exports, deletion, and sign-out. Anonymous document requests return JSON HTTP 401; writes without valid CSRF return HTTP 403. No new guest workspaces are created. Unexpired guest history left by older versions is transferred on the next registration/sign-in from that same session.
- Passwords use BCrypt (cost 12), require at least 12 characters, and are limited to 72 UTF-8 bytes. Email addresses are trimmed and case-normalized, with a database uniqueness constraint. Session IDs and CSRF tokens rotate at sign-in/registration; every auth mutation requires CSRF. No passwords or bearer tokens are stored in browser storage. Email verification and password recovery are not included.
- Authentication has bounded, in-memory per-remote-address limits: 5 registration attempts and 20 sign-in attempts per 15 minutes. Limits reset on API restart and are not distributed. Behind the bundled Nginx proxy, clients share the proxy's address and quota; add client-aware perimeter limits for public deployment.
- This is a runnable local MVP. Internet deployment needs HTTPS (`COOKIE_SECURE=true`), real secrets, perimeter upload/auth rate limits and capacity admission, monitoring, and a reviewed retention policy.
- API and workers currently run together in one Spring Boot service and use local PDF storage. Multiple replicas require shared file storage and shared sessions/sticky sessions; the per-session submission cap is not a distributed quota. Do not scale replicas without those changes.
- Uploaded documents may be hostile. The worker has page/file/dimension limits but is not a per-job OS sandbox. For untrusted public uploads, isolate rendering workers and enforce resource/time quotas at the process/container boundary.

### Configuration

| Environment variable | Default / purpose |
| --- | --- |
| `DATABASE_URL` | `jdbc:postgresql://localhost:5432/sabun` |
| `DATABASE_USER` | `sabun` |
| `DATABASE_PASSWORD` | Local-only development password |
| `RABBITMQ_HOST` / `RABBITMQ_PORT` | `localhost` / `5672` |
| `RABBITMQ_USER` / `RABBITMQ_PASSWORD` | Local development credentials |
| `QUEUE_ENABLED` | `true`; disabled explicitly in dev profile |
| `STORAGE_PATH` | `.data/files` relative to the API working directory |
| `JAPANESE_FONT` | Optional font path for sample generation |
| `COOKIE_SECURE` | `false` for local HTTP; use `true` behind HTTPS |
| `NUMERIC_OCR_ENABLED` | `true`; enable local printed-number OCR for image-only pages |
| `TESSERACT_COMMAND` | `tesseract`; local executable name or absolute path |

Other limits are in `backend/src/main/resources/application.yml`.

## Validation

```powershell
npm test
npm run build
cd backend
mvn test
```

Run the real PostgreSQL/RabbitMQ smoke test with the default API running:

```powershell
node scripts/smoke.mjs
node scripts/auth-smoke.mjs
node scripts/numeric-ocr-smoke.mjs
```

The smoke test creates two synthetic accounts and sample documents, waits for real queued processing, verifies Japanese amount/phrase changes, checks PNG/CSV responses, and tests CSRF, account isolation, and invalid uploads. Its sample data remains until automatic expiry for inspection.

The auth smoke test creates two synthetic `@example.com` accounts, verifies mandatory authentication on every document API, tests sign-in/sign-out and account isolation against the real stack, and deletes its sample comparison. Both smoke tests leave their synthetic accounts in the local database.

The numerical OCR smoke test uploads the two 100-DPI image-only reports in `output/pdf/`, runs the actual queued comparison, and checks all 81 numerical before/after pairs against `LOWRES-INDEPENDENT-COMPARISON.csv`, including page/row coordinates and the negative balance. It also checks CSV values. It leaves one synthetic account and comparison for inspection. This fixture result does not establish accuracy on every scanned document.

Backend tests cover unchanged documents, numeric changes and coordinates, scanned/graphic changes, mixed mode, page addition, text removal, Japanese normalization, encrypted PDFs, limits, safe CSV cells, CSRF, ownership, duplicate claims, mandatory authentication, account registration/sign-in/sign-out, legacy guest-history transfer, session/CSRF rotation, and account isolation. API integration tests use an isolated in-memory H2 database; the smoke test verifies the real PostgreSQL/RabbitMQ stack.

## Repository map

```text
src/                  React UI, API client, types, CSS, upload tests
backend/src/main/java/jp/sabun/
  SabunApplication.java  Spring Boot entry point; scans all feature packages
  auth/                 Registration, sign-in/out, sessions, account identity and persistence
  comparison/           Comparison API, PDF engine, jobs, dispatchers and retention
  config/               Spring Security and RabbitMQ queue configuration
  storage/              Local PDF, result and preview file storage
  web/                  Shared API errors and health endpoint
backend/src/main/resources/
  application*.yml      Runtime and local development configuration
  db/migration/         Flyway database migrations
backend/src/test/java/jp/sabun/
  auth/                 Authentication API and rate-limit tests
  comparison/           PDF engine, comparison API tests and shared job fixtures
scripts/smoke.mjs     Real-stack end-to-end API check
compose.yaml          PostgreSQL, RabbitMQ, Spring Boot, React/Nginx
```
