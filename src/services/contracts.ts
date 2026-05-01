import type {
  HabitatClass,
  PublicHotspot,
  PublicReportDetail,
  PublicMapReport,
  ReportDraft,
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

export interface ReportsService {
  createReport(
    draft: ReportDraft,
    options?: { stackParentReference?: string | null },
  ): Promise<SubmittedReport>
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
