import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useServices } from '@/app/useServices'
import { useAuth } from '@/app/useAuth'
import { ButtonLink, Surface } from '@/components/ui'
import { formatCalendarDate, formatHabitatLabel, formatTimestamp } from '@/lib/formatters'
import {
  ReportDetailPresentation,
  ReportDetailState,
  ReportObservationHistory,
  type ReportDetailViewModel,
} from '@/pages/components/ReportDetailPresentation'
import type { OwnerReportDetail } from '@/types/report'

function hasHttpStatus(error: unknown, status: number) {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === status)
}

export function OwnerReportDetailPage() {
  const { reference = '' } = useParams()
  const { reportsService } = useServices()
  const { isAuthenticated, isAuthLoading } = useAuth()
  const [report, setReport] = useState<OwnerReportDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [accessExpired, setAccessExpired] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (isAuthLoading) return
    if (!isAuthenticated) {
      setAccessExpired(true)
      setIsLoading(false)
      return
    }

    let active = true
    setIsLoading(true)
    setAccessExpired(false)
    setLoadFailed(false)
    setNotFound(false)

    async function loadOwnerReport() {
      try {
        const nextReport = await reportsService.getMyReport(reference)
        if (active) setReport(nextReport)
      } catch (error: unknown) {
        if (!active) return
        setReport(null)
        setAccessExpired(hasHttpStatus(error, 401))
        setNotFound(hasHttpStatus(error, 404))
        setLoadFailed(!hasHttpStatus(error, 401))
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void loadOwnerReport()
    return () => {
      active = false
    }
  }, [isAuthenticated, isAuthLoading, reference, reportsService])

  useEffect(() => {
    const imageUrl = report?.imageUrl
    return () => {
      if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl)
    }
  }, [report?.imageUrl])

  if (isLoading) {
    return <ReportDetailState backTo="/activity" backLabel="Back to My Reports" isLoading />
  }

  if (accessExpired) {
    const returnPath = `/my-reports/${reference}`
    return (
      <ReportDetailState
        backTo="/activity"
        backLabel="Back to My Reports"
        title="Sign in to view this report"
        message={<p>Your account session has expired.</p>}
        action={(
          <ButtonLink to={`/profile?redirect=${encodeURIComponent(returnPath)}`} variant="primary">
            Sign in
          </ButtonLink>
        )}
      />
    )
  }

  if (loadFailed || !report) {
    return (
      <ReportDetailState
        backTo="/activity"
        backLabel="Back to My Reports"
        title={notFound ? 'Report not found in your account' : 'Report details unavailable'}
        message={<p>{notFound ? 'This report may belong to another account or has not been claimed yet.' : 'We could not load the report details. Please try again.'}</p>}
      />
    )
  }

  const model: ReportDetailViewModel = {
    mode: 'owner',
    backTo: '/activity',
    backLabel: 'Back to My Reports',
    reference: report.reference,
    status: report.status,
    neighborhood: report.neighborhood,
    eyebrow: (
      <>
        Selected habitat: <strong>{formatHabitatLabel(report.prediction.label)}</strong>
      </>
    ),
    stats: [
      { label: 'Stacked Reports', value: 1 },
      { label: 'Last Updated', value: formatCalendarDate(report.createdAt) },
    ],
    evidence: {
      prediction: report.prediction,
      imageUrl: report.imageUrl,
      imageAlt: `Evidence for ${report.reference}`,
      description: 'Submitted photo with model classification boundaries',
    },
    location: {
      point: report.publicLocation,
      description: 'Public-safe location used on the map',
    },
    metadata: [
      { label: 'First Reported', value: formatTimestamp(report.createdAt) },
      { label: 'Last Updated', value: formatTimestamp(report.createdAt) },
      { label: 'Primary Habitat', value: formatHabitatLabel(report.prediction.label) },
      { label: 'Total Submissions', value: '1 report' },
    ],
  }

  return (
    <ReportDetailPresentation
      model={model}
      primaryAfterEvidence={(
        <>
          <ReportObservationHistory
            observations={[{
              id: report.id,
              reference: report.reference,
              reportedAt: report.createdAt,
              thumbnailUrl: report.imageUrl,
              habitatClass: report.prediction.label,
              confidenceBand: report.prediction.confidenceBand,
            }]}
            selectedReference={report.reference}
            description="Your submitted report"
          />
          <Surface as="section" className="public-detail-card-section">
            <div className="public-detail-card-section__header">
              <h2>Latest update</h2>
            </div>
            <p>{report.statusMessage}</p>
            {report.notes ? (
              <div className="detail-privacy-note">
                <span className="detail-metadata-label">Your note</span>
                <p>{report.notes}</p>
              </div>
            ) : null}
          </Surface>
        </>
      )}
    />
  )
}
