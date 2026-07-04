# AWS Deployment Analysis for DengueWatch KL

**Project:** Dengue Breeding Habitat Mapping  
**Student:** Noorullah  
**Environment:** Shared AWS IAM account (university project)  
**Goal:** Reliable deployment for university project demo

---

## Executive Summary

**RECOMMENDED APPROACH: Docker Compose on EC2 with RDS PostgreSQL/PostGIS**

This is the best option for your shared AWS account scenario because:

- ✅ Single EC2 instance = complete isolation from other students
- ✅ All resources prefixed with `denguewatch-noorullah-*`
- ✅ No complex orchestration or serverless management
- ✅ Easy to debug, monitor, and demo
- ✅ Cost-effective for university project
- ✅ Can be torn down completely without affecting others
- ✅ HTTPS support recommended (browser geolocation requires secure context)

**Estimated monthly cost:** $30-50 (t3.medium EC2 + db.t3.micro RDS + minimal S3)

**Important Architecture Notes:**

- Docker Compose on EC2 only runs: **nginx (frontend) + FastAPI backend**
- PostgreSQL database is **NOT in a container** - it runs on RDS (managed service)
- RDS must be created separately via AWS Console before deploying Docker Compose
- "One docker-compose up" deploys the EC2 application containers only, not the database

**HTTPS Strongly Recommended:**

- Browser Geolocation API requires secure context (HTTPS) in production
- Without HTTPS, geolocation will fail on mobile devices and remote access
- Use Let's Encrypt for free SSL certificates (see deployment guide)

---

## Repository Analysis

### Current Architecture

**Frontend:**

- Vite + React + TypeScript SPA
- Dependencies: React 19, React Router, Leaflet maps, Lucide icons
- Build output: ~736KB (21 files)
- Build command: `npm run build` → produces static files in `dist/`
- Environment variables: `VITE_API_BASE_URL` (API endpoint)

**Backend:**

- FastAPI (Python) REST API
- Dependencies: FastAPI, SQLAlchemy, Alembic, Ultralytics YOLO, Pillow, psycopg
- YOLO model file: `best.pt` (6.0 MB)
- Image processing: Pillow for thumbnails
- AI inference: Ultralytics YOLO v8 for habitat detection
- CORS-enabled for frontend access

**Database:**

- PostgreSQL 18+ with PostGIS extension (CRITICAL requirement)
- Alembic migrations for schema management
- Tables: `reports` (with geography columns), `hotspots` (spatial mirror)
- PostGIS features: geography points, GiST spatial indexes, ST_Distance queries

**Storage Requirements:**

- User-uploaded images (original + thumbnails)
- Currently: `backend/uploads/` (7.7 MB locally)
- Production: Needs persistent storage (S3 or EBS volume)

**Current public edge:**

- Amazon CloudFront is implemented at `d2yol17g6mes38.cloudfront.net`
- CloudFront origin and cache behavior are managed outside this repository and must be verified in AWS Console

**Environment Variables (Backend):**

```
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/dbname
MODEL_PATH=/app/models/best.pt
UPLOAD_ROOT=/app/uploads
CORS_ORIGINS=https://your-frontend-domain.com
IDENGUE_HOTSPOT_ENDPOINT=https://mygis.mysa.gov.my/... (external API)
```

Optional prototype-only variable:

```
OFFICER_API_TOKEN=secure-random-token
```

**Environment Variables (Frontend):**

```
VITE_API_BASE_URL=https://api.your-domain.com/api
```

---

## Deployment Options Comparison

### Option 1: Docker Compose on EC2 + RDS (RECOMMENDED ⭐)

**Architecture:**

```
┌─────────────────────────────────────────────────────────────┐
│ CloudFront (implemented public edge)                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ EC2 (t3.medium, 20GB EBS application origin)                │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Nginx      │  │   Frontend   │  │   Backend    │      │
│  │   (port 80)  │─→│   (React)    │  │   (FastAPI)  │      │
│  │              │  │   static     │  │   + YOLO     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                                     ↓              │
│    Docker Compose                       Model (6MB)         │
│                                        Uploads (EBS)         │
└─────────────────────────────────────────────────────────────┘
                          ↓
            ┌──────────────────────────┐
            │ RDS PostgreSQL + PostGIS │
            │   (db.t3.micro)          │
            └──────────────────────────┘
                          ↓
            ┌──────────────────────────┐
            │  S3 (optional backup)    │
            │  denguewatch-noorullah-imgs  │
            └──────────────────────────┘
```

