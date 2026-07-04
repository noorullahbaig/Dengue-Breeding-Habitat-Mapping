# AWS Deployment Options Comparison

Quick visual comparison of all deployment strategies for DengueWatch KL.

Scope note: this comparison should be read against the resident/public implementation scope. Prototype officer routes remain in the repository, but they are out of scope for the assessed implementation. The current deployed public edge uses Amazon CloudFront at `d2yol17g6mes38.cloudfront.net`; that does not make the full split S3 + CloudFront + Lambda architecture the current deployment choice.

---

## 📊 Comparison Matrix

| Option                  | Complexity | Cost/Month | Cold Starts | Isolation | Debug Ease | Recommendation  |
| ----------------------- | ---------- | ---------- | ----------- | --------- | ---------- | --------------- |
| **Docker on EC2 + RDS** | ⭐⭐       | $35-50     | ✅ None     | ✅✅✅    | ✅✅✅     | **⭐ BEST**     |
| Manual EC2              | ⭐         | $30-45     | ✅ None     | ✅✅      | ⚠️ Hard    | ❌ Skip         |
| Elastic Beanstalk       | ⭐⭐⭐     | $50-80     | ⚠️ Some     | ⚠️ Medium | ⚠️ Medium  | ⚠️ Overkill     |
| ECS/Fargate             | ⭐⭐⭐⭐   | $60-100    | ❌ 30-60s   | ⚠️ Medium | ❌ Hard    | ❌ Too Complex  |
| Lambda + API GW         | ⭐⭐⭐⭐   | $40-70     | ❌ 10-30s   | ✅ Good   | ❌ Hard    | ❌ Package Size |
| S3 + Lambda + RDS       | ⭐⭐⭐⭐   | $50-90     | ❌ 10-30s   | ✅ Good   | ❌ Hard    | ❌ Split Deploy |
| App Runner + RDS        | ⭐⭐⭐     | $45-65     | ⚠️ Some     | ✅✅      | ⚠️ Medium  | ⚠️ Close 2nd    |

---

## 🏗️ Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│             (Mobile residents + Public viewers in scope)             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 │ HTTP/HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CloudFront (implemented public edge)                               │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EC2 Instance: denguewatch-noorullah-ec2 (t3.medium, 4GB RAM)          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Nginx (Port 80/443)                                         │  │
│  │  - Serves frontend static files                              │  │
│  │  - Reverse proxy /api → backend                              │  │
│  └────────┬─────────────────────────────────────────────────────┘  │
```

```
│           │                                                          │
│           ├─────────► Frontend Container (React/Vite build)        │
│           │            - Static files in /usr/share/nginx/html     │
│           │            - 736KB total size                           │
│           │                                                          │
│           └─────────► Backend Container (FastAPI)                  │
│                        - Python 3.11 + FastAPI + Uvicorn           │
│                        - YOLO model (6MB) pre-loaded in memory     │
│                        - Pillow for image processing               │
│                        - Uploads stored in EBS volume              │
│                                                                      │
│  Docker Compose manages all containers                              │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               │ PostgreSQL protocol (port 5432)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  RDS PostgreSQL: denguewatch-noorullah-db (db.t3.micro)                 │
│  - PostgreSQL 15+ with PostGIS extension                            │
│  - Tables: reports (with geography columns), hotspots               │
│  - Automatic backups (7-day retention)                              │
│  - 20GB GP3 storage                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

                               │
                               │ (Optional) Backup sync
                               ▼

┌─────────────────────────────────────────────────────────────────────┐
│ S3 Bucket: denguewatch-noorullah-uploads (optional) │
│ - Backup of user-uploaded images │
│ - Synced from EC2 EBS volume │
└─────────────────────────────────────────────────────────────────────┘

````

---

## ✅ Why Docker Compose on EC2 Wins

### 1. **Complete Isolation**
- Your EC2 instance = your playground
- No shared compute with other students
- Unique naming: `denguewatch-noorullah-*` prevents all conflicts

### 2. **No Cold Starts**
- YOLO model loads once when container starts
- Stays in memory (4GB RAM on t3.medium is plenty)
- Instant inference for demos

