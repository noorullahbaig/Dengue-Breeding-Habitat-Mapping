# Breeding Habitat Watch Prototype

React + Vite + TypeScript frontend plus a local FastAPI backend for the dengue breeding-habitat reporting prototype described in the FYP report.

## Current scope

- Resident landing page and guided reporting flow
- Browser-based photo capture or upload fallback
- Browser/demo geolocation capture with map-pin correction before submit
- FastAPI report submission API
- Local PostgreSQL persistence for report metadata and advisory model output
- Local evidence image and thumbnail storage under `backend/uploads`
- Ultralytics YOLO inference from `/Users/noorullah/Downloads/best.pt`
- Submission success screen and anonymous status lookup
- Public crowdsourced map with exact consented pins, report thumbnails, and public detail galleries
- ML-gated nearby report stacking for same-class public submissions
- Kuala Lumpur service-area enforcement for report submission and hotspot context
- Reserved `/officer` route for the later dashboard increment

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

## Routes

- `/`: resident start page
- `/report`: evidence capture
- `/report/review`: map correction and final review
- `/report/success`: submission confirmation
- `/status`: anonymous status lookup
- `/map`: public crowdsourced report map
- `/map/reports/:reference`: public report detail with stacked image timeline
- `/officer`: placeholder for the next iteration

## Commands

### Frontend

```bash
npm install
npm run dev
npm run lint
npm run test:run
npm run build
```

### Backend

```bash
cd backend
python3 -m pip install -r requirements.txt
brew services start postgresql@14
createdb codex_fyp
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

The backend reads local settings from `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://noorullah@localhost:5432/codex_fyp
MODEL_PATH=/Users/noorullah/Downloads/best.pt
UPLOAD_ROOT=./uploads
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

For local browser testing, both common dev origins are allowed:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

If local PostgreSQL rejects passwordless TCP, switch `DATABASE_URL` to:

```env
DATABASE_URL=postgresql+psycopg://noorullah@/codex_fyp
```

The frontend reads `VITE_API_BASE_URL=http://localhost:8000/api` from `.env`.

### Local readiness check

```bash
curl http://localhost:8000/api/health
```

Expected once PostgreSQL is running, migrations are applied, and the model is present:

```json
{"ok":true,"database":true,"model":true}
```

## Notes

- The frontend uses the FastAPI backend when `VITE_API_BASE_URL` is configured; if it is not set, mock services are still available for isolated UI tests.
- The prototype currently reads hotspot context live from the public iDengue ArcGIS layer. Cloud deployment should replace this with a scheduled backend mirror or Lambda/cron sync keyed to source snapshot changes.
- Public map markers show exact pins and submitted photos after explicit resident consent.
- Nearby report stacking is ML-gated and uses an internal same-site matching rule; the 200 m/400 m hotspot visuals remain dengue context, not duplicate-report logic.
- Report submissions and public hotspot context are constrained to the Kuala Lumpur service area.
- AI output is always framed as advisory and never as final proof.
- Cloud migration later should replace the local PostgreSQL URL and local upload adapter with hosted PostgreSQL and private object storage without changing the resident-facing workflow.
