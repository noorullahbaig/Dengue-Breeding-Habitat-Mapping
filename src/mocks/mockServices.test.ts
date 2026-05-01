import { createMockAppServices } from '@/mocks/mockServices'
import { STORAGE_KEY } from '@/lib/constants'
import type { ReportDraft } from '@/types/report'

function buildHotspotFeature(
  locality: string,
  district: string,
  runsisDate: number,
  outbreakStartDate: number,
  weekNumber: number,
  year: number,
  pointX: number,
  pointY: number,
  cumulativeCases: number | null,
  outbreakDurationDays: number | null,
) {
  return {
    attributes: {
      'SPWD.AVT_HOTSPOTMINGGUAN.LOKALITI': locality,
      'SPWD.AVT_HOTSPOTMINGGUAN.DAERAH': district,
      'SPWD.AVT_HOTSPOTMINGGUAN.KUMULATIF_KES': cumulativeCases,
      'SPWD.AVT_HOTSPOTMINGGUAN.TEMPOH_WABAK': outbreakDurationDays,
      'SPWD.AVT_HOTSPOTMINGGUAN.TARIKH_MULA_WABAK': outbreakStartDate,
      'SPWD.AVT_HOTSPOTMINGGUAN.WEEKNUM': weekNumber,
      'SPWD.AVT_HOTSPOTMINGGUAN.TAHUN': year,
      'SPWD.AVT_HOTSPOTMINGGUAN.RUNSISDATE': runsisDate,
      'SPWD.DBO_LOKALITI_POINTS.POINT_X': pointX,
      'SPWD.DBO_LOKALITI_POINTS.POINT_Y': pointY,
    },
  }
}

