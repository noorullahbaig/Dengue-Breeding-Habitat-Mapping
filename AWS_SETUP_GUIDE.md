# AWS Deployment Setup Guide for DengueWatch KL

**Student:** Noorullah  
**Project:** Dengue Breeding Habitat Mapping  
**Architecture:** Docker Compose on EC2 + RDS PostgreSQL/PostGIS  
**Shared AWS Account:** All resources prefixed with `denguewatch-noorullah-*`

---

## ⚠️ Important Notes Before You Start

1. **Do NOT run AWS CLI commands automatically** - This guide uses AWS Console (web interface)
2. **RDS is separate from Docker Compose** - Docker Compose only runs nginx + backend on EC2
3. **HTTPS is recommended** - Browser geolocation API requires secure context (HTTPS)
4. **Unique naming** - All resources use `denguewatch-noorullah-*` prefix to avoid conflicts
5. **Cost awareness** - Stop EC2 when not demoing to save ~$15/month

---

## 📋 Prerequisites

- [ ] AWS IAM account credentials from your lecturer
- [ ] SSH client (Terminal on Mac/Linux, PuTTY on Windows)
- [ ] AWS Console access: https://console.aws.amazon.com
- [ ] Domain name (optional, for HTTPS)
- [ ] This repository cloned locally

---

## 🗺️ Deployment Overview

```
Step 1: Create RDS PostgreSQL + PostGIS (AWS Console)
Step 2: Create EC2 instance (AWS Console)
Step 3: Configure Security Groups
Step 4: SSH into EC2 and install Docker
Step 5: Upload code and YOLO model to EC2
Step 6: Configure environment variables
Step 7: Run Docker Compose
```
```
Step 8: Run database migrations
Step 9: Test and verify
Step 10: (Optional) Configure HTTPS with Let's Encrypt
```

---

## 📦 Step 1: Create RDS PostgreSQL Instance

### 1.1 Navigate to RDS Service

1. Log in to AWS Console: https://console.aws.amazon.com
2. Search for "RDS" in the top search bar
3. Click "RDS" (Relational Database Service)

### 1.2 Create Database

1. Click **"Create database"** button
2. Choose database creation method: **Standard create**

### 1.3 Engine Options

- **Engine type:** PostgreSQL
- **Version:** PostgreSQL 15.x or newer (PostGIS compatible)
- **Templates:** Free tier (if available) or Dev/Test

### 1.4 Settings

```
DB instance identifier: denguewatch-noorullah-db
Master username: postgres
Master password: [Choose a strong password - SAVE THIS!]
Confirm password: [Same password]
```

**⚠️ IMPORTANT:** Save your master password in a secure location!

### 1.5 Instance Configuration

```
DB instance class: db.t3.micro (or db.t4g.micro for ARM)
```
Storage: 20 GB
Storage autoscaling: Disable (to control costs)
```

### 1.6 Connectivity

```
Virtual private cloud (VPC): Default VPC
Subnet group: default
Public access: No (security best practice)
VPC security group: Create new
  Name: denguewatch-noorullah-rds-sg
Availability Zone: No preference
```

### 1.7 Database Authentication

```
Database authentication: Password authentication
```

### 1.8 Additional Configuration

```
Initial database name: denguewatch
Backup retention: 7 days (automatic backups)
Backup window: No preference
Enable deletion protection: Yes (prevents accidental deletion)
```

### 1.9 Monitoring and Tags

**Tags:**
```
Owner = Noorullah
Project = DengueWatch
Environment = Demo
Course = FYP
```

### 1.10 Create Database

1. Review all settings
2. Click **"Create database"**
3. Wait 5-10 minutes for database to be created
4. Note down the **Endpoint** (e.g., `denguewatch-noorullah-db.xxxxx.us-east-1.rds.amazonaws.com`)

---

## 🖥️ Step 2: Create EC2 Instance

### 2.1 Navigate to EC2 Service

1. Search for "EC2" in AWS Console
2. Click "EC2" (Virtual Servers in the Cloud)
3. Click **"Launch instance"** button

### 2.2 Name and Tags

```
Name: denguewatch-noorullah-ec2

