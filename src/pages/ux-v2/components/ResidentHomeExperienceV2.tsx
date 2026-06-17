import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useServices } from '@/app/useServices'
import { formatRelativeTime, formatHabitatLabel, formatConfidenceScore } from '@/lib/formatters'
import type { PublicHotspot, PublicMapReport } from '@/types/report'
import { StatusBadge } from '@/features/shared/StatusBadge'

// requestAnimationFrame count-up hook/component for smooth premium counts on scroll/viewport intersection
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const [element, setElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!element || hasAnimated || value === 0) {
      if (value > 0 && hasAnimated) {
        setCount(value)
      }
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasAnimated(true)
        let startTimestamp: number | null = null
        const step = (timestamp: number) => {
          if (!startTimestamp) startTimestamp = timestamp
          const progress = Math.min((timestamp - startTimestamp) / duration, 1)
          setCount(Math.floor(progress * value))
          if (progress < 1) {
            window.requestAnimationFrame(step)
          } else {
            setCount(value)
          }
        }
        window.requestAnimationFrame(step)
        observer.disconnect()
      }
    }, { threshold: 0.1 })

    observer.observe(element)
    return () => observer.disconnect()
  }, [element, value, duration, hasAnimated])

  useEffect(() => {
    if (hasAnimated) {
      setCount(value)
    }
  }, [value, hasAnimated])

  return <span ref={setElement} className="metric-card__value-num">{value === 0 ? '--' : count}</span>
}