### 3. **Easy Debugging**
```bash
ssh into EC2 → docker logs -f backend → see exactly what's happening
````

### 4. **Simple Updates**

```bash
git pull
docker-compose build
docker-compose up -d
```

### 5. **Cost Control**

- Stop EC2 nights/weekends: Save ~40% ($20/month instead of $30)
- RDS stays running: Cheap ($15/month) and preserves data
- No load balancer needed: Nginx on EC2 handles routing

### 6. **PostGIS Just Works**

- RDS PostgreSQL: Enable PostGIS extension in 1 SQL command
- Your migrations run smoothly
- Geography columns, spatial indexes, ST_Distance all work

### 7. **Demo Confidence**

- No Lambda timeouts
- No Fargate task failures
- No package size errors
- Just works™

---

## ❌ Why Other Options Don't Fit

### Lambda + API Gateway

**Problem:** YOLO model + Ultralytics dependencies = 200MB+ unzipped  
**Lambda limit:** 250MB unzipped (tight fit, risky)  
**Cold starts:** 10-30 seconds for model loading (terrible for demos)

### ECS/Fargate

**Problem:** Complex networking (VPC, subnets, ALB, task definitions)  
**Risk:** Too many moving parts in shared AWS account
**Debugging:** CloudWatch logs scattered, hard to SSH into tasks

### Elastic Beanstalk

**Problem:** Auto-scaling not needed for university project  
**Risk:** Creates ALB, ASG, CloudWatch alarms = many resources to manage  
**Debugging:** More abstraction = harder to troubleshoot

### Manual EC2 (no Docker)

**Problem:** Dependency hell (Python, PostgreSQL, PostGIS, Nginx manual install)  
**Risk:** If something breaks, hard to reproduce  
**No rollback:** Can't easily revert to working state

### S3 + CloudFront + Lambda

**Problem:** Split deployment (frontend separate from backend)  
**Complexity:** Multiple deployment pipelines  
**CORS:** More configuration headaches  
**Cost:** CloudFront + API Gateway + Lambda ≈ EC2 cost anyway

This refers to a full split serverless architecture. It is not a statement that CloudFront is absent from the current deployment edge.

---

## 💰 Cost Breakdown

### Recommended Setup (Part-time usage)

**Running costs:**

- EC2 t3.medium (12 hrs/day): **$15/month**
- RDS db.t3.micro (24/7): **$15/month**
- EBS 20GB: **$2/month**
- S3 backup (optional): **$1/month**
- Data transfer: **$2/month**

**Total: ~$35/month** (stop EC2 when not demoing)

### Full-time vs Part-time

| Resource        | Full-time | Part-time (50%) | Savings |
| --------------- | --------- | --------------- | ------- |
| EC2 t3.medium   | $30       | $15             | $15     |
| RDS db.t3.micro | $15       | $15             | $0      |
| EBS + S3        | $3        | $3              | $0      |
| **Total**       | **$48**   | **$33**         | **$15** |

**Pro tip:** Use Elastic IP ($0 while EC2 running) to keep same IP after stop/start.

---

## 🛡️ Safety in Shared AWS Account

### Resource Naming Convention

```
denguewatch-noorullah-ec2         ← EC2 instance
denguewatch-noorullah-db          ← RDS database
denguewatch-noorullah-ec2-sg      ← Security group (EC2)
denguewatch-noorullah-rds-sg      ← Security group (RDS)
denguewatch-noorullah-key         ← SSH key pair
denguewatch-noorullah-uploads     ← S3 bucket (optional)
denguewatch-noorullah-eip         ← Elastic IP (optional)
```

### AWS Tags (Mandatory)

Apply to ALL resources:

```
Project: DengueWatch
Owner: Noorullah
Environment: Demo
Course: FYP
AutoShutdown: No
```

### Safety Checklist Before Deleting Anything

- ✅ Resource name starts with `denguewatch-noorullah-`?
- ✅ Tag `Owner=Noorullah` present?
- ✅ Not a shared VPC/subnet/security group?
- ✅ Confirmed with `aws describe` command first?

---

## 🚀 Deployment Timeline

### Week 1: Preparation (Local)

- [x] Analyze repository ← **YOU ARE HERE**
- [ ] Create Docker files
- [ ] Create docker-compose.yml
- [ ] Test locally with Docker Compose
- [ ] Verify YOLO model in container
- [ ] Verify PostGIS migration

### Week 2: AWS Setup

- [ ] Create RDS instance
- [ ] Enable PostGIS on RDS
- [ ] Create EC2 instance
- [ ] Configure security groups
- [ ] Allocate Elastic IP (optional)

### Week 3: Deployment

- [ ] SSH into EC2
- [ ] Install Docker + Docker Compose
- [ ] Upload code and YOLO model
- [ ] Configure environment variables
- [ ] Run `docker-compose up -d`
- [ ] Run migrations
- [ ] Test health endpoint
- [ ] Submit test report

### Week 4: Testing & Demo Prep

- [ ] Load test with sample reports
- [ ] Test resident/public end-to-end flow
- [ ] Test public map
- [ ] Backup RDS snapshot
- [ ] Document access URLs
- [ ] Practice demo flow

---

## 📋 Files I Will Create

Once you approve this approach, I will generate:

1. **`Dockerfile.backend`** - FastAPI + YOLO container
2. **`Dockerfile.frontend`** - Vite build container
3. **`docker-compose.yml`** - Local development
4. **`docker-compose.prod.yml`** - Production deployment
5. **`nginx.conf`** - Reverse proxy configuration
6. **`.dockerignore`** - Exclude unnecessary files
7. **`deploy.sh`** - Deployment automation script
8. **`AWS_SETUP_GUIDE.md`** - Step-by-step AWS Console instructions
9. **`TROUBLESHOOTING.md`** - Common issues and solutions
10. **`.env.production.example`** - Production environment template

---

## ✨ Summary

**Recommended:** Docker Compose on EC2 + RDS PostgreSQL  
**Why:** Simple, isolated, debuggable, cost-effective, demo-reliable  
**Cost:** ~$35-50/month (stop EC2 when not demoing)  
**Risk:** Minimal (complete isolation from other students)  
**Complexity:** Low (one `docker-compose up -d` deploys everything)

**Next step:** Get your approval, then I'll create all deployment files! 🎯
