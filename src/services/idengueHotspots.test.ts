import { fetchCurrentIdengueHotspots } from '@/services/idengueHotspots'
import type { MapBounds } from '@/services/contracts'

function buildFeature(
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

describe('fetchCurrentIdengueHotspots', () => {
  it('requests the ArcGIS hotspot endpoint and normalizes the current hotspot snapshot', async () => {
    const currentRunsisDate = Date.parse('2026-04-19T00:00:00.000Z')
    const previousRunsisDate = Date.parse('2026-04-16T00:00:00.000Z')
    const olderOutbreakDate = Date.parse('2026-02-18T00:00:00.000Z')
    const newerOutbreakDate = Date.parse('2026-03-19T00:00:00.000Z')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          buildFeature(
            'Palm Court',
            'Lembah Pantai',
            previousRunsisDate,
            olderOutbreakDate,
            16,
            2026,
            101.68,
            3.12,
            7,
            64,
          ),
          buildFeature(
            'Palm Court',
            'Lembah Pantai',
            currentRunsisDate,
            olderOutbreakDate,
            16,
            2026,
            101.68,
            3.12,
            8,
            67,
          ),
          buildFeature(
            'Palm Court',
            'Lembah Pantai',
            currentRunsisDate,
            olderOutbreakDate,
            16,
            2026,
            101.68,
            3.12,
            8,
            67,
          ),
          buildFeature(
            'Desa Tasik',
            'Cheras',
            currentRunsisDate,
            newerOutbreakDate,
            16,
            2026,
            101.74,
            3.09,
            null,
            null,
          ),
          buildFeature(
            'Outside KL',
            'Putrajaya',
            currentRunsisDate,
            newerOutbreakDate,
            16,
            2026,
            101.6964,
            2.9264,
            9,
            12,
          ),
        ],
      }),
    })

    const hotspots = await fetchCurrentIdengueHotspots(fetchMock as unknown as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestUrl.pathname).toContain('/MapServer/0/query')
    expect(requestUrl.searchParams.get('where')).toBe(
      "SPWD.AVT_HOTSPOTMINGGUAN.NEGERI='WILAYAH PERSEKUTUAN'",
    )
    expect(requestUrl.searchParams.get('returnGeometry')).toBe('false')

    expect(hotspots).toHaveLength(2)
    expect(hotspots[0]?.radiusMeters).toBe(200)
    expect(hotspots[0]?.warningRadiusMeters).toBe(400)
    expect(hotspots[0]?.outbreakStartDate).toBe(new Date(olderOutbreakDate).toISOString())
    expect(hotspots[0]?.weekNumber).toBe(16)
    expect(hotspots[0]?.year).toBe(2026)
    expect(hotspots[0]?.snapshotDate).toBe(new Date(currentRunsisDate).toISOString())
    expect(hotspots[0]?.sourceLabel).toBe('iDengue hotspot context')
    expect(hotspots[0]?.center.source).toBe('public')
    expect(hotspots[0]?.locality).toBe('Palm Court')
    expect(hotspots[1]?.locality).toBe('Desa Tasik')
  })

  it('applies bounds filtering after normalization', async () => {
    const currentRunsisDate = Date.parse('2026-04-19T00:00:00.000Z')
    const outbreakStartDate = Date.parse('2026-03-19T00:00:00.000Z')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          buildFeature(
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
          buildFeature(
            'Desa Tasik',
            'Cheras',
            currentRunsisDate,
            outbreakStartDate,
            16,
            2026,
            101.74,
            3.09,
            4,
            32,
          ),
        ],
      }),
    })
    const bounds: MapBounds = {
      north: 3.13,
      south: 3.11,
      east: 101.69,
      west: 101.67,
    }

    const hotspots = await fetchCurrentIdengueHotspots(
      fetchMock as unknown as typeof fetch,
      bounds,
    )

    expect(hotspots).toHaveLength(1)
    expect(hotspots[0]?.locality).toBe('Palm Court')
  })

  it('throws when the response is invalid', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ features: [] }),
    })

    await expect(
      fetchCurrentIdengueHotspots(fetchMock as unknown as typeof fetch),
    ).rejects.toThrow(/empty/i)
  })
})
