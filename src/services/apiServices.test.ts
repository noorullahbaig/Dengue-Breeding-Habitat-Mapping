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
      message: 'Could not reach the backend. Check the connection to http://localhost:8000/api.',
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

describe('createApiAppServices account reports', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('claims a report with the current bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        id: 'report-1',
        reference: 'KL-TEST-0001',
        createdAt: '2026-07-04T10:00:00Z',
        status: 'submitted',
        prediction: {
          label: 'tire',
          confidence: 0.9,
          confidenceBand: 'high',
          advisoryText: 'Advisory only.',
        },
        neighborhood: 'Sentul',
        statusMessage: 'Report received.',
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const services = createApiAppServices(
      'http://localhost:8000/api',
      async () => 'id-token',
    )

    await services.reportsService.claimReport('KL-TEST-0001', 'private-claim-token')

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/my-reports/claim',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer id-token',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          reference: 'KL-TEST-0001',
          claimToken: 'private-claim-token',
        }),
      }),
    )
  })
})

describe('createApiAppServices report notes', () => {
  it('sends the trimmed resident note in report form data', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ reference: 'KL-TEST-0001' }, 201))
    vi.stubGlobal('fetch', fetchMock)
    const services = createApiAppServices('http://localhost:8000/api')
    const draft: ReportDraft = {
      ...createDraft(),
      capturedAt: '2026-07-05T10:00:00.000Z',
      correctedLocation: {
        latitude: 3.139,
        longitude: 101.6869,
        accuracyMeters: 42,
        source: 'browser',
      },
      notes: '  Water beneath drain cover  ',
    }

    await services.reportsService.createReport(draft, { publicConsentAccepted: true })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(request.body).toBeInstanceOf(FormData)
    expect((request.body as FormData).get('notes')).toBe('Water beneath drain cover')
  })
})
