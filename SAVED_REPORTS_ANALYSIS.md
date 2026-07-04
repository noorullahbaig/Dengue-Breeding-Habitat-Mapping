# Saved Reports Functionality Analysis

## ⚠️ CRITICAL FINDING: Reports Are NOT Saved to Database

### Summary

The "Save to My Reports" functionality **ONLY exists in the frontend** using **localStorage**. There is **NO user association** in the database, and reports are **NOT attached to user profiles** in any backend table.

---

## How It Actually Works (Frontend Only)

### 1. **Authentication System**
Located in: `src/app/AuthContext.tsx`

**Two modes:**
- **Local mode** (development): Mock authentication, everything stored in browser
- **Cognito mode** (production): AWS Cognito for authentication, but report tracking still local

**Key finding:**
```typescript
// localStorage key for tracked reports
const AUTH_ACTIVITY_STORAGE_KEY = 'dwkl.auth.activity'

// Stored as: { userId: [reference1, reference2, ...] }
function writeTrackedReportsMap(nextValue: Record<string, string[]>) {
  window.localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, JSON.stringify(nextValue))
}
```

### 2. **"Saving" a Report**
Located in: `src/pages/ReportSuccessPage.tsx`

```typescript
// Automatically saves reference to localStorage when authenticated
useEffect(() => {
  if (isAuthenticated && reference && !alreadySaved && !savedToActivity) {
    trackReport(reference);  // Just saves to localStorage!
    setSavedToActivity(true);
  }
}, [isAuthenticated, reference, alreadySaved, savedToActivity, trackReport]);
```

**What actually happens:**
1. User submits report → gets reference ID (e.g., "KL-ABCD-1234")
2. If user is authenticated, reference is saved to localStorage
3. localStorage stores: `{ "user-id": ["KL-ABCD-1234", "KL-EFGH-5678"] }`
4. No database update!

### 3. **Viewing "My Reports"**
Located in: `src/pages/ActivityPage.tsx`

```typescript
// Loads references from localStorage, then fetches report details
const reports = await Promise.all(
  trackedReferences.map(async (reference) => ({
    reference,
    report: await reportsService.getReportStatus(reference),
  }))
);
```

**How it works:**
1. Read tracked references from localStorage
2. For each reference, fetch report details from API using public endpoint
3. Display in "My Reports" page

---

## Database Reality Check

### ❌ What's NOT in the Database

**Report Model** (`backend/app/models.py`):
```python
class Report(Base):
    id: str                          # ✅ Exists
    reference: str                   # ✅ Exists
    created_at: datetime             # ✅ Exists
    # ... all report fields ...
    
    # ❌ NO user_id field
    # ❌ NO owner_id field  
    # ❌ NO submitter_id field
    # ❌ NO creator_id field
    # ❌ NO relationship to users
```

**No User Model exists:**
```python
# ❌ No User table
# ❌ No Profile table
# ❌ No UserReports relationship table
```

### ✅ What IS in the Database

Reports are **completely anonymous** in the database:
- Report data (location, image, prediction, status)
- Hotspot context
- Public consent
- Officer review notes

But **zero connection to who submitted it**.

---

## Implications & Limitations

### ❌ Current Limitations

1. **No Cross-Device Sync**
   - User signs in on phone → saves reports to phone's localStorage
   - User signs in on laptop → sees empty "My Reports" (different localStorage)
   - Even with Cognito authentication!

2. **No Data Persistence**
   - Clear browser data = lose all tracked reports
   - Incognito mode = can't track reports
   - Different browser = start fresh

