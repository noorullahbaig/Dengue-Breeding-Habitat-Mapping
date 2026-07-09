# Breeding Habitat Watch Prototype

React + Vite + TypeScript frontend plus a local FastAPI backend for the dengue breeding-habitat reporting prototype described in the FYP report.

Current documentation scope: the assessed implementation covers the resident submission flow and the public map/status experience. Prototype officer routes still exist in the repository, but they are out of scope for architecture, deployment acceptance, and evaluation claims. The current deployed edge entrypoint uses Amazon CloudFront at `d2yol17g6mes38.cloudfront.net`; its origin and cache configuration are managed outside this repository.

Visual implementation rule: treat mobile view as the authoritative layout for this prototype. Any visual/UI change should be designed and validated for phone-sized viewports first; desktop/laptop rendering is secondary and should adapt from the mobile behavior rather than redefining it.

## Current scope

- Resident landing page and guided reporting flow
- Browser-based photo capture or upload fallback
- Browser/demo geolocation capture with map-pin correction before submit
- FastAPI report submission API
- Local PostgreSQL persistence for report metadata and advisory model output
- Local PostGIS geography columns and hotspot mirror for AWS RDS/PostGIS rehearsal
- Local evidence image and thumbnail storage under `backend/uploads`
- AWS-ready storage keys for future private S3 object mapping
- Explicit public image and exact-pin consent capture
- Backend-owned hotspot priority context for each submitted report
- Ultralytics YOLOv8s inference from `backend/models/denguewatch_yolov8s_best.pt`
- Submission success screen and anonymous status lookup
- Public crowdsourced map with exact consented pins, report thumbnails, and public detail galleries
- ML-gated nearby report stacking for same-class public submissions
- Kuala Lumpur service-area enforcement for report submission and hotspot context
- Experimental officer review routes remain in the repo for local prototype work, but they are out of scope for the assessed implementation

## Directory layout

- `src/app`: app shell, routing, providers, and context wiring
- `src/pages`: route-level screens
- `src/features/report`: resident reporting flow
- `src/features/public-map`: public map display
- `src/features/status`: status lookup UI
- `src/features/shared`: shared feature-level UI
- `src/components`: reusable UI building blocks
- `src/services`: service contracts
- `src/mocks`: mock adapters and seeded data
- `src/lib`: browser helpers, constants, formatting, and map helpers
- `src/types`: shared domain models
- `src/styles`: tokens and global styling
- `src/test`: shared test setup
- `backend/app`: FastAPI application, persistence, image handling, and model inference
- `backend/migrations`: Alembic database migrations
- `backend/tests`: backend unit tests
- `e2e`: Playwright full-flow browser rehearsal against local frontend/backend/PostgreSQL

## Routes

- `/`: resident start page
- `/report`: evidence capture
- `/report/review`: map correction and final review
- `/report/success`: submission confirmation
- `/status`: anonymous status lookup
- `/map`: public crowdsourced report map
- `/map/reports/:reference`: public report detail with stacked image timeline
- `/officer`: experimental local officer review queue retained in the repo, but out of scope for the assessed implementation
- `/next`, `/next/report`, `/next/status`, `/next/map`, `/next/map/reports/:reference`, `/next/officer`: temporary v2 aliases kept during cutover cleanup window, including the same out-of-scope officer prototype route
- `/legacy`, `/legacy/report`, `/legacy/status`, `/legacy/map`, `/legacy/map/reports/:reference`, `/legacy/officer`: rollback-only legacy routes (temporary), including the same out-of-scope officer prototype route

Legacy routes remain unchanged by default. The v2 lane is additive and isolated until explicit cutover.

## Commands

### Frontend

```bash
npm install
npx playwright install chromium
npm run dev
npm run lint
npm run test:run
npm run test:e2e
npm run build
```

### Backend

