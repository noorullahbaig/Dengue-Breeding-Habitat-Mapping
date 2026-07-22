# Quick Data Storage Reference

## Where Everything Is Stored

### 📊 PostgreSQL Database

#### `users` table (resident profile storage)
```
┌─────────────────────────────────────────────────────────────┐
│ • id (VARCHAR) - Primary key                                │
│ • cognito_sub (VARCHAR) - Cognito subject - UNIQUE          │
│ • email (VARCHAR) - Resident email                          │
│ • display_name (VARCHAR) - Google/Cognito display name      │
│ • photo_url (TEXT) - Google/Cognito profile image           │
│ • provider (VARCHAR) - cognito or local                     │
│ • created_at (TIMESTAMPTZ) - Creation time                  │
│ • updated_at (TIMESTAMPTZ) - Last update time               │
└─────────────────────────────────────────────────────────────┘
```

#### `reports` table (Main entity - current columns)
```
┌─────────────────────────────────────────────────────────────┐
│ IDENTITY & TIMESTAMPS                                       │
├─────────────────────────────────────────────────────────────┤
│ • id (UUID) - Primary key                                   │
│ • reference (VARCHAR) - Human ID (KL-XXXX-9999) - UNIQUE   │
│ • created_at (TIMESTAMPTZ) - Submission time                │
│ • captured_at (TIMESTAMPTZ) - Photo capture time            │
│ • parent_report_id (UUID) - FK for stacking - NULLABLE     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ LOCATION DATA (8 columns)                                   │
├─────────────────────────────────────────────────────────────┤
│ • latitude, longitude (FLOAT) - Exact location              │
│ • accuracy_meters (FLOAT) - GPS accuracy                    │
│ • location_source (VARCHAR) - "browser", "manual"           │
│ • public_latitude, public_longitude (FLOAT) - Display loc   │
│ • report_location_geog (GEOGRAPHY) - PostGIS spatial        │
│ • public_location_geog (GEOGRAPHY) - PostGIS spatial        │
│                                                              │
│ INDEXES: GIST on both geography columns for fast queries    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ IMAGE METADATA (8 columns)                                  │
├─────────────────────────────────────────────────────────────┤
│ • image_original_filename (VARCHAR) - Upload name           │
│ • image_mime_type (VARCHAR) - Always "image/jpeg"           │
│ • image_size_bytes (INT) - Original file size               │
│ • image_sha256 (VARCHAR) - Content hash                     │
│ • image_path (TEXT) - Local path                            │
│ • thumbnail_path (TEXT) - Local thumbnail path              │
│ • image_storage_key (VARCHAR) - S3 key (evidence/...)       │
│ • thumbnail_storage_key (VARCHAR) - S3 key (thumbnails/...) │
│                                                              │
│ INDEX: On image_sha256 for deduplication                    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ AI PREDICTIONS (7 columns + JSON)                           │
├─────────────────────────────────────────────────────────────┤
│ • prediction_label (VARCHAR) - tire, drain_inlet, etc.      │
│ • prediction_confidence (FLOAT) - 0.0 to 1.0                │
│ • prediction_confidence_band (VARCHAR) - high/medium/low    │
│ • prediction_top_raw_label (VARCHAR) - YOLO class name      │
│ • prediction_advisory_text (TEXT) - Human explanation       │
│ • detections (JSON) - Array of detection objects:           │
│   [{                                                         │
│     rawLabel: string,                                        │
│     confidence: float,                                       │
│     bbox: [x1, y1, x2, y2],                                  │
│     bboxNormalized: [x1, y1, x2, y2],                        │
│     imageWidth: int,                                         │
│     imageHeight: int                                         │
│   }]                                                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ HOTSPOT CONTEXT (7 columns)                                 │
├─────────────────────────────────────────────────────────────┤
│ • hotspot_snapshot_date (TIMESTAMPTZ) - Hotspot data date   │
│ • nearest_hotspot_id (VARCHAR) - Reference ID               │
│ • nearest_hotspot_locality (VARCHAR) - Location name        │
│ • nearest_hotspot_district (VARCHAR) - District name        │
│ • nearest_hotspot_distance_meters (FLOAT) - Distance        │
│ • hotspot_priority_level (VARCHAR) - core/warning/routine   │
│ • hotspot_priority_reason (TEXT) - Explanation              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PUBLIC CONSENT (4 columns)                                  │
├─────────────────────────────────────────────────────────────┤
│ • public_consent_accepted (BOOL) - Always TRUE              │
│ • public_consent_at (TIMESTAMPTZ) - Consent timestamp       │
│ • public_consent_version (VARCHAR) - Version string         │
│ • public_consent_text (TEXT) - Full consent text shown      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ STATUS & WORKFLOW (current columns)                         │
├─────────────────────────────────────────────────────────────┤
│ • status (VARCHAR) - submitted, under_review, etc.          │
│ • neighborhood (VARCHAR) - Area name                        │
│ • status_message (TEXT) - Human-readable status             │
│ • notes (TEXT) - User notes - NULLABLE                      │
│                                                              │
│ NOTE: officer_notes/follow_up_action/reviewed_at/reviewed_  │
│ by were removed from the live schema.                        │
└─────────────────────────────────────────────────────────────┘
```

