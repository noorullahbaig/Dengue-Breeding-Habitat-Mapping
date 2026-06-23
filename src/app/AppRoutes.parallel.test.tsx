import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders } from '@/app/AppProviders'
import { AppRoutes } from '@/app/AppRoutes'

vi.mock('@/app/uxFlags', () => ({
  uxFlags: {
    enableV2Preview: true,
  },
}))

vi.mock('@/pages/HomePage', () => ({
  HomePage: () => <div>legacy-home</div>,
}))
vi.mock('@/pages/ReportPage', () => ({
  ReportPage: () => <div>legacy-report</div>,
}))
vi.mock('@/pages/StatusPage', () => ({
  StatusPage: () => <div>legacy-status</div>,
}))
vi.mock('@/pages/PublicMapPage', () => ({
  PublicMapPage: () => <div>legacy-map</div>,
}))
vi.mock('@/pages/PublicReportDetailPage', () => ({
  PublicReportDetailPage: () => <div>legacy-detail</div>,
}))
vi.mock('@/pages/OfficerPlaceholderPage', () => ({
  OfficerPlaceholderPage: () => <div>legacy-officer</div>,
}))
vi.mock('@/pages/ReportReviewPage', () => ({
  ReportReviewPage: () => <div>legacy-review</div>,
}))
vi.mock('@/pages/ux-v2/HomePageV2', () => ({
  HomePageV2: () => <div>v2-home</div>,
}))
vi.mock('@/pages/ux-v2/ReportPageV2', () => ({
  ReportPageV2: () => <div>v2-report</div>,
}))
vi.mock('@/pages/ux-v2/StatusPageV2', () => ({
  StatusPageV2: () => <div>v2-status</div>,
}))
vi.mock('@/pages/ux-v2/ReportSuccessPageV2', () => ({
  ReportSuccessPageV2: () => <div>v2-success</div>,
}))
vi.mock('@/pages/ux-v2/ActivityPageV2', () => ({
  ActivityPageV2: () => <div>v2-activity</div>,
}))
vi.mock('@/pages/ux-v2/ProfilePageV2', () => ({
  ProfilePageV2: () => <div>v2-profile</div>,
}))
vi.mock('@/pages/ux-v2/PublicMapPageV2', () => ({
  PublicMapPageV2: () => <div>v2-map</div>,
}))
vi.mock('@/pages/ux-v2/PublicReportDetailPageV2', () => ({
  PublicReportDetailPageV2: () => <div>v2-detail</div>,
}))
vi.mock('@/pages/ux-v2/LearnPageV2', () => ({
  LearnPageV2: () => <div>v2-learn</div>,
}))
vi.mock('@/pages/ux-v2/OfficerDashboardPageV2', () => ({
  OfficerDashboardPageV2: () => <div>v2-officer</div>,
}))

describe('v2-only cutover routes', () => {
  beforeEach(() => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(max-width: 760px)',
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

  it('renders canonical routes as v2', async () => {
    let view = renderRoutes('/')
    expect(screen.getByText('v2-home')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/map')
    expect(await screen.findByText('v2-map')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/report')
    expect(await screen.findByText('v2-report')).toBeInTheDocument()

    view.unmount()
    renderRoutes('/report/success')
    expect(await screen.findByText('v2-success')).toBeInTheDocument()
  })

  it('renders the new resident account routes', async () => {
    const view = renderRoutes('/activity')
    expect(await screen.findByText('v2-activity')).toBeInTheDocument()

    view.unmount()
    renderRoutes('/profile')
    expect(await screen.findByText('v2-profile')).toBeInTheDocument()
  })

  it('renders the learn route in both canonical and alias paths', async () => {
    const view = renderRoutes('/learn')
    expect(await screen.findByText('v2-learn')).toBeInTheDocument()

    view.unmount()
    renderRoutes('/next/learn')
    expect(await screen.findByText('v2-learn')).toBeInTheDocument()
  })

  it('redirects retired legacy paths back to the resident home', () => {
    let view = renderRoutes('/legacy')
    expect(screen.getByText('v2-home')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/legacy/report')
    expect(screen.getByText('v2-home')).toBeInTheDocument()
  })

  it('keeps /next/* as v2 aliases temporarily', async () => {
    let view = renderRoutes('/next')
    expect(screen.getByText('v2-home')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/next/report')
    expect(await screen.findByText('v2-report')).toBeInTheDocument()
  })

  it('marks the matching shell nav item active on canonical routes', () => {
    renderRoutes('/map')

    expect(screen.getAllByRole('link', { name: 'Map' }).some((link) => link.className.includes('active'))).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Home' }).every((link) => !link.className.includes('active'))).toBe(true)
  })

  it('keeps the mobile top bar focused on brand and profile access', () => {
    renderRoutes('/')

    expect(screen.queryByRole('link', { name: 'Track a report by reference code' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to view profile' })).toBeInTheDocument()
  })

  it('opens Report as a route-backed overlay above the current mobile screen', async () => {
    const user = userEvent.setup()
    renderRoutes('/map')

    await screen.findByText('v2-map')
    await user.click(screen.getByRole('button', { name: 'Start report' }))

    expect(screen.getByText('v2-map')).toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: 'Report a breeding habitat' })).toBeInTheDocument()
    expect(screen.getByText('v2-report')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Primary mobile navigation' })).not.toBeInTheDocument()
  })

  it('renders direct mobile report visits in the full-screen overlay', async () => {
    renderRoutes('/report')

    expect(await screen.findByRole('dialog', { name: 'Report a breeding habitat' })).toBeInTheDocument()
    expect(screen.getByText('v2-report')).toBeInTheDocument()
  })
})
