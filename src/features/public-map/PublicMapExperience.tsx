import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { InlineNotice } from '@/components/InlineNotice'
import { SectionHeading } from '@/components/SectionHeading'
import { useServices } from '@/app/useServices'
import { PublicReportsMap } from '@/features/public-map/PublicReportsMap'
import {
  formatCalendarDate,
  formatCompactCalendarDate,
  formatHabitatLabel,
  formatStatusLabel,
} from '@/lib/formatters'
import type {
  HabitatClass,
  PublicHotspot,
  PublicMapReport,
  SubmissionStatus,
} from '@/types/report'

type StatusFilter = SubmissionStatus | 'all'
type HabitatFilter = HabitatClass | 'all'
type ExperienceMode = 'home' | 'map'

interface PublicMapExperienceProps {
  mode: ExperienceMode
}

const contentByMode: Record<
  ExperienceMode,
  { eyebrow: string; title: string; description: string }
> = {
  home: {
    eyebrow: 'Map-first awareness',
    title: 'See current dengue habitat context near you, then report a site if needed.',
    description:
      'Hotspots stay live from iDengue while citizen reports show public evidence photos and exact confirmed pins.',
  },
  map: {
    eyebrow: 'Public map',
    title: 'See current dengue habitat context across Kuala Lumpur.',
    description:
      'Use live hotspot context, public report photos, and exact citizen-submitted pins to understand what is happening nearby.',
  },
}

