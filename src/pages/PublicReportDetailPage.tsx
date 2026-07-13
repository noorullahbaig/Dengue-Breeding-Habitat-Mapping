import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useServices } from '@/app/useServices'
import { Surface } from '@/components/ui'
import {
  formatCalendarDate,
  formatConfidenceLabel,
  formatHabitatLabel,
  formatTimestamp,
} from '@/lib/formatters'
import { toPublicReportErrorMessage } from '@/lib/userFacingErrors'
import {
  ReportDetailPresentation,
  ReportDetailState,
  type ReportDetailViewModel,
} from '@/pages/components/ReportDetailPresentation'
import type {
  HotspotPriority,
  PublicReportDetail,
  PublicReportObservation,
} from '@/types/report'

export function getPublicHotspotContext(priority?: HotspotPriority) {
  if (priority?.priorityLevel === 'core' || priority?.priorityLevel === 'warning') {
    return { state: 'prioritized' as const, badge: 'Prioritized report' }
  }
  return { state: 'normal' as const, badge: 'Normal report' }
}

function fallbackObservation(report: PublicReportDetail): PublicReportObservation {
  return {
    id: report.id,
    reference: report.reference,
    capturedAt: report.reportedAt,
    reportedAt: report.reportedAt,
    imageUrl: report.imageUrl,
    thumbnailUrl: report.thumbnailUrl,
    habitatClass: report.habitatClass,
    confidenceBand: report.prediction.confidenceBand,
    prediction: report.prediction,
  }
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function PublicReportDetailPage() {
  const { reference = '' } = useParams()
  const { reportsService } = useServices()
  const [report, setReport] = useState<PublicReportDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedObsRef, setSelectedObsRef] = useState('')

  useEffect(() => {
    let active = true

    async function loadReport() {
      setIsLoading(true)
      setError('')
      try {
        const nextReport = await reportsService.getPublicReport(reference)
        if (!active) return
        setReport(nextReport)
        setSelectedObsRef(nextReport?.observations[0]?.reference ?? nextReport?.reference ?? '')
      } catch (loadError) {
        if (!active) return
        setReport(null)
        setError(toPublicReportErrorMessage(loadError))
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadReport()
    return () => {
      active = false
    }
  }, [reference, reportsService])

  if (isLoading) {
    return (
      <ReportDetailState
        backTo="/map"
        backLabel="Back to map"
        isLoading
        loadingLabel="Loading public report details..."
      />
    )
  }

  if (error) {
    return (
      <ReportDetailState
        backTo="/map"
        backLabel="Back to map"
        title="Report unavailable."
        message={error}
        tone="warning"
      />
    )
  }

  if (!report) {
    return (
      <ReportDetailState
        backTo="/map"
        backLabel="Back to map"
        message={<p>No public report found matching this reference code.</p>}
      />
    )
  }

  const observations = report.observations.length ? report.observations : [fallbackObservation(report)]
  const activeObservation = observations.find((item) => item.reference === selectedObsRef) ?? observations[0]
  const hotspotContext = getPublicHotspotContext(report.hotspotPriority)
  const model: ReportDetailViewModel = {
    mode: 'public',
    backTo: '/map',
    backLabel: 'Back to map',
    reference: report.reference,
    status: report.status,
    neighborhood: report.neighborhood,
    eyebrow: (
      <>
        Selected habitat: <strong>{formatHabitatLabel(activeObservation.habitatClass)}</strong>
      </>
    ),
    stats: [
      { label: 'Stacked Reports', value: report.reportCount },
      { label: 'Last Updated', value: formatCalendarDate(report.latestReportedAt) },
    ],
    evidence: {
      prediction: activeObservation.prediction,
      imageUrl: activeObservation.originalImageUrl ?? activeObservation.imageUrl,
      imageAlt: `AI bounding boxes for ${activeObservation.reference}`,
      description: 'Submitted photo with model classification boundaries',
    },
    location: {
      point: report.publicLocation,
      description: 'Privacy-consented citizen location coordinate pin',
    },
    metadata: [
      { label: 'First Reported', value: formatTimestamp(report.reportedAt) },
      { label: 'Last Updated', value: formatTimestamp(report.latestReportedAt) },
      { label: 'Primary Habitat', value: formatHabitatLabel(report.habitatClass) },
      { label: 'Total Submissions', value: countLabel(report.reportCount, 'report') },
    ],
  }

  return (
    <ReportDetailPresentation
      model={model}
      primaryAfterEvidence={(
        <Surface as="section" className="public-detail-card-section">
          <div className="public-detail-card-section__header">
            <h2>Observation history</h2>
            <p className="caption-text">
              {`This location has ${countLabel(report.reportCount, 'stacked citizen submission')}`}
            </p>
          </div>
          <div className="timeline-gallery-wrap">
            {observations.map((observation) => {
              const isSelected = activeObservation.reference === observation.reference
              return (
                <button
                  type="button"
                  key={observation.reference}
                  className={`timeline-node${isSelected ? ' timeline-node--active' : ''}`}
                  onClick={() => setSelectedObsRef(observation.reference)}
                >
                  <div className="timeline-card">
                    <img src={observation.thumbnailUrl} alt="" className="timeline-card__img" />
                    <div className="timeline-card__info">
                      <div className="timeline-card__info-header">
                        <strong className="timeline-card__ref">{observation.reference}</strong>
                        <span className="timeline-card__date">{formatTimestamp(observation.reportedAt)}</span>
                      </div>
                      <div className="timeline-card__details">
                        <span className="timeline-card__detail-pill">
                          Class: <strong>{formatHabitatLabel(observation.habitatClass)}</strong>
                        </span>
                        <span className="timeline-card__detail-pill">
                          Confidence: <strong>{formatConfidenceLabel(observation.confidenceBand)}</strong>
                        </span>
                      </div>
                    </div>
                    <span className={isSelected ? 'timeline-card__badge' : 'timeline-card__action'}>
                      {isSelected ? 'Selected' : 'Review'}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </Surface>
      )}
      locationAfterMap={(
        <div className={`detail-outbreak-alert detail-outbreak-alert--${hotspotContext.state}`}>
          <div className="detail-outbreak-alert__badge">{hotspotContext.badge}</div>
        </div>
      )}
      metadataAfter={report.privacyNote ? (
        <div className="detail-privacy-note">
          <span className="detail-metadata-label">Citizen Privacy Consent</span>
          <p>{report.privacyNote}</p>
        </div>
      ) : null}
    />
  )
}
