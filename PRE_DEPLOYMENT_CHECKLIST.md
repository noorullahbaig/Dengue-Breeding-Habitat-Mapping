# Pre-Deployment Checklist

> Historical checklist. Use [PRODUCTION_DEPLOYMENT.md](/Users/noorullah/Developer/prototype/PRODUCTION_DEPLOYMENT.md) for the current production workflow.

## DengueWatch KL - AWS Production Deployment

**Student:** Noorullah  
**Date:** June 25, 2026

Use this checklist before creating any AWS resources.

---

## ✅ Code and Configuration Ready

### Files Verified

- [x] Dockerfile.backend - Fixed health check
- [x] Dockerfile.frontend - Fixed npm install
- [x] docker-compose.prod.yml - Fixed YAML, security, health checks
- [x] nginx.conf - Fixed nested location blocks
- [x] .env.production.example - Added missing vars
- [x] AWS_SETUP_GUIDE.md - Complete step-by-step guide
- [x] DEPLOYMENT_README.md - Quick reference

### Critical Checks Passed

- [x] No PostgreSQL container in docker-compose
- [x] Backend connects to external RDS via DATABASE_URL
- [x] Backend port NOT publicly exposed (uses `expose` not `ports`)
- [x] Health checks use Python stdlib (no curl/requests needed)
- [x] Frontend build installs all dependencies (not --only=production)
- [x] nginx.conf has valid syntax (no nested regex locations)
- [x] YOLO model exists at expected path (6.0MB verified)
- [x] All resources use `denguewatch-noorullah-*` prefix
- [x] All tags use `Owner: Noorullah`
- [x] No "hamza" references remaining

---

## 📋 Before Creating AWS Resources

### Information You Need

- [ ] AWS IAM credentials from lecturer
- [ ] Decide on AWS region (e.g., us-east-1)
- [ ] (Optional) Domain name for HTTPS

### Passwords to Generate

- [ ] RDS master password (strong, save securely!)
- [ ] Officer API token: `openssl rand -hex 32`

### Files to Prepare

- [ ] Have this repository ready to upload
- [ ] Have YOLO model ready: `/Users/noorullah/Desktop/FYP CODEX/ml_workspace/models/current_yolo/best.pt`

---

## 🗺️ Deployment Order (DO NOT DEVIATE)

### Phase 1: AWS Console Only (No Code Yet)

1. [ ] Create RDS PostgreSQL instance
   - Name: `denguewatch-noorullah-db`
   - Engine: PostgreSQL 15+
   - Instance: db.t3.micro
   - Save endpoint and password!

2. [ ] Enable PostGIS on RDS

   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   SELECT PostGIS_version();
   ```

3. [ ] Create EC2 instance
   - Name: `denguewatch-noorullah-ec2`
   - AMI: Amazon Linux 2023
   - Instance: t3.medium (4GB RAM)
   - Storage: 20GB

4. [ ] Configure security groups
   - RDS: Allow port 5432 from EC2 security group
   - EC2: Allow ports 22, 80, 443

5. [ ] Download SSH key: `denguewatch-noorullah-key.pem`

---

### Phase 2: EC2 Setup (No App Code Yet)

6. [ ] SSH into EC2

   ```bash
   chmod 400 denguewatch-noorullah-key.pem
   ssh -i denguewatch-noorullah-key.pem ec2-user@<EC2_IP>
   ```

7. [ ] Install Docker

   ```bash
   sudo yum update -y
   sudo yum install -y docker
   sudo systemctl start docker
   sudo systemctl enable docker
   sudo usermod -a -G docker ec2-user
   ```

8. [ ] Install Docker Compose

   ```bash
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

9. [ ] Log out and back in for group changes

---

### Phase 3: Upload and Validate

10. [ ] Upload code to EC2 (via git or scp)

11. [ ] Upload YOLO model to EC2

    ```bash
    scp -i key.pem best.pt ec2-user@<IP>:/home/ec2-user/denguewatch/ml_workspace/models/current_yolo/
    ```

12. [ ] Create upload directory on EC2

    ```bash
    sudo mkdir -p /var/denguewatch/uploads
    sudo chown ec2-user:ec2-user /var/denguewatch/uploads
    ```

13. [ ] Create .env.production on EC2

    ```bash
    cp .env.production.example .env.production
    nano .env.production  # Fill in RDS endpoint, EC2 IP, etc.
    ```

14. [ ] Validate on EC2 BEFORE building
    ```bash
    docker compose -f docker-compose.prod.yml config --quiet
    docker run --rm -v $(pwd)/nginx.conf:/etc/nginx/nginx.conf:ro nginx nginx -t
    ls -lh ml_workspace/models/current_yolo/best.pt  # Should be 6.0M
    ```

---

### Phase 4: Deploy

15. [ ] Build and start containers

    ```bash
    export $(cat .env.production | xargs)
    docker compose -f docker-compose.prod.yml up -d --build
    ```

