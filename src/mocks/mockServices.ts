import { STORAGE_KEY } from '@/lib/constants'
import { predictHabitatForDraft } from '@/lib/prediction'
import { isWithinServiceArea, SERVICE_AREA_ERROR } from '@/lib/serviceArea'
import { fetchCurrentIdengueHotspots } from '@/services/idengueHotspots'
import { pointInBounds } from '@/services/mapBounds'
import type { AppServices, PublicReportFilters } from '@/services/contracts'
import type {
  LocationPoint,
  NearbyReportCheck,
  NearbyReportCandidate,
  PublicReportDetail,
  PublicReportObservation,
  PublicMapReport,
  ReportDraft,
  SubmittedReport,
} from '@/types/report'
import { seededReports } from '@/mocks/data'

interface MockServicesOptions {
  hotspotFetchImpl?: typeof fetch
}

const SAME_SITE_RADIUS_METERS = 30
const EARTH_RADIUS_METERS = 6_371_000
const placeholderEvidenceImage =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"%3E%3Crect width="640" height="480" fill="%23e6ece6"/%3E%3Ccircle cx="320" cy="228" r="84" fill="%23af6831" fill-opacity=".32"/%3E%3Cpath d="M185 340h270" stroke="%23163528" stroke-width="18" stroke-linecap="round"/%3E%3Ctext x="320" y="400" text-anchor="middle" font-family="Arial" font-size="28" fill="%23163528"%3EPublic evidence%3C/text%3E%3C/svg%3E'

function delay(ms = 220) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function distanceMeters(a: LocationPoint, b: LocationPoint) {
  const deltaLatitude = ((b.latitude - a.latitude) * Math.PI) / 180
  const deltaLongitude = ((b.longitude - a.longitude) * Math.PI) / 180
  const startLatitude = (a.latitude * Math.PI) / 180
  const endLatitude = (b.latitude * Math.PI) / 180
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(deltaLongitude / 2) ** 2

  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function readStoredReports() {
  if (typeof window === 'undefined') {
    return seededReports
  }

  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seededReports))
    return seededReports
  }

  try {
    const parsed = JSON.parse(raw) as SubmittedReport[]
    return parsed.length ? parsed : seededReports
  } catch {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seededReports))
    return seededReports
  }
}

