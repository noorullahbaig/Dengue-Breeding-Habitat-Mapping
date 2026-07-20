import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { storePendingReportClaim } from '@/lib/pendingReportClaim'
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
let mockSessionMode: 'local' | 'cognito' = 'local'
let mockTrackedReferences: string[] = []

vi.mock('@/app/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    sessionMode: mockSessionMode,
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
    mockSessionMode = 'local'
    mockTrackedReferences = []
    window.sessionStorage.clear()
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

  it('displays the anonymous tracking caption and uses the shared success illustration', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/report/success']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )


    await waitFor(() => {
      expect(screen.getByText('Your anonymous Tracking ID')).toBeInTheDocument()
      expect(screen.getByText('Tap to copy')).toBeInTheDocument()
    })

    const illustration = container.querySelector('.success-hero__illustration img')
    expect(illustration).not.toBeNull()
    expect(container.querySelector('.success-hero__portrait')).not.toBeNull()
    expect(illustration?.getAttribute('src')).toContain('report-submitted.png')
    expect(illustration?.getAttribute('alt')).toBe('')
  })

  it('auto-saves report to account, shows account confirmation, and keeps tracking as the primary action for authenticated users', async () => {
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
      expect(screen.getByRole('link', { name: 'View activity' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Track report status' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Report another habitat' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Return home' })).toBeInTheDocument()
    })
  })

  it('shows the anonymous sign-in prompt after the main actions and keeps no-account tracking language visible', async () => {
    mockIsAuthenticated = false

    render(
      <MemoryRouter initialEntries={['/report/success']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Track report status' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Report another habitat' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Return home' })).toBeInTheDocument()
      expect(screen.getByText('Want to save this report to an account?')).toBeInTheDocument()
      expect(screen.getByText(/You can still track this report anytime with the Tracking ID above, no account needed\./i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Sign in to save it' })).toBeInTheDocument()
    })
  })

  it('explains when a signed-in-looking session could not save the report', async () => {
    mockIsAuthenticated = true
    mockSessionMode = 'cognito'
    storePendingReportClaim('REF-12345', 'private-claim-token')

    render(
      <MemoryRouter initialEntries={['/report/success?ref=REF-12345']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    expect(await screen.findByText(/couldn’t verify your account/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in again to save report/i })).toHaveAttribute(
      'href',
      '/profile?attachRef=REF-12345&reauth=1&redirect=%2Factivity',
    )
    expect(screen.getByText('Your anonymous Tracking ID')).toBeInTheDocument()
    expect(trackReport).not.toHaveBeenCalled()
  })

  it('copies the tracking id and exposes visible copied feedback', async () => {
    mockIsAuthenticated = false
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    const originalClipboard = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    })

    render(
      <MemoryRouter initialEntries={['/report/success']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    const copyButton = await screen.findByRole('button', { name: 'Copy tracking ID to clipboard' })
    await user.click(copyButton)

    expect(writeText).toHaveBeenCalledWith('REF-12345')
    expect(screen.getByText('Copied!')).toBeInTheDocument()

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    })
  })

  it('keeps the same success illustration when receipt details fail to load', async () => {
    getReportStatus.mockRejectedValueOnce(new Error('receipt unavailable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { container } = render(
      <MemoryRouter initialEntries={['/report/success?ref=REF-12345']}>
        <ReportSuccessPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Receipt details are still loading/i)).toBeInTheDocument()
    })

    expect(screen.getByRole('link', { name: 'Track report status' })).toBeInTheDocument()
    const illustration = container.querySelector('.success-hero__illustration img')
    expect(illustration).not.toBeNull()
    expect(illustration?.getAttribute('src')).toContain('report-submitted.png')

    consoleError.mockRestore()
  })
})