3. **No Backend Verification**
   - Anyone can query any reference (no ownership verification)
   - No API to "get my reports" (because backend doesn't know who "you" are)
   - Officer dashboard sees all reports equally (no submitter info)

4. **No Historical Attribution**
   - If user forgets to "save" report, can't recover it later
   - No "show all reports I've submitted" functionality possible
   - Data analytics can't track user behavior patterns

### ✅ What Works

1. **Basic tracking on same device**
   - User can save references to localStorage
   - Can view status of saved reports
   - Remove references from their list

2. **Privacy**
   - Reports are truly anonymous in database
   - No PII stored server-side
   - Can't be linked back to user

---

## Is This A Problem for Prototype?

### For Prototype: **Acceptable**

**Pros:**
- ✅ Simple implementation (no user database needed)
- ✅ Privacy-first (no user tracking)
- ✅ Works for single-device demo
- ✅ Fast to implement

**Cons:**
- ❌ Confusing UX (users expect cloud sync)
- ❌ Data lost on browser clear
- ❌ Can't track across devices

### For Production: **Must Be Fixed**

Users expect "save to my account" to mean:
- ✅ Works across all my devices
- ✅ Survives browser data clearing
- ✅ True server-side association

---

## How To Fix (Production-Ready Solution)

### Option 1: Add User Association to Database

#### 1. Create User table and add relationship

**New migration needed:**
```python
# backend/migrations/versions/0005_add_user_reports.py

def upgrade():
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('cognito_id', sa.String(128), unique=True, nullable=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    )
    
    # Add user_id to reports (nullable for backward compatibility)
    op.add_column('reports', sa.Column('user_id', sa.String(36), nullable=True))
    op.create_foreign_key(
        'fk_reports_user_id',
        'reports', 'users',
        ['user_id'], ['id']
    )
    op.create_index('ix_reports_user_id', 'reports', ['user_id'])
```

#### 2. Update Report model

```python
class User(Base):
    __tablename__ = "users"
    
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    cognito_id: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    
    reports: Mapped[list["Report"]] = relationship("Report", back_populates="user")


class Report(Base):
    # ... existing fields ...
    
    # New field
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,  # Backward compatible
        index=True
    )
    
    user: Mapped["User | None"] = relationship("User", back_populates="reports")
```

#### 3. Update API endpoints

```python
# Require authentication for submission
@app.post("/api/reports")
async def create_report(
    # ... existing params ...
    current_user: User = Depends(get_current_user),  # New!
    db: Session = Depends(get_db),
):
    # ... existing logic ...
    
    report = Report(
        # ... existing fields ...
        user_id=current_user.id,  # Associate with user!
    )
    
    db.add(report)
    db.commit()
    return submitted_report_out(report)


# New endpoint: Get my reports
@app.get("/api/my-reports")
async def get_my_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    reports = db.scalars(
        select(Report)
        .where(Report.user_id == current_user.id)
        .order_by(Report.created_at.desc())
    ).all()
    
    return [status_report_out(report) for report in reports]
```

#### 4. Update frontend

```typescript
// Remove localStorage tracking
// Use API instead
async function loadMyReports() {
  const response = await fetch('/api/my-reports', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.json();
}
```

### Option 2: Keep Anonymous + Add Claim Mechanism

If you want to keep reports anonymous but allow users to "claim" them:

```python
# Add claim_token to reports
class Report(Base):
    # ... existing fields ...
    claim_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    claimed_by_user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
```

Users get a secret claim token when submitting, can associate with account later.

---

## Recommendation for Your Prototype

### Short-term (Prototype is Fine As-Is)

**Keep current localStorage approach** because:
- ✅ Prototype scope (single device demo)
- ✅ Already implemented
- ✅ No backend changes needed
- ✅ Respects privacy

**But update documentation** to clarify:
- "Saved reports are stored locally on this device"
- "Sign in with same browser to see your activity"
- "Clearing browser data will reset your activity"

### Long-term (Production Requires Changes)

**Implement Option 1** (User association):
- Add User table
- Add `user_id` to reports
- Require authentication for submission
- Add `/api/my-reports` endpoint
- Remove localStorage tracking

**Estimated effort:** 2-4 hours for database + backend + frontend changes

---

## Update Your Data Flow Documentation

### Add to DATA_FLOW_ANALYSIS.md

**Section: User Report Tracking**

```markdown
## User Report Tracking (Frontend Only)

### Current Implementation

Reports are **NOT associated with users in the database**. The "My Reports" 
feature uses **browser localStorage** to track report references locally.

**Storage location:** `localStorage['dwkl.auth.activity']`

**Data structure:**
```json
{
  "user-id-1": ["KL-ABCD-1234", "KL-EFGH-5678"],
  "user-id-2": ["KL-IJKL-9012"]
}
```

**Limitations:**
- ❌ No cross-device synchronization
- ❌ Lost when browser data is cleared
- ❌ No server-side verification
- ❌ No user attribution in database

**For production:** Would require adding User table and `user_id` foreign 
key to reports table.
```

---

## Testing "Save to My Reports"

### Current Behavior (localStorage)

```javascript
// Open browser console
// Check what's stored
localStorage.getItem('dwkl.auth.activity')
// Returns: {"user-id": ["KL-XXXX-9999"]}

// Submit report → auto-saves if authenticated
// Go to /activity → sees tracked reports

// Open incognito window
// Sign in with same account
// /activity shows empty (different localStorage)

// Clear browser data
// /activity shows empty (localStorage cleared)
```

### Database Check

```sql
-- No user association exists
SELECT id, reference, created_at, user_id FROM reports;
-- user_id column doesn't exist!

-- No User table exists
SELECT * FROM users;
-- Table doesn't exist!
```

---

## Conclusion

**The "Save to My Reports" button works** ✅ - but only locally in the browser.

**Database does NOT accommodate user association** ❌ - reports are completely anonymous.

**For prototype:** Acceptable, but should be documented clearly.

**For production:** Requires significant backend changes:
1. Add User table
2. Add user_id to reports
3. Implement authentication middleware
4. Add "my reports" API endpoint
5. Remove localStorage dependency

**Effort estimate:** 2-4 hours for production-ready implementation.

**Your current implementation is:**
- ✅ Functional for prototype
- ✅ Privacy-preserving
- ❌ Not suitable for production without changes
- ❌ Will confuse users expecting cloud sync
