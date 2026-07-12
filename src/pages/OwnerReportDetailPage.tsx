import { Map as MapIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useServices } from '@/app/useServices'
import { useAuth } from '@/app/useAuth'
import { ButtonLink, Surface } from '@/components/ui'
import { formatHabitatLabel, formatTimestamp } from '@/lib/formatters'
import {
  ReportDetailPresentation,
  ReportDetailState,
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

    async function loadOwnerReport() {
      try {
        const nextReport = await reportsService.getMyReport(reference)
        if (active) setReport(nextReport)
      } catch (error: unknown) {
        if (!active) return
        setReport(null)
        setAccessExpired(hasHttpStatus(error, 401))
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
        title="Report unavailable"
        message={<p>This report is unavailable in your account.</p>}
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
    eyebrow: 'Your private report details',
    evidence: {
      prediction: report.prediction,
      imageUrl: report.imageUrl,
      imageAlt: `Evidence for ${report.reference}`,
      description: 'Your submitted photo and model result',
    },
    location: {
      point: report.publicLocation,
      description: 'Public-safe location used on the map',
    },
    metadata: [
      { label: 'Submitted', value: formatTimestamp(report.createdAt) },
      { label: 'Habitat', value: formatHabitatLabel(report.prediction.label) },
      { label: 'Reference', value: report.reference },
    ],
  }

  return (
    <ReportDetailPresentation
      model={model}
      primaryAfterEvidence={(
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
      )}
      metadataAfter={report.publicReportReference ? (
        <Link
          to={`/map/reports/${report.publicReportReference}`}
          className="status-action-link"
        >
          <MapIcon size={18} />
          View public location report
        </Link>
      ) : null}
    />
  )
}
