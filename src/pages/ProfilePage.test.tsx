import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { storePendingReportClaim } from '@/lib/pendingReportClaim'
import { ProfilePage } from '@/pages/ProfilePage'

const claimReport = vi.fn()
const signOut = vi.fn().mockResolvedValue(undefined)

vi.mock('@/app/useServices', () => ({
  useServices: () => ({
    reportsService: { claimReport, getMyReports: vi.fn().mockResolvedValue([]) },
  }),
}))

vi.mock('@/app/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    signOut,
    signInWithGoogle: vi.fn(),
    signInWithHostedUI: vi.fn(),
    sessionMode: 'cognito',
    trackedReferences: [],
    user: {
      id: 'cognito:user',
      email: 'user@example.com',
      displayName: 'Test User',
      provider: 'cognito',
    },
  }),
}))

describe('ProfilePage report claims', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
  })

  it('attaches a pending anonymous report after sign-in before showing success', async () => {
    storePendingReportClaim('KL-CLAIM-0001', 'private-token')
    claimReport.mockResolvedValue({ reference: 'KL-CLAIM-0001' })

    render(
      <MemoryRouter initialEntries={['/profile?attachRef=KL-CLAIM-0001']}>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(claimReport).toHaveBeenCalledWith('KL-CLAIM-0001', 'private-token')
    })
    expect(await screen.findByText('Report KL-CLAIM-0001 saved to your account.')).toBeInTheDocument()
  })

  it('does not claim or show success when the private token is missing', async () => {
    render(
      <MemoryRouter initialEntries={['/profile?attachRef=KL-CLAIM-0001']}>
        <ProfilePage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This report can no longer be attached from this browser session.',
    )
    expect(claimReport).not.toHaveBeenCalled()
  })

  it('clears a stale session before returning to the claim sign-in flow', async () => {
    render(
      <MemoryRouter initialEntries={['/profile?attachRef=KL-CLAIM-0001&reauth=1&redirect=%2Factivity']}>
        <ProfilePage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(signOut).toHaveBeenCalled()
    })
  })
})