Tags:
  Owner = Noorullah
  Project = DengueWatch
  Environment = Demo
  Course = FYP
```

### 2.3 Application and OS Images (AMI)

```
Quick Start: Amazon Linux
AMI: Amazon Linux 2023 AMI (64-bit x86)
```

**Alternative:** Ubuntu Server 22.04 LTS (also works well)

### 2.4 Instance Type

```
Instance type: t3.medium
  - 2 vCPU
  - 4 GB RAM
  - Needed for YOLO model inference
```

**Why t3.medium?** 
- YOLO model requires ~1.5GB RAM
- FastAPI + Nginx + overhead = 4GB total recommended
- t3.small (2GB) might cause OOM errors

### 2.5 Key Pair (Login)

1. Click **"Create new key pair"**
2. Key pair name: `denguewatch-noorullah-key`
3. Key pair type: RSA
4. Private key format: .pem (for Mac/Linux) or .ppk (for Windows PuTTY)
5. Click **"Create key pair"**
6. **Download and save** the `.pem` file securely

### 2.6 Network Settings

```
VPC: Default VPC (same as RDS)
Subnet: No preference
Auto-assign public IP: Enable
```

**Firewall (Security groups):**
1. Click **"Create security group"**
2. Security group name: `denguewatch-noorullah-ec2-sg`
3. Description: `DengueWatch EC2 security group for Noorullah`

**Inbound rules:**
```
Type          Protocol   Port    Source         Description
SSH           TCP        22      My IP          SSH access
HTTP          TCP        80      0.0.0.0/0      HTTP access
HTTPS         TCP        443     0.0.0.0/0      HTTPS access (optional)
```

**Note:** For "My IP", AWS will auto-detect your current IP. For demo day, you may need to temporarily change this to `0.0.0.0/0` (anywhere).

### 2.7 Configure Storage

```
Volume type: gp3 (General Purpose SSD)
Size: 20 GB
Delete on termination: No (keep data if instance terminates)
```

### 2.8 Advanced Details (Optional)

Leave defaults, or optionally add:

```
IAM instance profile: None (not needed for basic deployment)
```

### 2.9 Summary and Launch

1. Review all settings in the right panel
2. Click **"Launch instance"**
3. Wait 2-3 minutes for instance to start
4. Note down the **Public IPv4 address** (e.g., `54.123.45.67`)

---

## 🔐 Step 3: Configure Security Groups

### 3.1 Allow EC2 to Connect to RDS

1. Go to **EC2 > Security Groups**
2. Find `denguewatch-noorullah-rds-sg`
3. Click on it, then click **"Edit inbound rules"**
4. Add rule:
   ```
   Type: PostgreSQL
   Protocol: TCP
   Port: 5432
   Source: Custom > Select 'denguewatch-noorullah-ec2-sg'
   Description: Allow EC2 access to RDS
   ```
5. Click **"Save rules"**

This allows your EC2 instance to connect to RDS database.

### 3.2 (Optional) Create Elastic IP

To keep the same public IP even after stopping/starting EC2:

1. Go to **EC2 > Elastic IPs**
2. Click **"Allocate Elastic IP address"**
3. Add tags:
   ```
   Name: denguewatch-noorullah-eip
   Owner: Noorullah
   Project: DengueWatch
   ```
4. Click **"Allocate"**
5. Select the new Elastic IP
6. Click **"Actions" > "Associate Elastic IP address"**
7. Instance: Select `denguewatch-noorullah-ec2`
8. Click **"Associate"**

**Note:** Elastic IPs are free while associated with a running instance, but cost $0.005/hour if not associated.

---

## 🔧 Step 4: Install Docker on EC2

### 4.1 Connect to EC2 via SSH

On Mac/Linux Terminal:
```bash
# Set correct permissions on key file
chmod 400 ~/Downloads/denguewatch-noorullah-key.pem

