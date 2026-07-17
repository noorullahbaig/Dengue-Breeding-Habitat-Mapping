import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LowConfidenceWarningSheet } from '@/pages/components/LowConfidenceWarningSheet'

describe('LowConfidenceWarningSheet', () => {
  it('uses a dedicated retake callback instead of dismissing the warning', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onRetake = vi.fn()

    render(
      <LowConfidenceWarningSheet
        onConfirm={vi.fn()}
        onCancel={onCancel}
        onRetake={onRetake}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Retake photo' }))
    await new Promise((resolve) => window.setTimeout(resolve, 240))
    expect(onRetake).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('keeps submit and dismiss actions separate', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()

    render(
      <LowConfidenceWarningSheet
        onConfirm={onConfirm}
        onCancel={onCancel}
        onRetake={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Submit anyway' }))
    expect(onConfirm).not.toHaveBeenCalled()

    await new Promise((resolve) => window.setTimeout(resolve, 240))
    expect(onConfirm).toHaveBeenCalledWith('')

    await user.click(screen.getByRole('button', { name: 'Close low-confidence review' }))
    await new Promise((resolve) => window.setTimeout(resolve, 240))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('dismisses on Escape without invoking retake', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const onRetake = vi.fn()

    render(
      <LowConfidenceWarningSheet
        onConfirm={vi.fn()}
        onCancel={onCancel}
        onRetake={onRetake}
      />,
    )

    await user.keyboard('{Escape}')
    await new Promise((resolve) => window.setTimeout(resolve, 240))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onRetake).not.toHaveBeenCalled()
  })
})