function writeStoredReports(reports: SubmittedReport[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

function buildReference() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `KL-${suffix}-${Date.now().toString().slice(-4)}`
}

function publicLocation(point: LocationPoint): LocationPoint {
  return {
    latitude: point.latitude,
    longitude: point.longitude,
    source: 'public',
  }
}

function pickNeighborhood(point: LocationPoint) {
  const candidates = [
    { label: 'Bukit Jalil', latitude: 3.0589, longitude: 101.6846 },
    { label: 'Cheras', latitude: 3.0928, longitude: 101.7436 },
    { label: 'Kepong', latitude: 3.2146, longitude: 101.6278 },
    { label: 'Sentul', latitude: 3.1745, longitude: 101.6953 },
    { label: 'Wangsa Maju', latitude: 3.2052, longitude: 101.7329 },
  ]

  let closest = candidates[0]
  let closestDistance = Number.POSITIVE_INFINITY

  for (const candidate of candidates) {
    const distance =
      Math.abs(point.latitude - candidate.latitude) +
      Math.abs(point.longitude - candidate.longitude)

    if (distance < closestDistance) {
      closest = candidate
      closestDistance = distance
    }
  }

  return closest.label
}

function getStatusMessage(index: number) {
  const messages = [
    'Received and awaiting officer review.',
    'Queued for officer review with map context.',
    'Flagged for faster follow-up because the area aligns with active hotspot context.',
    'An officer logged follow-up activity for this report.',
  ]

  return messages[index % messages.length]
}

function applyFilters(report: PublicMapReport, filters?: PublicReportFilters) {
  if (!filters) {
    return true
  }

  if (filters.status && filters.status !== 'all' && report.status !== filters.status) {
    return false
  }

  if (
    filters.habitatClass &&
    filters.habitatClass !== 'all' &&
    report.habitatClass !== filters.habitatClass
  ) {
    return false
  }

  return true
}

function stackMembers(reports: SubmittedReport[], parentReference: string) {
  return reports
    .filter(
      (report) => report.reference === parentReference || report.stackedOnReference === parentReference,
    )
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
}

function parentReports(reports: SubmittedReport[]) {
  return reports.filter((report) => !report.stackedOnReference)
}

function latestStackReport(reports: SubmittedReport[], parentReference: string) {
  return stackMembers(reports, parentReference)[0]
}

function toPublicReport(report: SubmittedReport): PublicMapReport {
  const reports = readStoredReports()
  const members = stackMembers(reports, report.reference)
  const latestReport = latestStackReport(reports, report.reference) ?? report

  return {
    id: report.id,
    reference: report.reference,
    publicLocation: report.publicLocation,
    habitatClass: report.prediction.label,
    status: report.status,
    neighborhood: report.neighborhood,
    reportedAt: report.createdAt,
    latestReportedAt: latestReport.createdAt,
    reportCount: Math.max(members.length, 1),
    thumbnailUrl: latestReport.thumbnailUrl ?? placeholderEvidenceImage,
    imageUrl: latestReport.imageUrl ?? placeholderEvidenceImage,
    privacyNote:
      'Citizen-submitted image and exact pin are public because the reporter confirmed publication.',
  }
}

function toObservation(report: SubmittedReport): PublicReportObservation {
  return {
    id: report.id,
    reference: report.reference,
    capturedAt: report.createdAt,
    reportedAt: report.createdAt,
    imageUrl: report.imageUrl ?? placeholderEvidenceImage,
    thumbnailUrl: report.thumbnailUrl ?? placeholderEvidenceImage,
    habitatClass: report.prediction.label,
    confidenceBand: report.prediction.confidenceBand,
  }
}

function toPublicReportDetail(report: SubmittedReport, reports: SubmittedReport[]): PublicReportDetail {
  const rootReport = report.stackedOnReference
    ? reports.find((candidate) => candidate.reference === report.stackedOnReference) ?? report
    : report
  const members = stackMembers(reports, rootReport.reference)
  const latestReport = members[0] ?? rootReport

  return {
    id: rootReport.id,
    reference: rootReport.reference,
    publicLocation: rootReport.publicLocation,
    habitatClass: rootReport.prediction.label,
    status: rootReport.status,
    neighborhood: rootReport.neighborhood,
    reportedAt: rootReport.createdAt,
    latestReportedAt: latestReport.createdAt,
    reportCount: Math.max(members.length, 1),
    thumbnailUrl: latestReport.thumbnailUrl ?? placeholderEvidenceImage,
    imageUrl: latestReport.imageUrl ?? placeholderEvidenceImage,
    observations: (members.length ? members : [rootReport]).map(toObservation),
  }
}

function toNearbyCandidate(
  report: SubmittedReport,
  reports: SubmittedReport[],
  location: LocationPoint,
): NearbyReportCandidate {
  const members = stackMembers(reports, report.reference)
  const latestReport = members[0] ?? report

  return {
    id: report.id,
    reference: report.reference,
    publicLocation: report.publicLocation,
    habitatClass: report.prediction.label,
    status: report.status,
    neighborhood: report.neighborhood,
    distanceMeters: Math.round(distanceMeters(location, report.publicLocation) * 10) / 10,
    latestReportedAt: latestReport.createdAt,
    reportCount: Math.max(members.length, 1),
    thumbnailUrl: latestReport.thumbnailUrl ?? placeholderEvidenceImage,
  }
}

function createSubmittedReport(
  draft: ReportDraft,
  existingCount: number,
  stackParentReference?: string | null,
): SubmittedReport {
  const reportLocation = draft.correctedLocation ?? draft.detectedLocation

  if (!reportLocation || !draft.photoEvidence || !draft.capturedAt) {
    throw new Error('The report draft is incomplete.')
  }

  if (!isWithinServiceArea(reportLocation)) {
    throw new Error(SERVICE_AREA_ERROR)
  }

  const prediction = predictHabitatForDraft(draft)

  return {
    id: `report-${Date.now()}`,
    reference: buildReference(),
    createdAt: new Date().toISOString(),
    reportLocation,
    publicLocation: publicLocation(reportLocation),
    status: existingCount % 2 === 0 ? 'submitted' : 'under_review',
    prediction,
    neighborhood: pickNeighborhood(reportLocation),
    statusMessage: stackParentReference
      ? `Added to existing public report ${stackParentReference}.`
      : getStatusMessage(existingCount),
    notes: draft.notes?.trim(),
    stackedOnReference: stackParentReference,
    thumbnailUrl: draft.photoPreviewUrl ?? placeholderEvidenceImage,
    imageUrl: draft.photoPreviewUrl ?? placeholderEvidenceImage,
  }
}

function validateStackParent(
  reports: SubmittedReport[],
  draft: ReportDraft,
  stackParentReference?: string | null,
) {
  if (!stackParentReference) {
    return
  }

  const reportLocation = draft.correctedLocation ?? draft.detectedLocation

  if (!reportLocation) {
    throw new Error('The report draft is incomplete.')
  }

  if (!isWithinServiceArea(reportLocation)) {
    throw new Error(SERVICE_AREA_ERROR)
  }

  const prediction = predictHabitatForDraft(draft)
  const parent = parentReports(reports).find(
    (report) => report.reference.toUpperCase() === stackParentReference.trim().toUpperCase(),
  )

  if (
    !parent ||
    parent.status === 'closed' ||
    prediction.label === 'unclassified' ||
    parent.prediction.label !== prediction.label ||
    distanceMeters(reportLocation, parent.publicLocation) > SAME_SITE_RADIUS_METERS
  ) {
    throw new Error('The selected report no longer matches this submission.')
  }
}

export function createMockAppServices(
  options: MockServicesOptions = {},
): AppServices {
  return {
    reportsService: {
      async createReport(draft, createOptions) {
        await delay()
        const reports = readStoredReports()
        validateStackParent(reports, draft, createOptions?.stackParentReference)
        const nextReport = createSubmittedReport(
          draft,
          reports.length,
          createOptions?.stackParentReference,
        )
        const updatedReports = [nextReport, ...reports]
        writeStoredReports(updatedReports)
        return nextReport
      },
      async findNearbyReportCandidates(draft): Promise<NearbyReportCheck> {
        await delay(120)
        const location = draft.correctedLocation ?? draft.detectedLocation
        if (!location) {
          throw new Error('The report draft is incomplete.')
        }

        if (!isWithinServiceArea(location)) {
          throw new Error(SERVICE_AREA_ERROR)
        }

        const prediction = predictHabitatForDraft(draft)
        if (prediction.label === 'unclassified') {
          return { prediction, candidates: [] }
        }

        const reports = readStoredReports()
        const candidates = parentReports(reports)
          .filter((report) => report.status !== 'closed')
          .filter((report) => report.prediction.label === prediction.label)
          .map((report) => toNearbyCandidate(report, reports, location))
          .filter((report) => report.distanceMeters <= SAME_SITE_RADIUS_METERS)
          .sort((a, b) => a.distanceMeters - b.distanceMeters)
          .slice(0, 3)

        return { prediction, candidates }
      },
      async getReportStatus(reference) {
        await delay(140)
        const reports = readStoredReports()
        return (
          reports.find(
            (report) => report.reference.toUpperCase() === reference.trim().toUpperCase(),
          ) ?? null
        )
      },
      async getPublicReport(reference) {
        await delay(140)
        const reports = readStoredReports()
        const report = reports.find(
          (candidate) => candidate.reference.toUpperCase() === reference.trim().toUpperCase(),
        )

        return report ? toPublicReportDetail(report, reports) : null
      },
    },
    mapService: {
      async listPublicReports(bounds, filters) {
        await delay(160)
        const reports = parentReports(readStoredReports()).map(toPublicReport)
        return reports.filter(
          (report) =>
            isWithinServiceArea(report.publicLocation) &&
            pointInBounds(report.publicLocation, bounds) &&
            applyFilters(report, filters),
        )
      },
      async listHotspots(bounds) {
        return fetchCurrentIdengueHotspots(options.hotspotFetchImpl ?? fetch, bounds)
      },
    },
  }
}