#### `hotspots` table (Dengue outbreak data)
```
┌─────────────────────────────────────────────────────────────┐
│ • id (VARCHAR) - Composite: district--locality--lng--lat    │
│ • locality (VARCHAR) - Location name                        │
│ • district (VARCHAR) - District name                        │
│ • latitude, longitude (FLOAT) - Center coordinates          │
│ • center_geog (GEOGRAPHY) - PostGIS spatial point           │
│ • radius_meters (INT) - Default 200m                        │
│ • cumulative_cases (INT) - Case count                       │
│ • outbreak_duration_days (INT) - Duration                   │
│ • outbreak_start_date (TIMESTAMPTZ) - Start date            │
│ • week_number, year (INT) - Epidemiological week/year       │
│ • snapshot_date (TIMESTAMPTZ) - Data snapshot date          │
│ • source_label (VARCHAR) - "iDengue hotspot context"        │
│ • synced_at (TIMESTAMPTZ) - Last sync time                  │
│                                                              │
│ INDEXES: GIST on center_geog, regular on snapshot_date      │
└─────────────────────────────────────────────────────────────┘
```

---

### 📁 File System Storage

#### Local Uploads (backend/uploads/)
```
uploads/
├── evidence/
│   └── {uuid}-{sha256[:12]}.jpg     ← Original images (quality 88)
├── thumbnails/
│   └── {uuid}-{sha256[:12]}.jpg     ← 480x480 thumbnails (quality 82)
└── prechecks/
    └── {uuid}-{sha256[:12]}.jpg     ← Temporary precheck images
```

**Cleanup policy:**
- Evidence/thumbnails: Kept permanently (or until S3 cleanup enabled)
- Prechecks: Auto-deleted after 24 hours

---

### ☁️ S3 Storage (when STORAGE_BACKEND=s3)

#### Bucket Structure
```
s3://your-bucket-name/
├── evidence/
│   └── {uuid}-{sha256[:12]}.jpg     ← Original images
└── thumbnails/
    └── {uuid}-{sha256[:12]}.jpg     ← Thumbnails
```

**Access method:** Presigned URLs (expires in 3600 seconds)

**Cleanup behavior:**
- `CLEANUP_LOCAL_AFTER_S3_UPLOAD=false` → Local files kept as backup
- `CLEANUP_LOCAL_AFTER_S3_UPLOAD=true` → Local files deleted after upload

---

## Data Flow Summary

### Report Submission
```
Frontend
   ↓ FormData (image + metadata)
Backend Validation
   ↓ Service area, accuracy, consent checks
Image Storage
   ↓ SHA-256 hash, JPEG conversion, thumbnail generation
   ├→ Local: ./uploads/evidence/ + thumbnails/
   └→ S3: s3://bucket/evidence/ + thumbnails/
       └→ Optional: Delete local files
AI Inference
   ↓ YOLO detection → predictions + bounding boxes
Hotspot Assessment
   ↓ PostGIS spatial query for nearest hotspot
Database Persistence
   ↓ INSERT into reports table
   └→ UPDATE geography columns (PostGIS)
Response
   └→ SubmittedReportOut with reference ID
```

### Map Queries (Optimized)
```
GET /api/public/reports?north=X&south=Y&east=Z&west=W
   ↓
PostgreSQL Detection
   ↓
[PostgreSQL + bbox] → PostGIS Spatial Query
   ↓ ST_Intersects(public_location_geog, ST_MakeEnvelope(...))
   ↓ Uses GIST index (O(log n))
   ↓ Returns matching report IDs
   ↓
[SQLite or no bbox] → Standard Lat/Lng Filter
   ↓ latitude <= north AND latitude >= south, etc.
   ↓ Uses composite index (O(n))
   ↓
Apply Status/Class Filters
   ↓
Load Report Objects + Stack Summaries
   ↓
Return PublicMapReportOut[]
```

### Image Retrieval (with Fallback)
```
GET /api/public/reports/{reference}/image
   ↓
Lookup Report by Reference
   ↓
[S3 Mode] → Generate Presigned URL
   ↓ Try: get_s3_presigned_url(storage_key)
   ├→ SUCCESS: 302 Redirect to S3 presigned URL
   └→ FAILURE: Fallback to local file
       ↓ resolve_public_upload_path(image_path)
       └→ 200 FileResponse or 404
   
[Local Mode] → Serve from Filesystem
   ↓ resolve_public_upload_path(storage_key)
   └→ 200 FileResponse
```

