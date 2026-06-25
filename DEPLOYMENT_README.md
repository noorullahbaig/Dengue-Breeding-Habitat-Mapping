# Deployment Files Overview

This directory contains Docker and deployment configuration files for deploying DengueWatch KL to AWS.

---

## 📁 Files Created

### Docker Configuration

1. **`Dockerfile.backend`**
   - Builds the FastAPI backend container
   - Includes Python 3.11, all dependencies, and YOLO model
   - Installs PostGIS client libraries
   - Exposes port 8000

2. **`Dockerfile.frontend`**
   - Multi-stage build: compiles React app, then serves with nginx
   - Stage 1: Node.js build environment
   - Stage 2: Minimal nginx alpine image
   - Exposes port 80 and 443

3. **`docker-compose.prod.yml`**
   - Production orchestration for EC2 deployment
   - Runs TWO services only: `backend` + `nginx`
   - **Does NOT include PostgreSQL** (uses external RDS)
   - Connects to RDS via DATABASE_URL environment variable
   - Mounts persistent EBS volume for uploads

4. **`nginx.conf`**
   - Reverse proxy configuration
   - Routes `/api/*` to backend container
   - Serves frontend static files for all other routes
   - Includes commented HTTPS configuration for Let's Encrypt
   - Security headers and gzip compression

5. **`.dockerignore`**
   - Excludes unnecessary files from Docker build context
   - Reduces image size and build time
   - Excludes: node_modules, .venv, .git, uploads, logs

6. **`.env.production.example`**
   - Template for production environment variables
   - Copy to `.env.production` and fill in actual values
   - Includes: DATABASE_URL, CORS_ORIGINS, API tokens

---

## 📚 Documentation

1. **`AWS_SETUP_GUIDE.md`** ⭐ Start Here
   - Complete step-by-step deployment instructions
   - AWS Console screenshots and commands
   - Troubleshooting section
   - Demo day checklist

2. **`AWS_DEPLOYMENT_ANALYSIS.md`**
   - Full technical analysis of deployment options
   - Architecture comparison
   - Cost estimates
   - Why Docker Compose on EC2 is recommended

3. **`DEPLOYMENT_COMPARISON.md`**
   - Visual comparison matrix
   - Architecture diagrams
   - Pros/cons of each approach

4. **`DEPLOYMENT_DECISION.md`**
   - Quick reference card
   - Essential commands
   - One-page summary

---

## 🚀 Quick Start

### Prerequisites

- AWS IAM account access
- RDS PostgreSQL instance created (see AWS_SETUP_GUIDE.md Step 1)
- EC2 instance created with Docker installed (see AWS_SETUP_GUIDE.md Steps 2-4)
- YOLO model file (`best.pt`) uploaded to EC2

### Deployment Steps

1. **Read the full guide first:**
   ```bash
   # Open in your editor or browser
   open AWS_SETUP_GUIDE.md
   ```

2. **Create RDS PostgreSQL + PostGIS** (AWS Console - Manual)
   - Name: `denguewatch-noorullah-db`
   - Instance: db.t3.micro
   - Enable PostGIS extension

3. **Create EC2 instance** (AWS Console - Manual)
   - Name: `denguewatch-noorullah-ec2`
   - Instance: t3.medium
   - Install Docker and Docker Compose

4. **Upload code and model to EC2:**
   ```bash
   # From your local machine
   scp -i denguewatch-noorullah-key.pem -r . ec2-user@YOUR_EC2_IP:~/denguewatch/
   ```

5. **Configure environment:**
   ```bash
   # On EC2
   cd ~/denguewatch
   cp .env.production.example .env.production
   nano .env.production  # Edit with your RDS endpoint, EC2 IP, etc.
   ```

6. **Create upload directory:**
   ```bash
   sudo mkdir -p /var/denguewatch/uploads
   sudo chown ec2-user:ec2-user /var/denguewatch/uploads
   ```

