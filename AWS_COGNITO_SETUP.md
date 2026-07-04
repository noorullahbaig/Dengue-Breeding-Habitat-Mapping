# AWS Cognito Setup Guide for User Authentication

This guide walks you through configuring AWS Cognito for user authentication in DengueWatch KL. Cognito provides secure user sign-up, sign-in, and profile management with social login support (Google, etc.).

## 🎯 What You'll Achieve

- Users can sign up with email and password
- Users can sign in with Google (optional)
- Reports are automatically associated with authenticated users
- Users can view all their submitted reports on the Activity page
- User profile pictures and display names are retrieved from Cognito

---

## 📋 Prerequisites

- AWS Account with console access
- Your DengueWatch KL application already deployed on EC2
- Access to your `.env.production` file on EC2

---

## 🔧 Step 1: Create Cognito User Pool

### Via AWS Console

1. **Open AWS Cognito Console**
   - Go to: https://console.aws.amazon.com/cognito/
   - Make sure you're in the correct region (e.g., `us-east-1`)

2. **Create User Pool**
   - Click **"Create user pool"**
   
3. **Configure Sign-in Experience**
   - **Sign-in options**: Select `Email` (users sign in with email address)
   - **Cognito user pool sign-in options**: Check `Email`
   - Click **Next**

4. **Configure Security Requirements**
   - **Password policy**: Choose `Cognito defaults` or customize
   - **Multi-factor authentication**: `No MFA` (for prototype) or enable if needed
   - **User account recovery**: Check `Enable self-service account recovery`
     - Delivery method: `Email only`
   - Click **Next**

5. **Configure Sign-up Experience**
   - **Self-registration**: Check `Enable self-registration`
   - **Required attributes**: Select:
     - `email` (already required)
     - `name` (for display name)
   - **Custom attributes**: None needed for now
   - Click **Next**

6. **Configure Message Delivery**
   - **Email provider**: Choose `Send email with Cognito` (free tier, 50 emails/day)
     - For production with higher volume, configure SES instead
   - **FROM email address**: Use default or customize
   - Click **Next**

7. **Integrate Your App**
   - **User pool name**: Enter `denguewatch-users` (or your preferred name)
   - **Hosted UI**: Check `Use the Cognito Hosted UI`
   - **Hosted UI domain**: Enter a unique prefix like `denguewatch-noorullah`
     - Full domain will be: `https://denguewatch-noorullah.auth.us-east-1.amazoncognito.com`
   - **Initial app client**:
     - **App client name**: `denguewatch-web-client`
     - **Client secret**: Select `Don't generate a client secret` (for public web app)
     - **Authentication flows**: Check `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH`
   - **Callback URLs**: Enter your frontend URL(s):
     - `http://YOUR_EC2_PUBLIC_IP/profile`
     - `https://your-domain.com/profile` (if using HTTPS)
   - **Sign-out URLs**: Enter your frontend URL(s):
     - `http://YOUR_EC2_PUBLIC_IP/`
     - `https://your-domain.com/` (if using HTTPS)
   - **Identity providers**: Check `Cognito user pool` (enable Google later if needed)
   - Click **Next**

8. **Review and Create**
   - Review all settings
   - Click **Create user pool**

---

## 🔑 Step 2: Get Cognito Configuration Values

After creating the user pool:

1. **Get User Pool ID**
   - In the Cognito console, click on your user pool name
   - You'll see **User pool ID** at the top (e.g., `us-east-1_AbCdEfGhI`)
   - Copy this value

2. **Get App Client ID**
   - In your user pool, go to **App integration** tab
   - Scroll down to **App clients and analytics**
   - Click on your app client name (`denguewatch-web-client`)
   - Copy the **Client ID** (e.g., `1a2b3c4d5e6f7g8h9i0j1k2l3m`)

3. **Get Region**
   - This is the AWS region where you created the user pool (e.g., `us-east-1`)

---

## 📝 Step 3: Update Environment Variables on EC2

SSH into your EC2 instance and update the `.env.production` file:

```bash
# SSH into EC2
ssh -i your-key.pem ec2-user@YOUR_EC2_PUBLIC_IP

# Navigate to project directory
cd ~/prototype

# Edit .env.production
nano .env.production
```

Add or update these lines with your Cognito values:

```bash
# AWS Cognito authentication
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=us-east-1_AbCdEfGhI
COGNITO_APP_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m
```

Save and exit (Ctrl+X, then Y, then Enter).

---

## 🔄 Step 4: Run Database Migration

The user authentication feature requires a database migration to add the `users` table and `user_id` foreign key to reports:

```bash
# Still on EC2, navigate to project directory
cd ~/prototype

# Run the migration using Docker
docker-compose -f docker-compose.prod.yml exec backend alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade 0004 -> 0005, add user reports association
```

---

## 🚀 Step 5: Restart Docker Containers

Restart the containers to pick up the new environment variables:

```bash
# Still on EC2
cd ~/prototype

# Rebuild and restart containers
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

Check that containers are running:
```bash
docker-compose -f docker-compose.prod.yml ps
```

---

## ✅ Step 6: Test Authentication

1. **Open your application** in a browser: `http://YOUR_EC2_PUBLIC_IP`