describe('mock services', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('creates a report, stores it, and exposes a public evidence marker', async () => {
    const services = createMockAppServices()
    const draft: ReportDraft = {
      photoEvidence: {
        name: 'tire-water.jpg',
        mimeType: 'image/jpeg',
        size: 1200,
      },
      photoPreviewUrl: 'data:image/jpeg;base64,preview',
      capturedAt: '2026-04-20T01:00:00.000Z',
      detectedLocation: {
        latitude: 3.11121,
        longitude: 101.65218,
        source: 'browser',
      },
      correctedLocation: {
        latitude: 3.11121,
        longitude: 101.65218,
        source: 'manual',
      },
      notes: 'Old tire with stagnant water',
    }

    const created = await services.reportsService.createReport(draft)
    const statusLookup = await services.reportsService.getReportStatus(created.reference)
    const publicReports = await services.mapService.listPublicReports()
    const publicDetail = await services.reportsService.getPublicReport(created.reference)

    expect(statusLookup?.reference).toBe(created.reference)
    expect(created.prediction.label).toBe('tire')
    expect(created.publicLocation.latitude).toBe(created.reportLocation.latitude)
    expect(created.publicLocation.longitude).toBe(created.reportLocation.longitude)
    expect(publicReports.some((report) => report.reference === created.reference)).toBe(true)
    expect(publicReports.find((report) => report.reference === created.reference)?.thumbnailUrl).toBeTruthy()
    expect(publicDetail?.observations).toHaveLength(1)
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain(created.reference)
  })

  it('finds nearby parent reports and creates stacked submissions in mock storage', async () => {
    const services = createMockAppServices()
    const parentDraft: ReportDraft = {
      photoEvidence: {
        name: 'tire-parent.jpg',
        mimeType: 'image/jpeg',
        size: 1200,
      },
      photoPreviewUrl: 'data:image/jpeg;base64,parent',
      capturedAt: '2026-04-20T01:00:00.000Z',
      detectedLocation: {
        latitude: 3.11121,
        longitude: 101.65218,
        source: 'browser',
      },
    }
    const childDraft: ReportDraft = {
      ...parentDraft,
      photoEvidence: {
        name: 'tire-child.jpg',
        mimeType: 'image/jpeg',
        size: 1300,
      },
      photoPreviewUrl: 'data:image/jpeg;base64,child',
      capturedAt: '2026-04-20T02:00:00.000Z',
      detectedLocation: {
        latitude: 3.11123,
        longitude: 101.6522,
        source: 'browser',
      },
    }

    const parent = await services.reportsService.createReport(parentDraft)
    const nearbyCheck = await services.reportsService.findNearbyReportCandidates(childDraft)
    const child = await services.reportsService.createReport(childDraft, {
      stackParentReference: nearbyCheck.candidates[0]?.reference,
    })
    const publicDetail = await services.reportsService.getPublicReport(child.reference)
    const publicReports = await services.mapService.listPublicReports()

    expect(nearbyCheck.prediction.label).toBe('tire')
    expect(nearbyCheck.candidates[0]?.reference).toBe(parent.reference)
    expect(child.stackedOnReference).toBe(parent.reference)
    expect(publicDetail?.reference).toBe(parent.reference)
    expect(publicDetail?.observations).toHaveLength(2)
    expect(publicReports.filter((report) => report.reference === parent.reference)).toHaveLength(1)
  })

  it('does not suggest nearby mock reports when the predicted class differs', async () => {
    const services = createMockAppServices()
    const parentDraft: ReportDraft = {
      photoEvidence: {
        name: 'tire-parent.jpg',
        mimeType: 'image/jpeg',
        size: 1200,
      },
      photoPreviewUrl: 'data:image/jpeg;base64,parent',
      capturedAt: '2026-04-20T01:00:00.000Z',
      detectedLocation: {
        latitude: 3.11121,
        longitude: 101.65218,
        source: 'browser',
      },
    }
    const drainDraft: ReportDraft = {
      ...parentDraft,
      photoEvidence: {
        name: 'drain-child.jpg',
        mimeType: 'image/jpeg',
        size: 1300,
      },
      photoPreviewUrl: 'data:image/jpeg;base64,child',
      capturedAt: '2026-04-20T02:00:00.000Z',
      detectedLocation: {
        latitude: 3.11123,
        longitude: 101.6522,
        source: 'browser',
      },
    }

    await services.reportsService.createReport(parentDraft)
    const nearbyCheck = await services.reportsService.findNearbyReportCandidates(drainDraft)

    expect(nearbyCheck.prediction.label).toBe('drain_inlet')
    expect(nearbyCheck.candidates).toEqual([])
  })

  it('rejects mock submissions outside Kuala Lumpur', async () => {
    const services = createMockAppServices()
    const draft: ReportDraft = {
      photoEvidence: {
        name: 'container.jpg',
        mimeType: 'image/jpeg',
        size: 1200,
      },
      photoPreviewUrl: 'data:image/jpeg;base64,preview',
      capturedAt: '2026-04-20T01:00:00.000Z',
      detectedLocation: {
        latitude: 2.9264,
        longitude: 101.6964,
        source: 'browser',
      },
    }

    await expect(services.reportsService.createReport(draft)).rejects.toThrow(
      /only be submitted within Kuala Lumpur/i,
    )
    await expect(services.reportsService.findNearbyReportCandidates(draft)).rejects.toThrow(
      /only be submitted within Kuala Lumpur/i,
    )
  })

  it('returns normalized hotspot context through mapService.listHotspots', async () => {
    const previousRunsisDate = Date.parse('2026-04-16T00:00:00.000Z')
    const currentRunsisDate = Date.parse('2026-04-19T00:00:00.000Z')
    const outbreakStartDate = Date.parse('2026-03-19T00:00:00.000Z')
    const hotspotFetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          buildHotspotFeature(
            'Palm Court',
            'Lembah Pantai',
            previousRunsisDate,
            outbreakStartDate,
            16,
            2026,
            101.68,
            3.12,
            7,
            64,
          ),
          buildHotspotFeature(
            'Palm Court',
            'Lembah Pantai',
            currentRunsisDate,
            outbreakStartDate,
            16,
            2026,
            101.68,
            3.12,
            8,
            67,
          ),
          buildHotspotFeature(
            'Palm Court',
            'Lembah Pantai',
            currentRunsisDate,
            outbreakStartDate,
            16,
            2026,
            101.68,
            3.12,
            8,
            67,
          ),
        ],
      }),
    }) as unknown as typeof fetch

    const services = createMockAppServices({ hotspotFetchImpl })
    const hotspots = await services.mapService.listHotspots()

    expect(hotspotFetchImpl).toHaveBeenCalledTimes(1)
    expect(hotspots).toHaveLength(1)
    expect(hotspots[0]?.locality).toBe('Palm Court')
    expect(hotspots[0]?.radiusMeters).toBe(200)
    expect(hotspots[0]?.sourceLabel).toBe('iDengue hotspot context')
    expect(hotspots[0]?.weekNumber).toBe(16)
    expect(hotspots[0]?.year).toBe(2026)
    expect(hotspots[0]?.outbreakStartDate).toBe(new Date(outbreakStartDate).toISOString())
    expect(hotspots[0]?.snapshotDate).toBe(new Date(currentRunsisDate).toISOString())
  })
})
