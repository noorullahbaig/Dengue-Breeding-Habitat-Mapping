import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OwnerReportDetailPage } from '@/pages/OwnerReportDetailPage'

const getMyReport = vi.fn()
const reportsService = { getMyReport }
const authState = { isAuthenticated: true, isAuthLoading: false }

vi.mock('@/app/useServices', () => ({
  useServices: () => ({ reportsService }),
}))

vi.mock('@/app/useAuth', () => ({
  useAuth: () => authState,
}))

vi.mock('@/pages/components/PredictionEvidencePanel', () => ({
  PredictionEvidencePanel: () => <div>evidence-panel</div>,
}))

vi.mock('@/pages/components/StaticReceiptMap', () => ({
  StaticReceiptMap: () => <div>location-map</div>,
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/my-reports/KL-PRIVATE-0001']}>
      <Routes>
        <Route path="/my-reports/:reference" element={<OwnerReportDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function ownerDetail(publicReportReference: string | null = null) {
  return {
    id: 'report-1',
    reference: 'KL-PRIVATE-0001',
    createdAt: '2026-07-12T12:00:00.000Z',
    status: 'submitted',
    prediction: {
      label: 'tire',
      confidence: 0.9,
      confidenceBand: 'high',
      advisoryText: 'Advisory only.',
      detections: [],
    },
    neighborhood: 'Bukit Jalil',
    statusMessage: 'Report received.',
    notes: 'Resident note',
    publicLocation: { latitude: 3.1, longitude: 101.7, source: 'public' },
    imageUrl: 'https://api.example.com/api/my-reports/KL-PRIVATE-0001/image',
    thumbnailUrl: 'https://api.example.com/api/my-reports/KL-PRIVATE-0001/thumbnail',
    publicReportReference,
  }
}

describe('OwnerReportDetailPage', () => {
  beforeEach(() => {
    getMyReport.mockReset()
    authState.isAuthenticated = true
    authState.isAuthLoading = false
  })

  it('keeps owner navigation and private content without a public action', async () => {
    getMyReport.mockResolvedValue(ownerDetail())
    renderPage()

    expect(await screen.findByRole('link', { name: 'Back to My Reports' })).toHaveAttribute('href', '/activity')
    expect(screen.getByText('Resident note')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View public location report' })).not.toBeInTheDocument()
  })

  it('links a stacked owner report to its root public report', async () => {
    getMyReport.mockResolvedValue(ownerDetail('KL-ROOT-0001'))
    renderPage()

    expect(await screen.findByRole('link', { name: 'View public location report' })).toHaveAttribute(
      'href',
      '/map/reports/KL-ROOT-0001',
    )
  })

  it('offers sign in with a return path when account access expires', async () => {
    authState.isAuthenticated = false
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Sign in to view this report' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/profile?redirect=%2Fmy-reports%2FKL-PRIVATE-0001',
    )
  })
})
