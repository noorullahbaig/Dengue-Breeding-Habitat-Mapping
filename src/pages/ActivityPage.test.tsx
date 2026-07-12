import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ActivityPage } from '@/pages/ActivityPage'

const reportsService = {
  getReportStatus: vi.fn(),
  getMyReports: vi.fn(),
}

const guestAuthState = {
  isAuthenticated: false,
  isAuthLoading: false,
  sessionMode: 'local',
  trackedReferences: [] as string[],
  untrackReport: vi.fn(),
}

vi.mock('@/app/useAuth', () => ({
  useAuth: () => guestAuthState,
}))

vi.mock('@/app/useServices', () => ({
  useServices: () => ({
    reportsService,
  }),
}))

describe('ActivityPage guest state', () => {
  beforeEach(() => {
    guestAuthState.isAuthLoading = false
    guestAuthState.isAuthenticated = false
    guestAuthState.sessionMode = 'local'
    reportsService.getMyReports.mockReset()
  })

  it('waits for session restoration before showing the signed-out gate', () => {
    guestAuthState.isAuthLoading = true
    render(
      <MemoryRouter initialEntries={['/activity']}>
        <ActivityPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Restoring your account…')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Your Report Activity' })).not.toBeInTheDocument()
  })

  it('keeps the sign-in prompt concise and avoids implementation-detail copy', () => {
    render(
      <MemoryRouter initialEntries={['/activity']}>
        <ActivityPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Your Report Activity' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign In to View Activity' })).toBeInTheDocument()
    expect(screen.queryByText(/local build keeps saved activity/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cognito/i)).not.toBeInTheDocument()
  })

  it('opens an owned report in the owner detail route', async () => {
    guestAuthState.isAuthenticated = true
    guestAuthState.sessionMode = 'cognito'
    reportsService.getMyReports.mockResolvedValue([
      {
        id: 'report-1',
        reference: 'KL-OWNER-0001',
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
        statusMessage: 'Received.',
        notes: 'Resident note',
      },
    ])

    render(
      <MemoryRouter initialEntries={['/activity']}>
        <ActivityPage />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: 'View report details' })
    expect(link).toHaveAttribute('href', '/my-reports/KL-OWNER-0001')
    expect(screen.queryByRole('link', { name: 'View Status' })).not.toBeInTheDocument()
  })
})
