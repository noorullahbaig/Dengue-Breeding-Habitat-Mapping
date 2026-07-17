import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/app/layoutConstants'
import { ReportPage } from '@/pages/ReportPage'
import type { ReportDraft } from '@/types/report'

const updateDraft = vi.fn()
const resetDraft = vi.fn()
const precheckReport = vi.fn()

const draft: ReportDraft = {
  photoFile: new File(['photo'], 'evidence.jpg', { type: 'image/jpeg' }),
  photoPreviewUrl: 'data:image/jpeg;base64,preview',
  photoEvidence: {
    name: 'evidence.jpg',
    mimeType: 'image/jpeg',
    size: 5,
  },
  detectedLocation: {
    latitude: 3.139,
    longitude: 101.6869,
    accuracyMeters: 20,
    source: 'browser',
  },
  correctedLocation: {
    latitude: 3.139,
    longitude: 101.6869,
    accuracyMeters: 20,
    source: 'browser',
  },
}

vi.mock('@/app/useReportDraft', () => ({
  useReportDraft: () => ({
    draft,
    updateDraft,
    resetDraft,
    setLastSubmittedReference: vi.fn(),
  }),
}))

vi.mock('@/app/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    sessionMode: 'local',
    trackReport: vi.fn(),
    trackedReferences: [],
  }),
}))

vi.mock('@/app/useServices', () => ({
  useServices: () => ({
    reportsService: { precheckReport },
  }),
}))

vi.mock('@/pages/components/LocationReviewMap', () => ({
  LocationReviewMap: () => <div>Location map</div>,
}))

vi.mock('@/features/report/LocationPermissionGate', () => ({
  LocationPermissionGate: ({ children }: { children: (props: { isLocating: boolean; onRetryLocation: () => void; locationError: string }) => React.ReactNode }) =>
    children({ isLocating: false, onRetryLocation: vi.fn(), locationError: '' }),
}))

vi.mock('@/pages/components/NearbyReportPrompt', () => ({
  NearbyReportPrompt: () => null,
}))

vi.mock('@/pages/components/PredictionEvidencePanel', () => ({
  PredictionEvidencePanel: () => <div>Prediction panel</div>,
}))

vi.mock('@/pages/components/StaticReceiptMap', () => ({
  StaticReceiptMap: () => <div>Receipt map</div>,
}))

describe('ReportPage mobile photo review', () => {
  beforeEach(() => {
    updateDraft.mockClear()
    resetDraft.mockClear()
    precheckReport.mockReset()
    draft.wizardStep = 0
    draft.hasConfirmedPin = false
    draft.hasPublicConsent = false
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

  it('keeps the photo review actions visible and waits for explicit continuation', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Take image' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Captured preview' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Use photo & continue' })).toBeVisible()
    expect(screen.getByLabelText('Retake photo')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm this exact site' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Use photo & continue' }))

    expect(screen.getByRole('heading', { name: 'Confirm location' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirm this exact site' })).toBeVisible()
  })

  it('restores the last reachable wizard step from the session draft', () => {
    draft.wizardStep = 1

    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Confirm location' })).toBeInTheDocument()
    expect(screen.getByText('Location map')).toBeInTheDocument()
  })

  it('fully restarts the report when retaking after no habitat is detected', async () => {
    const user = userEvent.setup()
    draft.wizardStep = 3
    draft.hasConfirmedPin = true
    draft.hasPublicConsent = true
    precheckReport.mockResolvedValue({
      prediction: {
        label: 'unclassified',
        confidence: null,
        confidenceBand: 'low',
        detections: [],
        advisoryText: 'No target habitat was identified.',
      },
      candidates: [],
      imageUrl: null,
    })

    render(
      <MemoryRouter initialEntries={['/report']}>
        <ReportPage />
      </MemoryRouter>,
    )

    const continueButton = await screen.findByRole('button', {
      name: 'Continue to submit',
    })
    await waitFor(() => expect(continueButton).toBeEnabled())
    await user.click(continueButton)

    const warning = await screen.findByRole('dialog', {
      name: 'Our AI couldn\'t confirm a habitat',
    })
    await user.click(
      within(warning).getByRole('button', { name: 'Retake photo' }),
    )

    await waitFor(() => {
      expect(resetDraft).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('heading', { name: 'Take image' })).toBeInTheDocument()
    })
    expect(screen.queryByText('Prediction panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Our AI couldn\'t confirm a habitat' })).not.toBeInTheDocument()
  })
})
