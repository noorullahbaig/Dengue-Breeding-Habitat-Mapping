import type { PublicHotspot } from '@/types/report'
import type { MapBounds } from '@/services/contracts'
import { pointInBounds } from '@/services/mapBounds'
import { isWithinServiceArea } from '@/lib/serviceArea'

const IDENGUE_HOTSPOT_ENDPOINT =
  'https://mygis.mysa.gov.my/erica1/rest/services/iDengue/WM_idengue/MapServer/0/query'

const HOTSPOT_FIELDS = [
  'SPWD.AVT_HOTSPOTMINGGUAN.LOKALITI',
  'SPWD.AVT_HOTSPOTMINGGUAN.DAERAH',
  'SPWD.AVT_HOTSPOTMINGGUAN.KUMULATIF_KES',
  'SPWD.AVT_HOTSPOTMINGGUAN.TEMPOH_WABAK',
  'SPWD.AVT_HOTSPOTMINGGUAN.TARIKH_MULA_WABAK',
  'SPWD.AVT_HOTSPOTMINGGUAN.WEEKNUM',
  'SPWD.AVT_HOTSPOTMINGGUAN.TAHUN',
  'SPWD.AVT_HOTSPOTMINGGUAN.RUNSISDATE',
  'SPWD.DBO_LOKALITI_POINTS.POINT_X',
  'SPWD.DBO_LOKALITI_POINTS.POINT_Y',
]

type HotspotAttributes = Record<string, number | string | null | undefined>

interface ArcGisFeature {
  attributes?: HotspotAttributes
}

interface ArcGisResponse {
  features?: ArcGisFeature[]
}

interface ParsedHotspotRow {
  locality: string
  district: string
  cumulativeCases: number | null
  outbreakDurationDays: number | null
  outbreakStartDate: number
  weekNumber: number
  year: number
  runsisDate: number
  pointX: number
  pointY: number
}

function getString(attributes: HotspotAttributes, field: string) {
  const value = attributes[field]

  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

function getRequiredNumber(attributes: HotspotAttributes, field: string) {
  const value = attributes[field]
  const numericValue = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(numericValue) ? numericValue : null
}

function getOptionalNumber(attributes: HotspotAttributes, field: string) {
  const value = attributes[field]

  if (value === null || value === undefined || value === '') {
    return null
  }

  const numericValue = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numericValue) ? numericValue : null
}

function parseHotspotFeature(feature: ArcGisFeature) {
  const attributes = feature.attributes

  if (!attributes) {
    return null
  }

  const locality = getString(attributes, 'SPWD.AVT_HOTSPOTMINGGUAN.LOKALITI')
  const district = getString(attributes, 'SPWD.AVT_HOTSPOTMINGGUAN.DAERAH')
  const runsisDate = getRequiredNumber(attributes, 'SPWD.AVT_HOTSPOTMINGGUAN.RUNSISDATE')
  const outbreakStartDate = getRequiredNumber(
    attributes,
    'SPWD.AVT_HOTSPOTMINGGUAN.TARIKH_MULA_WABAK',
  )
  const weekNumber = getRequiredNumber(attributes, 'SPWD.AVT_HOTSPOTMINGGUAN.WEEKNUM')
  const year = getRequiredNumber(attributes, 'SPWD.AVT_HOTSPOTMINGGUAN.TAHUN')
  const pointX = getRequiredNumber(attributes, 'SPWD.DBO_LOKALITI_POINTS.POINT_X')
  const pointY = getRequiredNumber(attributes, 'SPWD.DBO_LOKALITI_POINTS.POINT_Y')

  if (
    !locality ||
    !district ||
    runsisDate === null ||
    outbreakStartDate === null ||
    weekNumber === null ||
    year === null ||
    pointX === null ||
    pointY === null
  ) {
    return null
  }

  return {
    locality,
    district,
    cumulativeCases: getOptionalNumber(
      attributes,
      'SPWD.AVT_HOTSPOTMINGGUAN.KUMULATIF_KES',
    ),
    outbreakDurationDays: getOptionalNumber(
      attributes,
      'SPWD.AVT_HOTSPOTMINGGUAN.TEMPOH_WABAK',
    ),
    outbreakStartDate,
    weekNumber,
    year,
    runsisDate,
    pointX,
    pointY,
  } satisfies ParsedHotspotRow
}

