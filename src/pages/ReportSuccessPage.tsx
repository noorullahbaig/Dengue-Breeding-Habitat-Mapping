import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SectionHeading } from '@/components/SectionHeading'
import { useReportDraft } from '@/app/useReportDraft'
import { useServices } from '@/app/useServices'
import { StatusBadge } from '@/features/shared/StatusBadge'
import { formatTimestamp } from '@/lib/formatters'
import type { ReportStatus } from '@/types/report'

export function ReportSuccessPage() {
  const { reportsService } = useServices()
  const { lastSubmittedReference, resetDraft } = useReportDraft()
  const [searchParams] = useSearchParams()
  const [report, setReport] = useState<ReportStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasResetDraft = useRef(false)

  const reference = searchParams.get('ref') ?? lastSubmittedReference

  useEffect(() => {
    if (!hasResetDraft.current) {
      resetDraft()
      hasResetDraft.current = true
    }
  }, [resetDraft])

  useEffect(() => {
    let isMounted = true

    async function loadStatus() {
      if (!reference) {
        setIsLoading(false)
        return
      }

      const nextReport = await reportsService.getReportStatus(reference)

      if (isMounted) {
        setReport(nextReport)
        setIsLoading(false)
      }
    }

    void loadStatus()

    return () => {
      isMounted = false
    }
  }, [reference, reportsService])

  return (
    <div className="page">
      <SectionHeading
        variant="compact"
        eyebrow="Submission received"
        title="Your report has been received."
        description="This prototype returns a non-personalized reference so residents can check progress later without creating an account."
      />

      {isLoading ? (
        <div className="panel">Loading your new report...</div>
      ) : report ? (
        <div className="success-card">
          <div className="success-card__header">
            <span className="success-card__reference">{report.reference}</span>
            <StatusBadge status={report.status} />
          </div>

          <div className="detail-grid">
            <div>
              <span className="detail-grid__label">Submitted</span>
              <strong>{formatTimestamp(report.createdAt)}</strong>
            </div>
            <div>
              <span className="detail-grid__label">Neighborhood</span>
              <strong>{report.neighborhood}</strong>
            </div>
            <div>
              <span className="detail-grid__label">Next step</span>
              <strong>Use the reference to track progress later.</strong>
            </div>
          </div>

          <p>{report.statusMessage}</p>
          {report.stackedOnReference ? (
            <p>
              Your submission was linked to existing public report{' '}
              <strong>{report.stackedOnReference}</strong>.
            </p>
          ) : null}
          <p className="caption-text">
            Public viewers can see the confirmed image and exact pin. Your private note is not shown publicly.
          </p>

          <div className="cluster-row">
            <Link to={`/status?ref=${report.reference}`} className="button">
              Track status
            </Link>
            <Link
              to={`/map/reports/${report.stackedOnReference ?? report.reference}`}
              className="button button--secondary"
            >
              View public report
            </Link>
          </div>
        </div>
      ) : (
        <div className="panel">
          <p>No report reference was found. Start a new report or track a report manually.</p>
          <div className="cluster-row">
            <Link to="/report" className="button">
              Report a site
            </Link>
            <Link to="/status" className="button button--secondary">
              Track status
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
