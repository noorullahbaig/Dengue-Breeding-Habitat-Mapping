import L from 'leaflet'
import type { LocationPoint } from '@/types/report'

function buildIcon(className: string, html = '<span class="map-pin__core"></span>') {
  return L.divIcon({
    className,
    html,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  })
}

export const residentMarkerIcon = buildIcon('map-pin map-pin--resident')
export const publicMarkerIcon = buildIcon('map-pin map-pin--public')
export const hotspotMarkerIcon = buildIcon(
  'map-pin map-pin--hotspot',
  '<span class="map-pin__diamond"></span>',
)

export function toLeafletPosition(point: LocationPoint): [number, number] {
  return [point.latitude, point.longitude]
}