16. [ ] Monitor logs

    ```bash
    docker compose -f docker-compose.prod.yml logs -f
    ```

17. [ ] Run migrations

    ```bash
    docker compose -f docker-compose.prod.yml exec backend alembic upgrade head
    ```

18. [ ] Verify health
    ```bash
    curl http://localhost/api/health
    ```

---

### Phase 5: Verify and Test

19. [ ] Check health endpoint from local machine

    ```bash
    curl http://<EC2_IP>/api/health
    ```

    Expected: `{"ok":true,"database":true,"model":true,"postgis":true}`

20. [ ] Open frontend in browser
    - URL: `http://<EC2_IP>`

21. [ ] Submit test report
    - Navigate to `/report`
    - Upload test image
    - Complete submission

22. [ ] If CloudFront is in front of the app, verify the public entrypoint and cache behavior
    - Current distribution: `https://d2yol17g6mes38.cloudfront.net`
    - Confirm the distribution serves the expected public entrypoint

23. [ ] Check public map
    - URL: `http://<EC2_IP>/map`

24. [ ] Verify uploads persist
    ```bash
    docker compose -f docker-compose.prod.yml restart backend
    ls /var/denguewatch/uploads  # Should contain test upload
    ```

---

### Phase 6: HTTPS (Optional but Recommended)

25. [ ] Get domain name and point to EC2 Elastic IP

26. [ ] Install Certbot

    ```bash
    sudo yum install -y certbot
    ```

27. [ ] Get SSL certificate

    ```bash
    sudo certbot certonly --standalone -d your-domain.com
    ```

28. [ ] Update docker-compose.prod.yml (uncomment volumes)

29. [ ] Update nginx.conf (uncomment HTTPS server block)

30. [ ] Rebuild and restart

    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```

31. [ ] Test HTTPS
    ```bash
    curl https://your-domain.com/api/health
    ```

---

## ⚠️ Common Mistakes to Avoid

### DO NOT:

- ❌ Expose backend port 8000 publicly (use `expose` not `ports`)
- ❌ Forget to create /var/denguewatch/uploads directory
- ❌ Forget to enable PostGIS on RDS before migrations
- ❌ Run migrations before docker-compose is fully up
- ❌ Use --only=production for npm install (breaks build)
- ❌ Use curl or requests in health checks (not installed)
- ❌ Create a PostgreSQL container in docker-compose
- ❌ Forget to load .env.production before docker-compose up
- ❌ Skip validation steps on EC2 before building

### DO:

- ✅ Create RDS separately via AWS Console
- ✅ Use Python stdlib for health checks
- ✅ Verify YOLO model file exists before building
- ✅ Create upload directory BEFORE starting containers
- ✅ Enable PostGIS BEFORE running migrations
- ✅ Load environment variables before docker-compose
- ✅ Monitor logs during first deployment
- ✅ Test health endpoint before declaring success

---

## 📊 Success Criteria

Deployment is successful when:

- ✅ `docker ps` shows 2 running containers
- ✅ Health endpoint returns all true
- ✅ Frontend loads in browser
- ✅ Can submit a test report
- ✅ Report is available through the resident/public verification path (status lookup or public map, depending on consent and workflow state)
- ✅ Report appears on public map
- ✅ Uploads persist after backend restart
- ✅ No errors in docker logs
- ✅ Database contains test report

---

## 🆘 If Something Goes Wrong

### Container won't start

```bash
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs nginx
```

### Health check fails

```bash
# Check from inside container
docker compose -f docker-compose.prod.yml exec backend python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8000/api/health', timeout=5).read())"
```

### Database connection fails

```bash
# Test from EC2
psql -h <RDS_ENDPOINT> -U postgres -d denguewatch

# Check security group allows EC2
```

### YOLO model not found

```bash
# Verify inside container
docker compose -f docker-compose.prod.yml exec backend ls -lh /app/models/best.pt
```

### Full redeploy

```bash
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📚 Reference Documents

- **Full Guide:** `AWS_SETUP_GUIDE.md`
- **Quick Reference:** `DEPLOYMENT_README.md`
- **Issues Fixed:** `DEPLOYMENT_FIXES_SUMMARY.md`
- **Full Audit:** `DEPLOYMENT_READINESS_REPORT.md`

---

## ✅ Final Check

Before proceeding to AWS:

- [ ] I have read DEPLOYMENT_READINESS_REPORT.md
- [ ] I have read AWS_SETUP_GUIDE.md
- [ ] I understand RDS is created separately (not in Docker)
- [ ] I understand backend port is internal only
- [ ] I have AWS credentials ready
- [ ] I have YOLO model file ready
- [ ] I will follow the deployment order exactly
- [ ] I will validate on EC2 before building

**If all checkboxes are checked, you are ready to proceed!** ✅

---

**Created:** June 25, 2026  
**Status:** READY FOR DEPLOYMENT 🚀
