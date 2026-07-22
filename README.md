# DengueWatch — Dengue Breeding Habitat Mapping

A civic web application that lets Kuala Lumpur residents submit photo evidence of likely mosquito breeding habitats, confirm exact map location, and track reports anonymously. The system provides a public awareness map and supports AI-assisted habitat classification using a YOLOv8s model trained on local breeding-site imagery.

**Assessed scope:** The resident submission flow, public map, public report detail, and anonymous status lookup.

**Live deployment:** CloudFront CDN → EC2 origin (Docker Compose) → RDS PostgreSQL/PostGIS + S3.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Routes](#routes)
3. [Local Development Setup](#local-development-setup)
4. [Environment Variables](#environment-variables)
5. [Running Tests](#running-tests)
6. [Production Deployment (EC2)](#production-deployment-ec2)
7. [Authentication — AWS Cognito](#authentication--aws-cognito)
8. [Database Schema](#database-schema)
9. [AI Model](#ai-model)
10. [Design System](#design-system)
11. [Architecture Decisions](#architecture-decisions)

---

## Project Structure

```
prototype/
├── src/
│   ├── app/          # App shell, routing, auth context, providers
│   ├── pages/        # Route-level screens and page components
│   ├── features/     # report/, shared/
│   ├── components/   # Reusable UI building blocks
│   ├── services/     # API service contracts and adapters
│   ├── lib/          # Browser helpers, geolocation, prediction, formatting
│   ├── mocks/        # Mock service adapters for isolated UI tests
│   ├── styles/       # CSS design tokens and per-route stylesheets
│   ├── types/        # Shared TypeScript domain models
│   └── test/         # Shared test setup
├── backend/
│   ├── app/          # FastAPI application: auth, domain, inference, storage
│   ├── migrations/   # Alembic database migration versions (9 migrations)
│   ├── models/       # YOLOv8s .pt checkpoint + metadata + operating profile
│   ├── tests/        # Backend unit and integration tests
│   └── scripts/      # setup_local_db.sh, derive_operating_profile.py
├── e2e/              # Playwright end-to-end browser tests
├── docs/
│   ├── academic/     # Model operating profile, use-case analysis
│   ├── diagrams/     # Architecture diagrams, flowcharts, use-case SVGs
│   └── wireframe_*.html  # UI wireframes for all major flows
├── scripts/          # Deployment scripts, perf measurement
└── public/           # favicon.svg
```

---

## Routes

| Route | Description |
|---|---|
| `/` | Resident landing page |
| `/report` | Multi-step evidence capture wizard |
| `/report/success` | Submission confirmation with reference code |
| `/status` | Anonymous status lookup by reference |
| `/map` | Public crowdsourced awareness map |
| `/map/reports/:reference` | Public report detail with image evidence timeline |
| `/learn` | Habitat identification guidance |
| `/activity` | Authenticated resident's own report history |
| `/profile` | Authenticated resident profile |

**Mobile-first:** Mobile view is the authoritative layout. All UI changes are validated phone-first; desktop adapts from mobile behaviour.

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16+ with PostGIS

### Frontend

```bash
npm install
npx playwright install chromium   # for e2e tests only
npm run dev                        # starts Vite on http://localhost:5173
```

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# One-command local DB setup (starts PostgreSQL, enables PostGIS, runs all migrations):
./scripts/setup_local_db.sh

# Or manually:
brew install postgresql@16 postgis
brew services start postgresql@16
createdb codex_fyp
alembic upgrade head

uvicorn app.main:app --reload --port 8000
```

### Local Environment Files

Copy the examples to create your local overrides:

```bash
cp .env.local.example .env.local                   # frontend
cp backend/.env.local.example backend/.env.local   # backend
```

Minimal `backend/.env.local`:

```env
DATABASE_URL=postgresql+psycopg://your_username@localhost:5432/codex_fyp
MODEL_PATH=./models/denguewatch_yolov8s_best.pt
UPLOAD_ROOT=./uploads
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
```

> If PostgreSQL rejects passwordless TCP, use the socket form:
> `DATABASE_URL=postgresql+psycopg://your_username@/codex_fyp`

### Readiness Check

```bash
curl http://localhost:8000/api/health
# Expected: { "ok": true, "database": true, "model": true, "postgis": true }
```

### Hotspot Sync (local)

The public map reads iDengue hotspot data from PostgreSQL. The backend syncs automatically from the iDengue ArcGIS layer on startup and periodically in the background. To trigger a manual sync during development:

```bash
curl -X POST http://localhost:8000/api/officer/hotspots/sync \
  -H "Authorization: Bearer local-officer-demo-token"
```

This endpoint is a development/operational utility. It is not part of the assessed resident-facing implementation.

---

## Environment Variables

### Frontend (`VITE_*`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Yes | Backend API base, e.g. `/api` or `http://localhost:8000/api` |
| `VITE_COGNITO_REGION` | Prod only | AWS region, e.g. `ap-southeast-1` |
| `VITE_COGNITO_USER_POOL_ID` | Prod only | Cognito User Pool ID |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | Prod only | Cognito App Client ID |
| `VITE_COGNITO_HOSTED_UI_DOMAIN` | Prod only | Cognito Hosted UI domain |
| `VITE_COGNITO_REDIRECT_SIGN_IN` | Prod only | OAuth redirect after sign-in |
| `VITE_COGNITO_REDIRECT_SIGN_OUT` | Prod only | OAuth redirect after sign-out |

### Backend

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+psycopg://...`) |
| `MODEL_PATH` | Yes | Path to `.pt` checkpoint, e.g. `./models/denguewatch_yolov8s_best.pt` |
| `UPLOAD_ROOT` | Yes | Local upload directory, e.g. `./uploads` |
| `CORS_ORIGINS` | Yes | Comma-separated allowed origins |
| `STORAGE_BACKEND` | Prod | `local` (default) or `s3` |
| `S3_BUCKET` | Prod (S3) | S3 bucket name |
| `S3_REGION` | Prod (S3) | S3 region |
| `CLEANUP_LOCAL_AFTER_S3_UPLOAD` | Prod (S3) | `true` to delete local files after S3 upload |
| `COGNITO_REGION` | Prod | Must match frontend `VITE_COGNITO_REGION` |
| `COGNITO_USER_POOL_ID` | Prod | Must match frontend value |
| `COGNITO_APP_CLIENT_ID` | Prod | Must match frontend value |


---

## Running Tests

### Frontend Unit Tests

```bash
npm run test:run        # run all Vitest unit tests once
npm run test            # watch mode
```

### Backend Unit Tests

```bash
cd backend
pytest                  # runs all tests
pytest tests/test_inference.py   # single file
```

### End-to-End Tests (Playwright)

Requires both frontend (port 5173) and backend (port 8000) running locally:

```bash
npm run test:e2e
```

---

## Production Deployment (EC2)

The production environment uses Docker Compose on an EC2 instance, with RDS PostgreSQL/PostGIS as the database and S3 for image storage.

### Architecture

```
Browser → CloudFront (CDN/edge) → EC2 (nginx + Docker Compose)
                                       ├── frontend container (Vite build served by nginx)
                                       ├── backend container (FastAPI + Uvicorn)
                                       ├── migrate service (alembic upgrade head, runs once on deploy)
                                       └── nginx (reverse proxy: / → frontend, /api → backend)
EC2 backend → RDS PostgreSQL/PostGIS
EC2 backend → S3 (image evidence storage)
EC2 backend → AWS Cognito (JWT verification)
```

### Deployment Steps

Production credentials are stored as an AWS SSM SecureString. The deploy script fetches, validates, and applies them automatically.

```bash
# SSH into EC2 (use your own .pem key file)
chmod 400 YOUR_KEY_FILE.pem
ssh -i YOUR_KEY_FILE.pem ec2-user@<YOUR-EC2-PUBLIC-IP>

# Pull latest code
cd /home/ec2-user/prototype
git pull origin main

# Deploy
./scripts/deploy-production.sh
```

The script:
1. Fetches `.env.production` from AWS SSM SecureString
2. Validates all required variables
3. Builds Docker images tagged with the current Git SHA
4. Runs the `migrate` service (`alembic upgrade head`) before app containers start
5. Brings up `docker compose --env-file .env.production -f docker-compose.prod.yml up -d --remove-orphans`
6. Waits for health checks to pass

### Verifying Deployment

```bash
curl http://localhost/health        # nginx → frontend health
curl http://localhost/api/health    # nginx → backend health
# Expected: { "ok": true, "database": true, "model": true, "postgis": true }
```

Also verify:
- Frontend login flow reaches Cognito
- An authenticated submission writes `user_id` to the DB
- An anonymous submission followed by sign-in claims the report

### Useful Docker Commands on EC2

```bash
# View running services
docker compose --env-file .env.production -f docker-compose.prod.yml ps

# Tail logs
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100

# Re-run without pulling new code (e.g. config-only change)
./scripts/deploy-production.sh --skip-pull
```

### Rollback

The deploy script saves `.deploy/previous-release.env`. If a release fails after images are built, redeploy the earlier `APP_VERSION` manually with the same compose file. Do not rollback the database automatically — only downgrade if the migration is confirmed forward-compatible with the older image.

### Production Rules

- **Never** commit `.env.production` to git.
- **Never** rely on ambient shell variables for production deploys — always use `--env-file .env.production`.
- **Never** edit `.env.production` directly on EC2 and treat it as source of truth — update SSM, then redeploy.
- **Never** use mock auth in production as a fallback for missing Cognito configuration.

---

## Authentication — AWS Cognito

### How It Works

- **Anonymous reporting** is always available — no sign-in required.
- **Authenticated reporting:** A report submitted with a valid Cognito ID token is automatically linked to that resident. `GET /api/my-reports` returns only the authenticated resident's own reports.
- **Claim flow:** An anonymous submission receives a private one-time claim token, held in session storage. When the user later signs in, `POST /api/my-reports/claim` attaches the report to the account. Claim tokens are stored as hashes server-side, never in URLs, and cleared after a successful claim.

### Required Configuration

Frontend and backend must reference the **same** User Pool and App Client. Cognito identifiers are safe to include in the frontend build; App Client secrets must not be placed in the browser.

```
Backend:  COGNITO_REGION, COGNITO_USER_POOL_ID, COGNITO_APP_CLIENT_ID
Frontend: VITE_COGNITO_REGION, VITE_COGNITO_USER_POOL_ID,
          VITE_COGNITO_USER_POOL_CLIENT_ID, VITE_COGNITO_HOSTED_UI_DOMAIN,
          VITE_COGNITO_REDIRECT_SIGN_IN, VITE_COGNITO_REDIRECT_SIGN_OUT
```

### API Contract

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/reports` | Optional bearer token | Anonymous: returns `claimToken`. Authenticated: links report immediately. |
| `GET /api/my-reports` | Required Cognito ID token | Returns only the authenticated resident's reports |
| `POST /api/my-reports/claim` | Required Cognito ID token | Body: `{ reference, claimToken }` |
| `GET /api/reports/status/{reference}` | None | Public status lookup |
| `GET /api/public/reports` | None | Public map data |
| `GET /api/hotspots/current` | None | iDengue hotspot mirror |

If Cognito configuration is incomplete in production, public reporting remains available but account sign-in is disabled — no mock auth fallback.

---

## Database Schema

PostgreSQL with PostGIS. Managed by Alembic (9 migration files in `backend/migrations/versions/`).

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | VARCHAR | Primary key |
| `cognito_sub` | VARCHAR | Unique — Cognito subject identifier |
| `email` | VARCHAR | |
| `display_name` | VARCHAR | From Google/Cognito profile |
| `photo_url` | TEXT | Google/Cognito profile image |
| `provider` | VARCHAR | `cognito` or `local` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `reports`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `reference` | VARCHAR | Human-readable ID, e.g. `KL-ABCD-1234` — unique |
| `parent_report_id` | UUID | FK for stacked/duplicate reports |
| `user_id` | VARCHAR | FK to `users.id` — nullable for anonymous |
| `claim_token_hash` | TEXT | SHA-256 of one-time claim token |
| `latitude` / `longitude` | FLOAT | Submitted GPS coordinates |
| `address` | TEXT | Reverse-geocoded address |
| `public_location_geog` | Geography(Point) | PostGIS spatial index for bounding-box map queries |
| `habitat_class` | VARCHAR | AI classification: `artificial_container`, `drain_inlet`, `tire` |
| `confidence_score` | FLOAT | Raw model confidence |
| `ai_decision` | VARCHAR | `confirmed`, `low_confidence`, `rejected` |
| `storage_key` | TEXT | Evidence image path/S3 key |
| `thumbnail_key` | TEXT | Thumbnail path/S3 key |
| `annotated_key` | TEXT | Annotated overlay image key |
| `status` | VARCHAR | `submitted`, `under_review`, `action_recorded`, `closed` |
| `consent_public_location` | BOOLEAN | Resident consent for public pin display |
| `consent_public_image` | BOOLEAN | Resident consent for public photo display |
| `created_at` / `captured_at` | TIMESTAMPTZ | |
| `hotspot_id` | INTEGER | FK to nearest iDengue hotspot at time of submission |

### `hotspots`
Local mirror of the iDengue ArcGIS layer. Synced automatically on backend startup and periodically in the background. Used for hotspot priority context on the public map and at report submission time. Includes a PostGIS geography column with a GiST index for spatial proximity queries.

### `user_reports` (association)
Many-to-many join between `users` and `reports` for the claim flow.

---

## AI Model

**Model:** YOLOv8s image classifier, trained on local Kuala Lumpur breeding-site imagery.

**Checkpoint:** `backend/models/denguewatch_yolov8s_best.pt`
- SHA-256: `af33db97278948b7feb6bddf3ebc351ca757922e47643d05d713b7026eeb3d92`
- Epoch: 44 (best validation checkpoint)

**Classes:**
- `artificial_container` — buckets, pots, open containers
- `drain_inlet` — drains, culverts, channel openings
- `tire` — discarded tyres

**Inference settings:** `conf=0.448, iou=0.70, imgsz=640, augment=False`
- `conf=0.448` is the envelope to expose all class candidates for post-filtering, not a hard accept threshold.
- Post-filter applies per-class F1 review floors: `0.547` (container), `0.486` (drain), `0.448` (tire).
- Stronger-evidence (F0.5) thresholds: `0.674`, `0.553`, `0.712` respectively.

**Operating profile:** `backend/models/denguewatch_yolov8s_operating_profile.json`
Full derivation rationale in `docs/academic/model-operating-profile.md`.

AI output is always framed as advisory — never final proof. Low-confidence submissions are still accepted with a warning shown to the user.

---

## Design System

**Palette:**
| Token | Value | Usage |
|---|---|---|
| `--color-accent` | `#00464f` | Primary CTA, active states |
| `--color-surface` | `#f3faff` | Page canvas |
| `--color-surface-muted` | `#e6f6ff` | Secondary panels |
| `--color-ink` | `#021f29` | Body text |
| `--color-ink-soft` | `#42585f` | Secondary text |
| `--color-warning` | `#ba1a1a` | Errors, warnings |
| `--color-success` | `#156874` | Confirmations |

**Typography:** Work Sans (headings + body), Inter (labels + compact UI). Tone: civic, high-legibility, no decorative display treatment.

**Layout:** Mobile-first. Fixed top bar + 5-item bottom nav for resident routes on mobile; fixed left rail on desktop. 8px spacing rhythm. Map-first layouts throughout.

**Accessibility:** WCAG AA contrast target. Large touch targets for mobile field use. Keyboard accessible on desktop. Color not used as sole status indicator.

---

## Architecture Decisions

| Decision | Chosen | Rationale |
|---|---|---|
| Frontend framework | React + Vite + TypeScript | Component model fits multi-step wizard; Vite fast dev/build |
| Backend framework | FastAPI (Python) | Async support; direct integration with Ultralytics/PyTorch inference |
| Database | PostgreSQL + PostGIS | Spatial queries for bounding-box map data and hotspot proximity |
| ORM / Migrations | SQLAlchemy + Alembic | Versioned schema; reproducible across local and RDS |
| Image storage | Local (dev) / S3 (prod) | Consistent `storage_key` abstraction; S3 fallback to local if unavailable |
| Auth | AWS Cognito (Google OAuth) | Managed identity; anonymous fallback preserved for non-auth users |
| AI model | YOLOv8s (classification head) | Suitable size for single-GPU EC2; fits `backend/models/` in repo |
| Deployment | Docker Compose on EC2 | Reproducible multi-service environment; nginx handles routing |
| CDN | CloudFront | Edge caching; shields EC2 origin |
| Map | OpenLayers + OpenStreetMap | Open-source; no API key for tile rendering |
| Service area | KL boundary GeoJSON | Submissions and hotspot context constrained to Kuala Lumpur |
| Report stacking | ML-gated 200m radius | Reduces duplicate reports for same habitat; class-aware matching |

**Spatial queries:** `public_location_geog` uses a PostGIS geography column with a GiST index. Public map endpoint uses `ST_Intersects` with a bounding-box envelope — benchmarked at ~10ms for 500 reports vs ~80ms without the index.

**Storage fallback:** If S3 is unreachable when serving an image, the backend falls back to a local `FileResponse` transparently. Startup validates S3 connectivity and logs a warning (does not crash) if unreachable.