# SSH into EC2 (replace with your actual public IP)
ssh -i ~/Downloads/denguewatch-noorullah-key.pem ec2-user@54.123.45.67
```

On Windows (PowerShell):
```powershell
ssh -i C:\path\to\denguewatch-noorullah-key.pem ec2-user@54.123.45.67
```

**First time connecting?** Type `yes` when asked about host authenticity.

### 4.2 Update System Packages

```bash
sudo yum update -y
```

### 4.3 Install Docker

```bash
# Install Docker
sudo yum install -y docker

# Start Docker service
sudo systemctl start docker

# Enable Docker to start on boot
sudo systemctl enable docker

# Add ec2-user to docker group (avoid using sudo)
sudo usermod -a -G docker ec2-user
```

### 4.4 Install Docker Compose

```bash
# Download Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### 4.5 Log Out and Back In

For group changes to take effect:
```bash
exit
```

Then SSH back in:
```bash
ssh -i ~/Downloads/denguewatch-noorullah-key.pem ec2-user@54.123.45.67
```

Verify Docker works without sudo:
```bash
docker ps
```

---

## 📤 Step 5: Upload Code to EC2

### 5.1 Option A: Using Git (Recommended)

If your code is in a Git repository:

```bash
# On EC2
cd /home/ec2-user
git clone https://github.com/yourusername/denguewatch.git
cd denguewatch
```

### 5.2 Option B: Using SCP (Direct Upload)

From your local machine:

```bash
# Create a tarball of your project (exclude node_modules, .venv, etc.)
cd /Users/noorullah/Developer/prototype
tar --exclude='node_modules' --exclude='.venv' --exclude='backend/.venv' \
    --exclude='dist' --exclude='backend/uploads' --exclude='.git' \
    -czf denguewatch.tar.gz .

# Upload to EC2
scp -i ~/Downloads/denguewatch-noorullah-key.pem \
    denguewatch.tar.gz ec2-user@54.123.45.67:/home/ec2-user/

# SSH into EC2 and extract
ssh -i ~/Downloads/denguewatch-noorullah-key.pem ec2-user@54.123.45.67
cd /home/ec2-user
mkdir denguewatch
cd denguewatch
tar -xzf ../denguewatch.tar.gz
```

### 5.3 Upload YOLO Model File

The YOLO model (`best.pt`, 6MB) needs to be in the correct location:

```bash
# On your local machine
scp -i ~/Downloads/denguewatch-noorullah-key.pem \
    /Users/noorullah/Desktop/FYP\ CODEX/ml_workspace/models/current_yolo/best.pt \
    ec2-user@54.123.45.67:/home/ec2-user/denguewatch/ml_workspace/models/current_yolo/
```

Or create the directory structure on EC2 first:
```bash
# On EC2
mkdir -p /home/ec2-user/denguewatch/ml_workspace/models/current_yolo/
```

Then upload from local machine.

### 5.4 Verify Files

On EC2, verify the structure:
```bash
cd /home/ec2-user/denguewatch
ls -la
# Should see: Dockerfile.backend, Dockerfile.frontend, docker-compose.prod.yml, etc.

ls -lh ml_workspace/models/current_yolo/best.pt
# Should show: 6.0M file
```

---

## ⚙️ Step 6: Configure Environment Variables

### 6.1 Create Production Environment File

On EC2:
```bash
cd /home/ec2-user/denguewatch
cp .env.production.example .env.production
nano .env.production
```

### 6.2 Edit Configuration

Update the following values:

```bash
# DATABASE_URL - Use your RDS endpoint
DATABASE_URL=postgresql+psycopg://postgres:YOUR_RDS_PASSWORD@denguewatch-noorullah-db.c1234567.us-east-1.rds.amazonaws.com:5432/denguewatch

# CORS_ORIGINS - Use your EC2 public IP or domain
CORS_ORIGINS=http://54.123.45.67,https://your-domain.com

# VITE_API_BASE_URL - Frontend API endpoint
VITE_API_BASE_URL=http://54.123.45.67/api

# OFFICER_API_TOKEN - Generate a secure token
OFFICER_API_TOKEN=your-secure-random-token-here
```

**To generate a secure token:**
```bash
openssl rand -hex 32
```

Save and exit nano: `Ctrl+X`, then `Y`, then `Enter`

### 6.3 Create Upload Directory

