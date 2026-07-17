import { fireEvent, render, screen } from '@testing-library/react'
import { PermissionBlocker } from './PermissionBlocker'

describe('PermissionBlocker location recovery', () => {
  it('shows current iPhone Safari website and system Location settings', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1',
    })

    render(<PermissionBlocker permission="location" onRetry={vi.fn()} />)

    expect(
      screen.getByText('In Safari, open the Page Menu → More → Website Settings → Location'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Settings → Apps → Safari → Location/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Privacy & Security → Location Services/),
    ).toBeInTheDocument()
  })

  it('waits for an explicit retry tap after returning from Settings', () => {
    const onRetry = vi.fn()
    render(<PermissionBlocker permission="location" onRetry={onRetry} />)

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    fireEvent(document, new Event('visibilitychange'))

    expect(onRetry).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: "I've updated settings — Try Again" }),
    )
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
