import { useEffect, useState } from 'react'
import { InlineNotice } from '@/components/InlineNotice'
import { SectionHeading } from '@/components/SectionHeading'
import { useServices } from '@/app/useServices'
import { PredictionEvidencePanelV2 } from '@/pages/ux-v2/components/PredictionEvidencePanelV2'
import { StatusBadge } from '@/features/shared/StatusBadge'
import {
  formatCoordinate,
  formatHabitatLabel,
  formatStatusLabel,
  formatTimestamp,
  formatConfidenceScore,
} from '@/lib/formatters'
import { MapContainer, Marker, Circle, TileLayer, useMap, Popup } from 'react-leaflet'
import { toLeafletPosition, residentMarkerIcon } from '@/lib/map'
import { REVIEW_MAP_ZOOM, HOTSPOT_WARNING_RADIUS_METERS } from '@/lib/constants'
import type { HotspotMirrorStatus, OfficerReport, SubmissionStatus, LocationPoint } from '@/types/report'

const statusOptions: SubmissionStatus[] = [
  'submitted',
  'under_review',
  'prioritized',
  'action_recorded',
  'closed',
]

function priorityLabel(level: string) {
  const labels: Record<string, string> = {
    core: 'Core Hotspot Zone (0-200m)',
    warning: 'Warning Buffer Zone (200-400m)',
    routine: 'Routine Context (>400m)',
    unavailable: 'Hotspot Context Unavailable',
    unassessed: 'Not Assessed',
  }
  return labels[level] ?? level
}

type SortOption = 'priority' | 'newest' | 'neighborhood'
type StatusFilter = SubmissionStatus | 'all'
type HabitatFilter = string | 'all'

function RecenterMap({ location }: { location: LocationPoint }) {
  const map = useMap()
  useEffect(() => {
    map.setView(toLeafletPosition(location), REVIEW_MAP_ZOOM)
  }, [location, map])
  return null
}

