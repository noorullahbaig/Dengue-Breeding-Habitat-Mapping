# AWS Deployment Decision - Quick Reference

**Student:** Noorullah  
**Project:** DengueWatch KL (Dengue Breeding Habitat Mapping)  
**Date:** June 25, 2026  
**Environment:** Shared AWS IAM Account (University)

---

## ⭐ RECOMMENDED SOLUTION

### Docker Compose on EC2 + RDS PostgreSQL + PostGIS

**Why this solution:**
1. ✅ **Isolation:** Your EC2 instance = complete isolation from other students
2. ✅ **Simplicity:** One `docker-compose up -d` deploys everything
3. ✅ **No cold starts:** YOLO model stays loaded in memory
4. ✅ **Easy debugging:** SSH access + Docker logs
5. ✅ **Cost-effective:** ~$35-50/month (can stop EC2 when not demoing)
6. ✅ **Demo-ready:** Predictable performance, no surprises

---

## 📐 Architecture Overview

```
Users → EC2 (Nginx + Frontend + Backend + YOLO) → RDS (PostgreSQL + PostGIS)
                         ↓
                   S3 (optional backup)
```

**Components:**
- **EC2:** t3.medium (2 vCPU, 4GB RAM, 20GB EBS) - Runs Docker Compose
- **RDS:** db.t3.micro (PostgreSQL 15+ with PostGIS) - Managed database
- **S3:** Optional backup for uploaded images
- **Nginx:** Reverse proxy on EC2 (frontend static + backend API)

---

## 💰 Cost Estimate

| Resource | Uptime | Monthly Cost |
|----------|--------|--------------|
| EC2 t3.medium | 12 hrs/day | $15 |
| RDS db.t3.micro | 24/7 | $15 |
| EBS 20GB | Always | $2 |
| S3 + Transfer | Minimal | $3 |
| **TOTAL** | | **~$35** |

**Cost optimization:**
- Stop EC2 when not demoing (saves $15/month)
- Keep RDS running (cheap, preserves data)
- Use Elastic IP to maintain same public IP

---

## 🛡️ Safety for Shared Account

### Naming Convention
ALL resources prefixed with: `denguewatch-noorullah-`

```
denguewatch-noorullah-ec2       ← EC2 instance
denguewatch-noorullah-db        ← RDS database
denguewatch-noorullah-ec2-sg    ← Security group
```
```
denguewatch-noorullah-rds-sg    ← Security group
denguewatch-noorullah-key       ← SSH key pair
denguewatch-noorullah-uploads   ← S3 bucket
```

### AWS Tags (Apply to all resources)
```
Project: DengueWatch
Owner: Noorullah
Environment: Demo
Course: FYP
```

---

## 🚀 Deployment Steps (High-Level)

### 1. AWS Console Setup
- Create RDS PostgreSQL instance
- Enable PostGIS extension
- Create EC2 instance (t3.medium, Amazon Linux 2023)
- Configure security groups (allow 22, 80, 443)

### 2. EC2 Configuration
- SSH into EC2
- Install Docker + Docker Compose
- Clone repository
- Upload YOLO model file (6MB)

### 3. Application Deployment
- Configure environment variables (.env.production)
- Run `docker-compose up -d`
- Run Alembic migrations
- Test health endpoint

### 4. Verification
- Frontend: `http://<EC2_IP>`
- Backend health: `http://<EC2_IP>/api/health`
- Submit test report
- Check officer dashboard

---

## ❌ Why NOT Other Options

| Option | Why Not |
|--------|---------|
| **Lambda** | YOLO model too large (6MB + libs), cold starts 10-30s |
| **ECS/Fargate** | Too complex for shared account, harder debugging |
| **Elastic Beanstalk** | Overkill, creates too many resources, auto-scaling not needed |
| **Manual EC2** | Dependency hell, hard to reproduce if broken |
| **S3 + Lambda** | Split deployment complexity, Lambda package size limits |

---

## 📊 Critical Requirements Met

✅ **Frontend:** Vite build → Static files served by Nginx  
✅ **Backend:** FastAPI + Uvicorn in Docker container  
✅ **Database:** RDS PostgreSQL 15+ with PostGIS extension  
✅ **AI Model:** YOLO best.pt (6MB) bundled in Docker image  
✅ **Image uploads:** EBS volume persistent storage  
✅ **CORS:** Configured in FastAPI for frontend domain
✅ **Migrations:** Alembic runs on container startup  
✅ **Environment vars:** Passed via docker-compose.prod.yml  
✅ **Isolation:** Unique naming prevents conflicts with other students

