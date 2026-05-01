import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SectionHeading } from '@/components/SectionHeading'
import { useServices } from '@/app/useServices'
import { StatusLookupForm } from '@/features/status/StatusLookupForm'
import { StatusBadge } from '@/features/shared/StatusBadge'
import { formatHabitatLabel, formatTimestamp } from '@/lib/formatters'
import { seededReports } from '@/mocks/data'
import type { ReportStatus } from '@/types/report'

const statusSteps = [
  'Submitted: the evidence bundle reached the system.',
  'Under Review: an officer can examine the report details.',
  'Prioritized: area-level hotspot context may justify quicker follow-up.',
  'Action Recorded: some form of officer action was logged.',
  'Closed: the report lifecycle has been completed for this prototype.',
]

export function StatusPage() {
  const { reportsService } = useServices()
  const [searchParams, setSearchParams] = useSearchParams()
  const [report, setReport] = useState<ReportStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const reference = searchParams.get('ref') ?? ''
  const demoReference = seededReports[0]?.reference ?? ''

  useEffect(() => {
    let isMounted = true

    async function loadStatus() {
      if (!reference) {
        setReport(null)
        return
      }

      setIsLoading(true)
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
    <div className="page page--status">
      <SectionHeading
        variant="compact"
        eyebrow="Anonymous status lookup"
        title="Track a report without signing in."
        description="Paste a reference to see progress. Public evidence stays on the map; private notes and officer-only review details stay out of this lookup."
      />

      <div className="stack-lg">
        <div className="flow-card flow-card--bare">
          <div className="cluster-row">
            <Link to="/" className="button button--ghost">
              Return to map
            </Link>
          </div>
          <StatusLookupForm
            initialReference={reference}
            onLookup={(nextReference) => setSearchParams(nextReference ? { ref: nextReference } : {})}
          />
          <div className="status-demo">
            <div className="status-demo__row">
              <div>
                <span className="detail-grid__label">Seeded laptop test reference</span>
                <p>Use a guaranteed demo lookup before you submit a new report.</p>
              </div>
              <button
                type="button"
                className="status-demo__reference"
                onClick={() => setSearchParams({ ref: demoReference })}
              >
                {demoReference}
              </button>
            </div>
            <p className="caption-text">
              New submissions are stored through the local backend when it is running.
            </p>
          </div>
        </div>

        {isLoading ? <div className="panel">Checking the current report status...</div> : null}

        {!isLoading && report ? (
          <div className="panel panel--highlight">
            <div className="cluster-row cluster-row--between">
              <strong>{report.reference}</strong>
              <StatusBadge status={report.status} />
            </div>
            <div className="detail-grid">
              <div>
                <span className="detail-grid__label">Submitted</span>
                <strong>{formatTimestamp(report.createdAt)}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Area</span>
                <strong>{report.neighborhood}</strong>
              </div>
              <div>
                <span className="detail-grid__label">Advisory habitat</span>
                <strong>{formatHabitatLabel(report.prediction.label)}</strong>
              </div>
            </div>
            <p>{report.statusMessage}</p>
            {report.stackedOnReference ? (
              <p className="caption-text">
                This reference is linked to public report {report.stackedOnReference}.
              </p>
            ) : null}
          </div>
        ) : null}

        {!isLoading && reference && !report ? (
          <div className="panel">
            <p>No report matched that reference. Check the code and try again.</p>
          </div>
        ) : null}

        <div className="panel">
          <h2>Status meanings</h2>
          <ul className="status-list">
            {statusSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
