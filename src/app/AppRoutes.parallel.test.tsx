import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders } from '@/app/AppProviders'
import { AppRoutes } from '@/app/AppRoutes'
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/app/layoutConstants'

vi.mock('@/pages/HomePage', () => ({
  HomePage: () => <div>home-page</div>,
}))
vi.mock('@/pages/ReportPage', () => ({
  ReportPage: () => <div>report-page</div>,
}))
vi.mock('@/pages/StatusPage', () => ({
  StatusPage: () => <div>status-page</div>,
}))
vi.mock('@/pages/ReportSuccessPage', () => ({
  ReportSuccessPage: () => <div>success-page</div>,
}))
vi.mock('@/pages/ActivityPage', () => ({
  ActivityPage: () => <div>activity-page</div>,
}))
vi.mock('@/pages/ProfilePage', () => ({
  ProfilePage: () => <div>profile-page</div>,
}))
vi.mock('@/pages/PublicMapPage', () => ({
  PublicMapPage: () => <div>map-page</div>,
}))
vi.mock('@/pages/PublicReportDetailPage', () => ({
  PublicReportDetailPage: () => <div>detail-page</div>,
}))
vi.mock('@/pages/OwnerReportDetailPage', () => ({
  OwnerReportDetailPage: () => <div>owner-detail-page</div>,
}))
vi.mock('@/pages/LearnPage', () => ({
  LearnPage: () => <div>learn-page</div>,
}))
describe('canonical routes', () => {
  beforeEach(() => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === MOBILE_VIEWPORT_MEDIA_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  function renderRoutes(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )
  }

  it('renders canonical routes', async () => {
    let view = renderRoutes('/')
    expect(screen.getByText('home-page')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/map')
    expect(await screen.findByText('map-page')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/report')
    expect(await screen.findByText('report-page')).toBeInTheDocument()

    view.unmount()
    renderRoutes('/report/success')
    expect(await screen.findByText('success-page')).toBeInTheDocument()
  })

  it('renders the new resident account routes', async () => {
    const view = renderRoutes('/activity')
    expect(await screen.findByText('activity-page')).toBeInTheDocument()

    view.unmount()
    renderRoutes('/my-reports/KL-OWNER-0001')
    expect(await screen.findByText('owner-detail-page')).toBeInTheDocument()
    expect(
      screen.getAllByRole('link', { name: 'Activity' }).some((link) => link.className.includes('active')),
    ).toBe(true)

    view.unmount()
    renderRoutes('/profile')
    expect(await screen.findByText('profile-page')).toBeInTheDocument()
  })

  it('renders the learn route', async () => {
		renderRoutes('/learn')
    expect(await screen.findByText('learn-page')).toBeInTheDocument()
  })

  it('redirects unknown paths back to the resident home', () => {
    let view = renderRoutes('/unknown')
    expect(screen.getByText('home-page')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/legacy/report')
    expect(screen.getByText('home-page')).toBeInTheDocument()
  })

  it('marks the matching shell nav item active on canonical routes', () => {
    renderRoutes('/map')

    expect(screen.getAllByRole('link', { name: 'Map' }).some((link) => link.className.includes('active'))).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Home' }).every((link) => !link.className.includes('active'))).toBe(true)
  })

  it('opens Report as a route-backed overlay above the current mobile screen', async () => {
    const user = userEvent.setup()
    renderRoutes('/map')

    await screen.findByText('map-page')
    await user.click(screen.getByRole('button', { name: 'Start report' }))

    expect(screen.getByText('map-page')).toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: 'Report a breeding habitat' })).toBeInTheDocument()
    expect(screen.getByText('report-page')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary mobile navigation' })).not.toBeInTheDocument()
  })

  it('renders direct mobile report visits in the full-screen overlay', async () => {
    renderRoutes('/report')

    expect(await screen.findByRole('dialog', { name: 'Report a breeding habitat' })).toBeInTheDocument()
    expect(screen.getByText('report-page')).toBeInTheDocument()
  })
})