7. **Build and deploy:**
   ```bash
   export $(cat .env.production | xargs)
   docker-compose -f docker-compose.prod.yml up -d --build
   ```

8. **Run migrations:**
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
   ```

9. **Verify:**
   ```bash
   curl http://YOUR_EC2_IP/api/health
   # Should return: {"ok":true,"database":true,"model":true,"postgis":true}
   ```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Browser (Mobile/Desktop)                   │
└──────────────────┬──────────────────────────┘
                   │ HTTP/HTTPS
                   ↓
┌─────────────────────────────────────────────┐
│  EC2: denguewatch-noorullah-ec2             │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  Nginx (Port 80/443)                   │ │
│  │  - Serves frontend static files        │ │
│  │  - Proxies /api/* to backend           │ │
│  └────────┬───────────────────────────────┘ │
│           │                                  │
│           ↓                                  │
│  ┌────────────────────────────────────────┐ │
│  │  Backend (Port 8000)                   │ │
│  │  - FastAPI + Uvicorn                   │ │
│  │  - YOLO model (6MB in memory)          │ │
│  │  - Image processing                    │ │
│  └────────┬───────────────────────────────┘ │
│           │                                  │
│  Docker Compose manages both containers     │
└───────────┼──────────────────────────────────┘
            │ PostgreSQL protocol (port 5432)
            ↓
┌─────────────────────────────────────────────┐
│  RDS: denguewatch-noorullah-db              │
│  - PostgreSQL 15 + PostGIS                  │
│  - Managed by AWS (not in Docker)           │
│  - Automatic backups                        │
└─────────────────────────────────────────────┘
```

---

## ⚙️ Environment Variables

### Required Variables (.env.production)

```bash
# RDS connection (MUST be configured)
DATABASE_URL=postgresql+psycopg://postgres:PASSWORD@RDS_ENDPOINT:5432/denguewatch

# CORS origins (frontend URL)
CORS_ORIGINS=http://YOUR_EC2_IP,https://your-domain.com

# Frontend API base URL
VITE_API_BASE_URL=http://YOUR_EC2_IP/api

# Officer dashboard authentication
OFFICER_API_TOKEN=your-secure-random-token
```

### Auto-set Variables (in docker-compose.prod.yml)

```bash
MODEL_PATH=/app/models/best.pt
UPLOAD_ROOT=/app/uploads
```

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Both containers running: `docker ps`
- [ ] Health check passes: `curl http://YOUR_EC2_IP/api/health`
- [ ] Frontend loads: Open `http://YOUR_EC2_IP` in browser
- [ ] Backend logs show no errors: `docker-compose logs backend`
- [ ] Database connection works: Check health endpoint shows `"database":true`
- [ ] PostGIS enabled: Health endpoint shows `"postgis":true`
- [ ] YOLO model loaded: Health endpoint shows `"model":true`
- [ ] Can submit test report
- [ ] Officer dashboard accessible: `http://YOUR_EC2_IP/officer`
- [ ] Public map displays: `http://YOUR_EC2_IP/map`

---

## 🛠️ Common Commands

### Container Management

```bash
# Check status
docker ps
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f nginx

# Restart containers
docker-compose -f docker-compose.prod.yml restart

# Stop containers
docker-compose -f docker-compose.prod.yml stop

# Start containers
docker-compose -f docker-compose.prod.yml start

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build

# Stop and remove
docker-compose -f docker-compose.prod.yml down
```

### Database Operations

```bash
# Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Connect to RDS
psql -h YOUR_RDS_ENDPOINT -U postgres -d denguewatch

# Check tables
psql -h YOUR_RDS_ENDPOINT -U postgres -d denguewatch -c "\dt"

# Check PostGIS
psql -h YOUR_RDS_ENDPOINT -U postgres -d denguewatch -c "SELECT PostGIS_version();"
```

### Debugging