```bash
# Create persistent upload directory on EC2
sudo mkdir -p /var/denguewatch/uploads
sudo chown ec2-user:ec2-user /var/denguewatch/uploads
sudo chmod 755 /var/denguewatch/uploads
```

---

## 🗄️ Step 7: Enable PostGIS on RDS

Before running migrations, enable PostGIS extension on RDS.

### 7.1 Install PostgreSQL Client on EC2

```bash
sudo yum install -y postgresql15
```

### 7.2 Connect to RDS

```bash
psql -h denguewatch-noorullah-db.c1234567.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d denguewatch
```

Enter your RDS master password when prompted.

### 7.3 Enable PostGIS Extension

```sql
-- Inside psql prompt
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is installed
SELECT PostGIS_version();

-- Should output something like: "3.3 USE_GEOS=1 USE_PROJ=1..."

-- Exit psql
\q
```

---

## 🚀 Step 8: Deploy with Docker Compose

### 8.1 Build and Start Containers

```bash
cd /home/ec2-user/denguewatch

# Load environment variables
export $(cat .env.production | xargs)

# Build and start containers
docker-compose -f docker-compose.prod.yml up -d --build
```

This will:
1. Build the backend Docker image (includes YOLO model)
2. Build the frontend Docker image (static React build)
3. Start nginx container (port 80, 443)
4. Start backend container (port 8000)

**Expected output:**
```
Creating network "denguewatch_denguewatch-network" ... done
Building backend...
Building nginx...
Creating denguewatch-backend ... done
Creating denguewatch-nginx   ... done
```

### 8.2 Check Container Status

```bash
docker ps
```

You should see 2 containers running:
- `denguewatch-backend`
- `denguewatch-nginx`

### 8.3 Check Logs

```bash
# Backend logs (YOLO model loading)
docker-compose -f docker-compose.prod.yml logs -f backend

# Nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# To exit logs: Ctrl+C
```

Look for:
- ✅ "Application startup complete" (backend)
- ✅ Model loaded successfully
- ✅ No database connection errors

---

## 🔄 Step 9: Run Database Migrations

### 9.1 Run Alembic Migrations

```bash
cd /home/ec2-user/denguewatch

# Run migrations inside backend container
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

**Expected output:**
```
INFO  [alembic.runtime.migration] Running upgrade -> 0001_initial_reports
INFO  [alembic.runtime.migration] Running upgrade 0001 -> 0002_report_stacking
INFO  [alembic.runtime.migration] Running upgrade 0002 -> 0003_aws_ready_report_metadata
INFO  [alembic.runtime.migration] Running upgrade 0003 -> 0004_postgis_spatial
```

### 9.2 Verify Database Schema

```bash
# Connect to RDS again
psql -h denguewatch-noorullah-db.c1234567.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d denguewatch
```

Inside psql:
```sql
\dt
-- Should show: reports, hotspots, alembic_version tables

\d reports
-- Should show columns including report_location_geog, public_location_geog

\q
```

---

## ✅ Step 10: Test and Verify

### 10.1 Health Check

From your local machine:
```bash
curl http://54.123.45.67/api/health
```

Expected response:
```json
{
  "ok": true,
  "database": true,
  "model": true,
  "postgis": true,
  "uploadRoot": "/app/uploads",
  "modelPath": "/app/models/best.pt"
}
```

### 10.2 Access Frontend

Open in browser: `http://54.123.45.67`

You should see the DengueWatch KL homepage.

### 10.3 Submit Test Report

1. Click "Report" to start submission flow
2. Allow browser geolocation (you may need HTTPS for this to work on mobile)
3. Upload a test image
4. Complete the report submission
5. Check officer dashboard: `http://54.123.45.67/officer`

### 10.4 Check Backend Logs

```bash
docker-compose -f docker-compose.prod.yml logs backend | tail -50
```

Look for successful report submission logs.

### 10.5 Verify Data in Database

```bash
psql -h denguewatch-noorullah-db.c1234567.us-east-1.rds.amazonaws.com \
     -U postgres \
     -d denguewatch \
     -c "SELECT COUNT(*) FROM reports;"
```

