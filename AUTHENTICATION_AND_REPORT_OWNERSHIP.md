# Authentication and Report Ownership

This is the authoritative implementation and deployment reference for resident accounts.

## Supported behavior

- Anonymous reporting remains available.
- A report submitted with a valid Cognito ID token is linked to that resident automatically.
- An anonymous submission receives a private, one-time claim token. The browser keeps it in session storage so the submitter can sign in immediately and attach the report.
- `GET /api/my-reports` returns only reports owned by the authenticated resident.
- Existing anonymous reports created before claim tokens were introduced remain trackable by reference but cannot be claimed.
- Officer workflow and officer APIs are out of scope.

## Required configuration

Backend runtime variables:

```text
COGNITO_REGION
COGNITO_USER_POOL_ID
COGNITO_APP_CLIENT_ID
```

Frontend build variables:

```text
VITE_AUTH_MODE=cognito
VITE_COGNITO_REGION
VITE_COGNITO_USER_POOL_ID
VITE_COGNITO_USER_POOL_CLIENT_ID
VITE_COGNITO_HOSTED_UI_DOMAIN
VITE_COGNITO_REDIRECT_SIGN_IN
VITE_COGNITO_REDIRECT_SIGN_OUT
```

The frontend and backend values must identify the same user pool and app client. Cognito identifiers are public configuration; app-client secrets must not be placed in the browser build.

## Deployment

1. Fill `.env.production` from `.env.production.example`.
2. Install backend dependencies from `backend/requirements.txt`.
3. Run `alembic upgrade head` from the backend container or environment.
4. Rebuild both images so the Cognito build arguments are embedded in the frontend.
5. Verify authenticated submission and anonymous sign-in-and-claim flows from separate browser sessions.

If production frontend Cognito configuration is incomplete, public reporting stays available but account sign-in is disabled instead of falling back to mock accounts.

## API contract

- `POST /api/reports`: accepts an optional bearer token. Anonymous responses include `claimToken`; authenticated responses omit it.
- `GET /api/my-reports`: requires a valid Cognito ID token.
- `POST /api/my-reports/claim`: requires a valid Cognito ID token plus the report reference and private claim token.

Claim tokens are random, stored only as hashes on the server, never placed in URLs, and cleared after a successful claim.
