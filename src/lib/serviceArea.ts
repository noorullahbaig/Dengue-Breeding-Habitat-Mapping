import boundaryGeoJson from '@/data/kuala-lumpur-boundary.geojson?raw'
import type { LocationPoint } from '@/types/report'

type Coordinate = [number, number]
type Ring = Coordinate[]
type Polygon = Ring[]
type Geometry =
  | { type: 'Polygon'; coordinates: Polygon }
  | { type: 'MultiPolygon'; coordinates: Polygon[] }

interface BoundaryFeature {
  type: 'Feature'
  geometry: Geometry
}

interface BoundaryFeatureCollection {
  type: 'FeatureCollection'
  features: BoundaryFeature[]
}

export const SERVICE_AREA_ERROR = 'Reports can only be submitted within Kuala Lumpur.'
export const SERVICE_AREA_LABEL = 'Kuala Lumpur service area'

const boundary = JSON.parse(boundaryGeoJson) as BoundaryFeatureCollection
const serviceAreaPolygons = boundary.features.flatMap((feature) =>
  feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates,
)
const allBoundaryCoordinates = serviceAreaPolygons.flat(2)

function isPointOnSegment(
  longitude: number,
  latitude: number,
  [startLongitude, startLatitude]: Coordinate,
  [endLongitude, endLatitude]: Coordinate,
) {
  const crossProduct =
    (latitude - startLatitude) * (endLongitude - startLongitude) -
    (longitude - startLongitude) * (endLatitude - startLatitude)

  if (Math.abs(crossProduct) > 1e-10) {
    return false
  }

  return (
    Math.min(startLongitude, endLongitude) - 1e-10 <= longitude &&
    longitude <= Math.max(startLongitude, endLongitude) + 1e-10 &&
    Math.min(startLatitude, endLatitude) - 1e-10 <= latitude &&
    latitude <= Math.max(startLatitude, endLatitude) + 1e-10
  )
}

function isPointInRing(longitude: number, latitude: number, ring: Ring) {
  let inside = false
  let previous = ring.at(-1)

  if (!previous) {
    return false
  }

  for (const current of ring) {
    if (isPointOnSegment(longitude, latitude, previous, current)) {
      return true
    }

    const [currentLongitude, currentLatitude] = current
    const [previousLongitude, previousLatitude] = previous
    const crossesLatitude = (currentLatitude > latitude) !== (previousLatitude > latitude)

    if (crossesLatitude) {
      const intersectionLongitude =
        ((previousLongitude - currentLongitude) * (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
        currentLongitude

      if (longitude < intersectionLongitude) {
        inside = !inside
      }
    }

    previous = current
  }

  return inside
}

function isPointInPolygon(longitude: number, latitude: number, polygon: Polygon) {
  const [outerRing, ...holes] = polygon

  if (!outerRing || !isPointInRing(longitude, latitude, outerRing)) {
    return false
  }

  return !holes.some((hole) => isPointInRing(longitude, latitude, hole))
}

export function isWithinServiceArea(point: Pick<LocationPoint, 'latitude' | 'longitude'>) {
  return serviceAreaPolygons.some((polygon) =>
    isPointInPolygon(point.longitude, point.latitude, polygon),
  )
}

export const serviceAreaBoundaryPolygons = serviceAreaPolygons.map((polygon) => {
  const firstCoordinate = polygon[0]?.[0]
  const id = firstCoordinate
    ? `service-area-${firstCoordinate[0]}-${firstCoordinate[1]}`
    : SERVICE_AREA_LABEL

  return {
    id,
    positions: polygon.map((ring) =>
      ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
    ),
  }
})

const worldMaskRing: [number, number][] = [
  [90, -180],
  [90, 180],
  [-90, 180],
  [-90, -180],
]

export const serviceAreaMaskPositions = [
  worldMaskRing,
  ...serviceAreaPolygons
    .map((polygon) => polygon[0])
    .filter((ring): ring is Ring => Boolean(ring))
    .map((ring) =>
      ring.map(([longitude, latitude]) => [latitude, longitude] as [number, number]),
    ),
]

const longitudes = allBoundaryCoordinates.map(([longitude]) => longitude)
const latitudes = allBoundaryCoordinates.map(([, latitude]) => latitude)
const boundsPadding = 0.025

export const serviceAreaMapBounds: [[number, number], [number, number]] = [
  [Math.min(...latitudes) - boundsPadding, Math.min(...longitudes) - boundsPadding],
  [Math.max(...latitudes) + boundsPadding, Math.max(...longitudes) + boundsPadding],
]
