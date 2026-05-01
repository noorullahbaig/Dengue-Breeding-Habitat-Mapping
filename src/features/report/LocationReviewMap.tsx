import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { REVIEW_MAP_ZOOM } from '@/lib/constants'
import { residentMarkerIcon, toLeafletPosition } from '@/lib/map'
import {
  isWithinServiceArea,
  serviceAreaBoundaryPolygons,
  SERVICE_AREA_ERROR,
  SERVICE_AREA_LABEL,
} from '@/lib/serviceArea'
import type { LocationPoint } from '@/types/report'

interface LocationReviewMapProps {
  location: LocationPoint
  onLocationChange: (location: LocationPoint) => void
}

function RecenterMap({ location }: { location: LocationPoint }) {
  const map = useMap()

  useEffect(() => {
    map.setView(toLeafletPosition(location), REVIEW_MAP_ZOOM)
  }, [location, map])

  return null
}

export function LocationReviewMap({
  location,
  onLocationChange,
}: LocationReviewMapProps) {
  const [boundaryWarning, setBoundaryWarning] = useState('')

  useEffect(() => {
    if (isWithinServiceArea(location)) {
      setBoundaryWarning('')
    }
  }, [location])

  return (
    <div className="map-frame">
      {boundaryWarning ? (
        <div className="map-frame__banner map-frame__banner--warning">
          <strong>{SERVICE_AREA_ERROR}</strong>
          <p>{boundaryWarning}</p>
        </div>
      ) : null}
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
        <RecenterMap location={location} />
        {serviceAreaBoundaryPolygons.map((polygon) => (
          <Polygon
            key={polygon.id}
            positions={polygon.positions}
            pathOptions={{
              color: '#185676',
              fillColor: '#185676',
              fillOpacity: 0.05,
              weight: 2,
            }}
          >
            <Popup>{SERVICE_AREA_LABEL}</Popup>
          </Polygon>
        ))}
        <Circle
          center={toLeafletPosition(location)}
          radius={Math.max(location.accuracyMeters ?? 22, 22)}
          pathOptions={{ color: '#af6831', fillColor: '#af6831', fillOpacity: 0.12 }}
        />
        <Marker
          position={toLeafletPosition(location)}
          draggable
          icon={residentMarkerIcon}
          eventHandlers={{
            dragend(event) {
              const marker = event.target
              const nextLatLng = marker.getLatLng()
              const nextLocation: LocationPoint = {
                latitude: nextLatLng.lat,
                longitude: nextLatLng.lng,
                accuracyMeters: location.accuracyMeters,
                source: 'manual',
              }

              if (!isWithinServiceArea(nextLocation)) {
                marker.setLatLng(toLeafletPosition(location))
                setBoundaryWarning('The pin was returned to the last valid location.')
                return
              }

              setBoundaryWarning('')
              onLocationChange(nextLocation)
            },
          }}
        >
          <Popup>Drag this pin to the exact point you want officers to review.</Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
