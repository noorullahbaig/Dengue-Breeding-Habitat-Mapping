import type { CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, CircleUserRound, Clock3, FileText, Home, Map as MapIcon, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/app/useAuth'
import { hasReportDraft } from '@/app/reportOverlayState'
import { useReportDraft } from '@/app/useReportDraft'

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { draft } = useReportDraft()

  const primaryLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/report', label: 'Report', icon: FileText },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/activity', label: 'Activity', icon: Clock3 },
    { to: '/learn', label: 'Learn', icon: BookOpen },
  ]

  // Calculate active index for the 5 main navigation items
  const activeIndex = primaryLinks.slice(0, 5).findIndex((link) => {
    if (link.to === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(link.to)
  })
  const pillOpacity = activeIndex !== -1 ? 1 : 0

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
  const mobileActiveIndex = mobileLinks.findIndex((link) => {
    if (link.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(link.to)
  })

  function openReport() {
    navigate('/report', {
      state: {
        reportBackgroundLocation: location,
        reportTriggerId: 'mobile-report-action',
        promptForDraft: hasReportDraft(draft),
      },
    })
  }

  return (
    <div className="app-shell">
      <aside className="app-rail" aria-label="Primary desktop navigation">
        <div className="app-rail__brand">
          <NavLink to="/" className="app-brand">
            <span className="app-brand__mark" aria-hidden="true">
              KL
            </span>
            <span className="app-brand__copy">
              <strong>DengueWatch KL</strong>
              <span>Resident reporting system</span>
            </span>
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
                className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="app-nav-link__label">{link.label}</span>
              </NavLink>
            )
          })}
        </nav>
        <div className="app-rail__footer">
          <div className="app-rail__meta">
            <span className="app-rail__meta-label">Operations</span>
            <NavLink
              to="/officer"
              className={({ isActive }) => `app-nav-link${isActive ? ' app-nav-link--active' : ''}`}
            >
              <ShieldCheck size={18} aria-hidden="true" />
              <span className="app-nav-link__label">Officer Portal</span>
            </NavLink>
          </div>
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
        <header className="app-topbar">
          <NavLink to="/" className="app-brand app-brand--topbar">
            <span className="app-brand__mark" aria-hidden="true">
              KL
            </span>
            <span className="app-brand__copy">
              <strong>DengueWatch KL</strong>
            </span>
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
              className={({ isActive }) => `app-bottom-nav__link${isActive ? ' app-bottom-nav__link--active' : ''}`}
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
