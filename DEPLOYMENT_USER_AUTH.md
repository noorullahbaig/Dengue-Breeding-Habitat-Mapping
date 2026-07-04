# Quick Deployment Guide - User Authentication

## 🎯 What's Ready to Deploy

User authentication with AWS Cognito is **fully implemented and tested**. All changes are backward compatible - existing functionality continues to work.

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure you have:

- [ ] AWS Account access
- [ ] EC2 instance running with existing deployment
- [ ] SSH access to EC2
- [ ] `.env.production` file on EC2

---

## 🚀 Deployment Steps (TL;DR)

### 1. Create Cognito User Pool (10 minutes)

Follow the detailed guide in `AWS_COGNITO_SETUP.md`, or quick steps:

1. Go to [AWS Cognito Console](https://console.aws.amazon.com/cognito/)
2. Click "Create user pool"
3. Configure:
   - Sign-in: **Email**
   - MFA: **No MFA** (for prototype)
   - Self-registration: **Enabled**
   - Required attributes: **email**, **name**
   - Email provider: **Cognito** (free tier)
   - Hosted UI: **Enable** with domain prefix
   - App client: **No client secret**, name it `denguewatch-web-client`
   - Callback URLs: `http://YOUR_EC2_IP/profile`
4. Create pool
5. Copy these values:
   - **User Pool ID**: `us-east-1_XXXXXXXXX`
   - **App Client ID**: `1a2b3c4d5e6f7g8h9i0j1k2l3m`
   - **Region**: `us-east-1` (or your region)

### 2. Deploy to EC2 (5 minutes)

```bash
# 1. Pull latest code
ssh -i your-key.pem ec2-user@YOUR_EC2_IP
cd ~/prototype
git pull origin main

# 2. Update .env.production
nano .env.production
# Add these lines (with your actual values):
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m
# Save (Ctrl+X, Y, Enter)

# 3. Run database migration
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# 4. Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d

# 5. Verify
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs backend | grep -i cognito
```

### 3. Test (5 minutes)

1. Open app: `http://YOUR_EC2_IP`
2. Click **Profile** → **Sign Up**
3. Create account with email/password
4. Check email for verification code
5. Enter code to verify
6. Sign in
7. Submit a report
8. Go to **Activity** page
9. ✅ Your report should appear!

---

## ✅ What's Working Now

### Before (localStorage tracking)
- ❌ Reports only visible on same browser
- ❌ Clear browser data = lose tracked reports
- ❌ Can't see reports on other devices
- ❌ No real user association

### After (Database + Cognito)
- ✅ Reports saved with user in database
- ✅ Cross-device synchronization
- ✅ Survives browser data clearing
- ✅ Real user authentication
- ✅ Profile pictures and names
- ✅ Secure JWT token verification
- ✅ **Anonymous reporting still works!**

---

## 🔍 Quick Verification Commands

```bash
# Check containers are running
docker-compose -f docker-compose.prod.yml ps

# Check backend logs (should see no Cognito errors)
docker-compose -f docker-compose.prod.yml logs backend | tail -50

# Check migration status
docker-compose -f docker-compose.prod.yml exec backend alembic current
# Should show: 0005 (head)

# Check database has users table
docker-compose -f docker-compose.prod.yml exec backend python -c "
from app.database import SessionLocal
from app.models import User
db = SessionLocal()
print(f'Users table exists: {User.__table__.exists(db.bind)}')
db.close()
"

# After signing up a user, verify user was created
docker-compose -f docker-compose.prod.yml exec backend python -c "
from app.database import SessionLocal
from app.models import User
from sqlalchemy import select
db = SessionLocal()
users = db.scalars(select(User)).all()
print(f'Total users: {len(users)}')
for user in users:
    print(f'  - {user.email} ({user.display_name})')
db.close()
"
```

---

## 🐛 Troubleshooting

### Problem: "Cognito authentication not configured on server"

```bash
# Check env vars are set
docker-compose -f docker-compose.prod.yml exec backend env | grep COGNITO

# If empty, check .env.production
cat .env.production | grep COGNITO

# Restart containers to pick up changes
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Problem: Migration fails

```bash
# Check current migration state
docker-compose -f docker-compose.prod.yml exec backend alembic current

# If it shows 0004, run upgrade
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head

# If it shows 0005, you're good!
```

### Problem: Users can't sign up

- Check Cognito User Pool exists
- Verify App Client ID is correct
- Check callback URLs match your domain
- Check frontend environment variables (`VITE_COGNITO_*`)

---

## 📊 Key Metrics to Monitor

After deployment, monitor these:

1. **User sign-ups**: Check Cognito User Pool dashboard
2. **Report submissions**: Both authenticated and anonymous should work
3. **Activity page loads**: Should fetch from `/api/my-reports`
4. **Backend logs**: No Cognito configuration errors
5. **Database**: `users` and `reports.user_id` populated correctly

---

## 🎉 Success Criteria

You've successfully deployed when:

- ✅ Users can sign up with email/password
- ✅ Users can sign in
- ✅ Authenticated users can submit reports
- ✅ Activity page shows user's reports from database
- ✅ Reports persist across devices
- ✅ Anonymous reporting still works
- ✅ No errors in backend logs

---

## 📚 Full Documentation

For detailed information, see:

- **`AWS_COGNITO_SETUP.md`**: Complete Cognito setup with screenshots
- **`USER_AUTHENTICATION_IMPLEMENTATION.md`**: Technical implementation details
- **`DATA_FLOW_ANALYSIS.md`**: Data flow documentation (updated)

---

## ⏱️ Total Time Estimate

- **Cognito setup**: 10 minutes
- **Code deployment**: 5 minutes
- **Testing**: 5 minutes
- **Total**: ~20 minutes

---

## 🔐 Security Notes

- JWT tokens verified with Cognito JWKS
- Tokens expire after 1 hour (Cognito default)
- User data encrypted in transit (HTTPS recommended)
- Reports remain anonymous if user not signed in
- User can only see their own reports
- No breaking changes to existing APIs

---

## 🚨 Rollback Plan (If Needed)

If something goes wrong:

```bash
# 1. Revert code
cd ~/prototype
git log --oneline  # Find commit before user auth
git reset --hard COMMIT_HASH
git push origin main --force

# 2. Rollback migration
docker-compose -f docker-compose.prod.yml exec backend alembic downgrade -1

# 3. Remove Cognito env vars from .env.production
nano .env.production
# Remove COGNITO_* lines

# 4. Restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

Note: Rolling back will not delete users or break reports, but:
- User authentication will stop working
- Activity page will fall back to localStorage
- `users` table remains but unused
- `reports.user_id` remains but NULL for new reports

---

## ✨ Optional: Enable Google Sign-In

After basic auth works, add Google Sign-In:

1. Get Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/)
2. Add Google as identity provider in Cognito
3. Update app client to use Google
4. Users see "Sign in with Google" button

See `AWS_COGNITO_SETUP.md` section "Optional: Enable Google Sign-In" for details.

---

**Ready to deploy? Follow the 3 steps above and you're done!** 🚀