```bash
# Exec into backend container
docker-compose -f docker-compose.prod.yml exec backend bash

# Check Python imports
docker-compose -f docker-compose.prod.yml exec backend python -c "from app.inference import ModelInference; print('OK')"

# Test database connection
docker-compose -f docker-compose.prod.yml exec backend python -c "from app.database import engine; print(engine.connect())"

# Check model file
docker-compose -f docker-compose.prod.yml exec backend ls -lh /app/models/best.pt
```

---

## 🚨 Troubleshooting

### Issue: "Cannot connect to database"

```bash
# Check RDS security group allows EC2
# AWS Console > RDS > Security Groups > Inbound rules
# Should allow PostgreSQL (5432) from EC2 security group

# Test connection from EC2
psql -h YOUR_RDS_ENDPOINT -U postgres -d denguewatch
```

### Issue: "YOLO model not found"

```bash
# Verify model file exists
docker-compose -f docker-compose.prod.yml exec backend ls -lh /app/models/best.pt

# Should show: 6.0M file

# If missing, rebuild with model file in place
docker-compose -f docker-compose.prod.yml up -d --build
```

### Issue: "Frontend shows 502 Bad Gateway"

```bash
# Check backend container is running
docker ps | grep backend

# Check backend logs
docker-compose -f docker-compose.prod.yml logs backend

# Restart backend
docker-compose -f docker-compose.prod.yml restart backend
```

### Issue: "Browser geolocation not working"

**Cause:** Geolocation API requires HTTPS in production

**Solution:** Configure HTTPS with Let's Encrypt (see AWS_SETUP_GUIDE.md Step 11)

---

## 📊 Resource Naming Convention

All AWS resources use the prefix: `denguewatch-noorullah-`

```
EC2 Instance:       denguewatch-noorullah-ec2
RDS Database:       denguewatch-noorullah-db
EC2 Security Group: denguewatch-noorullah-ec2-sg
RDS Security Group: denguewatch-noorullah-rds-sg
SSH Key Pair:       denguewatch-noorullah-key
Elastic IP:         denguewatch-noorullah-eip (optional)
S3 Bucket:          denguewatch-noorullah-uploads (optional)
```

**Tags for all resources:**
```
Owner: Noorullah
Project: DengueWatch
Environment: Demo
Course: FYP
```

---

## 💰 Cost Estimate

### Monthly Costs (Part-time usage)

```
EC2 t3.medium (12 hrs/day):  $15
RDS db.t3.micro (24/7):      $15
EBS 20GB:                     $2
S3 + Data Transfer:           $3
────────────────────────────────
Total:                       ~$35/month
```

**Cost optimization:**
- Stop EC2 when not demoing: `aws ec2 stop-instances`
- Keep RDS running (cheap, preserves data)
- Use Elastic IP to maintain same public IP

---

## 🔐 Security Best Practices

1. **Never commit `.env.production`** - Contains secrets
2. **Use strong RDS password** - Generate with `openssl rand -base64 32`
3. **Limit SSH access** - Update security group to allow only your IP
4. **Enable HTTPS** - Required for production geolocation
5. **Regular backups** - Create RDS snapshots before demos
6. **Update Docker images** - Keep base images up to date

---

## 📖 Further Reading

- **Full Deployment Guide:** `AWS_SETUP_GUIDE.md` (step-by-step instructions)
- **Architecture Analysis:** `AWS_DEPLOYMENT_ANALYSIS.md` (why this approach)
- **Quick Reference:** `DEPLOYMENT_DECISION.md` (one-page summary)
- **Options Comparison:** `DEPLOYMENT_COMPARISON.md` (all alternatives)

---

## ✅ Ready to Deploy?

1. Read `AWS_SETUP_GUIDE.md` thoroughly
2. Create RDS instance (Step 1)
3. Create EC2 instance (Step 2)
4. Follow steps 3-11 in the guide
5. Test thoroughly
6. Demo with confidence! 🎉

**Good luck with your deployment!** 🚀
