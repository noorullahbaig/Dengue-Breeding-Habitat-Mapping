import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReportSuccessPage } from '@/pages/ReportSuccessPage'

const resetDraft = vi.fn()
vi.mock('@/app/useReportDraft', () => ({
  useReportDraft: () => ({
    lastSubmittedReference: 'REF-12345',
    resetDraft,
  }),
}))

const getReportStatus = vi.fn()
vi.mock('@/app/useServices', () => ({
  useServices: () => ({
    reportsService: {
      getReportStatus,
    },
  }),
}))

const trackReport = vi.fn()
let mockIsAuthenticated = false
let mockTrackedReferences: string[] = []

vi.mock('@/app/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    sessionMode: 'local',
    trackReport,
    trackedReferences: mockTrackedReferences,
  }),
}))

vi.mock('@/pages/components/PredictionEvidencePanel', () => ({
  PredictionEvidencePanel: () => <div>Prediction Panel</div>,
}))

describe('ReportSuccessPage Identity & Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAuthenticated = false
    mockTrackedReferences = []
    getReportStatus.mockResolvedValue({
      reference: 'REF-12345',
      createdAt: '2026-06-22T12:00:00Z',
      neighborhood: 'Kuala Lumpur Central',
      prediction: {
        predictedClass: 'Dengue breeding habitat',
        confidence: 0.92,
        detections: [],
      },
    })
  })

  it('resets draft on mount, displays the anonymous tracking caption, and uses the shared success illustration', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/report/success']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    expect(resetDraft).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('Your anonymous Tracking ID — tap to copy')).toBeInTheDocument()
    })

    const illustration = container.querySelector('.success-hero__illustration img')
    expect(illustration).not.toBeNull()
    expect(illustration?.getAttribute('src')).toContain('report-submitted.png')
    expect(illustration?.getAttribute('alt')).toBe('')
  })

  it('auto-saves report to account and shows success notice when user is authenticated', async () => {
    mockIsAuthenticated = true

    render(
      <MemoryRouter initialEntries={['/report/success']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(trackReport).toHaveBeenCalledWith('REF-12345')
      expect(screen.getByText('Report saved to your account')).toBeInTheDocument()
      expect(screen.getByText('This submission has been automatically linked to your activity history.')).toBeInTheDocument()
      expect(screen.getByText('View Saved Activity')).toBeInTheDocument()
    })
  })

  it('shows track report panel and collapses it when dismissing as an anonymous user', async () => {
    mockIsAuthenticated = false
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/report/success']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Want to follow up on this report?')).toBeInTheDocument()
      expect(screen.getByText("Sign In & Save to Account")).toBeInTheDocument()
    })

    const dismissButton = screen.getByRole('button', { name: "I'll use the Tracking ID" })
    await user.click(dismissButton)

    expect(screen.queryByText('Want to follow up on this report?')).not.toBeInTheDocument()
  })

  it('keeps the same success illustration when receipt details fail to load', async () => {
    getReportStatus.mockRejectedValueOnce(new Error('receipt unavailable'))
    const { container } = render(
      <MemoryRouter initialEntries={['/report/success?ref=REF-12345']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Receipt details are still loading/i)).toBeInTheDocument()
    })

    const illustration = container.querySelector('.success-hero__illustration img')
    expect(illustration).not.toBeNull()
    expect(illustration?.getAttribute('src')).toContain('report-submitted.png')
  })
})
