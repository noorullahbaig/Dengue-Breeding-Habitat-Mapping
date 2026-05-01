import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { AppProviders } from '@/app/AppProviders'
import { AppRoutes } from '@/app/AppRoutes'
import { KL_CENTER, STORAGE_KEY } from '@/lib/constants'
import type { SubmittedReport } from '@/types/report'

vi.mock('@/features/report/LocationReviewMap', () => ({
  LocationReviewMap: ({
    onLocationChange,
  }: {
    onLocationChange: (location: {
      latitude: number
      longitude: number
      source: 'manual'
    }) => void
  }) => (
    <div data-testid="location-review-map">
      Map preview
      <button
        type="button"
        onClick={() =>
          onLocationChange({ latitude: 2.9264, longitude: 101.6964, source: 'manual' })
        }
      >
        Move outside Kuala Lumpur
      </button>
      <button
        type="button"
        onClick={() =>
          onLocationChange({ latitude: 3.139, longitude: 101.6869, source: 'manual' })
        }
      >
        Move inside Kuala Lumpur
      </button>
    </div>
  ),
}))

describe('resident report flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it('completes the resident happy path using the demo location fallback', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/report']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    const fileInput = screen.getByLabelText(/upload a photo instead/i)
    const photo = new File(['sample'], 'drain.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, photo)
    await user.click(screen.getByRole('button', { name: /use demo kuala lumpur location/i }))
    await screen.findByText(/demo kuala lumpur location loaded/i)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to review/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /continue to review/i }))

    expect(await screen.findByText(/confirm the pin and image before submission/i)).toBeInTheDocument()
    expect(screen.getByTestId('location-review-map')).toBeInTheDocument()

    await user.click(
      screen.getByRole('checkbox', {
        name: /i confirm this image and exact pin can be shown publicly/i,
      }),
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit public report/i })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: /submit public report/i }))

    await waitFor(() => {
      expect(screen.getByText(/your report has been received/i)).toBeInTheDocument()
    })
  })

  it('lets the resident stack a nearby public report before submitting', async () => {
    const user = userEvent.setup()
    const nearbyReport: SubmittedReport = {
      id: 'nearby-parent',
      reference: 'KL-NEAR-3001',
      createdAt: '2026-04-20T01:00:00.000Z',
      reportLocation: KL_CENTER,
      publicLocation: {
        latitude: KL_CENTER.latitude,
        longitude: KL_CENTER.longitude,
        source: 'public',
      },
      status: 'submitted',
      prediction: {
        label: 'tire',
        confidenceBand: 'high',
        advisoryText: 'Advisory only.',
      },
      neighborhood: 'Bukit Jalil',
      statusMessage: 'Received and awaiting officer review.',
      thumbnailUrl: 'data:image/jpeg;base64,thumb',
      imageUrl: 'data:image/jpeg;base64,image',
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([nearbyReport]))

    render(
      <MemoryRouter initialEntries={['/report']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    const fileInput = screen.getByLabelText(/upload a photo instead/i)
    const photo = new File(['sample'], 'tire.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, photo)
    await user.click(screen.getByRole('button', { name: /use demo kuala lumpur location/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to review/i })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: /continue to review/i }))

    expect(await screen.findByText(/is this the same breeding site/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /add to this report/i }))
    await user.click(
      screen.getByRole('checkbox', {
        name: /i confirm this image and exact pin can be shown publicly/i,
      }),
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit stacked report/i })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: /submit stacked report/i }))

    await waitFor(() => {
      expect(screen.getByText(/linked to existing public report/i)).toBeInTheDocument()
    })
  })

  it('does not prompt to stack when the nearby report has a different predicted class', async () => {
    const user = userEvent.setup()
    const nearbyReport: SubmittedReport = {
      id: 'nearby-parent',
      reference: 'KL-NEAR-4001',
      createdAt: '2026-04-20T01:00:00.000Z',
      reportLocation: KL_CENTER,
      publicLocation: {
        latitude: KL_CENTER.latitude,
        longitude: KL_CENTER.longitude,
        source: 'public',
      },
      status: 'submitted',
      prediction: {
        label: 'tire',
        confidenceBand: 'high',
        advisoryText: 'Advisory only.',
      },
      neighborhood: 'Bukit Jalil',
      statusMessage: 'Received and awaiting officer review.',
      thumbnailUrl: 'data:image/jpeg;base64,thumb',
      imageUrl: 'data:image/jpeg;base64,image',
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([nearbyReport]))

    render(
      <MemoryRouter initialEntries={['/report']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    const fileInput = screen.getByLabelText(/upload a photo instead/i)
    const photo = new File(['sample'], 'drain.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, photo)
    await user.click(screen.getByRole('button', { name: /use demo kuala lumpur location/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to review/i })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: /continue to review/i }))

    await user.click(
      screen.getByRole('checkbox', {
        name: /i confirm this image and exact pin can be shown publicly/i,
      }),
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit public report/i })).toBeEnabled()
    })
    expect(screen.queryByText(/is this the same breeding site/i)).not.toBeInTheDocument()
  })

  it('blocks review submission when the corrected pin leaves Kuala Lumpur', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/report']}>
        <AppProviders>
          <AppRoutes />
        </AppProviders>
      </MemoryRouter>,
    )

    const fileInput = screen.getByLabelText(/upload a photo instead/i)
    const photo = new File(['sample'], 'container.jpg', { type: 'image/jpeg' })

    await user.upload(fileInput, photo)
    await user.click(screen.getByRole('button', { name: /use demo kuala lumpur location/i }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continue to review/i })).toBeEnabled()
    })
    await user.click(screen.getByRole('button', { name: /continue to review/i }))
    await user.click(
      screen.getByRole('checkbox', {
        name: /i confirm this image and exact pin can be shown publicly/i,
      }),
    )
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit public report/i })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: /move outside kuala lumpur/i }))

    expect(
      screen.getByText(/reports can only be submitted within kuala lumpur/i),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit public report/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: /move inside kuala lumpur/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit public report/i })).toBeEnabled()
    })
  })
})
