import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MobileLocationConfirmation } from '@/pages/components/MobileLocationConfirmation'

describe('MobileLocationConfirmation', () => {
  it('keeps the location status and confirmation action visible together', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()

    render(
      <MobileLocationConfirmation
        status="At your device location."
        tone="valid"
        disabled={false}
        onConfirm={onConfirm}
      />,
    )

    expect(screen.getByText('At your device location.')).toBeVisible()

    const confirmButton = screen.getByRole('button', { name: 'Confirm this exact site' })
    expect(confirmButton).toBeEnabled()

    await user.click(confirmButton)

    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows the action while disabled so the status explains what is required', () => {
    render(
      <MobileLocationConfirmation
        status="Use your device location to verify this exact site."
        tone="warning"
        disabled
        onConfirm={() => {}}
      />,
    )

    expect(screen.getByText('Use your device location to verify this exact site.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Confirm this exact site' })).toBeDisabled()
  })
})
