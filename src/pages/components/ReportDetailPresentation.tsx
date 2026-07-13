import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { ButtonLink, EmptyState, LoadingState, Surface } from '@/components/ui'
import { InlineNotice } from '@/components/InlineNotice'
import { StatusBadge } from '@/features/shared/StatusBadge'
import { formatConfidenceLabel, formatHabitatLabel, formatTimestamp } from '@/lib/formatters'
import { PredictionEvidencePanel } from '@/pages/components/PredictionEvidencePanel'
import { StaticReceiptMap } from '@/pages/components/StaticReceiptMap'
import type {
  ConfidenceBand,
  HabitatClass,
  LocationPoint,
  PredictionSummary,
  SubmissionStatus,
} from '@/types/report'

export interface ReportDetailViewModel {
  mode: 'owner' | 'public'
  backTo: string
  backLabel: string
  reference: string
  status: SubmissionStatus
  neighborhood: string
  eyebrow: ReactNode
  stats?: Array<{ label: string; value: ReactNode }>
  evidence: {
    prediction: PredictionSummary
    imageUrl?: string
    imageUnavailable?: boolean
    imageAlt: string
    description: string
  }
  location: {
    point: LocationPoint
    description: string
  }
  metadata: Array<{ label: string; value: ReactNode }>
}

export interface ReportDetailObservation {
  id: string
  reference: string
  reportedAt: string
  thumbnailUrl: string
  habitatClass: HabitatClass
  confidenceBand: ConfidenceBand
}

interface ReportObservationHistoryProps {
  observations: ReportDetailObservation[]
  selectedReference: string
  onSelect?: (reference: string) => void
  description: string
}

export function ReportObservationHistory({
  observations,
  selectedReference,
  onSelect,
  description,
}: ReportObservationHistoryProps) {
  return (
    <Surface as="section" className="public-detail-card-section">
      <div className="public-detail-card-section__header">
        <h2>Observation history</h2>
        <p className="caption-text">{description}</p>
      </div>
      <div className="timeline-gallery-wrap">
        {observations.map((observation) => {
          const isSelected = observation.reference === selectedReference
          return (
            <button
              type="button"
              key={observation.reference}
              className={`timeline-node${isSelected ? ' timeline-node--active' : ''}`}
              onClick={() => onSelect?.(observation.reference)}
              aria-current={isSelected ? 'true' : undefined}
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
  )
}

interface ReportDetailPresentationProps {
  model: ReportDetailViewModel
  primaryAfterEvidence?: ReactNode
  locationAfterMap?: ReactNode
  metadataAfter?: ReactNode
}

export function ReportDetailNavigation({ to, label }: { to: string; label: string }) {
  return (
    <div className="detail-navigation-bar">
      <ButtonLink to={to} variant="ghost" size="compact">
        <ArrowLeft size={18} />
        {label}
      </ButtonLink>
    </div>
  )
}

export function ReportDetailPresentation({
  model,
  primaryAfterEvidence,
  locationAfterMap,
  metadataAfter,
}: ReportDetailPresentationProps) {
  return (
    <div className="page-layout page--detail-revamp" data-detail-mode={model.mode}>
      <div className="page-body stack-md">
        <ReportDetailNavigation to={model.backTo} label={model.backLabel} />
        <div className="stack-md report-detail-enter">
          <Surface as="header" className="detail-hero-header">
            <div className="detail-hero-header__main">
              <div className="detail-hero-header__meta">
                <span className="detail-hero-header__ref">{model.reference}</span>
                <StatusBadge status={model.status} />
              </div>
              <h1 className="detail-hero-header__locality">{model.neighborhood}</h1>
              <p className="detail-hero-header__eyebrow">{model.eyebrow}</p>
            </div>
            {model.stats?.length ? (
              <div className="detail-hero-header__stats">
                {model.stats.map((stat) => (
                  <div className="detail-hero-header__stat-item" key={stat.label}>
                    <span className="detail-hero-header__stat-label">{stat.label}</span>
                    <span className="detail-hero-header__stat-value">{stat.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </Surface>

          <div className="public-detail-layout">
            <div className="public-detail-column public-detail-column--primary stack-md">
              <Surface as="section" className="public-detail-card-section">
                <div className="public-detail-card-section__header">
                  <h2>Evidence review</h2>
                  <p className="caption-text">{model.evidence.description}</p>
                </div>
                <PredictionEvidencePanel
                  prediction={model.evidence.prediction}
                  imageUrl={model.evidence.imageUrl}
                  imageUnavailable={model.evidence.imageUnavailable}
                  imageAlt={model.evidence.imageAlt}
                  showDetections
                  compact
                />
              </Surface>
              {primaryAfterEvidence}
            </div>

            <div className="public-detail-column public-detail-column--secondary stack-md">
              <Surface as="section" className="public-detail-card-section">
                <div className="public-detail-card-section__header">
                  <h2>Location context</h2>
                  <p className="caption-text">{model.location.description}</p>
                </div>
                <div className="compact-map-wrapper">
                  <StaticReceiptMap location={model.location.point} />
                </div>
                {locationAfterMap}
              </Surface>

              <Surface as="section" className="public-detail-card-section">
                <div className="public-detail-card-section__header">
                  <h2>Report metadata</h2>
                </div>
                <div className="detail-metadata-grid">
                  {model.metadata.map((item) => (
                    <div className="detail-metadata-item" key={item.label}>
                      <span className="detail-metadata-label">{item.label}</span>
                      <strong className="detail-metadata-value">{item.value}</strong>
                    </div>
                  ))}
                </div>
                {metadataAfter}
              </Surface>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface ReportDetailStateProps {
  backTo: string
  backLabel: string
  isLoading?: boolean
  loadingLabel?: string
  title?: string
  message?: ReactNode
  action?: ReactNode
  tone?: 'empty' | 'warning'
}

export function ReportDetailState({
  backTo,
  backLabel,
  isLoading,
  loadingLabel = 'Loading report details...',
  title = 'Report Not Found',
  message,
  action,
  tone = 'empty',
}: ReportDetailStateProps) {
  return (
    <div className="page-layout page--detail-revamp">
      <div className="page-body stack-md">
        <ReportDetailNavigation to={backTo} label={backLabel} />
        {isLoading ? <LoadingState label={loadingLabel} /> : null}
        {!isLoading && tone === 'warning' ? (
          <InlineNotice tone="warning">
            <strong>{title}</strong> {message}
            {action}
          </InlineNotice>
        ) : null}
        {!isLoading && tone === 'empty' ? (
          <Surface>
            <EmptyState title={title} actions={action}>{message}</EmptyState>
          </Surface>
        ) : null}
      </div>
    </div>
  )
}