Should show 1 or more reports.

---

## 🔒 Step 11: Configure HTTPS (Recommended)

**Why HTTPS?** Browser Geolocation API requires secure context (HTTPS) in production.

### Option A: Using Let's Encrypt (Free SSL)

#### 11.1 Prerequisites

1. You need a domain name (e.g., `denguewatch.yourdomain.com`)
2. Point domain's A record to your EC2 Elastic IP

#### 11.2 Install Certbot on EC2

```bash
# Install Certbot
sudo yum install -y certbot

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Get SSL certificate (standalone mode)
sudo certbot certonly --standalone -d denguewatch.yourdomain.com
```

Follow prompts:
- Enter email: your-email@example.com
- Agree to terms: Y
- Share email: N (optional)

Certificates will be saved to:
```
/etc/letsencrypt/live/denguewatch.yourdomain.com/fullchain.pem
/etc/letsencrypt/live/denguewatch.yourdomain.com/privkey.pem
```

#### 11.3 Update nginx.conf

On EC2:
```bash
cd /home/ec2-user/denguewatch
nano nginx.conf
```

Uncomment the HTTPS server block and update:
```nginx
server {
    listen 443 ssl http2;
    server_name denguewatch.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/denguewatch.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/denguewatch.yourdomain.com/privkey.pem;
    
    # ... rest of config
}
```

#### 11.4 Update docker-compose.prod.yml

Uncomment the volumes section for nginx:
```yaml
volumes:
  - /etc/letsencrypt:/etc/letsencrypt:ro
```

#### 11.5 Rebuild and Restart

```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

#### 11.6 Test HTTPS

```bash
curl https://denguewatch.yourdomain.com/api/health
```

#### 11.7 Auto-Renewal

Set up auto-renewal cron job:
```bash
sudo crontab -e
```

Add this line:
```
0 3 * * * certbot renew --quiet && docker-compose -f /home/ec2-user/denguewatch/docker-compose.prod.yml restart nginx
```

---

### Option B: Using AWS Certificate Manager (ACM) + Load Balancer

This is more expensive (~$16/month for ALB) but fully managed.

1. Request certificate in AWS Certificate Manager
2. Create Application Load Balancer
3. Configure target group pointing to EC2 instance port 80
4. Use ALB DNS name or Route 53 for custom domain

**For university demo:** Let's Encrypt (Option A) is sufficient.

---

## 🛠️ Maintenance and Management

### Starting/Stopping Containers

```bash
# Stop containers (preserves data)
docker-compose -f docker-compose.prod.yml stop

# Start containers
docker-compose -f docker-compose.prod.yml start

# Restart containers
docker-compose -f docker-compose.prod.yml restart

# Stop and remove containers (data in volumes is preserved)
docker-compose -f docker-compose.prod.yml down
```

### Viewing Logs

```bash
# All containers
docker-compose -f docker-compose.prod.yml logs -f

# Specific container
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f nginx

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Updating Code

```bash
# Pull latest code
cd /home/ec2-user/denguewatch
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml up -d --build
```

### Running Commands in Container

```bash
# Python shell in backend
docker-compose -f docker-compose.prod.yml exec backend python

# Bash shell in backend
docker-compose -f docker-compose.prod.yml exec backend bash

# Run Alembic migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

---

## 💰 Cost Optimization

### Stopping EC2 When Not Demoing

**From AWS Console:**
1. Go to EC2 > Instances
2. Select `denguewatch-noorullah-ec2`
3. Instance state > Stop instance
4. Confirm

**To start again:**
1. Select instance
2. Instance state > Start instance
3. Note the new public IP (if not using Elastic IP)

**Cost savings:** ~$15/month by running 12 hours/day instead of 24/7

### Keeping RDS Running

- RDS db.t3.micro costs ~$15/month regardless of usage
- Stopping RDS is not recommended (takes 7 days to automatically stop, restarts automatically)
- Keep RDS running to preserve data and avoid startup delays

### Using Elastic IP

- Elastic IP is free while associated with a running instance
- $0.005/hour when not associated
- Prevents IP changes when stopping/starting EC2

---

## 🆘 Troubleshooting

### Issue: Frontend shows "Cannot connect to server"

**Diagnosis:**
```bash
docker ps
# Check if both containers are running