```bash
cd backend
python3 -m pip install -r requirements.txt
brew install postgresql@18 postgis
brew services start postgresql@18
createdb codex_fyp
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The helper script starts PostgreSQL@18 when needed, creates/enables PostGIS, and runs all migrations:

```bash
cd backend
./scripts/setup_local_db.sh
```

The backend reads local settings from `backend/.env.local` first, then `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://noorullah@localhost:5432/codex_fyp
MODEL_PATH=./models/denguewatch_yolov8s_best.pt
UPLOAD_ROOT=./uploads
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
# Optional: only for the experimental officer-only prototype endpoints
OFFICER_API_TOKEN=local-officer-demo-token
```

Model path policy:

- Keep `MODEL_PATH` pointed at the committed runtime checkpoint: `backend/models/denguewatch_yolov8s_best.pt`.
- The selected default deployment model is YOLOv8s because it delivered the best accuracy-to-latency tradeoff across the trained `n`, `s`, and `m` variants.
- Runtime metadata for the promoted checkpoint lives in `backend/models/denguewatch_yolov8s_metadata.json`.
- Current promoted checkpoint SHA-256 (2026-07-09): `6d6a5b75ea3913ebd6cf358faccd0ed75b0e38a57eb72edeaa5a2983e01afdc5`

Recommended local setup:

- Copy `prototype/.env.local.example` to `prototype/.env.local` for frontend-only values such as `VITE_API_BASE_URL`
- Copy `prototype/backend/.env.local.example` to `prototype/backend/.env.local` for backend-only values such as `DATABASE_URL` and `MODEL_PATH`
- Add `OFFICER_API_TOKEN` only if you are using the experimental officer-only prototype endpoints
- Keep `.env.example` files committed as templates, and treat `.env.local` as your machine-specific override

For local browser testing, support both the Vite dev server and local preview/manual access origins:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
```

If local PostgreSQL rejects passwordless TCP, switch `DATABASE_URL` to:

```env
DATABASE_URL=postgresql+psycopg://noorullah@/codex_fyp
```

The frontend reads `VITE_API_BASE_URL=http://localhost:8000/api` from `.env.local` or `.env`.

Parallel UX safety flags:

```env
VITE_ENABLE_UX_V2_PREVIEW=false
```

- Canonical routes are now v2 by default.
- `VITE_ENABLE_UX_V2_PREVIEW=true`: optional UI affordance while validating/cleaning up transition links.

### Local readiness check

```bash
curl http://localhost:8000/api/health
```

Expected once PostgreSQL is running, migrations are applied, and the model is present:

```json
{ "ok": true, "database": true, "model": true, "postgis": true }
```

PostGIS is now part of local readiness, not an optional AWS-only detail. The Alembic migration enables it, adds report geography points plus GiST indexes, and creates the local `hotspots` mirror table.

### Report flow troubleshooting

- `Failed to fetch` in the resident report AI pre-check means the browser could not reach the API at all. Check that the backend is running on `localhost:8000`.
- Browser access also depends on the active frontend origin being listed in backend `CORS_ORIGINS`. Local development should allow both `5173` and `4173`.
- `curl http://localhost:8000/api/health` returning `database=true`, `model=true`, and `postgis=true` means the backend, model, and spatial DB path are ready for report submission.
- `curl` success does not prove browser success. If browser preflight fails with `Disallowed CORS origin` for `http://127.0.0.1:4173`, add that origin to `backend/.env.local` and restart the backend.
- A model-specific `503` from the report pre-check means the backend is up, but the AI path is not ready yet. Typical cases are:
  - `The detection model is not ready.`
  - `The detection model could not process the uploaded image.`
- For local validation, start the frontend on `5173` or `4173`, then confirm `/api/health` is green before testing `/report`.

### Hotspot mirror sync

The public map and report priority logic read from PostgreSQL, not directly from the browser. The current local sync path is still an officer-only backend endpoint retained as an operational utility, even though the officer workflow itself is out of scope for the assessed prototype:

```bash
curl -X POST http://localhost:8000/api/officer/hotspots/sync \
  -H "Authorization: Bearer local-officer-demo-token"
```

You can also sync from the experimental `/officer` dashboard.

## Notes

- The frontend uses the FastAPI backend when `VITE_API_BASE_URL` is configured; if it is not set, mock services are still available for isolated UI tests.
- The current deployed public entrypoint is the CloudFront distribution `d2yol17g6mes38.cloudfront.net`, but the CloudFront origin and cache behavior are managed outside this repository, so local docs should not claim an exact edge-to-origin topology beyond CloudFront sitting in front of the application.
- The backend syncs hotspot context from the public iDengue ArcGIS layer into local PostgreSQL/PostGIS. Cloud deployment can move the same sync boundary to a scheduled App Runner job, Lambda, or EventBridge-triggered worker.
- Public map markers show exact pins and submitted photos after explicit resident consent.
- Nearby report stacking is ML-gated and uses an internal same-site matching rule; the 200 m/400 m hotspot visuals remain dengue context, not duplicate-report logic.
- Report submissions and public hotspot context are constrained to the Kuala Lumpur service area.
- AI output is always framed as advisory and never as final proof.
- The officer prototype remains in the repository as an experimental utility surface and should not be used as a required scope claim for diagrams, deployment acceptance, or academic evaluation.
- The system is currently deployed to AWS. The local development environment continues to use local PostgreSQL and local uploads for development purposes, while the production AWS environment utilizes hosted PostgreSQL (RDS) and S3 object storage without changing the resident-facing workflow.
- Design tradeoffs are documented in `DESIGN_CHOICES.md`.
