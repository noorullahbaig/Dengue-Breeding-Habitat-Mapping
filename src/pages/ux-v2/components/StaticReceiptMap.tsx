import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { toLeafletPosition, residentMarkerIcon } from '@/lib/map'
import { REVIEW_MAP_ZOOM } from '@/lib/constants'
import type { LocationPoint } from '@/types/report'

interface StaticReceiptMapProps {
  location: LocationPoint
}

export function StaticReceiptMap({ location }: StaticReceiptMapProps) {
  return (
    <div className="map-frame" style={{ minHeight: '180px', height: '180px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', pointerEvents: 'none' }}>
      <MapContainer
        center={toLeafletPosition(location)}
        zoom={REVIEW_MAP_ZOOM}
        dragging={false}
        doubleClickZoom={false}
        scrollWheelZoom={false}
        attributionControl={false}
        zoomControl={false}
        className="map-frame__canvas"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={toLeafletPosition(location)} icon={residentMarkerIcon} interactive={false} />
      </MapContainer>
    </div>
  )
}
