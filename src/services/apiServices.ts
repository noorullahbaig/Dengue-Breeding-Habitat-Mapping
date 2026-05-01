import { fetchCurrentIdengueHotspots } from '@/services/idengueHotspots'
import type { AppServices, PublicReportFilters } from '@/services/contracts'
import type {
  NearbyReportCheck,
  NearbyReportCandidate,
  PublicMapReport,
  PublicReportDetail,
  PublicReportObservation,
  ReportDraft,
  SubmittedReport,
} from '@/types/report'
import type { MapBounds } from '@/services/contracts'

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`
    try {
      const body = await response.json() as { detail?: string }
      if (body.detail) {
        message = body.detail
      }
    } catch {
      // Keep the generic message.
    }

    throw new Error(message)
  }

  return response.json() as Promise<T>
}

function buildReportFormData(
  draft: ReportDraft,
  options?: { stackParentReference?: string | null },
) {
  const location = draft.correctedLocation ?? draft.detectedLocation

  if (!draft.photoFile || !draft.capturedAt || !location) {
    throw new Error('The report draft is incomplete.')
  }

  const formData = new FormData()
  formData.append('image', draft.photoFile)
  formData.append('captured_at', draft.capturedAt)
  formData.append('latitude', String(location.latitude))
  formData.append('longitude', String(location.longitude))
  formData.append('source', location.source)

  if (typeof location.accuracyMeters === 'number') {
    formData.append('accuracy_meters', String(location.accuracyMeters))
  }

  if (draft.notes?.trim()) {
    formData.append('notes', draft.notes.trim())
  }

  if (options?.stackParentReference) {
    formData.append('stack_parent_reference', options.stackParentReference)
  }

  return formData
}

function buildNearbyCandidateFormData(draft: ReportDraft) {
  const location = draft.correctedLocation ?? draft.detectedLocation

  if (!draft.photoFile || !location) {
    throw new Error('The report draft is incomplete.')
  }

  const formData = new FormData()
  formData.append('image', draft.photoFile)
  formData.append('latitude', String(location.latitude))
  formData.append('longitude', String(location.longitude))

  return formData
}

function appendBounds(params: URLSearchParams, bounds?: MapBounds) {
  if (!bounds) {
    return
  }

  params.set('north', String(bounds.north))
  params.set('south', String(bounds.south))
  params.set('east', String(bounds.east))
  params.set('west', String(bounds.west))
}

function appendFilters(params: URLSearchParams, filters?: PublicReportFilters) {
  if (!filters) {
    return
  }

  if (filters.status && filters.status !== 'all') {
    params.set('status', filters.status)
  }

  if (filters.habitatClass && filters.habitatClass !== 'all') {
    params.set('habitat_class', filters.habitatClass)
  }
}

export function createApiAppServices(apiBaseUrl: string): AppServices {
  const baseUrl = trimTrailingSlash(apiBaseUrl)
  const apiOrigin = new URL(baseUrl, window.location.origin).origin

  function publicUrl(value: string) {
    return value.startsWith('/api/') ? `${apiOrigin}${value}` : value
  }

  function normalizePublicReport(report: PublicMapReport): PublicMapReport {
    return {
      ...report,
      thumbnailUrl: publicUrl(report.thumbnailUrl),
      imageUrl: publicUrl(report.imageUrl),
    }
  }

  function normalizeNearbyReport(report: NearbyReportCandidate): NearbyReportCandidate {
    return {
      ...report,
      thumbnailUrl: publicUrl(report.thumbnailUrl),
    }
  }

  function normalizeObservation(observation: PublicReportObservation): PublicReportObservation {
    return {
      ...observation,
      thumbnailUrl: publicUrl(observation.thumbnailUrl),
      imageUrl: publicUrl(observation.imageUrl),
    }
  }

  function normalizePublicReportDetail(
    report: PublicReportDetail | null,
  ): PublicReportDetail | null {
    if (!report) {
      return null
    }

    return {
      ...report,
      thumbnailUrl: publicUrl(report.thumbnailUrl),
      imageUrl: publicUrl(report.imageUrl),
      observations: report.observations.map(normalizeObservation),
    }
  }

  return {
    reportsService: {
      async createReport(draft, options) {
        const response = await fetch(`${baseUrl}/reports`, {
          method: 'POST',
          body: buildReportFormData(draft, options),
        })

        return parseJsonResponse<SubmittedReport>(response)
      },
      async findNearbyReportCandidates(draft) {
        const response = await fetch(`${baseUrl}/reports/nearby-candidates`, {
          method: 'POST',
          body: buildNearbyCandidateFormData(draft),
        })
        const result = await parseJsonResponse<NearbyReportCheck>(response)
        return {
          ...result,
          candidates: result.candidates.map(normalizeNearbyReport),
        }
      },
      async getReportStatus(reference) {
        const response = await fetch(
          `${baseUrl}/reports/status/${encodeURIComponent(reference.trim())}`,
        )

        return parseJsonResponse(response)
      },
      async getPublicReport(reference) {
        const response = await fetch(
          `${baseUrl}/public/reports/${encodeURIComponent(reference.trim())}`,
        )

        return normalizePublicReportDetail(
          await parseJsonResponse<PublicReportDetail | null>(response),
        )
      },
    },
    mapService: {
      async listPublicReports(bounds, filters) {
        const params = new URLSearchParams()
        appendBounds(params, bounds)
        appendFilters(params, filters)
        const query = params.toString()
        const response = await fetch(`${baseUrl}/public/reports${query ? `?${query}` : ''}`)
        const reports = await parseJsonResponse<PublicMapReport[]>(response)

        return reports.map(normalizePublicReport)
      },
      async listHotspots(bounds) {
        return fetchCurrentIdengueHotspots(fetch, bounds)
      },
    },
  }
}
