import { STORAGE_KEY } from '@/lib/constants'
import {
  MAX_DETECTED_ACCURACY_METERS,
  allowedCorrectionRadiusMeters,
  hasTrustedDetectedLocation,
} from '@/lib/locationTrust'
import { predictHabitatForDraft } from '@/lib/prediction'
import { isWithinServiceArea, SERVICE_AREA_ERROR } from '@/lib/serviceArea'
import { fetchCurrentIdengueHotspots } from '@/services/idengueHotspots'
import { pointInBounds } from '@/services/mapBounds'
import type { AppServices, PublicReportFilters } from '@/services/contracts'
import type {
  HotspotMirrorStatus,
  LocationPoint,
  NearbyReportCheck,
  NearbyReportCandidate,
  OfficerReport,
  OfficerReportUpdate,
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
    prediction: report.prediction,
    status: report.status,
    neighborhood: report.neighborhood,
    reportedAt: report.createdAt,
    latestReportedAt: latestReport.createdAt,
    reportCount: Math.max(members.length, 1),
    thumbnailUrl: latestReport.thumbnailUrl ?? placeholderEvidenceImage,
    imageUrl: latestReport.imageUrl ?? placeholderEvidenceImage,
    privacyNote:
      'Citizen-submitted image and exact pin are public because the reporter confirmed publication.',
    hotspotPriority:
      report.hotspotPriority ?? defaultHotspotPriority(report.reportLocation),
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
    prediction: report.prediction,
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
    prediction: rootReport.prediction,
    status: rootReport.status,
    neighborhood: rootReport.neighborhood,
    reportedAt: rootReport.createdAt,
    latestReportedAt: latestReport.createdAt,
    reportCount: Math.max(members.length, 1),
    thumbnailUrl: latestReport.thumbnailUrl ?? placeholderEvidenceImage,
    imageUrl: latestReport.imageUrl ?? placeholderEvidenceImage,
    hotspotPriority:
      rootReport.hotspotPriority ?? defaultHotspotPriority(rootReport.reportLocation),
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

function defaultHotspotPriority(location: LocationPoint) {
  const centerDistance = distanceMeters(location, {
    latitude: 3.139,
    longitude: 101.6869,
    source: 'public',
  })
  const priorityLevel =
    centerDistance <= 200 ? 'core' : centerDistance <= 400 ? 'warning' : 'routine'

  return {
    snapshotDate: new Date().toISOString(),
    nearestHotspotId: 'mock-idengue-hotspot',
    nearestHotspotLocality: 'Demo Kuala Lumpur hotspot',
    nearestHotspotDistrict: 'Wilayah Persekutuan',
    nearestHotspotDistanceMeters: Math.round(centerDistance * 10) / 10,
    priorityLevel,
    priorityReason:
      priorityLevel === 'routine'
        ? 'No current iDengue hotspot is within the 400 m warning buffer.'
        : 'Near demo hotspot context for local prototype testing.',
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
    publicConsent: {
      accepted: true,
      acceptedAt: new Date().toISOString(),
      version: 'public-image-pin-ai-v2',
    },
    hotspotPriority: defaultHotspotPriority(reportLocation),
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

function validateTrustedLocationDraft(draft: ReportDraft) {
  const detectedLocation = draft.detectedLocation
  const selectedLocation = draft.correctedLocation ?? draft.detectedLocation

  if (!detectedLocation || !selectedLocation) {
    throw new Error('The report draft is incomplete.')
  }

  if (!hasTrustedDetectedLocation(detectedLocation)) {
    throw new Error(
      `A verified device location within ${MAX_DETECTED_ACCURACY_METERS}m accuracy is required.`,
    )
  }

  if (!isWithinServiceArea(selectedLocation)) {
    throw new Error(SERVICE_AREA_ERROR)
  }

  const allowedRadius = allowedCorrectionRadiusMeters(detectedLocation.accuracyMeters)
  if (allowedRadius === null || distanceMeters(detectedLocation, selectedLocation) > allowedRadius) {
    throw new Error('The selected site must stay within the allowed device-location correction area.')
  }
}

export function createMockAppServices(
  options: MockServicesOptions = {},
): AppServices {
  let hotspotMirrorStatus: HotspotMirrorStatus = {
    hotspotCount: 0,
    latestSnapshotDate: null,
    lastSyncedAt: null,
    sourceLabel: 'iDengue hotspot context',
  }

  function toOfficerReport(report: SubmittedReport): OfficerReport {
    return {
      id: report.id,
      reference: report.reference,
      createdAt: report.createdAt,
      capturedAt: report.createdAt,
      reportLocation: report.reportLocation,
      publicLocation: report.publicLocation,
      status: report.status,
      prediction: report.prediction,
      neighborhood: report.neighborhood,
      statusMessage: report.statusMessage,
      notes: report.notes,
      imageUrl: report.imageUrl ?? placeholderEvidenceImage,
      thumbnailUrl: report.thumbnailUrl ?? placeholderEvidenceImage,
      stackedOnReference: report.stackedOnReference,
      publicConsent: report.publicConsent ?? {
        accepted: true,
        acceptedAt: report.createdAt,
        version: 'public-image-pin-ai-v2',
      },
      hotspotPriority: report.hotspotPriority ?? defaultHotspotPriority(report.publicLocation),
      officerNotes: undefined,
      followUpAction: undefined,
      reviewedAt: undefined,
      reviewedBy: undefined,
    }
  }

  function applyOfficerUpdate(
    report: SubmittedReport,
    update: OfficerReportUpdate,
  ): SubmittedReport {
    const statusMessage =
      update.status === 'submitted'
        ? 'Received and awaiting officer review.'
        : update.status === 'under_review'
          ? 'Queued for officer review with map context.'
          : update.status === 'prioritized'
            ? 'Flagged for faster follow-up because the area aligns with active hotspot context.'
            : update.status === 'action_recorded'
              ? 'An officer logged follow-up activity for this report.'
              : 'The report lifecycle has been completed for this prototype.'

    return {
      ...report,
      status: update.status,
      statusMessage,
    }
  }

  return {
    reportsService: {
      async getMyReports() {
        await delay()
        // Mock implementation: return all stored reports
        // In real implementation, this would filter by authenticated user
        const reports = readStoredReports()
        return reports.map((report) => ({
          reference: report.reference,
          status: report.status,
          createdAt: report.createdAt,
          neighborhood: report.neighborhood,
          statusMessage: report.statusMessage,
        }))
      },
      async createReport(draft, createOptions) {
        await delay()
        if (!createOptions?.publicConsentAccepted) {
          throw new Error('Confirm public image and exact-pin publication before submitting.')
        }
        validateTrustedLocationDraft(draft)
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
      async precheckReport(draft): Promise<NearbyReportCheck> {
        await delay(120)
        const location = draft.correctedLocation ?? draft.detectedLocation
        validateTrustedLocationDraft(draft)

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
      async findNearbyReportCandidates(draft): Promise<NearbyReportCheck> {
        await delay(120)
        const location = draft.correctedLocation ?? draft.detectedLocation
        validateTrustedLocationDraft(draft)

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
}    },
  }
}
