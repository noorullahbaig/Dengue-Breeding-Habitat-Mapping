import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
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
  function renderRoutes(path: string) {
    return render(
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>,
    )
  }

  it('renders canonical routes as v2', () => {
    let view = renderRoutes('/')
    expect(screen.getByText('v2-home')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/map')
    expect(screen.getByText('v2-map')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/report')
    expect(screen.getByText('v2-report')).toBeInTheDocument()

    view.unmount()
    renderRoutes('/report/success')
    expect(screen.getByText('v2-success')).toBeInTheDocument()
  })

  it('renders the learn route in both canonical and alias paths', () => {
    let view = renderRoutes('/learn')
    expect(screen.getByText('v2-learn')).toBeInTheDocument()

    view.unmount()
    renderRoutes('/next/learn')
    expect(screen.getByText('v2-learn')).toBeInTheDocument()
  })

  it('keeps rollback legacy routes under /legacy/*', () => {
    let view = renderRoutes('/legacy')
    expect(screen.getByText('legacy-home')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/legacy/report')
    expect(screen.getByText('legacy-report')).toBeInTheDocument()
  })

  it('keeps /next/* as v2 aliases temporarily', () => {
    let view = renderRoutes('/next')
    expect(screen.getByText('v2-home')).toBeInTheDocument()

    view.unmount()
    view = renderRoutes('/next/report')
    expect(screen.getByText('v2-report')).toBeInTheDocument()
  })

  it('marks the matching shell nav item active on canonical routes', () => {
    renderRoutes('/map')

    expect(screen.getAllByRole('link', { name: 'Map' }).some((link) => link.className.includes('active'))).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Home' }).every((link) => !link.className.includes('active'))).toBe(true)
  })
})
