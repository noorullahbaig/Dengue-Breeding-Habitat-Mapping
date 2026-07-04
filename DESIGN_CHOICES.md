# Design Choices for Local-First, AWS-Ready Development

This file records implementation choices made after reviewing `/Users/noorullah/Desktop/MUHAMMAD NOORULLAH BAIG-TP077979-APD3F2511CS(AI).docx`.

## Deployed on AWS EC2 (with Local Development Support)

- The current production deployment target is AWS EC2.
- The local development stack (React/Vite frontend, FastAPI backend, PostgreSQL/PostGIS) mirrors the AWS production shape where practical to ensure seamless development.
- The current deployed public edge uses Amazon CloudFront at `d2yol17g6mes38.cloudfront.net`, which routes to our EC2 instances.
- The system continues to support full local development workflows, while the production environment handles real traffic on AWS.

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
- Optional resident notes remain non-public and are not exposed on public map/detail/status endpoints.

## YOLO vs EfficientNet

- The report recommends a whole-image EfficientNet classifier because the intended ML task is advisory single-label habitat classification.
- The working prototype currently uses an Ultralytics YOLO model from `/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/current_yolo/best.pt`.
- YOLO remains the default for now because it is already integrated, tested, and returns usable habitat evidence for local demonstration.
- The backend API stays classifier-like: it stores public habitat label, confidence, confidence band, top raw label, detections, and advisory text.
- Detection payloads keep raw pixel boxes for auditability and normalized box coordinates for reliable public and prototype-overlay rendering across display sizes.
- If later model evaluation shows EfficientNet performs better for the retained classes, the inference implementation can be swapped without changing report storage or frontend submission flow.

## Hotspot Priority

- Hotspot context is now backend-owned for report submission and public report display.
- The current sync path still uses an officer-only backend endpoint retained in the repository as an operational utility.
- The backend assesses nearest iDengue hotspot distance with PostGIS distance logic and stores snapshot, nearest hotspot identity, priority level, and priority reason on each report.
- Frontend map hotspot listing is served from the local mirror, which prepares the future path for scheduled AWS mirroring instead of browser-direct ArcGIS calls.

## Out-of-Scope Officer Prototype

- Officer review remains in the repository as a local prototype with a demo bearer token.
- It can still trigger hotspot sync and expose operational controls for experimentation.
- It is explicitly out of scope for the assessed implementation, architecture diagrams, deployment acceptance, and academic evaluation claims.

## Full-Flow Rehearsal

- Playwright and local rehearsal focus on resident report submission plus public detail/status lookup against local frontend, FastAPI, PostgreSQL, and PostGIS.
- Some repository-level test or prototype paths may still touch officer functionality, but that does not expand the formal implementation scope.
- The rehearsal intentionally avoids AWS credentials. It proves the boundaries AWS will inherit: Amplify can host the frontend, App Runner can host FastAPI, RDS can provide PostgreSQL/PostGIS, and S3 can replace the local key resolver.