export function OfficerDashboardPageV2() {
  const { officerService } = useServices()
  const [reports, setReports] = useState<OfficerReport[]>([])
  const [selectedReference, setSelectedReference] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<SubmissionStatus>('under_review')
  const [officerNotes, setOfficerNotes] = useState('')
  const [followUpAction, setFollowUpAction] = useState('')
  const [hotspotStatus, setHotspotStatus] = useState<HotspotMirrorStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncingHotspots, setIsSyncingHotspots] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Queue Sort & Filter State
  const [sortBy, setSortBy] = useState<SortOption>('priority')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [habitatFilter, setHabitatFilter] = useState<HabitatFilter>('all')

  // Stacking Side-by-side view toggle
  const [showStackCompare, setShowStackCompare] = useState(false)

  const selectedReport =
    reports.find((report) => report.reference === selectedReference) ?? reports[0] ?? null

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError('')

    Promise.all([
      officerService.listReports(),
      officerService.getHotspotStatus(),
    ])
      .then(([nextReports, nextHotspotStatus]) => {
        if (!isMounted) return

        setHotspotStatus(nextHotspotStatus)
        setReports(nextReports)
        const firstReport = nextReports[0]
        if (firstReport) {
          setSelectedReference(firstReport.reference)
          setSelectedStatus(firstReport.status)
          setOfficerNotes(firstReport.officerNotes ?? '')
          setFollowUpAction(firstReport.followUpAction ?? '')
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Officer reports are unavailable. Check that the local backend is running.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [officerService])

  function handleSelectReport(report: OfficerReport) {
    setSelectedReference(report.reference)
    setSelectedStatus(report.status)
    setOfficerNotes(report.officerNotes ?? '')
    setFollowUpAction(report.followUpAction ?? '')
    setMessage('')
    setError('')
    setShowStackCompare(false)
  }

  async function handleSaveReview() {
    if (!selectedReport) return

    setIsSaving(true)
    setMessage('')
    setError('')

    try {
      const updatedReport = await officerService.updateReport(selectedReport.reference, {
        status: selectedStatus,
        officerNotes,
        followUpAction,
        reviewedBy: 'Local officer demo v2',
      })

      setReports((currentReports) =>
        currentReports.map((report) =>
          report.reference === updatedReport.reference ? updatedReport : report,
        ),
      )
      setMessage(`Saved review update for ${updatedReport.reference}.`)
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The officer review update could not be saved.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSyncHotspots() {
    setIsSyncingHotspots(true)
    setMessage('')
    setError('')

    try {
      const syncResult = await officerService.syncHotspots()
      setHotspotStatus({
        hotspotCount: syncResult.syncedCount,
        latestSnapshotDate: syncResult.snapshotDate,
        lastSyncedAt: syncResult.syncedAt,
        sourceLabel: syncResult.sourceLabel,
      })
      setMessage(`Synced ${syncResult.syncedCount} current hotspot row(s) from iDengue.`)
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : 'The hotspot mirror could not be synced.',
      )
    } finally {
      setIsSyncingHotspots(false)
    }
  }

  // Filter and Sort Queue list
  const filteredReports = reports
    .filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (habitatFilter !== 'all' && r.prediction.label !== habitatFilter) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder: Record<string, number> = { core: 1, warning: 2, routine: 3, unassessed: 4 }
        const aOrder = priorityOrder[a.hotspotPriority.priorityLevel] ?? 99
        const bOrder = priorityOrder[b.hotspotPriority.priorityLevel] ?? 99
        if (aOrder !== bOrder) return aOrder - bOrder
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (sortBy === 'neighborhood') {
        return a.neighborhood.localeCompare(b.neighborhood)
      }
      return 0
    })

  // Priority Triage Colors
  const priorityColor: Record<string, string> = {
    core: '#fee2e2', // light red
    warning: '#fef3c7', // light amber
    routine: '#f3f4f6', // gray
  }
  const priorityBorder: Record<string, string> = {
    core: '1px solid #ef4444',
    warning: '1px solid #f59e0b',
    routine: '1px solid var(--color-border)',
  }

  return (
    <div className="page page--officer stack-md">
      <SectionHeading
        variant="compact"
        eyebrow="Verification Dashboard"
        title="Officer Triage & Review Console"
        description="Verify crowdsourced evidence bundles, inspect PostGIS spatial overlap triages, run model precheck sanity checks, and schedule vector control updates."
      />

      {isLoading ? (
        <div className="panel panel--muted" style={{ textAlign: 'center', padding: '2.5rem' }}>
          Loading officer triage queue...
        </div>
      ) : null}
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}
      {message ? <InlineNotice tone="success">{message}</InlineNotice> : null}

      {/* PostGIS sync console panel */}
      <section className="app-card officer-hotspot-sync">
        <div>
          <span className="detail-grid__label" style={{ color: 'var(--color-accent)', fontWeight: 700 }}>PostGIS iDengue Hotspots Mirror</span>
          <h2 style={{ fontSize: '1.45rem', marginTop: '0.2rem' }}>{hotspotStatus?.hotspotCount ?? 0} current hotspot row(s) mirrored</h2>
          <p className="caption-text">
            {hotspotStatus?.latestSnapshotDate
              ? `Latest Ministry of Health (MOH) snapshot: ${formatTimestamp(hotspotStatus.latestSnapshotDate)}.`
              : 'No outbreak snapshot dataset mirrored yet.'}
          </p>
          <p className="caption-text">
            {hotspotStatus?.lastSyncedAt
              ? `Last synced: ${formatTimestamp(hotspotStatus.lastSyncedAt)}.`
              : 'Sync mirrors iDengue active clusters for spatial priority indexing.'}
          </p>
        </div>
        <button
          type="button"
          className="button button--secondary"
          style={{ padding: '0.6rem 1.2rem' }}
          onClick={handleSyncHotspots}
          disabled={isSyncingHotspots}
        >
          {isSyncingHotspots ? 'Mirroring registry...' : 'Sync iDengue Hotspots Registry'}
        </button>
      </section>

      {!isLoading && reports.length === 0 ? (
        <div className="panel panel--muted" style={{ textAlign: 'center', padding: '2.5rem' }}>
          Triage queue is empty. Submit a citizen report first, then return here to review.
        </div>
      ) : null}

      {selectedReport ? (
        <div className="officer-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.35fr) minmax(0, 0.65fr)', gap: '1.5rem', alignItems: 'start' }}>
          
          {/* QUEUE SIDEBAR WITH FILTERS */}
          <section className="app-card officer-queue stack-md">
            <div className="cluster-row cluster-row--between" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Triage Queue</h2>
              <span className="caption-text" style={{ fontWeight: 600 }}>{filteredReports.length} listed</span>
            </div>

            {/* Filter and Sort Tools */}
            <div style={{ display: 'grid', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="field__label" style={{ fontSize: '0.75rem' }}>Sort Queue</span>
                <select
                  className="field__input"
                  style={{ padding: '0.25rem', fontSize: '0.85rem' }}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                >
                  <option value="priority">Hotspot Priority</option>
                  <option value="newest">Newest Submitted</option>
                  <option value="neighborhood">Neighborhood (A-Z)</option>
                </select>
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span className="field__label" style={{ fontSize: '0.75rem' }}>Status Filter</span>
                <select
                  className="field__input"
                  style={{ padding: '0.25rem', fontSize: '0.85rem' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                >
                  <option value="all">All Statuses</option>
                  {statusOptions.map((o) => (
                    <option key={o} value={o}>{formatStatusLabel(o)}</option>
                  ))}
                </select>
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span className="field__label" style={{ fontSize: '0.75rem' }}>Habitat Filter</span>
                <select
                  className="field__input"
                  style={{ padding: '0.25rem', fontSize: '0.85rem' }}
                  value={habitatFilter}
                  onChange={(e) => setHabitatFilter(e.target.value as HabitatFilter)}
                >
                  <option value="all">All Classes</option>
                  <option value="tire">Tire</option>
                  <option value="drain_inlet">Drain Inlet</option>
                  <option value="artificial_container">Artificial Container</option>
                  <option value="unclassified">Unclassified</option>
                </select>
              </label>
            </div>

            {/* Queue List */}
            <div className="officer-queue__list" style={{ maxHeight: '600px', overflowY: 'auto', gap: '0.5rem' }}>
              {filteredReports.map((report) => {
                const isActive = report.reference === selectedReport.reference
                const isCore = report.hotspotPriority.priorityLevel === 'core'
                const isWarning = report.hotspotPriority.priorityLevel === 'warning'
                let badgeStyle = {}
                if (isCore) badgeStyle = { borderLeft: '4px solid #ef4444' }
                else if (isWarning) badgeStyle = { borderLeft: '4px solid #f59e0b' }

                return (
                  <button
                    key={report.id}
                    type="button"
                    className={`officer-queue__item${isActive ? ' officer-queue__item--active' : ''}`}
                    style={{ ...badgeStyle, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'stretch' }}
                    onClick={() => handleSelectReport(report)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>{report.reference}</strong>
                      <StatusBadge status={report.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-ink-soft)' }}>
                      <span>{report.neighborhood}</span>
                      <span style={{ fontWeight: 600 }}>{formatHabitatLabel(report.prediction.label)}</span>
                    </div>
                    {isCore || isWarning ? (
                      <span style={{ fontSize: '0.72rem', color: isCore ? '#dc2626' : '#d97706', fontWeight: 700 }}>
                        ⚠ Hotspot Outbreak Zone
                      </span>
                    ) : null}
                  </button>
                )
              })}
              {filteredReports.length === 0 ? (
                <p className="caption-text" style={{ textAlign: 'center', padding: '1rem' }}>No reports match active filters.</p>
              ) : null}
            </div>
          </section>

          {/* REPORT DETAILS PANEL */}
          <section className="app-card officer-detail stack-md">
            <div className="officer-detail__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div>
                <span className="detail-grid__label">Triage verification</span>
                <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Report {selectedReport.reference}</h2>
              </div>
              <StatusBadge status={selectedReport.status} />
            </div>

            {/* Redesigned colorful Triage Signal Cards */}
            <section className="officer-triage" aria-label="Triage metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {/* Card 1: AI Result */}
              <div className="app-card" style={{ padding: '0.75rem' }}>
                <span className="detail-grid__label">AI Class Label</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-accent)' }}>{formatHabitatLabel(selectedReport.prediction.label)}</strong>
                <span className="caption-text" style={{ display: 'block', marginTop: '0.2rem' }}>
                  {formatConfidenceScore(selectedReport.prediction.confidence)} ({selectedReport.prediction.confidenceBand})
                </span>
              </div>
              
              {/* Card 2: Hotspot Proximity */}
              <div style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: priorityColor[selectedReport.hotspotPriority.priorityLevel] || '#f9fafb',
                border: priorityBorder[selectedReport.hotspotPriority.priorityLevel] || '1px solid var(--color-border)'
              }}>
                <span className="detail-grid__label">Hotspot priority</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-ink)' }}>
                  {selectedReport.hotspotPriority.priorityLevel === 'core' ? 'Core hotspot' : selectedReport.hotspotPriority.priorityLevel === 'warning' ? 'Warning buffer' : 'Routine'}
                </strong>
                <span className="caption-text" style={{ display: 'block', marginTop: '0.2rem', lineHeight: '1.2' }}>
                  {selectedReport.hotspotPriority.priorityReason}
                </span>
              </div>

              {/* Card 3: Consent status */}
              <div style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                background: selectedReport.publicConsent.accepted ? '#dcfce7' : '#fee2e2',
                border: selectedReport.publicConsent.accepted ? '1px solid #22c55e' : '1px solid #ef4444'
              }}>
                <span className="detail-grid__label">Consent Stored</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-ink)' }}>
                  {selectedReport.publicConsent.accepted ? 'Accepted ✓' : 'Missing ⚠'}
                </strong>
                <span className="caption-text" style={{ display: 'block', marginTop: '0.2rem', fontSize: '0.78rem', lineHeight: '1.1' }}>
                  Image & confirmed pin map visibility.
                </span>
              </div>
            </section>

            {/* Geographical map overlay for officer */}
            <div className="panel" style={{ padding: '0.75rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <span className="detail-grid__label">Report coordinates map</span>
              <div style={{ height: '220px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginTop: '0.25rem' }}>
                <MapContainer
                  center={toLeafletPosition(selectedReport.reportLocation)}
                  zoom={REVIEW_MAP_ZOOM}
                  scrollWheelZoom={false}
                  className="map-frame__canvas"
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <RecenterMap location={selectedReport.reportLocation} />
                  
                  {/* Highlight nearby Hotspot circles if core or warning */}
                  {selectedReport.hotspotPriority.nearestHotspotDistanceMeters ? (
                    <>
                      {/* Outbreak warning circle center */}
                      <Circle
                        center={[
                          selectedReport.reportLocation.latitude + (selectedReport.hotspotPriority.nearestHotspotDistanceMeters / 111000) * 0.7, // simulated offset back to center
                          selectedReport.reportLocation.longitude
                        ]}
                        radius={HOTSPOT_WARNING_RADIUS_METERS}
                        pathOptions={{ color: '#d08a47', fillColor: '#d08a47', fillOpacity: 0.05, weight: 1 }}
                      />
                    </>
                  ) : null}

                  {/* Marker for report location */}
                  <Marker position={toLeafletPosition(selectedReport.reportLocation)} icon={residentMarkerIcon}>
                    <Popup>Confirmed report location</Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>

            {/* Stacked comparison view trigger */}
            {selectedReport.stackParent ? (
              <div className="panel panel--muted stack-md" style={{ padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Stacked Observation Context</strong>
                    <p className="caption-text" style={{ margin: 0 }}>This report is stacked on existing parent report: {selectedReport.stackedOnReference}</p>
                  </div>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={() => setShowStackCompare(!showStackCompare)}
                    style={{ padding: '0.35rem 0.7rem', fontSize: '0.85rem' }}
                  >
                    {showStackCompare ? 'Hide Comparison' : 'Compare Photos Side-by-Side'}
                  </button>
                </div>

                {showStackCompare ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                    <div>
                      <span className="detail-grid__label">Stacked Parent Image ({selectedReport.stackedOnReference})</span>
                      <img
                        src={selectedReport.stackParent.imageUrl}
                        alt={`Parent report ${selectedReport.stackedOnReference}`}
                        style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                      />
                    </div>
                    <div>
                      <span className="detail-grid__label">Current Submission Image ({selectedReport.reference})</span>
                      <img
                        src={selectedReport.imageUrl}
                        alt={`Current submission ${selectedReport.reference}`}
                        style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* EVIDENCES & METADATA GRID */}
            <div className="officer-detail__grid" style={{ gap: '1.5rem' }}>
              <div className="officer-evidence-column">
                <PredictionEvidencePanelV2
                  prediction={selectedReport.prediction}
                  title="Officer model evidence"
                  imageUrl={selectedReport.imageUrl}
                  imageAlt={`Evidence photo for ${selectedReport.reference}`}
                  showDetections
                />
              </div>

              <div className="stack-md">
                <div className="app-card detail-grid" style={{ padding: '0.75rem' }}>
                  <div>
                    <span className="detail-grid__label">Received Timestamp</span>
                    <strong>{formatTimestamp(selectedReport.createdAt)}</strong>
                  </div>
                  <div>
                    <span className="detail-grid__label">Reported Class</span>
                    <strong>{formatHabitatLabel(selectedReport.prediction.label)}</strong>
                  </div>
                  <div>
                    <span className="detail-grid__label">Exact Latitude</span>
                    <strong>{formatCoordinate(selectedReport.reportLocation.latitude)}</strong>
                  </div>
                  <div>
                    <span className="detail-grid__label">Exact Longitude</span>
                    <strong>{formatCoordinate(selectedReport.reportLocation.longitude)}</strong>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '0.5rem' }}>
                  <InlineNotice tone={selectedReport.hotspotPriority.priorityLevel === 'core' || selectedReport.hotspotPriority.priorityLevel === 'warning' ? 'warning' : 'neutral'}>
                    <strong>Priority Triage:</strong> {priorityLabel(selectedReport.hotspotPriority.priorityLevel)}. {selectedReport.hotspotPriority.priorityReason}
                  </InlineNotice>
                  
                  <InlineNotice>
                    <strong>Model Advisory Note:</strong> {selectedReport.prediction.advisoryText}
                  </InlineNotice>
                </div>

                {selectedReport.notes ? (
                  <div className="panel panel--muted" style={{ padding: '0.75rem 1rem' }}>
                    <span className="detail-grid__label">Citizen description (officer-only)</span>
                    <p style={{ margin: '0.2rem 0 0', fontStyle: 'italic', color: 'var(--color-ink)' }}>"{selectedReport.notes}"</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* REVIEW UPDATE FORM */}
            <div className="officer-review-form" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-heading)' }}>Record review triage</h3>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                <label className="field">
                  <span className="field__label">Review status</span>
                  <select
                    className="field__input"
                    value={selectedStatus}
                    onChange={(event) => setSelectedStatus(event.target.value as SubmissionStatus)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatStatusLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Internal officer notes (kept private)</span>
                  <textarea
                    className="field__input field__input--textarea"
                    value={officerNotes}
                    onChange={(event) => setOfficerNotes(event.target.value)}
                    placeholder="Internal coordinates checking details, vector team updates, etc. Not visible on public map."
                  />
                </label>

                <label className="field">
                  <span className="field__label">Vector follow-up action</span>
                  <textarea
                    className="field__input field__input--textarea"
                    value={followUpAction}
                    onChange={(event) => setFollowUpAction(event.target.value)}
                    placeholder="Example: chemical fogging scheduled, site cleared, duplicate stack confirmed."
                  />
                </label>
              </div>

              <div className="cluster-row cluster-row--end" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="button button--primary"
                  style={{ padding: '0.65rem 1.35rem', fontSize: '0.95rem' }}
                  onClick={handleSaveReview}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving review...' : 'Save review update'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
