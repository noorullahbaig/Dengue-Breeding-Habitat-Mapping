export type HabitatClass = 'tire' | 'drain_inlet' | 'artificial_container' | 'unclassified'

export type SubmissionStatus =
  | 'submitted'
  | 'under_review'
  | 'prioritized'
  | 'action_recorded'
  | 'closed'

export type ConfidenceBand = 'low' | 'moderate' | 'high'

export type LocationSource = 'browser' | 'manual' | 'demo' | 'public'

export interface LocationPoint {
  latitude: number
  longitude: number
  accuracyMeters?: number
  source: LocationSource
}

export interface PhotoEvidence {
  name: string
  mimeType: string
  size: number
}

export interface ReportDraft {
  photoFile?: File | null
  photoPreviewUrl?: string
  photoEvidence?: PhotoEvidence
  capturedAt?: string
  detectedLocation?: LocationPoint | null
  correctedLocation?: LocationPoint | null
  notes?: string
  wizardStep?: number
  hasConfirmedPin?: boolean
  hasPublicConsent?: boolean
}

export interface PredictionSummary {
  label: HabitatClass
  confidence?: number | null
  confidenceBand: ConfidenceBand
  topRawLabel?: string | null
  detections?: DetectionSummary[]
  advisoryText: string
}

export interface PublicConsent {
  accepted: boolean
  acceptedAt?: string | null
  version?: string | null
}

export interface HotspotPriority {
  snapshotDate?: string | null
  nearestHotspotId?: string | null
  nearestHotspotLocality?: string | null
  nearestHotspotDistrict?: string | null
  nearestHotspotDistanceMeters?: number | null
  priorityLevel: 'core' | 'warning' | 'routine' | 'unavailable' | 'unassessed' | string
  priorityReason: string
}

export interface DetectionSummary {
  rawLabel: string
  confidence: number
  bbox: number[]
  bboxNormalized?: number[] | null
  imageWidth?: number | null
  imageHeight?: number | null
}

export interface SubmittedReport {
  id: string
  reference: string
  createdAt: string
  reportLocation: LocationPoint
  publicLocation: LocationPoint
  status: SubmissionStatus
  prediction: PredictionSummary
  neighborhood: string
  statusMessage: string
  notes?: string
  stackedOnReference?: string | null
  thumbnailUrl?: string
  imageUrl?: string
  publicConsent?: PublicConsent
  hotspotPriority?: HotspotPriority
}

export interface ReportStatus {
  id: string
  reference: string
  createdAt: string
  status: SubmissionStatus
  prediction: PredictionSummary
  neighborhood: string
  statusMessage: string
  stackedOnReference?: string | null
}

export interface PublicMapReport {
  id: string
  reference: string
  publicLocation: LocationPoint
  habitatClass: HabitatClass
  prediction: PredictionSummary
  status: SubmissionStatus
  neighborhood: string
  reportedAt: string
  latestReportedAt: string
  reportCount: number
  thumbnailUrl: string
  imageUrl: string
  privacyNote: string
}

export interface NearbyReportCandidate {
  id: string
  reference: string
  publicLocation: LocationPoint
  habitatClass: HabitatClass
  status: SubmissionStatus
  neighborhood: string
  distanceMeters: number
  latestReportedAt: string
  reportCount: number
  thumbnailUrl: string
}

export interface NearbyReportCheck {
  prediction: PredictionSummary
  candidates: NearbyReportCandidate[]
  imageUrl?: string | null
}

export type ReportPrecheck = NearbyReportCheck

export interface PublicReportObservation {
  id: string
  reference: string
  capturedAt: string
  reportedAt: string
  imageUrl: string
  thumbnailUrl: string
  habitatClass: HabitatClass
  confidenceBand: ConfidenceBand
  prediction: PredictionSummary
}

export interface PublicReportDetail {
  id: string
  reference: string
  publicLocation: LocationPoint
  habitatClass: HabitatClass
  prediction: PredictionSummary
  status: SubmissionStatus
  neighborhood: string
  reportedAt: string
  latestReportedAt: string
  reportCount: number
  thumbnailUrl: string
  imageUrl: string
  privacyNote?: string
  hotspotPriority?: HotspotPriority
  observations: PublicReportObservation[]
}

export interface PublicHotspot {
  id: string
  locality: string
  district: string
  center: LocationPoint
  radiusMeters: 200
  cumulativeCases: number | null
  outbreakDurationDays: number | null
  outbreakStartDate: string
  weekNumber: number
  year: number
  snapshotDate: string
  sourceLabel: string
  reportCountWithinWarning?: number | null
}

export interface StackParentSummary {
  reference: string
  createdAt: string
  status: SubmissionStatus
  prediction: PredictionSummary
  imageUrl: string
  thumbnailUrl: string
}

export interface HotspotMirrorStatus {
  hotspotCount: number
  latestSnapshotDate?: string | null
  lastSyncedAt?: string | null
  sourceLabel: string
}

export interface HotspotSyncResult {
  syncedCount: number
  snapshotDate?: string | null
  sourceLabel: string
  syncedAt: string
}

export interface ApiHealthStatus {
  ok: boolean
  database: boolean
  model: boolean
  uploadRoot: string
  modelPath: string
  postgis: boolean
  details: Record<string, string>
}

export interface OfficerReport {
  id: string
  reference: string
  createdAt: string
  capturedAt: string
  reportLocation: LocationPoint
  publicLocation: LocationPoint
  status: SubmissionStatus
  prediction: PredictionSummary
  neighborhood: string
  statusMessage: string
  notes?: string | null
  imageUrl: string
  thumbnailUrl: string
  stackedOnReference?: string | null
  publicConsent: PublicConsent
  hotspotPriority: HotspotPriority
  officerNotes?: string | null
  followUpAction?: string | null
  reviewedAt?: string | null
  reviewedBy?: string | null
  stackParent?: StackParentSummary | null
}

export interface OfficerReportUpdate {
  status: SubmissionStatus
  officerNotes?: string | null
  followUpAction?: string | null
  reviewedBy?: string | null
}