**Pros:**

- ✅ Complete isolation: Your EC2 instance won't interfere with other students
- ✅ Simple: One docker-compose.yml manages everything
- ✅ Easy debugging: SSH in and check logs with `docker logs`
- ✅ Predictable: No cold starts, no Lambda timeouts
- ✅ Cost-effective: Single EC2 + small RDS = ~$30-50/month
- ✅ Model persistence: YOLO model stays loaded in memory
- ✅ Resource control: Can scale EC2 if needed for demo day
- ✅ Unique naming: `denguewatch-noorullah-ec2`, `denguewatch-noorullah-db`

**Cons:**

- ⚠️ Manual SSL: Need to configure Let's Encrypt or use ACM with ALB
- ⚠️ Uptime: If EC2 stops, entire app stops (but fine for project demo)
- ⚠️ No auto-scaling: But not needed for university project

**Why this beats other options for your use case:**

- Unlike Lambda/Fargate: No cold start delays for YOLO inference (6MB model)
- Unlike Elastic Beanstalk: More control, easier to debug
- Unlike manual EC2: Docker Compose = reproducible, no dependency hell
- Unlike RDS on EC2: Managed RDS = automatic backups, easier PostGIS setup

**Estimated Costs:**

- EC2 t3.medium (2 vCPU, 4GB RAM): ~$30/month
- RDS db.t3.micro (PostgreSQL + PostGIS): ~$15/month
- EBS 20GB: ~$2/month
- Data transfer: ~$1-5/month (low traffic)
- **Total: $48-52/month** (can stop instances when not demoing)

---

### Option 2: EC2 Manual Deployment (NOT RECOMMENDED)

**Architecture:** Install Node, Python, PostgreSQL, PostGIS directly on EC2

**Pros:**

- ✅ Full control
- ✅ No Docker learning curve

**Cons:**

- ❌ Dependency hell: Manual PostgreSQL + PostGIS installation
- ❌ Hard to reproduce: If something breaks, hard to reset
- ❌ No isolation: Processes share system resources
- ❌ Messy rollback: No easy way to revert changes
- ❌ Port conflicts: Manual nginx/process management

**Verdict:** Skip this. Docker Compose is easier and more reliable.

---

### Option 3: Elastic Beanstalk (Moderate Complexity)

**Architecture:** Managed EC2 deployment with auto-scaling, load balancer

**Pros:**

- ✅ AWS-managed: Auto-scaling, health monitoring
- ✅ Easy deployment: `eb deploy` from CLI
- ✅ Built-in load balancer and SSL

**Cons:**

- ❌ Complex for shared account: Creates multiple resources (ALB, ASG, CloudWatch)
- ❌ Harder to isolate: More AWS resources = more naming conflicts possible
- ❌ PostGIS complications: Need to ensure PostGIS extension in RDS
- ❌ YOLO model cold starts: If instances scale down, model reload delays
- ❌ Overkill: Auto-scaling not needed for university project
- ❌ Debugging: Logs scattered across CloudWatch, harder to troubleshoot

**Verdict:** Too complex for a shared student account. Stick with Docker on EC2.

---

### Option 4: ECS/Fargate (Too Complex)

**Architecture:** Containerized deployment with managed orchestration

**Pros:**

- ✅ Scalable containers
- ✅ No EC2 management

**Cons:**

- ❌ Steep learning curve: ECS tasks, services, task definitions
- ❌ Complex networking: VPC, subnets, security groups, ALB
- ❌ Cold starts: Fargate tasks take 30-60s to start (bad for demos)
- ❌ YOLO model: 6MB model needs to load on every cold start
- ❌ Cost: ALB (~$16/month) + Fargate tasks + RDS = more expensive
- ❌ Debugging nightmare: CloudWatch logs, task failures, hard to SSH
- ❌ Shared account risk: More resources = more chances to conflict

**Verdict:** Overkill for a university project. ECS is for production apps with high traffic.

---

### Option 5: Amplify/S3 Frontend + Separate Backend (Split Architecture)

