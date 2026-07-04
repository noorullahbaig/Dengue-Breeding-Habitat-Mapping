import { pointInBounds } from '@/services/mapBounds'
import { preparePhotoForUpload, StaleFileError } from '@/lib/imageProcessing'
import type { AppServices, CreateReportOptions, PublicReportFilters } from '@/services/contracts'
import type {
  ApiHealthStatus,
  NearbyReportCheck,
  NearbyReportCandidate,
  PublicMapReport,
  PublicReportDetail,
  PublicReportObservation,
  PublicHotspot,
  ReportDraft,
  ReportPrecheck,
  ReportStatus,
  SubmittedReport,
} from '@/types/report'
import type { MapBounds } from '@/services/contracts'

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export type AppApiErrorKind =
  | 'network'
  | 'model_not_ready'
  | 'model_processing_failed'
  | 'server_error'
  | 'stale_file'

type AppApiErrorTransport = 'network' | 'http'

interface AppApiErrorOptions {
  kind: AppApiErrorKind
  message: string
  transport: AppApiErrorTransport
  status?: number
  detail?: string
  apiBaseUrl?: string
  health?: ApiHealthStatus | null
}

export class AppApiError extends Error {
  kind: AppApiErrorKind
  transport: AppApiErrorTransport
  status?: number
  detail?: string
  apiBaseUrl?: string
  health?: ApiHealthStatus | null

  constructor({
    kind,
    message,
    transport,
    status,
    detail,
    apiBaseUrl,
    health,
  }: AppApiErrorOptions) {
    super(message)
    this.name = 'AppApiError'
    this.kind = kind
    this.transport = transport
    this.status = status
    this.detail = detail
    this.apiBaseUrl = apiBaseUrl
    this.health = health
  }
}

function isAppApiError(error: unknown): error is AppApiError {
  return error instanceof AppApiError
}

async function readErrorDetail(response: Response) {
  try {
    const body = (await response.json()) as { detail?: string }
    return body.detail
  } catch {
    return undefined
  }
}

async function parseJsonResponse<T>(response: Response, apiBaseUrl?: string): Promise<T> {
  if (!response.ok) {
    const detail = await readErrorDetail(response)
    throw new AppApiError({
      kind: 'server_error',
      message: detail ?? `Request failed with status ${response.status}.`,
      detail,
      status: response.status,
      transport: 'http',
      apiBaseUrl,
    })
  }

  return response.json() as Promise<T>
}

function buildPrecheckHttpError(
  response: Response,
  detail: string | undefined,
  apiBaseUrl: string,
) {
  if (response.status === 503 && detail === 'The detection model is not ready.') {
    return new AppApiError({
      kind: 'model_not_ready',
      message: 'Backend is reachable, but the detection model is not ready.',
      detail,
      status: response.status,
      transport: 'http',
      apiBaseUrl,
    })
  }

  if (
    response.status === 503 &&
    detail === 'The detection model could not process the uploaded image.'
  ) {
    return new AppApiError({
      kind: 'model_processing_failed',
      message:
        'Backend is reachable, but the uploaded image could not be processed by the model.',
      detail,
      status: response.status,
      transport: 'http',
      apiBaseUrl,
    })
  }

  return new AppApiError({
    kind: 'server_error',
    message: 'The backend returned an unexpected error during AI pre-check.',
    detail,
    status: response.status,
    transport: 'http',
    apiBaseUrl,
  })
}

async function fetchHealthStatus(baseUrl: string): Promise<ApiHealthStatus | null> {
  try {
    const response = await fetch(`${baseUrl}/health`)
    if (!response.ok) {
      return null
    }
    return (await response.json()) as ApiHealthStatus
  } catch {
    return null
  }
}

const shouldProbeHealth = import.meta.env.DEV || import.meta.env.MODE === 'test'

