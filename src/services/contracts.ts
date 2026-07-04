import type {
  HabitatClass,
  HotspotMirrorStatus,
  HotspotSyncResult,
  PublicHotspot,
  PublicReportDetail,
  PublicMapReport,
  ReportDraft,
  ReportPrecheck,
  ReportStatus,
  NearbyReportCheck,
  SubmissionStatus,
  SubmittedReport,
} from '@/types/report'

export interface MapBounds {
  north: number
  south: number
  east: number
  west: number
}

export interface PublicReportFilters {
  status?: SubmissionStatus | 'all'
  habitatClass?: HabitatClass | 'all'
}

export interface CreateReportOptions {
  stackParentReference?: string | null
  publicConsentAccepted?: boolean
  publicConsentText?: string
}

export interface ReportsService {
  getMyReports(): Promise<ReportStatus[]>
  createReport(
    draft: ReportDraft,
    options?: CreateReportOptions,
  ): Promise<SubmittedReport>
  precheckReport(draft: ReportDraft): Promise<ReportPrecheck>
  findNearbyReportCandidates(draft: ReportDraft): Promise<NearbyReportCheck>
  getReportStatus(reference: string): Promise<ReportStatus | null>
  getPublicReport(reference: string): Promise<PublicReportDetail | null>
}

export interface MapService {
  listPublicReports(
    bounds?: MapBounds,
    filters?: PublicReportFilters,
  ): Promise<PublicMapReport[]>
  listHotspots(bounds?: MapBounds): Promise<PublicHotspot[]>
}

export interface AppServices {
  reportsService: ReportsService
  mapService: MapService
}
