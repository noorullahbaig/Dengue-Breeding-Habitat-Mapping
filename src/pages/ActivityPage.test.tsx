import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ActivityPage } from '@/pages/ActivityPage'

const reportsService = {
  getReportStatus: vi.fn(),
}

const guestAuthState = {
  isAuthenticated: false,
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
})