async function buildReportFormData(
  draft: ReportDraft,
  options?: CreateReportOptions,
) {
  const location = draft.correctedLocation ?? draft.detectedLocation
  const detectedLocation = draft.detectedLocation

  if (!draft.capturedAt || !location || !detectedLocation) {
    throw new Error('The report draft is incomplete.')
  }

  const processedBlob = await preparePhotoForUpload(draft.photoFile)

  const formData = new FormData()
  formData.append('image', processedBlob, 'image.jpg')
  formData.append('captured_at', draft.capturedAt)
  formData.append('latitude', String(location.latitude))
  formData.append('longitude', String(location.longitude))
  formData.append('source', location.source)

  if (typeof location.accuracyMeters === 'number') {
    formData.append('accuracy_meters', String(location.accuracyMeters))
  }

  formData.append('detected_latitude', String(detectedLocation.latitude))
  formData.append('detected_longitude', String(detectedLocation.longitude))
  formData.append('detected_source', detectedLocation.source)

  if (typeof detectedLocation.accuracyMeters === 'number') {
    formData.append('detected_accuracy_meters', String(detectedLocation.accuracyMeters))
  }

  if (draft.notes?.trim()) {
    formData.append('notes', draft.notes.trim())
  }

  if (options?.stackParentReference) {
    formData.append('stack_parent_reference', options.stackParentReference)
  }

  formData.append(
    'public_consent_accepted',
    options?.publicConsentAccepted ? 'true' : 'false',
  )

  if (options?.publicConsentText) {
    formData.append('public_consent_text', options.publicConsentText)
  }

  return formData
}