function buildHotspotId(row: ParsedHotspotRow, snapshotDate: string) {
  return [
    row.district,
    row.locality,
    row.pointX.toFixed(6),
    row.pointY.toFixed(6),
    snapshotDate,
  ]
    .map((segment) => encodeURIComponent(segment.toLowerCase()))
    .join('--')
}

function toPublicHotspot(row: ParsedHotspotRow): PublicHotspot {
  const snapshotDate = new Date(row.runsisDate).toISOString()

  return {
    id: buildHotspotId(row, snapshotDate),
    locality: row.locality,
    district: row.district,
    center: {
      latitude: row.pointY,
      longitude: row.pointX,
      source: 'public',
    },
    radiusMeters: 200,
    cumulativeCases: row.cumulativeCases,
    outbreakDurationDays: row.outbreakDurationDays,
    outbreakStartDate: new Date(row.outbreakStartDate).toISOString(),
    weekNumber: row.weekNumber,
    year: row.year,
    snapshotDate,
    sourceLabel: 'iDengue hotspot context',
  }
}

function compareHotspots(a: PublicHotspot, b: PublicHotspot) {
  const byOutbreakStart = a.outbreakStartDate.localeCompare(b.outbreakStartDate)

  if (byOutbreakStart !== 0) {
    return byOutbreakStart
  }

  const aCases = a.cumulativeCases ?? Number.NEGATIVE_INFINITY
  const bCases = b.cumulativeCases ?? Number.NEGATIVE_INFINITY

  if (aCases !== bCases) {
    return bCases - aCases
  }

  return a.locality.localeCompare(b.locality)
}

// Prototype uses live iDengue ArcGIS queries. Cloud deployment should replace this with a scheduled backend mirror or Lambda/cron sync keyed by MAX(RUNSISDATE).
export async function fetchCurrentIdengueHotspots(
  fetchImpl: typeof fetch = fetch,
  bounds?: MapBounds,
): Promise<PublicHotspot[]> {
  const params = new URLSearchParams({
    where: "SPWD.AVT_HOTSPOTMINGGUAN.NEGERI='WILAYAH PERSEKUTUAN'",
    outFields: HOTSPOT_FIELDS.join(','),
    returnGeometry: 'false',
    f: 'json',
  })

  const response = await fetchImpl(`${IDENGUE_HOTSPOT_ENDPOINT}?${params.toString()}`)

  if (!response.ok) {
    throw new Error('The iDengue hotspot request failed.')
  }

  const payload = (await response.json()) as ArcGisResponse

  if (!Array.isArray(payload.features) || payload.features.length === 0) {
    throw new Error('The iDengue hotspot response was empty.')
  }

  const parsedRows = payload.features.map(parseHotspotFeature).filter(Boolean) as ParsedHotspotRow[]

  if (parsedRows.length === 0) {
    throw new Error('The iDengue hotspot response was malformed.')
  }

  const latestRunsisDate = Math.max(...parsedRows.map((row) => row.runsisDate))
  const latestRows = parsedRows.filter((row) => row.runsisDate === latestRunsisDate)

  const dedupedRows = new Map<string, ParsedHotspotRow>()

  for (const row of latestRows) {
    const rowKey = [row.locality, row.district, row.pointX, row.pointY].join('|')

    if (!dedupedRows.has(rowKey)) {
      dedupedRows.set(rowKey, row)
    }
  }

  const hotspots = Array.from(dedupedRows.values()).map(toPublicHotspot).sort(compareHotspots)

  if (!hotspots.length) {
    throw new Error('No current iDengue hotspots were available.')
  }

  return hotspots
    .filter((hotspot) => isWithinServiceArea(hotspot.center))
    .filter((hotspot) => pointInBounds(hotspot.center, bounds))
}
