import { createApiAppServices } from '@/services/apiServices'
import type { ReportDraft } from '@/types/report'

function createDraft(): ReportDraft {
  return {
    photoFile: new File(['sample'], 'sample.jpg', { type: 'image/jpeg' }),
    detectedLocation: {
      latitude: 3.139,
      longitude: 101.6869,
      accuracyMeters: 42,
      source: 'browser',
    },
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  })
}

describe('createApiAppServices precheck errors', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('classifies transport failures as network errors', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))

    vi.stubGlobal('fetch', fetchMock)

    const services = createApiAppServices('http://localhost:8000/api')

    await expect(services.reportsService.precheckReport(createDraft())).rejects.toMatchObject({
      kind: 'network',
      transport: 'network',
      message: 'Could not reach the local backend. Start or reconnect the API server at localhost:8000.',
    })
  })

  it('classifies readiness failures as model_not_ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ detail: 'The detection model is not ready.' }, 503),
      ),
    )

    const services = createApiAppServices('http://localhost:8000/api')

    await expect(services.reportsService.precheckReport(createDraft())).rejects.toMatchObject({
      kind: 'model_not_ready',
      status: 503,
      transport: 'http',
      detail: 'The detection model is not ready.',
    })
  })

  it('classifies model processing failures separately', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          { detail: 'The detection model could not process the uploaded image.' },
          503,
        ),
      ),
    )

    const services = createApiAppServices('http://localhost:8000/api')

    await expect(services.reportsService.precheckReport(createDraft())).rejects.toMatchObject({
      kind: 'model_processing_failed',
      status: 503,
      transport: 'http',
      detail: 'The detection model could not process the uploaded image.',
    })
  })

  it('normalizes backend precheck image urls to the api origin', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          {
            prediction: {
              label: 'tire',
              confidence: 0.91,
              confidenceBand: 'high',
              topRawLabel: 'Tire',
              detections: [],
              advisoryText: 'Advisory only.',
            },
            candidates: [],
            imageUrl: '/api/reports/precheck-images/prechecks/test-overlay.jpg',
          },
          200,
        ),
      ),
    )

    const services = createApiAppServices('http://localhost:8000/api')

    await expect(services.reportsService.precheckReport(createDraft())).resolves.toMatchObject({
      imageUrl: 'http://localhost:8000/api/reports/precheck-images/prechecks/test-overlay.jpg',
    })
  })

  it('classifies other backend failures as server errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse({ detail: 'Unexpected backend failure.' }, 500),
      ),
    )

    const services = createApiAppServices('http://localhost:8000/api')

    await expect(services.reportsService.precheckReport(createDraft())).rejects.toMatchObject({
      kind: 'server_error',
      status: 500,
      transport: 'http',
      detail: 'Unexpected backend failure.',
      message: 'The backend returned an unexpected error during AI pre-check.',
    })
  })
})