async function buildNearbyCandidateFormData(draft: ReportDraft) {
  const location = draft.correctedLocation ?? draft.detectedLocation
  const detectedLocation = draft.detectedLocation

  if (!location || !detectedLocation) {
    throw new Error('The report draft is incomplete.')
  }

  const processedBlob = await preparePhotoForUpload(draft.photoFile)

  const formData = new FormData()
  formData.append('image', processedBlob, 'image.jpg')
  formData.append('latitude', String(location.latitude))
  formData.append('longitude', String(location.longitude))
  formData.append('detected_latitude', String(detectedLocation.latitude))
  formData.append('detected_longitude', String(detectedLocation.longitude))
  formData.append('detected_source', detectedLocation.source)

  if (typeof detectedLocation.accuracyMeters === 'number') {
    formData.append('detected_accuracy_meters', String(detectedLocation.accuracyMeters))
  }

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

export function createApiAppServices(apiBaseUrl: string, getAuthToken?: () => Promise<string | null>): AppServices {
  const baseUrl = trimTrailingSlash(apiBaseUrl)
  const apiOrigin = new URL(baseUrl, window.location.origin).origin

  async function buildHeaders(includeAuth: boolean = false): Promise<HeadersInit> {
    const headers: HeadersInit = {}
    
    if (includeAuth && getAuthToken) {
      const token = await getAuthToken()
      if (token) {
			headers.Authorization = `Bearer ${token}`
      }
    }
    
    return headers
  }

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

  function normalizePrecheckResult(result: ReportPrecheck): ReportPrecheck {
    return {
      ...result,
      imageUrl: result.imageUrl ? publicUrl(result.imageUrl) : result.imageUrl,
      candidates: result.candidates.map(normalizeNearbyReport),
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
      async getMyReports() {
        const headers = await buildHeaders(true) // Include auth token
        const response = await fetch(`${baseUrl}/my-reports`, {
          headers,
        })
        return parseJsonResponse(response, baseUrl)
      },
      async claimReport(reference, claimToken) {
        const headers = await buildHeaders(true)
        const response = await fetch(`${baseUrl}/my-reports/claim`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reference, claimToken }),
        })
        return parseJsonResponse<ReportStatus>(response, baseUrl)
      },
      async createReport(draft, options) {
        try {
          const formData = await buildReportFormData(draft, options)
          const headers = await buildHeaders(true) // Include auth token
          const response = await fetch(`${baseUrl}/reports`, {
            method: 'POST',
            body: formData,
            headers,
          })
          return parseJsonResponse<SubmittedReport>(response, baseUrl)
        } catch (error) {
          if (error instanceof StaleFileError) {
            throw new AppApiError({
              kind: 'stale_file',
              message: error.message,
              transport: 'http',
              apiBaseUrl: baseUrl,
            })
          }
          throw error
        }
      },
      async precheckReport(draft) {
        const body = await buildNearbyCandidateFormData(draft)

        try {
          let response = await fetch(`${baseUrl}/reports/precheck`, {
            method: 'POST',
            body,
          })

          if (response.status === 404) {
            response = await fetch(`${baseUrl}/reports/nearby-candidates`, {
              method: 'POST',
              body,
            })
          }

          if (!response.ok) {
            throw buildPrecheckHttpError(response, await readErrorDetail(response), baseUrl)
          }

          const result = await parseJsonResponse<ReportPrecheck>(response, baseUrl)
          return normalizePrecheckResult(result)
        } catch (error) {
          if (error instanceof StaleFileError) {
            throw new AppApiError({
              kind: 'stale_file',
              message: error.message,
              transport: 'http',
              apiBaseUrl: baseUrl,
            })
          }

          if (isAppApiError(error)) {
            if (error.kind === 'network' && shouldProbeHealth) {
              const health = await fetchHealthStatus(baseUrl)
              if (health) {
                throw new AppApiError({
                  kind: 'server_error',
                  message: 'The backend returned an unexpected error during AI pre-check.',
                  detail: error.detail,
                  status: error.status,
                  transport: 'network',
                  apiBaseUrl: baseUrl,
                  health,
                })
              }
            }
            throw error
          }

          const health = shouldProbeHealth ? await fetchHealthStatus(baseUrl) : null
          if (health) {
            throw new AppApiError({
              kind: 'server_error',
              message: 'The backend returned an unexpected error during AI pre-check.',
              transport: 'network',
              apiBaseUrl: baseUrl,
              health,
            })
          }

          throw new AppApiError({
            kind: 'network',
            message:
              `Could not reach the backend. Check the connection to ${baseUrl}.`,
            transport: 'network',
            apiBaseUrl: baseUrl,
            health: null,
          })
        }
      },
      async findNearbyReportCandidates(draft) {
        try {
          const formData = await buildNearbyCandidateFormData(draft)
          
          const response = await fetch(`${baseUrl}/reports/nearby-candidates`, {
            method: 'POST',
            body: formData,
          })
          const result = await parseJsonResponse<NearbyReportCheck>(response, baseUrl)
          return normalizePrecheckResult(result)
        } catch (error) {
          if (error instanceof StaleFileError) {
            throw new AppApiError({
              kind: 'stale_file',
              message: error.message,
              transport: 'http',
              apiBaseUrl: baseUrl,
            })
          }
          throw error
        }
      },
      async getReportStatus(reference) {
        const response = await fetch(
          `${baseUrl}/reports/status/${encodeURIComponent(reference.trim())}`,
        )

        return parseJsonResponse(response, baseUrl)
      },
      async getPublicReport(reference) {
        const response = await fetch(
          `${baseUrl}/public/reports/${encodeURIComponent(reference.trim())}`,
        )

        return normalizePublicReportDetail(
          await parseJsonResponse<PublicReportDetail | null>(response, baseUrl),
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
        const reports = await parseJsonResponse<PublicMapReport[]>(response, baseUrl)

        return reports.map(normalizePublicReport)
      },
      async listHotspots(bounds) {
        const response = await fetch(`${baseUrl}/hotspots/current`)
        const hotspots = await parseJsonResponse<PublicHotspot[]>(response, baseUrl)
        return hotspots.filter((hotspot) => pointInBounds(hotspot.center, bounds))
      },
    },
  }
}