docker-compose -f docker-compose.prod.yml logs backend
# Check for errors
```

**Solutions:**
- Verify CORS_ORIGINS includes your EC2 public IP
- Check backend health: `curl http://localhost:8000/api/health` from EC2
- Restart containers: `docker-compose -f docker-compose.prod.yml restart`

### Issue: Backend shows database connection error

**Diagnosis:**
```bash
docker-compose -f docker-compose.prod.yml logs backend | grep -i database
```

**Solutions:**
- Verify RDS security group allows EC2 security group on port 5432
- Check DATABASE_URL in .env.production is correct
- Test connection: `psql -h <RDS_ENDPOINT> -U postgres -d denguewatch`

### Issue: YOLO model not loading

**Diagnosis:**
```bash
docker-compose -f docker-compose.prod.yml exec backend ls -lh /app/models/best.pt
```

**Solutions:**
- Verify model file exists and is 6MB
- Check Dockerfile.backend copies model correctly
- Rebuild: `docker-compose -f docker-compose.prod.yml up -d --build`

### Issue: 502 Bad Gateway

**Diagnosis:**
```bash
docker-compose -f docker-compose.prod.yml logs nginx
docker-compose -f docker-compose.prod.yml logs backend
```

**Solutions:**
- Backend container may have crashed (check logs)
- Restart backend: `docker-compose -f docker-compose.prod.yml restart backend`
- Check backend health: `curl http://backend:8000/api/health` from nginx container

### Issue: Browser geolocation not working

**Cause:** Geolocation API requires HTTPS in production (security requirement)

**Solutions:**
- Set up HTTPS with Let's Encrypt (see Step 11)
- For local testing, use `http://localhost` (allowed without HTTPS)

### Issue: Out of memory (OOM) errors

**Diagnosis:**
```bash
docker stats
# Check memory usage
```

**Solutions:**
- Upgrade to larger instance type (t3.large with 8GB RAM)
- Reduce concurrent requests
- Check for memory leaks in logs

---

## 📊 Monitoring

### Basic Monitoring Commands

```bash
# Docker stats (CPU, memory, network)
docker stats

# Disk usage
df -h

# Container resource usage
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml top
```

### CloudWatch Logs (Optional)

To send logs to AWS CloudWatch:

1. Install CloudWatch agent:
```bash
sudo yum install -y amazon-cloudwatch-agent
```

2. Configure agent to send Docker logs
3. View logs in AWS Console > CloudWatch > Logs

**For demo:** Basic `docker logs` is sufficient.

---

## 🗑️ Cleanup (After Project Ends)

**WARNING:** Only run these commands when you're completely done with the project!

### Delete EC2 Instance

1. AWS Console > EC2 > Instances
2. Select `denguewatch-noorullah-ec2`
3. Instance state > Terminate instance
4. Confirm

### Delete RDS Database

1. AWS Console > RDS > Databases
2. Select `denguewatch-noorullah-db`
3. Actions > Delete
4. Uncheck "Create final snapshot" (or create one for backup)
5. Type "delete me" to confirm
6. Delete

### Delete Security Groups

1. EC2 > Security Groups
2. Select `denguewatch-noorullah-ec2-sg`
3. Actions > Delete security groups
4. Repeat for `denguewatch-noorullah-rds-sg`

### Release Elastic IP

1. EC2 > Elastic IPs
2. Select `denguewatch-noorullah-eip`
3. Actions > Release Elastic IP address
4. Confirm

### Delete S3 Bucket (if created)

1. S3 > Buckets
2. Select `denguewatch-noorullah-uploads`
3. Empty bucket first
4. Delete bucket

---

## 📋 Quick Reference

### Important URLs

```
Frontend: http://YOUR_EC2_IP or https://your-domain.com
Backend API: http://YOUR_EC2_IP/api
Health check: http://YOUR_EC2_IP/api/health
Officer dashboard: http://YOUR_EC2_IP/officer
Public map: http://YOUR_EC2_IP/map
```

