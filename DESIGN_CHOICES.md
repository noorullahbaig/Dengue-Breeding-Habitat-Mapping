# Design Choices for Local-First, AWS-Ready Development

This file records implementation choices made after reviewing `/Users/noorullah/Desktop/MUHAMMAD NOORULLAH BAIG-TP077979-APD3F2511CS(AI).docx`.

## Local First, AWS Ready Later

- Current deployment target is local development only.
- The local stack mirrors the intended AWS shape where practical: React/Vite frontend, FastAPI backend, PostgreSQL/PostGIS, object-style image keys, DB-backed hotspot context, and backend-owned report logic.
- Future AWS migration should map the same boundaries to Amplify, App Runner, RDS PostgreSQL with PostGIS, and S3.

## PostgreSQL and PostGIS

- Local testing uses PostgreSQL through `DATABASE_URL` so report persistence matches the future hosted database more closely than mocks or SQLite.
- Local spatial testing uses PostgreSQL@18 plus PostGIS 3.6 installed through Homebrew.
- Alembic migration `0004_postgis_spatial_hotspot_mirror` requires/enables PostGIS, adds report geography point columns, creates GiST indexes, and creates the local `hotspots` mirror table.
- `/api/health` now treats PostGIS as part of readiness because hotspot priority and report geography are expected local behavior before AWS migration.

## Image Storage

- Local uploads still save files under `backend/uploads`.
- New reports also store `image_storage_key` and `thumbnail_storage_key`, such as `evidence/<id>.jpg`.
- These keys are the migration seam: local storage resolves keys to files now, while AWS can resolve the same keys to private S3 objects later.
- Public image access stays behind FastAPI routes instead of exposing raw filesystem or future S3 URLs directly.

## Public Image and Exact Pin Consent

- Public evidence images and exact pins are allowed only after explicit resident acknowledgement.
- The backend requires `public_consent_accepted=true` for report creation.
- Stored consent includes accepted state, timestamp, consent version, and consent text.
- New submissions use `public-image-pin-ai-v2`, which explicitly covers the public image, exact pin, computer-vision advisory result, confidence, and detection evidence.
- Optional resident notes remain officer-facing and are not exposed on public map/detail/status endpoints.

## YOLO vs EfficientNet

- The report recommends a whole-image EfficientNet classifier because the intended ML task is advisory single-label habitat classification.
- The working prototype currently uses an Ultralytics YOLO model from `/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/current_yolo/best.pt`.
- YOLO remains the default for now because it is already integrated, tested, and returns usable habitat evidence for local demonstration.
- The backend API stays classifier-like: it stores public habitat label, confidence, confidence band, top raw label, detections, and advisory text.
- Detection payloads keep raw pixel boxes for auditability and normalized box coordinates for reliable public/officer overlays across display sizes.
- If later model evaluation shows EfficientNet performs better for the retained classes, the inference implementation can be swapped without changing report storage or frontend submission flow.

## Hotspot Priority

- Hotspot context is now backend-owned for report submission and officer review.
- Officer-only sync mirrors the latest iDengue rows into PostgreSQL/PostGIS.
- The backend assesses nearest iDengue hotspot distance with PostGIS distance logic and stores snapshot, nearest hotspot identity, priority level, and priority reason on each report.
- Frontend map hotspot listing is served from the local mirror, which prepares the future path for scheduled AWS mirroring instead of browser-direct ArcGIS calls.

## Officer Workflow

- Officer review is implemented locally with a demo bearer token.
- The dashboard shows report queue, image evidence, private notes, advisory ML output, hotspot mirror status, hotspot priority context, consent state, and status/follow-up controls.
- The dashboard can trigger local hotspot sync now; AWS can later move that same behavior to a scheduled worker without changing resident-facing pages.
- AWS migration can replace the demo token with Cognito or another managed identity provider without changing the resident flow.

## Full-Flow Rehearsal

- Playwright E2E covers resident report submission, public detail/status lookup, officer review update, and persisted officer evidence against local frontend, FastAPI, PostgreSQL, and PostGIS.
- The rehearsal intentionally avoids AWS credentials. It proves the boundaries AWS will inherit: Amplify can host the frontend, App Runner can host FastAPI, RDS can provide PostgreSQL/PostGIS, and S3 can replace the local key resolver.
