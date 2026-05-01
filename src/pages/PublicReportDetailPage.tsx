import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InlineNotice } from '@/components/InlineNotice'
import { SectionHeading } from '@/components/SectionHeading'
import { useServices } from '@/app/useServices'
import { PublicReportDetailMap } from '@/features/public-map/PublicReportDetailMap'
import { StatusBadge } from '@/features/shared/StatusBadge'
import {
  formatConfidenceLabel,
  formatCoordinate,
  formatHabitatLabel,
  formatTimestamp,
} from '@/lib/formatters'
import type { PublicReportDetail } from '@/types/report'

export function PublicReportDetailPage() {
  const { reference = '' } = useParams()
  const { reportsService } = useServices()
  const [report, setReport] = useState<PublicReportDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadReport() {
      setIsLoading(true)
      setError('')

      try {
        const nextReport = await reportsService.getPublicReport(reference)
        if (isMounted) {
          setReport(nextReport)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'The public report could not be loaded.',
          )
          setReport(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadReport()

    return () => {
      isMounted = false
    }
  }, [reference, reportsService])

  return (
    <div className="page">
      <SectionHeading
        variant="compact"
        eyebrow="Public evidence"
        title={report ? report.reference : 'Public report detail'}
        description="Citizen-submitted images and the exact report pin are public because reporters confirm publication before submitting."
      />

      <div className="cluster-row">
        <Link to="/map" className="button button--ghost">
          Back to public map
        </Link>
        <Link to="/report" className="button">
          Add a report
        </Link>
      </div>

      {isLoading ? <div className="panel panel--muted">Loading public report...</div> : null}
      {error ? <InlineNotice tone="warning">{error}</InlineNotice> : null}

      {!isLoading && !error && !report ? (
        <div className="panel">
          <p>No public report matched that reference.</p>
        </div>
      ) : null}

      {report ? (
        <div className="public-detail-layout">
          <section className="public-detail-main">
            <img
              src={report.imageUrl}
              alt={`Latest public evidence for report ${report.reference}`}
              className="public-detail-main__image"
            />
            <div className="public-detail-main__summary">
              <div>
                <span className="detail-grid__label">Advisory class</span>
                <h2>{formatHabitatLabel(report.habitatClass)}</h2>
              </div>
              <StatusBadge status={report.status} />
            </div>
          </section>

          <aside className="panel public-detail-side">
            <div className="detail-grid">
              <div>
                <span className="detail-grid__label">First reported</span>
                <strong>{formatTimestamp(report.reportedAt)}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Latest update</span>
                <strong>{formatTimestamp(report.latestReportedAt)}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Stacked reports</span>
                <strong>{report.reportCount}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Area</span>
                <strong>{report.neighborhood}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Latitude</span>
                <strong>{formatCoordinate(report.publicLocation.latitude)}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Longitude</span>
                <strong>{formatCoordinate(report.publicLocation.longitude)}</strong>
              </div>
            </div>
          </aside>

          <section className="public-detail-map-wrap">
            <PublicReportDetailMap location={report.publicLocation} />
          </section>

          <section className="public-gallery">
            <div className="public-gallery__header">
              <div>
                <span className="detail-grid__label">Image timeline</span>
                <h2>All public submissions in this stack</h2>
              </div>
              <span>{report.reportCount} total</span>
            </div>
            <div className="public-gallery__grid">
              {report.observations.map((observation) => (
                <article className="public-gallery__item" key={observation.reference}>
                  <img
                    src={observation.thumbnailUrl}
                    alt={`Public evidence ${observation.reference}`}
                  />
                  <div>
                    <strong>{observation.reference}</strong>
                    <span>{formatTimestamp(observation.reportedAt)}</span>
                    <span>{formatHabitatLabel(observation.habitatClass)}</span>
                    <span>{formatConfidenceLabel(observation.confidenceBand)}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