2. **Sign up a new user**:
   - Click **Profile** or **Sign In**
   - Click **Sign up** or **Create an account**
   - Enter email, password, and display name
   - Check your email for verification code
   - Enter verification code to confirm account

3. **Sign in**:
   - Enter your email and password
   - Click **Sign In**

4. **Submit a report**:
   - Go to **Report** page
   - Take/upload a photo
   - Confirm location
   - Accept consent and submit
   - The report should be automatically associated with your user account

5. **Check Activity page**:
   - Go to **Activity** page
   - You should see all reports you've submitted
   - Profile picture and display name should appear (if provided)

---

## 🌐 Optional: Enable Google Sign-In

If you want users to sign in with Google:

### 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable **Google+ API**
4. Go to **Credentials** > **Create Credentials** > **OAuth 2.0 Client ID**
5. Application type: **Web application**
6. Authorized redirect URIs: Add your Cognito hosted UI callback URL:
   - `https://YOUR_COGNITO_DOMAIN.auth.REGION.amazoncognito.com/oauth2/idpresponse`
   - Example: `https://denguewatch-noorullah.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
7. Copy the **Client ID** and **Client Secret**

### 2. Configure Google as Identity Provider in Cognito

1. In Cognito console, go to your user pool
2. Go to **Sign-in experience** tab > **Federated identity provider sign-in**
3. Click **Add identity provider**
4. Select **Google**
5. Enter your Google Client ID and Client Secret
6. **Authorized scopes**: `profile email openid`
7. Click **Add identity provider**

### 3. Update App Client to Use Google

1. Go to **App integration** tab
2. Click on your app client
3. Under **Hosted UI settings**, edit **Identity providers**
4. Check **Google**
5. Save changes

### 4. Test Google Sign-In

- Go to your app's sign-in page
- You should now see a **Sign in with Google** button
- Click it to sign in with your Google account

---

## 🔍 Verify Everything Works

### Check Backend Logs

```bash
# On EC2
docker-compose -f docker-compose.prod.yml logs -f backend
```

Look for:
- No errors about missing Cognito configuration
- Successful JWT token verification logs when users sign in
- User creation logs when new users sign up

### Check Database

```bash
# Connect to your RDS database
docker-compose -f docker-compose.prod.yml exec backend python

# In Python shell:
from app.database import SessionLocal
from app.models import User, Report
from sqlalchemy import select

db = SessionLocal()

# Check users table
users = db.scalars(select(User)).all()
print(f"Total users: {len(users)}")
for user in users:
    print(f"  - {user.email} ({user.display_name})")

# Check reports with user association
reports = db.scalars(select(Report).where(Report.user_id.isnot(None))).all()
print(f"Total reports with user association: {len(reports)}")

db.close()
```

---

## 🛠️ Troubleshooting

### "Cognito authentication not configured on server"

**Cause**: Environment variables not set or containers not restarted.

**Fix**:
```bash
# Check environment variables are loaded
docker-compose -f docker-compose.prod.yml exec backend env | grep COGNITO

# If empty, make sure .env.production has the values
# Then restart containers:
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### "Token has expired"

**Cause**: User's session expired (tokens last 1 hour by default).

**Fix**: User needs to sign out and sign in again. This is normal behavior.

### "Authorization header required" when submitting report

**Cause**: This is expected! Reports can be submitted anonymously (without auth).

**Effect**: Anonymous reports have `user_id = NULL` in database. Authenticated reports have the user's ID.

### Migration fails with "column already exists"

**Cause**: Migration was already run or table was manually created.

**Fix**: Check current migration state:
```bash
docker-compose -f docker-compose.prod.yml exec backend alembic current
```

If it shows `0005`, you're good. If not:
```bash
# Mark current state without running migrations
docker-compose -f docker-compose.prod.yml exec backend alembic stamp head
```

### Users can't see their old reports

**Cause**: Reports submitted before user authentication was enabled don't have `user_id` set.

**Effect**: This is expected. Only reports submitted after signing in will appear in Activity page.

**Optional fix**: Manually associate old reports if you have a way to identify them:
```sql
-- Connect to RDS and run:
UPDATE reports 
SET user_id = 'cognito:USER_SUB_ID' 
WHERE reference IN ('KL-XXXX-1111', 'KL-XXXX-2222');
```

---

## 📊 Summary

You've successfully set up:

✅ AWS Cognito User Pool for authentication  
✅ User sign-up and sign-in with email/password  
✅ Optional Google Sign-In (if configured)  
✅ Database migration to associate reports with users  
✅ Environment variables for Cognito integration  
✅ Activity page showing user's reports  
✅ User profile pictures and display names  

Users can now:
- Sign up and sign in securely
- Submit reports that are linked to their account
- View all their reports on the Activity page
- See their profile picture and name in the UI

---

## 🔗 Next Steps

- **Configure email templates** in Cognito for better branding
- **Enable MFA** for enhanced security (optional)
- **Set up custom domain** for Cognito hosted UI (optional)
- **Configure Amazon SES** for higher email sending limits
- **Add password reset flow** (already supported by Cognito)
- **Implement user profile editing** (change display name, photo)

---

## 📚 References

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [Amplify Auth Documentation](https://docs.amplify.aws/javascript/build-a-backend/auth/)
- [Cognito User Pools Pricing](https://aws.amazon.com/cognito/pricing/) (50,000 MAUs free tier)