export function PublicMapExperience({ mode }: PublicMapExperienceProps) {
  const { mapService } = useServices()
  const [reports, setReports] = useState<PublicMapReport[]>([])
  const [hotspots, setHotspots] = useState<PublicHotspot[]>([])
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [habitatFilter, setHabitatFilter] = useState<HabitatFilter>('all')
  const [isReportsLoading, setIsReportsLoading] = useState(true)
  const [isHotspotsLoading, setIsHotspotsLoading] = useState(true)
  const [hotspotError, setHotspotError] = useState('')
  const [showHotspots, setShowHotspots] = useState(true)
  const mapSignature = [
    reports.map((report) => report.id).join(':'),
    hotspots.map((hotspot) => hotspot.id).join(':'),
    hotspotError,
  ]
    .filter(Boolean)
    .join('|') || `${statusFilter}:${habitatFilter}:empty`

  const hotspotMeta = hotspots[0] ?? null
  const shouldShowTable = !isHotspotsLoading && !hotspotError && hotspots.length > 0
  const content = contentByMode[mode]

  useEffect(() => {
    let isMounted = true
    const reportsPromise = mapService.listPublicReports(undefined, {
      status: statusFilter,
      habitatClass: habitatFilter,
    })

    reportsPromise
      .then((nextReports) => {
        if (isMounted) {
          setReports(nextReports)
        }
      })
      .catch(() => {
        if (isMounted) {
          setReports([])
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsReportsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [habitatFilter, mapService, statusFilter])

  useEffect(() => {
    let isMounted = true
    const hotspotsPromise = mapService.listHotspots()

    hotspotsPromise
      .then((nextHotspots) => {
        if (isMounted) {
          setHotspots(nextHotspots)
          setHotspotError('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setHotspots([])
          setHotspotError('Hotspot context is temporarily unavailable.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsHotspotsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [mapService])

  function handleStatusFilterChange(nextStatus: StatusFilter) {
    setIsReportsLoading(true)
    setStatusFilter(nextStatus)
  }

  function handleHabitatFilterChange(nextHabitat: HabitatFilter) {
    setIsReportsLoading(true)
    setHabitatFilter(nextHabitat)
  }

  return (
    <div className="page page--map-home">
      <SectionHeading
        variant="compact"
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />

      <div className="map-intro">
        <div className="map-intro__actions">
          <Link to="/report" className="button">
            Report a suspected breeding habitat
          </Link>
          <Link to="/status" className="button button--secondary">
            Track a report
          </Link>
        </div>

        <div className="map-intro__trust">
          <span className="detail-grid__label">Public trust</span>
          <p>Hotspots come from iDengue.</p>
          <p>Report photos and exact pins are public after consent.</p>
          <p>Resident notes stay private for officer review.</p>
        </div>
      </div>

      <div className="map-toolbar">
        <div className="filter-row">
          <label className="field">
            <span className="field__label">Status filter</span>
            <select
              className="field__input"
              value={statusFilter}
              onChange={(event) => handleStatusFilterChange(event.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="submitted">{formatStatusLabel('submitted')}</option>
              <option value="under_review">{formatStatusLabel('under_review')}</option>
              <option value="prioritized">{formatStatusLabel('prioritized')}</option>
              <option value="action_recorded">{formatStatusLabel('action_recorded')}</option>
              <option value="closed">{formatStatusLabel('closed')}</option>
            </select>
          </label>

          <label className="field">
            <span className="field__label">Habitat filter</span>
            <select
              className="field__input"
              value={habitatFilter}
              onChange={(event) =>
                handleHabitatFilterChange(event.target.value as HabitatFilter)
              }
            >
              <option value="all">All classes</option>
              <option value="tire">{formatHabitatLabel('tire')}</option>
              <option value="drain_inlet">{formatHabitatLabel('drain_inlet')}</option>
              <option value="artificial_container">
                {formatHabitatLabel('artificial_container')}
              </option>
              <option value="unclassified">{formatHabitatLabel('unclassified')}</option>
            </select>
          </label>
        </div>

        <div className="map-toolbar__side">
          <label className="toggle-field">
            <input
              className="toggle-field__input"
              type="checkbox"
              checked={showHotspots}
              onChange={(event) => setShowHotspots(event.target.checked)}
            />
            <span className="toggle-field__label">Show hotspot context</span>
          </label>

          <div className="map-toolbar__note">
            <span className="detail-grid__label">Hotspot source</span>
            <div className="map-toolbar__meta">
              <p>
                {isHotspotsLoading
                  ? 'Loading the current iDengue hotspot context.'
                  : 'Hotspot symbols, the 200 m core, and the 400 m warning buffer are visible from the start.'}
              </p>
              <p>
                Circles show a 200 m hotspot core and a 400 m warning buffer proxy from the
                iDengue hotspot point, not an official boundary.
              </p>
              <p>
                Source:{' '}
                <a
                  href="https://idengue.mysa.gov.my/hotspotutama.php"
                  target="_blank"
                  rel="noreferrer"
                >
                  iDengue hotspot search
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {hotspotError ? <InlineNotice tone="warning">{hotspotError}</InlineNotice> : null}

      {isReportsLoading ? (
        <div className="panel panel--muted">Loading public report markers...</div>
      ) : null}

      {!isReportsLoading ? (
        <PublicReportsMap
          key={mapSignature}
          reports={reports}
          hotspots={hotspots}
          showHotspots={showHotspots}
          hotspotError={hotspotError}
        />
      ) : null}

      {shouldShowTable ? (
        <section className="hotspot-table-section">
          <div className="hotspot-table-section__header">
            <div>
              <span className="detail-grid__label">Live hotspot table</span>
              <h2>Wilayah Persekutuan hotspot context</h2>
            </div>
            <div className="hotspot-table-section__meta">
              <span>
                Week {hotspotMeta?.weekNumber} / {hotspotMeta?.year}
              </span>
              <span>Snapshot {formatCalendarDate(hotspotMeta?.snapshotDate ?? '')}</span>
            </div>
          </div>

          <div className="hotspot-table-wrap">
            <table className="hotspot-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Locality</th>
                  <th>District</th>
                  <th>Cumulative outbreak cases</th>
                  <th>Outbreak start date</th>
                  <th>Outbreak duration</th>
                </tr>
              </thead>
              <tbody>
                {hotspots.map((hotspot, index) => (
                  <tr
                    key={`table-${hotspot.id}`}
                    className="hotspot-table__row"
                  >
                    <td>{index + 1}</td>
                    <td>
                      <strong>{hotspot.locality}</strong>
                    </td>
                    <td>{hotspot.district}</td>
                    <td>{hotspot.cumulativeCases ?? 'Not published'}</td>
                    <td>{formatCompactCalendarDate(hotspot.outbreakStartDate)}</td>
                    <td>
                      {hotspot.outbreakDurationDays === null
                        ? 'Not published'
                        : `${hotspot.outbreakDurationDays} days`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {!isHotspotsLoading && !hotspotError && hotspots.length === 0 ? (
        <div className="panel panel--muted">
          No current hotspot rows were returned for Wilayah Persekutuan.
        </div>
      ) : null}
    </div>
  )
}
