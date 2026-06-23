import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui'
import { hasReportDraft, type ReportRouteState } from '@/app/reportOverlayState'
import { useReportDraft } from '@/app/useReportDraft'

interface ReportOverlayProps {
  routeState?: ReportRouteState
  children: (closeOverlay: () => void) => ReactNode
}

export function ReportOverlay({ children, routeState }: ReportOverlayProps) {
  const navigate = useNavigate()
  const { draft, resetDraft } = useReportDraft()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [isClosing, setIsClosing] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(
    Boolean(routeState?.promptForDraft && hasReportDraft(draft)),
  )

  function closeOverlay() {
    if (isClosing) return
    setIsClosing(true)

    const finishClose = () => {
      if (routeState?.reportBackgroundLocation) {
        navigate(-1)
        return
      }
      navigate('/', { replace: true })
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishClose()
      return
    }

    closeTimerRef.current = window.setTimeout(finishClose, 220)
  }

  function startOver() {
    resetDraft()
    setShowResumePrompt(false)
  }

  useEffect(() => {
    const shell = document.querySelector<HTMLElement>('.app-shell')
    const previousOverflow = document.body.style.overflow
    const previousAriaHidden = shell?.getAttribute('aria-hidden')

    document.body.style.overflow = 'hidden'
    shell?.setAttribute('aria-hidden', 'true')
    shell?.setAttribute('inert', '')
    dialogRef.current?.focus({ preventScroll: true })

    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
      document.body.style.overflow = previousOverflow
      shell?.removeAttribute('inert')
      if (previousAriaHidden === null) {
        shell?.removeAttribute('aria-hidden')
      } else if (previousAriaHidden !== undefined) {
        shell?.setAttribute('aria-hidden', previousAriaHidden)
      }

      const triggerId = routeState?.reportTriggerId
      if (triggerId) {
        window.requestAnimationFrame(() => document.getElementById(triggerId)?.focus())
      }
    }
  }, [routeState?.reportTriggerId])

  return (
    <div
      ref={dialogRef}
      className={`report-overlay${isClosing ? ' report-overlay--closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Report a breeding habitat"
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key === 'Escape') closeOverlay()
      }}
    >
      <div className="report-overlay__surface">
        {showResumePrompt ? (
          <section className="report-resume" aria-labelledby="report-resume-title">
            <div className="report-resume__mark" aria-hidden="true">KL</div>
            <div>
              <p className="report-resume__eyebrow">Unfinished report</p>
              <h1 id="report-resume-title">Continue where you left off?</h1>
              <p>Your selected evidence stays on this device for the current session.</p>
            </div>
            <div className="report-resume__actions">
              <Button variant="primary" fullWidth onClick={() => setShowResumePrompt(false)}>
                Resume report
              </Button>
              <Button variant="secondary" fullWidth onClick={startOver}>
                Start over
              </Button>
              <Button variant="ghost" fullWidth onClick={closeOverlay}>
                Cancel
              </Button>
            </div>
          </section>
        ) : (
          children(closeOverlay)
        )}
      </div>
    </div>
  )
}
