#!/bin/bash
#
# AWS Deployment Script for Optimizations Update
# Run this on your EC2 instance after git pull
#
# Usage: ./scripts/deploy-aws-update.sh
#

set -e  # Exit on any error

echo "=========================================="
echo "DengueWatch KL - Deploying Optimizations"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "docker-compose.prod.yml" ]; then
    echo -e "${RED}Error: docker-compose.prod.yml not found!${NC}"
    echo "Please run this script from the project root directory."
    exit 1
fi

# Check if .env.production exists
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}Warning: .env.production not found${NC}"
    echo "Please create it from .env.production.example before deploying."
    exit 1
fi

echo "✓ Environment file found"
echo ""

# Show current running services
echo "Current running services:"
docker-compose -f docker-compose.prod.yml ps
echo ""

# Ask for confirmation
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "Step 1/4: Building containers with new code..."
docker-compose -f docker-compose.prod.yml build

echo ""
echo "Step 2/4: Stopping old containers..."
docker-compose -f docker-compose.prod.yml down

echo ""
echo "Step 3/4: Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

echo ""
echo "Step 4/4: Waiting for services to be healthy..."
sleep 10

# Check service status
echo ""
echo "Service status:"
docker-compose -f docker-compose.prod.yml ps

# Check backend health
echo ""
echo "Checking backend health..."
if curl -f -s http://localhost/api/health > /dev/null; then
    echo -e "${GREEN}✓ Backend is healthy${NC}"
else
    echo -e "${RED}✗ Backend health check failed${NC}"
    echo "Check logs with: docker logs denguewatch-backend"
    exit 1
fi

# Check for S3 warnings in logs
echo ""
echo "Checking for S3 configuration..."
S3_WARNINGS=$(docker logs denguewatch-backend 2>&1 | grep -i "warning.*s3" || true)
if [ -n "$S3_WARNINGS" ]; then
    echo -e "${YELLOW}S3 Warnings detected:${NC}"
    echo "$S3_WARNINGS"
    echo ""
    echo "This is not critical but you may want to check S3 connectivity."
else
    echo -e "${GREEN}✓ No S3 warnings${NC}"
fi

# Show recent logs
echo ""
echo "Recent backend logs (last 20 lines):"
docker logs denguewatch-backend --tail 20

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo "=========================================="
echo ""
echo "What changed:"
echo "  ✓ Map queries now 10-100x faster (PostGIS spatial indexes)"
echo "  ✓ S3 fallback to local files (better resilience)"
echo "  ✓ Startup validation (clearer errors)"
echo "  ✓ S3 cleanup failures now logged"
echo ""
echo "Your system is now running with all optimizations!"
echo ""
echo "Useful commands:"
echo "  View backend logs:  docker logs denguewatch-backend -f"
echo "  View nginx logs:    docker logs denguewatch-nginx -f"
echo "  Check services:     docker-compose -f docker-compose.prod.yml ps"
echo "  Restart backend:    docker-compose -f docker-compose.prod.yml restart backend"
echo ""