### SSH Command

```bash
ssh -i ~/Downloads/denguewatch-noorullah-key.pem ec2-user@YOUR_EC2_IP
```

### Docker Commands

```bash
# Status
docker ps
docker-compose -f docker-compose.prod.yml ps

# Logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart
docker-compose -f docker-compose.prod.yml restart

# Rebuild
docker-compose -f docker-compose.prod.yml up -d --build

# Stop
docker-compose -f docker-compose.prod.yml down
```

### Database Commands

```bash
# Connect to RDS
psql -h YOUR_RDS_ENDPOINT -U postgres -d denguewatch

# Run migrations
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# Check tables
psql -h YOUR_RDS_ENDPOINT -U postgres -d denguewatch -c "\dt"
```

### Resource Names

```
EC2 Instance: denguewatch-noorullah-ec2
RDS Database: denguewatch-noorullah-db
EC2 Security Group: denguewatch-noorullah-ec2-sg
RDS Security Group: denguewatch-noorullah-rds-sg
SSH Key: denguewatch-noorullah-key
Elastic IP: denguewatch-noorullah-eip
S3 Bucket: denguewatch-noorullah-uploads
```

### Tags (Apply to all resources)

```
Owner: Noorullah
Project: DengueWatch
Environment: Demo
Course: FYP
```

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] AWS IAM credentials obtained
- [ ] SSH key pair downloaded and saved
- [ ] YOLO model file (best.pt) ready
- [ ] Domain name configured (optional, for HTTPS)

### RDS Setup
- [ ] RDS PostgreSQL instance created
- [ ] PostGIS extension enabled
- [ ] RDS endpoint noted
- [ ] Master password saved securely

### EC2 Setup
- [ ] EC2 instance created (t3.medium)
- [ ] Security groups configured
- [ ] SSH access working
- [ ] Docker and Docker Compose installed
- [ ] Elastic IP associated (optional)

### Application Deployment
- [ ] Code uploaded to EC2
- [ ] YOLO model uploaded
- [ ] .env.production configured
- [ ] Upload directory created (/var/denguewatch/uploads)
- [ ] Docker images built
- [ ] Containers running
- [ ] Database migrations completed

### Verification
- [ ] Health endpoint returns all green
- [ ] Frontend loads in browser
- [ ] Test report submitted successfully
- [ ] Officer dashboard accessible
- [ ] Public map displays data
- [ ] HTTPS configured (recommended)

### Post-Deployment
- [ ] Test on mobile device
- [ ] Test geolocation (requires HTTPS)
- [ ] Load sample data (optional)
- [ ] Create RDS snapshot (backup)
- [ ] Document access URLs for demo

---

## 🎓 Demo Day Tips

1. **Start EC2 the night before** - Ensure everything is running smoothly
2. **Test on mobile** - Most users will access on phones
3. **Have backup plan** - Keep a video recording of the app working
4. **Monitor logs during demo** - SSH access on laptop for quick debugging
5. **Use Elastic IP** - Prevents IP changes if you restart EC2
6. **Enable HTTPS** - Professional and required for mobile geolocation
7. **Create RDS snapshot** - Backup before demo day
8. **Test officer dashboard** - Demonstrate full workflow
9. **Prepare sample images** - Pre-approved habitat photos
10. **Document everything** - Screenshots, architecture diagrams, this guide

---

## 📞 Support Resources

- **AWS Documentation:** https://docs.aws.amazon.com
- **Docker Documentation:** https://docs.docker.com
- **PostgreSQL + PostGIS:** https://postgis.net/documentation/
- **Let's Encrypt:** https://letsencrypt.org/docs/
- **FastAPI:** https://fastapi.tiangolo.com
- **Ultralytics YOLO:** https://docs.ultralytics.com

---

## ✨ Congratulations!

You've successfully deployed DengueWatch KL to AWS! 🎉

**Next steps:**
1. Test thoroughly
2. Share URL with lecturer
3. Prepare demo presentation
4. Monitor logs during testing
5. Keep this guide handy for troubleshooting

Good luck with your demo! 🚀