**Architecture:**

- Frontend: S3 + CloudFront (static hosting)
- Backend: Lambda + API Gateway OR EC2
- Database: RDS PostgreSQL + PostGIS

**Pros:**

- ✅ Fast frontend: CloudFront CDN globally
- ✅ Scalable frontend: S3 = unlimited static file hosting

**Cons:**

- ❌ Backend bottleneck: Lambda has cold starts (bad for YOLO)
- ❌ Lambda limits: 6MB YOLO model + Ultralytics = package size issues
- ❌ Complex: Multiple deployment pipelines (frontend vs backend)
- ❌ CORS complexity: API Gateway + CloudFront = CORS headaches
- ❌ Cost: CloudFront + API Gateway + Lambda + RDS = more expensive
- ❌ If backend on EC2: Still need Docker, so why split?

**Verdict:** Splitting frontend/backend adds complexity without benefit for a demo project.

---

### Option 6: RDS vs PostgreSQL on EC2

**RDS PostgreSQL + PostGIS (RECOMMENDED):**

- ✅ Automatic backups
- ✅ Easy PostGIS: Just enable extension
- ✅ Managed updates
- ✅ Better security: VPC security groups
- ✅ Separate from EC2: If EC2 crashes, DB is safe
- Cost: ~$15/month (db.t3.micro)

**PostgreSQL on EC2 (via Docker):**

- ✅ Slightly cheaper (~$5/month EBS instead of $15 RDS)
- ❌ Manual backups
- ❌ If EC2 crashes, DB might corrupt
- ❌ More work: PostGIS setup, tuning, backups

**Verdict:** RDS is worth the extra $10/month for peace of mind during demos.

---

## Recommended Deployment Plan

### Architecture: Docker Compose on EC2 + RDS

**Step-by-step deployment:**

#### Phase 1: AWS Resources Setup (Manual via AWS Console)

1. **Create RDS PostgreSQL Instance**
   - Name: `denguewatch-noorullah-db`
   - Engine: PostgreSQL 15+ (supports PostGIS)
   - Instance: db.t3.micro
   - Storage: 20GB GP3
   - Enable PostGIS: Connect and run `CREATE EXTENSION postgis;`
   - VPC: Default VPC (shared with EC2)
   - Security Group: Allow port 5432 from EC2 security group

2. **Create EC2 Instance**
   - Name: `denguewatch-noorullah-ec2`
   - AMI: Amazon Linux 2023 or Ubuntu 22.04
   - Instance type: t3.medium (2 vCPU, 4GB RAM for YOLO)
   - Storage: 20GB GP3 EBS
   - Security Group: Allow ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
   - Key pair: Create/download `denguewatch-noorullah-key.pem`

3. **Create S3 Bucket (Optional but recommended)**
   - Name: `denguewatch-noorullah-uploads`
   - Region: Same as EC2/RDS
   - Block public access: Keep ON (images served via backend API)
   - Versioning: Enable (for backup)
   - Purpose: Backup uploaded images from EBS to S3

4. **Security Groups**
   - `denguewatch-noorullah-ec2-sg`: Inbound 22, 80, 443 from 0.0.0.0/0
   - `denguewatch-noorullah-rds-sg`: Inbound 5432 from EC2 security group only

#### Phase 2: EC2 Setup

SSH into EC2:

```bash
chmod 400 denguewatch-noorullah-key.pem
ssh -i denguewatch-noorullah-key.pem ec2-user@<EC2_PUBLIC_IP>
```

Install Docker & Docker Compose:

```bash
# Amazon Linux 2023
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -a -G docker ec2-user
```

```bash
# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Log out and back in for group changes
exit
ssh -i denguewatch-noorullah-key.pem ec2-user@<EC2_PUBLIC_IP>
```

#### Phase 3: Deploy Application

Clone repository (or upload via SCP/Git):

```bash
cd /home/ec2-user
git clone <your-repo-url> denguewatch
cd denguewatch
```

Create production environment file:

```bash
cat > .env.production <<EOF
# Backend
DATABASE_URL=postgresql+psycopg://postgres:YOUR_RDS_PASSWORD@denguewatch-noorullah-db.xxxxx.us-east-1.rds.amazonaws.com:5432/denguewatch
MODEL_PATH=/app/models/best.pt
UPLOAD_ROOT=/app/uploads
CORS_ORIGINS=http://<EC2_PUBLIC_IP>
```

