import type { LocationPoint } from '@/types/report'
import type { MapBounds } from '@/services/contracts'

export function pointInBounds(
  point: Pick<LocationPoint, 'latitude' | 'longitude'>,
  bounds?: MapBounds,
) {
  if (!bounds) {
    return true
  }

  return (
    point.latitude <= bounds.north &&
    point.latitude >= bounds.south &&
    point.longitude <= bounds.east &&
    point.longitude >= bounds.west
  )
}
