import { NavLink, Outlet } from 'react-router-dom'

const links = [
  { to: '/', label: 'Map' },
  { to: '/report', label: 'Report' },
  { to: '/status', label: 'Track Status' },
  { to: '/officer', label: 'Officer', comingSoon: true },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <NavLink to="/" className="brand-mark">
            <span className="brand-mark__eyebrow">Kuala Lumpur prototype</span>
            <strong>Breeding Habitat Watch</strong>
          </NavLink>

          <nav className="site-nav" aria-label="Primary">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `site-nav__link${isActive ? ' site-nav__link--active' : ''}${
                    link.comingSoon ? ' site-nav__link--coming-soon' : ''
                  }`
                }
              >
                <span>{link.label}</span>
                {link.comingSoon ? <span className="site-nav__badge">Coming soon</span> : null}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>
    </div>
  )
}