---

## Query Patterns

### Find Reports in Bounding Box (Optimized)
```sql
-- PostGIS spatial query (uses GIST index)
SELECT id FROM reports
WHERE parent_report_id IS NULL
  AND public_consent_accepted = TRUE
  AND ST_Intersects(
        public_location_geog::geometry,
        ST_MakeEnvelope(:west, :south, :east, :north, 4326)
      )
```

### Find Nearest Hotspot (Optimized)
```sql
-- Uses GIST index on center_geog
SELECT h.*, 
       ST_Distance(h.center_geog, report_point.geog) AS distance_meters
FROM hotspots h
CROSS JOIN (
  SELECT ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography AS geog
) report_point
WHERE h.snapshot_date = (SELECT max(snapshot_date) FROM hotspots)
ORDER BY ST_Distance(h.center_geog, report_point.geog)
LIMIT 1
```

### Find Stack Members
```sql
-- Get all reports in a stack
SELECT * FROM reports
WHERE id = :root_id OR parent_report_id = :root_id
ORDER BY created_at DESC
```

---

## Storage Capacity Planning

### Per Report
- **Database:** ~5 KB (metadata + JSON)
- **Original image:** ~800 KB average (JPEG quality 88)
- **Thumbnail:** ~80 KB average (480x480, quality 82)
- **Total per report:** ~885 KB

### Scaling Estimates
| Reports | Database | Images (S3/Local) | Total |
|---------|----------|-------------------|-------|
| 100     | 500 KB   | 88 MB             | ~88 MB |
| 1,000   | 5 MB     | 885 MB            | ~890 MB |
| 10,000  | 50 MB    | 8.8 GB            | ~9 GB |
| 100,000 | 500 MB   | 88 GB             | ~88 GB |

**Note:** With `CLEANUP_LOCAL_AFTER_S3_UPLOAD=true`, local disk usage is minimal

---

## Indexes Summary

### PostgreSQL Indexes
```
reports:
  - PRIMARY KEY (id)
  - UNIQUE (reference)
  - FOREIGN KEY (parent_report_id → reports.id)
  - INDEX (image_sha256)
  - INDEX (image_storage_key)
  - INDEX (status, prediction_label)
  - INDEX (public_latitude, public_longitude)
  - GIST INDEX (report_location_geog)    ← Spatial queries
  - GIST INDEX (public_location_geog)    ← Map queries ✨

hotspots:
  - PRIMARY KEY (id)
  - INDEX (snapshot_date)
  - GIST INDEX (center_geog)             ← Spatial queries
```

---

## Configuration Matrix

| Environment | STORAGE_BACKEND | CLEANUP_LOCAL | Use Case |
|-------------|-----------------|---------------|----------|
| Development | `local` | N/A | Local testing |
| Staging | `s3` | `false` | Testing with backup |
| Production (backup) | `s3` | `false` | Max reliability |
| Production (optimized) | `s3` | `true` | Save disk space |

---

## Monitoring Checklist

### Database
- [ ] Table sizes (pg_total_relation_size)
- [ ] Index usage (pg_stat_user_indexes)
- [ ] Slow queries (pg_stat_statements)
- [ ] PostGIS extension enabled

### Storage
- [ ] Local disk usage (du -sh uploads/)
- [ ] S3 bucket size (AWS console)
- [ ] S3 costs (AWS billing)
- [ ] Orphaned objects (compare DB to S3)

### Application
- [ ] Image upload success rate
- [ ] S3 presigned URL generation failures
- [ ] S3 cleanup warnings in logs
- [ ] Map query performance (response time)

---

## Quick Troubleshooting

### Images not loading
1. Check `STORAGE_BACKEND` setting
2. If S3: verify bucket name and credentials
3. Check local file exists if fallback should work
4. Look for S3 warnings in logs

### Map loading slowly
1. Verify PostGIS is installed (`SELECT postgis_version()`)
2. Check GIST indexes exist (`\d reports`)
3. Look for `use_spatial_query = True` in logs
4. Run EXPLAIN ANALYZE on bounding box query

### Disk filling up
1. Check `CLEANUP_LOCAL_AFTER_S3_UPLOAD` setting
2. Run manual cleanup of old prechecks
3. Consider enabling cleanup if S3 is primary
4. Monitor S3 upload success rate

---

## References

- **Full Analysis:** `DATA_FLOW_ANALYSIS.md`
- **Implementation Details:** `OPTIMIZATIONS_IMPLEMENTED.md`
- **Summary:** `IMPLEMENTATION_SUMMARY.md`
- **PostGIS Docs:** https://postgis.net/docs/
- **AWS S3 Docs:** https://docs.aws.amazon.com/s3/
