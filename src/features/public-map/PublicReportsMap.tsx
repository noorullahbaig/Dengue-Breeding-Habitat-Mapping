import { Fragment, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Circle,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
} from 'react-leaflet'
import {
  DEFAULT_MAP_ZOOM,
  HOTSPOT_WARNING_RADIUS_METERS,
  KL_CENTER,
} from '@/lib/constants'
import {
  formatCalendarDate,
  formatHabitatLabel,
  formatTimestamp,
} from '@/lib/formatters'
import {
  hotspotMarkerIcon,
  publicMarkerIcon,
  toLeafletPosition,
} from '@/lib/map'
import type { PublicHotspot, PublicMapReport } from '@/types/report'
import { StatusBadge } from '@/features/shared/StatusBadge'

interface PublicReportsMapProps {
  reports: PublicMapReport[]
  hotspots: PublicHotspot[]
  showHotspots: boolean
  hotspotError?: string
}

type TileStatus = 'loading' | 'ready' | 'fallback'

const hotspotCircleStyle = {
  color: '#af6831',
  fillColor: '#af6831',
  fillOpacity: 0.2,
  weight: 1.8,
}

const hotspotWarningCircleStyle = {
  color: '#d08a47',
  fillColor: '#d08a47',
  fillOpacity: 0.08,
  weight: 1.2,
  dashArray: '6 6',
}

function formatHotspotMetric(value: number | null) {
  return value === null ? 'Not published' : String(value)
}

export function PublicReportsMap({
  reports,
  hotspots,
  showHotspots,
  hotspotError,
}: PublicReportsMapProps) {
  const [tileStatus, setTileStatus] = useState<TileStatus>('loading')
  const hadTileErrorRef = useRef(false)
  const fallbackReport = reports[0]
  const fallbackHotspot = hotspots[0]
  const mapCenter = fallbackReport
    ? toLeafletPosition(fallbackReport.publicLocation)
    : fallbackHotspot
      ? toLeafletPosition(fallbackHotspot.center)
      : ([KL_CENTER.latitude, KL_CENTER.longitude] as [number, number])

  return (
    <div className={`map-frame map-frame--public map-frame--${tileStatus}`}>
      {tileStatus === 'loading' ? (
        <div className="map-frame__banner">
          <strong>Loading basemap</strong>
          <p>Public report markers and thumbnails will appear once the map tiles finish loading.</p>
        </div>
      ) : null}

      {tileStatus === 'fallback' ? (
        <div className="map-frame__banner map-frame__banner--warning">
          <strong>Basemap unavailable right now</strong>
          <p>
            If the tiles stay gray, reload the page or check the connection. Public evidence still
            loads from the report detail view.
          </p>
        </div>
      ) : null}

      {showHotspots && hotspotError ? (
        <div className="map-frame__banner map-frame__banner--warning map-frame__banner--offset">
          <strong>Hotspot context unavailable</strong>
          <p>{hotspotError}</p>
        </div>
      ) : null}

      <MapContainer
        center={mapCenter}
        zoom={DEFAULT_MAP_ZOOM}
        scrollWheelZoom
        className="map-frame__canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            loading: () =>
              setTileStatus((currentStatus) =>
                currentStatus === 'fallback' ? currentStatus : 'loading',
              ),
            load: () => setTileStatus(hadTileErrorRef.current ? 'fallback' : 'ready'),
            tileerror: () => {
              hadTileErrorRef.current = true
              setTileStatus('fallback')
            },
          }}
        />

        {showHotspots
          ? hotspots.map((hotspot) => (
              <Fragment key={`${hotspot.id}-zones`}>
                <Circle
                  center={toLeafletPosition(hotspot.center)}
                  radius={HOTSPOT_WARNING_RADIUS_METERS}
                  pathOptions={hotspotWarningCircleStyle}
                />
                <Circle
                  center={toLeafletPosition(hotspot.center)}
                  radius={hotspot.radiusMeters}
                  pathOptions={hotspotCircleStyle}
                />
              </Fragment>
            ))
          : null}

        {showHotspots
          ? hotspots.map((hotspot) => (
              <Marker
                key={hotspot.id}
                position={toLeafletPosition(hotspot.center)}
                icon={hotspotMarkerIcon}
              >
                <Popup>
                  <div className="popup-stack">
                    <strong>{hotspot.locality}</strong>
                    <span>{hotspot.district}</span>
                    <span>200 m hotspot core with 400 m warning buffer proxy</span>
                    <span>Cumulative cases: {formatHotspotMetric(hotspot.cumulativeCases)}</span>
                    <span>
                      Outbreak duration: {formatHotspotMetric(hotspot.outbreakDurationDays)} days
                    </span>
                    <span>Core zone: 0-200 m</span>
                    <span>Warning buffer: 200-400 m</span>
                    <span>Outbreak start: {formatCalendarDate(hotspot.outbreakStartDate)}</span>
                    <span>Snapshot date: {formatCalendarDate(hotspot.snapshotDate)}</span>
                    <p>{hotspot.sourceLabel}</p>
                  </div>
                </Popup>
              </Marker>
            ))
          : null}

        {reports.map((report) => (
          <Marker
            key={report.id}
            position={toLeafletPosition(report.publicLocation)}
            icon={publicMarkerIcon}
          >
            <Popup>
              <div className="popup-stack">
                <strong>{report.neighborhood}</strong>
                <img
                  src={report.thumbnailUrl}
                  alt={`Public evidence thumbnail for ${report.reference}`}
                  className="public-popup-image"
                />
                <StatusBadge status={report.status} />
                <span>{formatHabitatLabel(report.habitatClass)}</span>
                <span>
                  {report.reportCount === 1 ? '1 report' : `${report.reportCount} reports`}
                </span>
                <span>Latest {formatTimestamp(report.latestReportedAt)}</span>
                <p>{report.privacyNote}</p>
                <Link to={`/map/reports/${report.reference}`} className="button button--secondary">
                  Open report
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