export function ResidentHomeExperienceV2() {
  const { mapService } = useServices()
  const [reports, setReports] = useState<PublicMapReport[]>([])
  const [hotspots, setHotspots] = useState<PublicHotspot[]>([])

  useEffect(() => {
    let isMounted = true

    Promise.allSettled([mapService.listPublicReports(), mapService.listHotspots()]).then(
      ([reportsResult, hotspotsResult]) => {
        if (!isMounted) {
          return
        }

        if (reportsResult.status === 'fulfilled') {
          setReports(reportsResult.value)
        } else {
          console.error('Failed to load public reports:', reportsResult.reason)
        }

        if (hotspotsResult.status === 'fulfilled') {
          setHotspots(hotspotsResult.value)
        } else {
          console.error('Failed to load hotspots:', hotspotsResult.reason)
        }
      },
    )

    return () => {
      isMounted = false
    }
  }, [mapService])

  const recentReports = reports.slice(0, 3)
  const resolvedReports = reports.filter((report) => report.status === 'closed').length

  return (
    <div className="page page--resident-home">
      <section className="home-hero panel">
        <div className="home-hero__copy">
          <span className="section-heading__eyebrow">Resident Reporting</span>
          <h1 className="home-hero__title">Keep KL safe from dengue.</h1>
          <p className="home-hero__description">
            Report possible mosquito breeding habitats, confirm the pin location, and submit photo
            evidence for officer review.
          </p>
          <div className="home-hero__actions">
            <Link to="/report" className="button home-hero__primary">
              Start Report
            </Link>
            <Link to="/learn" className="button button--ghost">
              Learn what to report
            </Link>
          </div>
        </div>
        <div className="home-hero__visual" aria-hidden="true">
          <div className="home-hero__visual-frame">
            <div className="home-hero__mesh-bg" />
            <div className="home-hero__shield-container">
              <svg className="home-hero__shield" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img">
                <title>DengueWatch KL Shield</title>
                <path d="M50 88C50 88 82 72 82 46V22L50 10L18 22V46C18 72 50 88 50 88Z" fill="url(#shield-grad)" stroke="var(--color-accent)" strokeWidth="3" strokeLinejoin="round"/>
                <path d="M50 78C50 78 74 65 74 46V27.5L50 18.5L26 27.5V46C26 65 50 78 50 78Z" fill="rgba(255, 255, 255, 0.15)" stroke="var(--color-accent-soft)" strokeWidth="1.5" strokeDasharray="3 3"/>
                <circle cx="50" cy="46" r="16" stroke="var(--color-accent)" strokeWidth="2" className="shield-pulse" />
                <circle cx="50" cy="46" r="8" fill="var(--color-accent)" />
                <defs>
                  <linearGradient id="shield-grad" x1="50" y1="10" x2="50" y2="88" gradientUnits="userSpaceOnUse">
                    <stop stopColor="rgba(216, 242, 255, 0.95)" />
                    <stop offset="1" stopColor="rgba(255, 255, 255, 0.96)" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
          <div className="home-hero__steps" style={{ padding: '0.5rem 1rem 1rem 1rem' }}>
            <ol className="home-guidance__list">
              <li>
                <strong>Photo of the habitat</strong>
                <span>Clear evidence helps officers validate the site quickly.</span>
              </li>
              <li>
                <strong>Location confirmation</strong>
                <span>Use browser GPS, then refine the exact point on the map.</span>
              </li>
              <li>
                <strong>Consent and final review</strong>
                <span>Choose public visibility explicitly before the report is submitted.</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="home-card-grid">
        <article className="metric-card panel">
          <div className="metric-card__value">
            <AnimatedCounter value={reports.length} />
          </div>
          <h2>Habitats identified</h2>
          <p>Publicly visible resident submissions currently listed on the shared map.</p>
        </article>
        <article className="metric-card panel">
          <div className="metric-card__value">
            <AnimatedCounter value={resolvedReports} />
          </div>
          <h2>Resolved or closed</h2>
          <p>Reports that have completed the current officer action lifecycle.</p>
        </article>
        <article className="metric-card panel metric-card--accent">
          <div className="metric-card__value">
            <AnimatedCounter value={hotspots.length} />
          </div>
          <h2>Active outbreak hotspots</h2>
          <p>Current iDengue hotspot rows mirrored into the local public awareness view.</p>
        </article>
      </section>



      <section className="home-activity">
        <div className="home-activity__header">
          <div>
            <span className="section-heading__eyebrow">Community Activity</span>
            <h2>Recent public reporting</h2>
          </div>
          <Link to="/map" className="home-activity__header-link">
            <span>Open public map</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
        <div className="home-activity__list">
          {recentReports.map((report) => (
            <Link
              key={report.id}
              to={`/map/reports/${report.reference}`}
              className="activity-card"
              aria-label={`View details for ${formatHabitatLabel(report.habitatClass)} reported in ${report.neighborhood}`}
            >
              <div className="activity-card__image-container">
                <img
                  src={report.thumbnailUrl}
                  alt=""
                  className="activity-card__image"
                  onError={(e) => {
                    e.currentTarget.src =
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="%2300464f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="15" y="15" width="70" height="70" rx="8" fill="%23d8f2ff"/%3E%3Cpath d="M15 65l20-20 25 25 10-10 15 15"/%3E%3Ccircle cx="40" cy="40" r="8" fill="%2300464f"/%3E%3C/svg%3E'
                  }}
                />
                {report.prediction?.confidence ? (
                  <div className="activity-card__confidence-badge">
                    {formatConfidenceScore(report.prediction.confidence)}
                  </div>
                ) : null}
              </div>
              <div className="activity-card__details">
                {/* Neighborhood — full width, accent colour */}
                <span className="activity-card__neighborhood">{report.neighborhood}</span>
                {/* Title — the primary headline, allowed to wrap to 2 lines */}
                <h3 className="activity-card__title">
                  {formatHabitatLabel(report.habitatClass)} Detected
                </h3>
                {/* Bottom row: status badge + stacking count + relative time */}
                <div className="activity-card__badges">
                  <StatusBadge status={report.status} />
                  {report.reportCount > 1 ? (
                    <span className="activity-card__stack-count">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }} aria-hidden="true">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      {report.reportCount} reports
                    </span>
                  ) : null}
                  <span className="activity-card__time">{formatRelativeTime(report.latestReportedAt)}</span>
                </div>
              </div>
              <div className="activity-card__arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            </Link>
          ))}
          {recentReports.length === 0 ? (
            <div className="activity-card activity-card--empty">
              <div className="activity-card__empty-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div className="activity-card__details" style={{ alignItems: 'center' }}>
                <h3 className="activity-card__title" style={{ whiteSpace: 'normal', textAlign: 'center' }}>
                  No active reports listed
                </h3>
                <p className="activity-card__sub" style={{ margin: '0.2rem 0 0 0', textAlign: 'center', fontSize: '0.84rem', color: 'var(--color-ink-soft)' }}>
                  Start a resident report or check back later once new report data is approved.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  )
}