```bash
# Frontend
VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>/api
EOF
```

If you are using the experimental officer-only prototype endpoints, add:

```bash
OFFICER_API_TOKEN=$(openssl rand -hex 32)
```

Build and start containers:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Check logs:

```bash
docker-compose -f docker-compose.prod.yml logs -f
```

#### Phase 4: Database Migrations

Run Alembic migrations:

```bash
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

Enable PostGIS (if not done during RDS setup):

```bash
docker-compose -f docker-compose.prod.yml exec backend python -c "
from app.database import engine
engine.execute('CREATE EXTENSION IF NOT EXISTS postgis;')
"
```

#### Phase 5: Access Application

- Frontend: CloudFront URL, custom domain, or `http://<EC2_PUBLIC_IP>` when testing the origin directly
- Backend API: `http://<EC2_PUBLIC_IP>/api/health`
- Public map: `http://<EC2_PUBLIC_IP>/map`
- Experimental officer dashboard (out of scope): `http://<EC2_PUBLIC_IP>/officer`

---

## Required Files to Create

I will prepare these Docker configuration files:

1. **`Dockerfile.backend`** - Backend container with Python, FastAPI, YOLO
2. **`Dockerfile.frontend`** - Frontend build container
3. **`docker-compose.prod.yml`** - Orchestration for nginx + backend + frontend
4. **`nginx.conf`** - Reverse proxy config (frontend static + backend API)
5. **`.dockerignore`** - Exclude unnecessary files from containers
6. **`deploy.sh`** - Helper script for deployment
7. **`AWS_DEPLOYMENT_GUIDE.md`** - Step-by-step manual deployment guide

---

## Key Considerations for Shared AWS Account

### Resource Naming Strategy

ALL resources MUST use the prefix `denguewatch-noorullah-` to avoid conflicts:

- EC2 instance: `denguewatch-noorullah-ec2`
- RDS database: `denguewatch-noorullah-db`
- S3 bucket: `denguewatch-noorullah-uploads`
- Security groups: `denguewatch-noorullah-ec2-sg`, `denguewatch-noorullah-rds-sg`
- Key pair: `denguewatch-noorullah-key`
- IAM role (if needed): `denguewatch-noorullah-ec2-role`

### Safety Rules

1. **Never delete resources without prefix check**
   - Always verify resource name starts with `denguewatch-noorullah-`
   - Use AWS Console tags: `Project=DengueWatch, Owner=Noorullah`

2. **Use AWS Resource Tags**

   ```
   Project: DengueWatch
   Owner: Noorullah
   Environment: Demo
   Course: FYP
   ```

3. **Separate VPC (Optional but safer)**
   - Create a dedicated VPC: `denguewatch-noorullah-vpc`
   - This completely isolates your network from other students
   - AWS Free Tier includes 1 VPC

4. **Resource Limits**
   - Use only 1 EC2 instance (t3.medium)
   - Use only 1 RDS instance (db.t3.micro)
   - Avoid creating multiple load balancers or NAT gateways (expensive)

5. **Clean Shutdown for Demos**
   - Stop EC2 when not demoing (saves $$$)
   - Keep RDS running (cheap, preserves data)
   - Use Elastic IP to keep same public IP after stop/start

---

## YOLO Model Deployment

### Challenge: 6MB Model File

Your YOLO model (`best.pt`) is 6MB. Options:

**Option A: Bundle in Docker Image (RECOMMENDED)**

- Include `best.pt` in the Docker image during build
- Model loads once when container starts
- No cold start delays
- Docker image size: ~2GB (base Python + dependencies + model)

**Option B: Download from S3 on Startup**

- Store model in S3: `s3://denguewatch-noorullah-models/best.pt`
- Container downloads on startup
- Pros: Smaller Docker image
- Cons: Adds 5-10s startup delay, requires S3 access

**Recommendation:** Option A (bundle in image). Docker images can be 2-3GB easily.

---

## PostGIS Setup on RDS

PostgreSQL + PostGIS is CRITICAL for your geography columns and spatial queries.

### RDS PostGIS Enablement

