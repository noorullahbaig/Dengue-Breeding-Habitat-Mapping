import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Check, Copy, AlertCircle } from 'lucide-react'
import { useReportDraft } from '@/app/useReportDraft'
import { useServices } from '@/app/useServices'
import { PredictionEvidencePanelV2 } from '@/pages/ux-v2/components/PredictionEvidencePanelV2'
import { formatTimestamp } from '@/lib/formatters'
import type { ReportStatus } from '@/types/report'

export function ReportSuccessPageV2() {
  const { reportsService } = useServices()
  const { lastSubmittedReference, resetDraft } = useReportDraft()
  const [searchParams] = useSearchParams()
  const [report, setReport] = useState<ReportStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const hasResetDraft = useRef(false)
  const [copied, setCopied] = useState(false)

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

      try {
        const nextReport = await reportsService.getReportStatus(reference)
        if (isMounted) {
          setReport(nextReport)
        }
      } catch (err) {
        console.error('Failed to load success report status:', err)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadStatus()

    return () => {
      isMounted = false
    }
  }, [reference, reportsService])

  async function handleCopyToClipboard() {
    if (!reference) return
    try {
      await navigator.clipboard.writeText(reference)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }

  return (
    <div className="page stack-md" style={{ maxWidth: '480px', margin: '0 auto' }}>
      {isLoading ? (
        <div className="loading-state" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-state__spinner">Loading your submission receipt...</div>
        </div>
      ) : report ? (
        <div className="stack-md">
          {/* 1. Hero Success Animation */}
          <div className="success-hero">
            <div className="success-hero__checkmark-wrapper">
              <svg className="success-hero__checkmark-svg" viewBox="0 0 52 52">
                <circle className="success-hero__checkmark-fill-circle" cx="26" cy="26" r="25" />
                <circle className="success-hero__checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="success-hero__checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            <h1 className="success-hero__title">Report Submitted!</h1>
            <p className="success-hero__subtitle">
              Thank you for helping map breeding habitats in our community.
            </p>
          </div>

          {/* 2. Visual Evidence Panel */}
          <div className="slide-up-content delay-1">
            <PredictionEvidencePanelV2
              prediction={report.prediction}
              title="AI Classification Receipt"
              imageUrl={`http://localhost:8000/api/public/reports/${report.reference}/image`}
              imageAlt="Your submitted photo evidence"
              compact
              showDetections
            />
          </div>

          {/* 3. Sleek Reference Code Copy Pill */}
          <div className="slide-up-content delay-2" style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className={`reference-copy-pill ${copied ? 'reference-copy-pill--copied' : ''}`}
              onClick={handleCopyToClipboard}
              aria-label="Copy reference code to clipboard"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="reference-copy-pill__code">{report.reference}</span>
                </>
              )}
            </button>
          </div>

          {/* 4. Minimal Detail Grid */}
          <div className="slide-up-content delay-2">
            <div className="minimal-success-grid">
              <div className="minimal-success-grid__item">
                <span className="detail-grid__label">Reported At</span>
                <strong style={{ fontSize: '0.92rem' }}>{formatTimestamp(report.createdAt)}</strong>
              </div>
              <div className="minimal-success-grid__item">
                <span className="detail-grid__label">Neighborhood</span>
                <strong style={{ fontSize: '0.92rem' }}>{report.neighborhood}</strong>
              </div>
            </div>

            {report.stackedOnReference && (
              <div className="info-strip info-strip--success" style={{ marginTop: '0.75rem', borderRadius: '12px' }}>
                <p className="caption-text" style={{ margin: 0, textTransform: 'none', color: 'var(--color-success)' }}>
                  Linked as stacked photo evidence on parent report: <strong>{report.stackedOnReference}</strong>
                </p>
              </div>
            )}
          </div>

          {/* 5. Primary Actions */}
          <div className="page-header__actions slide-up-content delay-3" style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to={`/status?ref=${report.reference}`} className="button" style={{ textAlign: 'center' }}>
              Track Live Status
            </Link>
            <Link to="/report" className="button button--secondary" style={{ textAlign: 'center' }}>
              Report Another Habitat
            </Link>
            <Link to="/" className="button button--ghost" style={{ textAlign: 'center' }}>
              Return to Home
            </Link>
          </div>
        </div>
      ) : reference ? (
        <div className="stack-md">
          {/* Hero Success Animation (Still shown even if receipt loading failed) */}
          <div className="success-hero">
            <div className="success-hero__checkmark-wrapper">
              <svg className="success-hero__checkmark-svg" viewBox="0 0 52 52">
                <circle className="success-hero__checkmark-fill-circle" cx="26" cy="26" r="25" />
                <circle className="success-hero__checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                <path className="success-hero__checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
              </svg>
            </div>
            <h1 className="success-hero__title">Report Submitted!</h1>
            <p className="success-hero__subtitle">
              Thank you for helping map breeding habitats in our community.
            </p>
          </div>

          {/* Fallback Warning Strip */}
          <div className="info-strip info-strip--warning slide-up-content delay-1" style={{ borderRadius: '12px', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.4' }}>
              We successfully captured your submission, but the live receipt status is taking a moment to load from the server.
            </p>
          </div>

          {/* Reference copy pill */}
          <div className="slide-up-content delay-2" style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className={`reference-copy-pill ${copied ? 'reference-copy-pill--copied' : ''}`}
              onClick={handleCopyToClipboard}
              aria-label="Copy reference code to clipboard"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="reference-copy-pill__code">{reference}</span>
                </>
              )}
            </button>
          </div>

          {/* Action buttons */}
          <div className="page-header__actions slide-up-content delay-3" style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to={`/status?ref=${reference}`} className="button" style={{ textAlign: 'center' }}>
              Track Live Status
            </Link>
            <Link to="/report" className="button button--secondary" style={{ textAlign: 'center' }}>
              Report Another Habitat
            </Link>
            <Link to="/" className="button button--ghost" style={{ textAlign: 'center' }}>
              Return to Home
            </Link>
          </div>
        </div>
      ) : (
        <div className="empty-state stack-md" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <p>No report reference was loaded. Start a new report or track a report manually.</p>
          <div className="page-header__actions" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to="/report" className="button" style={{ textAlign: 'center' }}>
              Report a site
            </Link>
            <Link to="/status" className="button button--secondary" style={{ textAlign: 'center' }}>
              Track status manually
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