---

## 📝 Environment Variables Needed

**Backend:**
```bash
DATABASE_URL=postgresql+psycopg://postgres:PASSWORD@denguewatch-noorullah-db.xxx.rds.amazonaws.com:5432/denguewatch
MODEL_PATH=/app/models/best.pt
UPLOAD_ROOT=/app/uploads
CORS_ORIGINS=http://<EC2_PUBLIC_IP>
OFFICER_API_TOKEN=<generate-random-token>
```

**Frontend:**
```bash
VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>/api
```

---

## 🔧 Essential Commands

**Deploy:**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

**Check logs:**
```bash
docker-compose logs -f backend
docker-compose logs -f nginx
```

**Run migrations:**
```bash
docker-compose exec backend alembic upgrade head
```

**Health check:**
```bash
curl http://<EC2_IP>/api/health
# Expected: {"ok":true,"database":true,"model":true,"postgis":true}
```

**Stop/Start EC2 (save money):**
```bash
# Stop when not demoing
aws ec2 stop-instances --instance-ids i-xxxxx

# Start before demo
aws ec2 start-instances --instance-ids i-xxxxx
```

---

## 🎯 Success Criteria

- ✅ Frontend loads at `http://<EC2_IP>`
- ✅ Health endpoint returns all green
- ✅ Can submit a report with photo
- ✅ YOLO inference works (no 503 errors)
- ✅ Reports visible on public map
- ✅ Officer dashboard accessible
- ✅ Database persists data after EC2 restart
- ✅ No interference with other students' resources

---

## 🆘 Troubleshooting Quick Fixes

**Frontend not loading:**
```bash
docker-compose logs nginx
# Check for port 80 binding errors
```

**Backend 503 errors:**
```bash
docker-compose logs backend
# Check YOLO model path and DATABASE_URL
```

**Database connection failed:**
```bash
# Check RDS security group allows EC2
# Verify DATABASE_URL is correct
docker-compose exec backend python -c "from app.database import engine; print(engine.connect())"
```

**PostGIS not enabled:**
```bash
# Connect to RDS and run:
psql -h denguewatch-noorullah-db.xxx.rds.amazonaws.com -U postgres -d denguewatch
CREATE EXTENSION IF NOT EXISTS postgis;
```

---

## 📚 Documentation Generated

1. ✅ **AWS_DEPLOYMENT_ANALYSIS.md** - Full technical analysis (this was created)
2. ✅ **DEPLOYMENT_COMPARISON.md** - Visual comparison matrix (this was created)
3. ✅ **DEPLOYMENT_DECISION.md** - Quick reference card (you are here)

**Still to create (awaiting your approval):**
- [ ] Dockerfile.backend
- [ ] Dockerfile.frontend
- [ ] docker-compose.prod.yml
- [ ] nginx.conf
- [ ] AWS_SETUP_GUIDE.md (step-by-step Console instructions)
- [ ] deploy.sh (automation script)

---

## 🤝 Next Actions

**Your decisions needed:**
1. ✅ **Approve this approach?** (Docker Compose on EC2 + RDS)
2. ❓ **Domain name?** (or use EC2 public IP?)
3. ❓ **HTTPS needed?** (Let's Encrypt or just HTTP for demo?)
4. ❓ **S3 for images?** (or EBS volume is sufficient?)
5. ❓ **Create Docker files now?** (I'm ready when you are!)

**My recommendation:**
- Use EC2 public IP (simpler, no domain needed)
- HTTP is fine for demo (skip SSL complexity)
- EBS volume for images (S3 backup optional)
- Let me create Docker files and deployment guide now! 🚀

---

## 📞 Summary for Your Lecturer

> "I'm deploying a FastAPI backend with YOLO inference and a React frontend on AWS.  
> Using Docker Compose on EC2 (t3.medium) with RDS PostgreSQL + PostGIS.  
> All resources prefixed `denguewatch-noorullah-*` to isolate from other students.  
> Estimated cost: $35-50/month, can stop EC2 when not demoing.  
> Total control, easy debugging, no cold starts, demo-reliable."

**Files to review:**
- `AWS_DEPLOYMENT_ANALYSIS.md` - Full technical analysis
- `DEPLOYMENT_COMPARISON.md` - Options comparison
- `DEPLOYMENT_DECISION.md` - This file (quick reference)

Ready to proceed! 🎉
