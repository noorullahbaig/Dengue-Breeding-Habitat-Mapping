import { Circle, MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { REVIEW_MAP_ZOOM } from '@/lib/constants'
import { formatCoordinate } from '@/lib/formatters'
import { publicMarkerIcon, toLeafletPosition } from '@/lib/map'
import type { LocationPoint } from '@/types/report'

interface PublicReportDetailMapProps {
  location: LocationPoint
}

export function PublicReportDetailMap({ location }: PublicReportDetailMapProps) {
  return (
    <div className="map-frame public-detail-map">
      <MapContainer
        center={toLeafletPosition(location)}
        zoom={REVIEW_MAP_ZOOM}
        scrollWheelZoom={false}
        className="map-frame__canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={toLeafletPosition(location)}
          radius={18}
          pathOptions={{ color: '#163528', fillColor: '#163528', fillOpacity: 0.12 }}
        />
        <Marker position={toLeafletPosition(location)} icon={publicMarkerIcon}>
          <Popup>
            Exact public report pin: {formatCoordinate(location.latitude)},{' '}
            {formatCoordinate(location.longitude)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