After creating RDS PostgreSQL instance:

```sql
-- Connect via psql or pgAdmin
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT PostGIS_version();
```

Verify PostGIS in your backend health check:

```bash
curl http://<EC2_IP>/api/health
# Should show: {"postgis": true}
```

---

## Image Upload Strategy

User-uploaded images need persistent storage.

### Option A: EBS Volume (RECOMMENDED for simplicity)

- Mount EBS volume to EC2: `/var/denguewatch/uploads`
- Docker volume: `-v /var/denguewatch/uploads:/app/uploads`
- Pros: Simple, no code changes, fast access
- Cons: If EC2 terminates, need to reattach volume

### Option B: S3 (Better for production)

- Update `app/image_storage.py` to use boto3
- Store uploads in `s3://denguewatch-noorullah-uploads/`
- Serve via backend API (presigned URLs)
- Pros: Durable, can survive EC2 termination
- Cons: Requires code changes, boto3 setup

**Recommendation for Demo:** Start with EBS (Option A), optionally migrate to S3 later.

---

## SSL/HTTPS (Optional for Demo)

For `https://` access (not required but professional):

### Option 1: Let's Encrypt (Free, on EC2)

```bash
# Install Certbot
sudo yum install -y certbot python3-certbot-nginx

# Get certificate (requires domain name)
sudo certbot --nginx -d denguewatch-noorullah.yourdomain.com
```

### Option 2: Application Load Balancer + ACM

- Create ALB: `denguewatch-noorullah-alb`
- Request ACM certificate (requires domain)
- ALB terminates SSL, forwards HTTP to EC2
- Cost: ~$16/month for ALB

**Recommendation:** Skip SSL for demo unless your lecturer requires HTTPS.

---

## Monitoring & Debugging

### Essential Commands

**Check container status:**

```bash
docker ps
docker-compose logs -f backend
docker-compose logs -f nginx
```

**Backend health:**

```bash
curl http://localhost/api/health
```

**Database connection test:**

```bash
docker-compose exec backend python -c "from app.database import engine; print(engine.connect())"
```

**YOLO model test:**

```bash
docker-compose exec backend python -c "from app.inference import ModelInference; from app.config import settings; m = ModelInference(settings.model_path); m.load(); print(m.ready)"
```

### CloudWatch Logs (Optional)

Install CloudWatch agent on EC2 to push logs:

```bash
sudo yum install -y amazon-cloudwatch-agent
```

Configure to push Docker logs to CloudWatch Logs group: `denguewatch-noorullah-logs`

---

## Backup Strategy

### Database Backups

- RDS automatic backups: Enabled by default (7-day retention)
- Manual snapshot before demo: Via AWS Console

### Code Backups

- Git repository (already backed up)
- Tag production version: `git tag v1.0-demo`

### Uploaded Images Backup

```bash
# Sync EBS uploads to S3 (daily cron job)
aws s3 sync /var/denguewatch/uploads s3://denguewatch-noorullah-uploads/backups/
```

---

## Cost Optimization

### Stop Resources When Not Demoing

**Before bed or weekends:**

```bash
# Stop EC2 (saves ~$20/month)
aws ec2 stop-instances --instance-ids i-xxxxx

# Keep RDS running (cheap, preserves data)
```

**Before demo:**

```bash
# Start EC2
aws ec2 start-instances --instance-ids i-xxxxx

# Get new public IP (or use Elastic IP to keep same IP)
aws ec2 describe-instances --instance-ids i-xxxxx --query 'Reservations[0].Instances[0].PublicIpAddress'
```

### Estimated Monthly Costs

**Full-time running:**

- EC2 t3.medium: $30
- RDS db.t3.micro: $15
- EBS 20GB: $2
- S3 + Data Transfer: $3
- **Total: ~$50/month**

**Part-time (12 hours/day):**

- EC2 t3.medium (50% uptime): $15
- RDS db.t3.micro (always on): $15
- EBS + S3: $5
- **Total: ~$35/month**

---

## Disaster Recovery Plan

### If EC2 Crashes

1. Check CloudWatch logs or SSH
2. Restart containers: `docker-compose up -d`
3. If Docker broken, reboot EC2
4. If EC2 terminated, launch new one:
   - Reattach EBS volume with uploads
   - Pull latest code from Git
   - Run `docker-compose up -d`
   - Database is safe on RDS

