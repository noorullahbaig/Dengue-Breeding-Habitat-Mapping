import { fireEvent, render, screen, within } from '@testing-library/react'
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
  it('uses an inset phone popup with persistent decision controls', () => {
    render(
      <NearbyReportPrompt
        presentation="popup"
        candidates={candidates}
        onStack={vi.fn()}
        onCreateSeparate={vi.fn()}
      />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Similar report nearby' })

    expect(dialog).toHaveClass('nearby-review--popup')
    expect(dialog.querySelector('.ui-dialog__header')).toBeInTheDocument()
    expect(dialog.querySelector('.nearby-review__content')).toBeInTheDocument()
    expect(dialog.querySelector('.nearby-review__footer')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('button', { name: 'Continue with a separate report' }),
    ).toBeInTheDocument()
  })

  it('treats both close and footer actions as choosing a separate report', async () => {
    const user = userEvent.setup()
    const onCreateSeparate = vi.fn()

    const { container } = render(
      <NearbyReportPrompt
        presentation="popup"
        candidates={candidates}
        onStack={vi.fn()}
        onCreateSeparate={onCreateSeparate}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Continue with a separate report' }))
    expect(onCreateSeparate).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Continue separately' }))
    expect(onCreateSeparate).toHaveBeenCalledTimes(2)

    fireEvent.mouseDown(container.querySelector('.ui-dialog-backdrop') as HTMLElement)
    expect(onCreateSeparate).toHaveBeenCalledTimes(2)
  })

  it('passes the selected nearby reference to the stack action', async () => {
    const user = userEvent.setup()
    const onStack = vi.fn()

    render(
      <NearbyReportPrompt
        presentation="popup"
        candidates={candidates}
        onStack={onStack}
        onCreateSeparate={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Add to this report' }))
    expect(onStack).toHaveBeenCalledWith('KL-TEST-1')
  })

  it('makes the persistent separate action primary and candidate actions secondary', () => {
    render(
      <NearbyReportPrompt
        presentation="popup"
        candidates={candidates}
        onStack={vi.fn()}
        onCreateSeparate={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Continue separately' })).toHaveClass(
      'ui-button--primary',
    )
    expect(screen.getByRole('button', { name: 'Add to this report' })).toHaveClass(
      'ui-button--secondary',
    )
  })

  it('renders all nearby candidates in the single review scroller', () => {
    const threeCandidates = [0, 1, 2].map((index) => ({
      ...candidates[0],
      id: `nearby-${index + 1}`,
      reference: `KL-TEST-${index + 1}`,
      distanceMeters: 18 + index * 10,
    }))

    render(
      <NearbyReportPrompt
        presentation="popup"
        candidates={threeCandidates}
        onStack={vi.fn()}
        onCreateSeparate={vi.fn()}
      />,
    )

    const scroller = screen
      .getByRole('dialog', { name: 'Similar report nearby' })
      .querySelector('.nearby-review__content') as HTMLElement
    expect(within(scroller).getAllByRole('article')).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'Add to this report' })).toHaveLength(3)
  })
})
