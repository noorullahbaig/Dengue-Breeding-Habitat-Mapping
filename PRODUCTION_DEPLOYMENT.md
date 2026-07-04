# Production Deployment

This is the authoritative production deployment guide for the EC2 Docker deployment.

Do not deploy from the older quick-start, optimization, or auth rollout documents without reconciling them to this guide. Several older files assume Compose reads `.env.production` automatically or instruct you to `export $(cat .env.production | xargs)`, which is not reliable enough for production.

## Operating model

- GitHub is the source of application code.
- AWS Systems Manager Parameter Store is the source of production configuration.
- EC2 keeps `.env.production` only as a generated runtime file.
- All production Docker Compose commands must include `--env-file .env.production`.
- Deployments run through `./scripts/deploy-production.sh`.

## One-time setup

### 1. Ignore secrets in Git

This repository now ignores `.env.production`. Keep using `.env.production.example` only as a schema reference.

### 2. Attach an IAM role to EC2

The EC2 instance role should allow:

- `ssm:GetParameter` for the production parameter path
- `kms:Decrypt` for the KMS key protecting that SecureString

Do not place long-lived AWS access keys on the instance.

### 3. Create the production SSM parameter

Recommended parameter name:

```text
/denguewatch/production/env
```

Create the parameter from a local file:

```bash
aws ssm put-parameter \
  --name /denguewatch/production/env \
  --type SecureString \
  --overwrite \
  --value file://.env.production
```

The parameter value should be the full env document, one `KEY=value` per line.

### 4. Populate the required values

Your production env should include:

- `DATABASE_URL`
- `CORS_ORIGINS`
- `STORAGE_BACKEND`
- `S3_BUCKET` and `S3_REGION` when `STORAGE_BACKEND=s3`
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_APP_CLIENT_ID`
- `VITE_AUTH_MODE`
- `VITE_API_BASE_URL`
- `VITE_COGNITO_REGION`
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_USER_POOL_CLIENT_ID`
- `VITE_COGNITO_HOSTED_UI_DOMAIN`
- `VITE_COGNITO_REDIRECT_SIGN_IN`
- `VITE_COGNITO_REDIRECT_SIGN_OUT`

Use `.env.production.example` as the schema. Production should normally set:

```text
VITE_API_BASE_URL=/api
VITE_AUTH_MODE=cognito
```

The backend and frontend Cognito pool, region, and app-client identifiers must match.

## Routine deployment

### Local machine

Push tracked code changes first:

```bash
git push origin main
```

### EC2 instance

From the repo root:

```bash
./scripts/deploy-production.sh
```

The script will:

1. Refuse to run if the EC2 tracked worktree is dirty.
2. Pull the latest code with `git pull --ff-only`.
3. Fetch the env file from SSM.
4. Validate the env file with the repo validator.
5. Install `.env.production` atomically with mode `600`.
6. Run `docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet`.
7. Build images tagged with the current Git SHA.
8. Run `alembic upgrade head` in a one-off backend container.
9. Run `docker compose up -d --remove-orphans`.
10. Wait for both nginx and backend health endpoints.

## Config-only changes

If only secrets or runtime configuration changed:

1. Update the SSM parameter value.
2. Re-run:

```bash
./scripts/deploy-production.sh
```

The script still rebuilds images to keep the deploy path deterministic. If you later want a faster config-only path, add it explicitly rather than bypassing the authoritative script ad hoc.

## Verification

After deployment, verify:

- `http://localhost/health` responds on the EC2 host
- `http://localhost/api/health` responds on the EC2 host
- The frontend login flow reaches Cognito correctly
- A signed-in submission writes `user_id` in the database
- The same account sees the report in Activity from a separate browser session
- An anonymous submission followed by sign-in claims the report successfully

## Troubleshooting

### See the resolved Compose configuration

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml config
```

### Inspect running services

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml ps
```

### Inspect logs

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=100
```

### Re-run without pulling new code

Useful if you are validating a just-updated SSM parameter on the same commit:

```bash
./scripts/deploy-production.sh --skip-pull
```

## Rollback

This workflow does not auto-downgrade the database. That is intentional.

If a release fails after images are built but before you trust the app, inspect `.deploy/previous-release.env` and redeploy the earlier `APP_VERSION` manually with the same compose file. Only do that if the newer migration is known to be forward-compatible with the older application image.

## Rules

- Never commit `.env.production`.
- Never rely on ambient shell variables for production deploys.
- Never run production Compose commands without `--env-file .env.production`.
- Never edit `.env.production` manually on EC2 and treat that as the source of truth.
- Never use mock auth in production as a fallback for missing Cognito configuration.
