import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NearbyReportPrompt } from '@/pages/components/NearbyReportPrompt'
import type { NearbyReportCandidate } from '@/types/report'

const candidates: NearbyReportCandidate[] = [
  {
    id: 'nearby-1',
    reference: 'KL-TEST-1',
    publicLocation: {
      latitude: 3.139,
      longitude: 101.6869,
      source: 'public',
    },
    habitatClass: 'artificial_container',
    status: 'submitted',
    neighborhood: 'Kuala Lumpur Central',
    distanceMeters: 48,
    latestReportedAt: '2026-07-04T10:00:00Z',
    reportCount: 2,
    thumbnailUrl: 'https://example.com/thumb.jpg',
  },
]

describe('NearbyReportPrompt', () => {
  it('dismisses the modal without choosing a separate report', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    const onCreateSeparate = vi.fn()

    const { container } = render(
      <NearbyReportPrompt
        candidates={candidates}
        onStack={vi.fn()}
        onCreateSeparate={onCreateSeparate}
        onDismiss={onDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Close dialog' }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onCreateSeparate).not.toHaveBeenCalled()

    fireEvent.mouseDown(container.querySelector('.ui-dialog-backdrop') as HTMLElement)

    expect(onDismiss).toHaveBeenCalledTimes(2)
    expect(onCreateSeparate).not.toHaveBeenCalled()
  })
})
