import { useState, useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, FileText, Home, Map as MapIcon, Search, ShieldCheck } from 'lucide-react'

export function AppLayout() {
  const location = useLocation()
  const isOfficerPath = location.pathname.startsWith('/officer')

  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  let primaryLinks: Array<{ to: string; label: string; icon: LucideIcon }> = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/report', label: 'Report', icon: FileText },
    { to: '/map', label: 'Map', icon: MapIcon },
    { to: '/status', label: 'Track Status', icon: Search },
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
  const isImmersivePath = isReportPath || isMapPath

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
          } as React.CSSProperties}
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
          <a href="https://idengue.mysa.gov.my" target="_blank" rel="noreferrer" className="app-inline-link">
            iDengue source
          </a>
        </div>
      </aside>

      <header className={`app-topbar${isScrolled ? ' app-topbar--scrolled' : ''}`}>
        <NavLink to="/" className="app-brand app-brand--topbar">
          <span className="app-brand__mark" aria-hidden="true">
            KL
          </span>
          <span className="app-brand__copy">
            <strong>DengueWatch KL</strong>
            <span>{isOfficerPath ? 'Officer portal' : 'Civic health reporting'}</span>
          </span>
        </NavLink>
      </header>

      <main className={`app-main ${isImmersivePath ? 'app-main--report-immersive' : ''}`}>
        <div className={`app-canvas ${isImmersivePath ? 'app-canvas--report-immersive' : ''}`}>
          <Outlet />
          {!isImmersivePath && (
            <footer className="app-footer">
              <p>
                Kuala Lumpur resident reporting prototype with public map, anonymous status tracking,
                and officer review workflow.
              </p>
              <div className="app-footer__links">
                <NavLink
                  to="/status"
                  className="app-inline-link"
                >
                  Track status
                </NavLink>
                <a href="https://idengue.mysa.gov.my" target="_blank" rel="noreferrer" className="app-inline-link">
                  iDengue
                </a>
                <NavLink to="/officer" className="app-inline-link">
                  Officer access
                </NavLink>
              </div>
            </footer>
          )}
        </div>
      </main>

      <nav
        className="app-bottom-nav"
        aria-label="Primary mobile navigation"
        style={{
          '--active-index': activeIndex,
          '--pill-opacity': pillOpacity,
        } as React.CSSProperties}
      >
        <div className="app-bottom-nav__active-pill" aria-hidden="true" />
        {primaryLinks.slice(0, 5).map((link) => {
          const Icon = link.icon
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
