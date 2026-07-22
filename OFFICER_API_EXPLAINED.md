# Historical officer API notes

> Officer APIs and the officer console have been removed from the prototype. This document is retained only as historical context.

## 📋 Summary

The **Officer API is optional** and **NOT needed for the public-facing app**. It's only for internal government/health officer dashboards (out of scope for your prototype).

---

## 🎯 What the Officer API Does

The Officer API provides 5 endpoints for **administrative users** (health department officers):

### 1. View All Reports
```
GET /api/officer/reports
```
- Lists all submitted reports (internal view)
- Includes private fields like resident notes, full addresses
- For government dashboard only

### 2. View Single Report
```
GET /api/officer/reports/{reference}
```
- Detailed view of one report
- Shows all internal data

### 3. Update Report Status
```
PATCH /api/officer/reports/{reference}
```
- Officers can change status (submitted → under_review → action_recorded → closed)
- Add officer notes ("Inspected on 2026-01-15, breeding site eliminated")
- Record follow-up actions
- Mark who reviewed it

### 4. Check Hotspot Sync Status
```
GET /api/officer/hotspots/status
```
- Shows when iDengue hotspots were last synced
- How many hotspots are cached

### 5. Manually Sync Hotspots
```
POST /api/officer/hotspots/sync
```
- Manually trigger sync from iDengue API
- Updates hotspot cache

---

## 🔒 Authentication

All officer endpoints require:
```
Authorization: Bearer <OFFICER_API_TOKEN>
```

This is a **simple shared token** (not user-specific, not Cognito).

---

## ❌ Why It's Out of Scope for Your Prototype

1. **No admin dashboard built** - You don't have a UI for officers to use
2. **Public app doesn't need it** - Regular users submit reports via the main app
3. **Token-based auth** - Different from Cognito user auth
4. **Internal tool only** - For government health department, not residents

---

## ✅ What Was Fixed

### Before
```python
# config.py
officer_api_token: str  # Required! Would fail if not set
```

```yaml
# docker-compose.prod.yml
OFFICER_API_TOKEN: ${OFFICER_API_TOKEN}  # Would fail if env var missing
```

### After
```python
# config.py
officer_api_token: str = "demo-token-not-used"  # Optional with default
```

```yaml
# docker-compose.prod.yml
OFFICER_API_TOKEN: ${OFFICER_API_TOKEN:-demo-token-not-used}  # Uses default if missing
```

### Result
✅ Backend starts even without `OFFICER_API_TOKEN` in environment  
✅ Officer endpoints still work (if someone needs them later)  
✅ Default token is used: `"demo-token-not-used"`  
✅ No impact on public-facing app  

---

## 🚀 For Your Deployment

You have **3 options**:

### Option 1: Don't Set It (Recommended)
```bash
# .env file - just omit it completely
DATABASE_URL=...
COGNITO_REGION=...
# No OFFICER_API_TOKEN needed!
```
- Backend will use default: `"demo-token-not-used"`
- Public app works perfectly
- Officer endpoints use demo token (no one will use them anyway)

### Option 2: Set a Dummy Value
```bash
# .env file
OFFICER_API_TOKEN=not-used-in-this-deployment
```
- Explicitly set to something
- Makes it clear it's intentionally unused

### Option 3: Generate Real Token (Only If Building Admin Dashboard)
```bash
# Generate secure token
openssl rand -hex 32

# Add to .env
OFFICER_API_TOKEN=abc123def456...
```
- Only needed if you're building an internal admin UI
- Outside scope of your current project

---

## 🧪 Who Uses What

### Public Users (Your Main App)
```
✅ POST /api/reports            (submit report)
✅ GET /api/my-reports          (view their reports - NEW!)
✅ GET /api/public/reports      (view public map)
✅ GET /api/hotspots/current    (view hotspots)
✅ GET /api/reports/status/{ref} (check status)

❌ NOT using any /api/officer/* endpoints
```

### Government Officers (Out of Scope)
```
❌ GET /api/officer/reports     (admin dashboard)
❌ PATCH /api/officer/reports   (update status)
❌ POST /api/officer/hotspots/sync (manual sync)

⚠️ These exist in code but no UI built for them
```

---

## 📊 Database Fields Related to Officers

The current `reports` table no longer has these officer-related fields. They are kept here only as historical context for the removed officer workflow. The removed fields were the officer review notes, follow-up action, reviewer name, and review timestamp.

**Status**: These fields were removed from the live schema by the officer-column cleanup migration and should not be assumed to exist in the database.

If you are building a replacement officer workflow, add the fields back explicitly in a new migration instead of relying on this document.

---

## 🎯 Bottom Line

**For your public-facing resident app:**
- ✅ Officer API is **completely optional**
- ✅ **No need to set** `OFFICER_API_TOKEN` in `.env`
- ✅ Backend will use default value automatically
- ✅ Public app works perfectly without it
- ✅ All changes made to make it truly optional

**If you ever build an admin dashboard later:**
- Generate a secure token
- Set `OFFICER_API_TOKEN` in `.env`
- Build a UI that calls `/api/officer/*` endpoints
- Officers can review and manage reports

**For now:** Ignore it! It's not blocking anything. 🚀