### If Database Corrupts

1. Restore from RDS automatic backup (last 7 days)
2. Or restore from manual snapshot

### If Wrong Resource Deleted

- **Prevention:** Tag all resources with `Owner=Noorullah`
- **AWS Console:** Use filters to show only your resources
- **CLI:** Always include resource name check: `--filters "Name=tag:Owner,Values=Noorullah"`

---

## Why Not Other Options?

### Why Not Lambda?

- ❌ YOLO model (6MB + Ultralytics libs) = package too large (Lambda limit: 50MB zipped, 250MB unzipped)
- ❌ Cold starts: 10-30s for YOLO to load
- ❌ Complex: Need API Gateway, S3 layers, RDS proxy
- ❌ Timeout: Lambda max 15 minutes (fine for inference, but complex to configure)

### Why Not Amplify Hosting?

- ❌ Amplify is great for frontend, but backend needs custom compute
- ❌ Still need EC2/Lambda for FastAPI + YOLO
- ❌ More expensive: Amplify hosting + Lambda/EC2 > just EC2

### Why Not App Runner?

- ✅ AWS App Runner is actually a good option (managed containers)
- ⚠️ But: Less control than Docker Compose on EC2
- ⚠️ Cost: Similar to EC2 t3.medium, but harder to stop/start
- ⚠️ Debugging: Less access than SSH into EC2

**Verdict:** App Runner is a close second choice if Docker Compose feels too manual.

---

## Alternative: App Runner (Close Second)

If you want more AWS-managed approach:

**Architecture:**

- Frontend: S3 + CloudFront
- Backend: AWS App Runner (containerized FastAPI)
- Database: RDS PostgreSQL + PostGIS

**Pros:**

- ✅ No EC2 management
- ✅ Auto-scaling (though not needed)
- ✅ Built-in load balancing

**Cons:**

- ❌ Split deployment (frontend separate from backend)
- ❌ Less SSH debugging
- ❌ Similar cost to EC2

---

## Final Recommendation Summary

### 🏆 Winner: Docker Compose on EC2 + RDS

**Why:**

1. **Simplicity:** One `docker-compose up -d` deploys everything
2. **Isolation:** Your EC2/RDS won't interfere with other students
3. **Debugging:** SSH in, check logs, restart containers easily
4. **Cost:** ~$35-50/month, can stop EC2 when not demoing
5. **Reliability:** No cold starts, YOLO model stays loaded
6. **Safety:** Unique `denguewatch-noorullah-*` naming prevents conflicts
7. **Demo-ready:** Predictable performance, no Lambda timeouts

**What you get:**

- Frontend + Backend on same EC2 (Nginx reverse proxy)
- RDS PostgreSQL + PostGIS (managed, backed up)
- EBS persistent storage for uploads
- Optional S3 backup for images
- SSH access for debugging
- Docker Compose for easy updates

---

## Next Steps

### Immediate Actions (Before AWS Deployment)

1. ✅ **Review this analysis** - Make sure you understand the architecture
2. ⏳ **I will create Docker files** - Dockerfile, docker-compose.yml, nginx.conf
3. ⏳ **I will create deployment guide** - Step-by-step AWS setup instructions
4. ⏳ **Test locally** - Run Docker Compose on your Mac first
5. ⏳ **AWS Console preparation** - Check AWS IAM permissions with lecturer

### AWS Deployment Actions (After Approval)

1. Create RDS instance: `denguewatch-noorullah-db`
2. Enable PostGIS on RDS
3. Create EC2 instance: `denguewatch-noorullah-ec2`
4. SSH into EC2, install Docker
5. Upload code and YOLO model
6. Run Docker Compose
7. Test: `curl http://<EC2_IP>/api/health`
8. Demo! 🎉

---

## Questions to Confirm Before I Proceed

1. **Do you approve the Docker Compose on EC2 + RDS approach?**
2. **Do you have a domain name, or should we use EC2 public IP?**
3. **Do you need HTTPS/SSL for demo?**
4. **Should I create the Docker files now?**
5. **Do you want S3 for images, or EBS volume is fine?**

Let me know and I'll create all the deployment files! 🚀
