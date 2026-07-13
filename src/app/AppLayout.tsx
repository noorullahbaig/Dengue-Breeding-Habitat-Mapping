import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CircleUserRound, Clock3, FileText, Home, Map as MapIcon, User } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { useAuth } from '@/app/useAuth'
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/app/layoutConstants'
import { hasReportDraft } from '@/app/reportOverlayState'
import { useReportDraft } from '@/app/useReportDraft'

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { draft } = useReportDraft()
  const topbarRef = useRef<HTMLElement | null>(null)
  const bottomNavRef = useRef<HTMLElement | null>(null)

  const primaryLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/report', label: 'Report', icon: FileText },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/activity', label: 'Activity', icon: Clock3 },
    { to: '/learn', label: 'Learn', icon: BookOpen },
  ]

  function isSectionActive(path: string) {
    if (path === '/') return location.pathname === '/'
    if (path === '/activity') {
      return location.pathname.startsWith('/activity') || location.pathname.startsWith('/my-reports/')
    }
    return location.pathname.startsWith(path)
  }

  // Calculate active index for the 5 main navigation items
  const activeIndex = primaryLinks.slice(0, 5).findIndex((link) => isSectionActive(link.to))
  const pillOpacity = 0

  const isReportPath = location.pathname === '/report'
  const isMapPath = location.pathname === '/map'
  const isImmersivePath = isMapPath

  const mobileLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/report', label: 'Report', icon: FileText },
    { to: '/activity', label: 'Activity', icon: Clock3 },
    { to: '/learn', label: 'Learn', icon: BookOpen },
  ]
  const mobileActiveIndex = mobileLinks.findIndex((link) => isSectionActive(link.to))

  function openReport() {
    navigate('/report', {
      state: {
        reportBackgroundLocation: location,
        reportTriggerId: 'mobile-report-action',
        promptForDraft: hasReportDraft(draft),
      },
    })
  }

  useLayoutEffect(() => {
    const rootStyle = document.documentElement.style
    const topbar = topbarRef.current
    const bottomNav = bottomNavRef.current
    const media = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY)

    function setRootMetric(name: string, value: string) {
      if (rootStyle.getPropertyValue(name) !== value) {
        rootStyle.setProperty(name, value)
      }
    }

    function getVisibleRect(element: HTMLElement | null) {
      if (!element) return null

      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        return null
      }

      return rect
    }

    function updateMobileChromeMetrics() {
      const topbarRect = media.matches ? getVisibleRect(topbar) : null
      const navRect = media.matches ? getVisibleRect(bottomNav) : null
      const reportAction = bottomNav?.querySelector<HTMLElement>('.app-bottom-nav__report-action') ?? null
      const reportActionRect = media.matches ? getVisibleRect(reportAction) : null
      const topbarOccupiedHeight = Math.ceil(topbarRect?.height ?? 0)
      const visualViewportOffset = window.visualViewport
        ? Math.max(
            0,
            Math.ceil(window.innerHeight - (window.visualViewport.height + window.visualViewport.offsetTop)),
          )
        : 0
      const occupiedHeight = navRect
        ? Math.max(0, Math.ceil(window.innerHeight - Math.min(navRect.top, reportActionRect?.top ?? navRect.top)))
        : 0
      const mobileBottomClearance = occupiedHeight + visualViewportOffset

      setRootMetric('--app-topbar-occupied-height', `${topbarOccupiedHeight}px`)
      setRootMetric('--app-bottom-nav-occupied-height', `${occupiedHeight}px`)
      setRootMetric('--visual-viewport-bottom-offset', `${visualViewportOffset}px`)
      setRootMetric('--app-mobile-bottom-clearance', `${mobileBottomClearance}px`)
      setRootMetric('--app-mobile-viewport-height', `${window.innerHeight}px`)
    }

    updateMobileChromeMetrics()
    const firstLayoutFrame = window.requestAnimationFrame(updateMobileChromeMetrics)
    const resizeObserver =
      typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => updateMobileChromeMetrics())
        : null

    if (topbar) {
      resizeObserver?.observe(topbar)
    }
    if (bottomNav) {
      resizeObserver?.observe(bottomNav)
    }

    window.addEventListener('resize', updateMobileChromeMetrics)
    window.addEventListener('orientationchange', updateMobileChromeMetrics)
    window.visualViewport?.addEventListener('resize', updateMobileChromeMetrics)
    window.visualViewport?.addEventListener('scroll', updateMobileChromeMetrics)

    return () => {
      resizeObserver?.disconnect()
      window.cancelAnimationFrame(firstLayoutFrame)
      window.removeEventListener('resize', updateMobileChromeMetrics)
      window.removeEventListener('orientationchange', updateMobileChromeMetrics)
      window.visualViewport?.removeEventListener('resize', updateMobileChromeMetrics)
      window.visualViewport?.removeEventListener('scroll', updateMobileChromeMetrics)
    }
  }, [])

  return (
    <div className="app-shell">
      <aside className="app-rail" aria-label="Primary desktop navigation">
        <div className="app-rail__brand">
          <NavLink to="/" className="app-brand">
            <BrandLogo variant="lockup" size={48} treatment="bare" className="app-brand__logo" />
          </NavLink>
        </div>
        <nav
          className="app-rail__nav"
          style={{
            '--active-index': activeIndex,
            '--pill-opacity': pillOpacity,
          } as CSSProperties}
        >
          <div className="app-rail__active-pill" aria-hidden="true" />
          {primaryLinks.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={`${link.to}:${link.label}`}
                to={link.to}
                end={link.to === '/'}
                className={`app-nav-link${isSectionActive(link.to) ? ' app-nav-link--active' : ''}`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="app-nav-link__label">{link.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="app-rail__footer">
          <div className="app-rail__meta">
            <span className="app-rail__meta-label">Resident tools</span>
            <NavLink
              to="/profile"
              className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
            >
              <CircleUserRound size={18} aria-hidden="true" />
              <span className="app-nav-link__label">{isAuthenticated ? 'Profile' : 'Sign In'}</span>
            </NavLink>
            <NavLink to="/status" className="app-inline-link">
              Track by reference code
            </NavLink>
          </div>
          <a href="https://idengue.mysa.gov.my" target="_blank" rel="noreferrer" className="app-inline-link">
            iDengue source
          </a>
        </div>
      </aside>

      {!isReportPath && (
        <header className="app-topbar" ref={topbarRef}>
          <NavLink to="/" className="app-brand app-brand--topbar">
            <BrandLogo variant="lockup" size={32} treatment="bare" className="app-brand__logo" />
          </NavLink>
          <div className="app-topbar__actions">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `app-topbar__avatar${isActive ? ' app-topbar__avatar--active' : ''}`
              }
              aria-label={isAuthenticated ? `Open profile for ${user?.displayName}` : 'Sign in to view profile'}
            >
              {isAuthenticated && user?.displayName
                ? <span className="app-topbar__avatar-initials">
                    {user.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </span>
                : <User size={16} strokeWidth={2} aria-hidden="true" />
              }
            </NavLink>
          </div>
        </header>
      )}

      <main className={`app-main ${isImmersivePath ? 'app-main--report-immersive' : ''}`}>
        <div className={`app-canvas ${isImmersivePath ? 'app-canvas--report-immersive' : ''}`}>
          <Outlet />
        </div>
      </main>

      <nav
        className="app-bottom-nav"
        aria-label="Primary mobile navigation"
        ref={bottomNavRef}
        style={{
          '--active-index': mobileActiveIndex,
          '--pill-opacity': mobileActiveIndex >= 0 && mobileActiveIndex !== 2 ? 1 : 0,
        } as CSSProperties}
      >
        <div className="app-bottom-nav__active-pill" aria-hidden="true" />
        {mobileLinks.map((link) => {
          const Icon = link.icon
          if (link.to === '/report') {
            return (
              <button
                key="mobile-report-action"
                id="mobile-report-action"
                type="button"
                className="app-bottom-nav__link app-bottom-nav__report-action"
                aria-label="Start report"
                onClick={openReport}
              >
                <span className="app-bottom-nav__report-core">
                  <Icon size={22} aria-hidden="true" />
                </span>
                <span>Report</span>
              </button>
            )
          }
          return (
            <NavLink
              key={`mobile-${link.to}:${link.label}`}
              to={link.to}
              end={link.to === '/'}
              className={`app-bottom-nav__link${isSectionActive(link.to) ? ' app-bottom-nav__link--active' : ''}`}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{link.label}</span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
