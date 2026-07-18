import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  Badge,
  Button,
  ButtonLink,
  DefinitionGrid,
  DefinitionItem,
  Dialog,
  EmptyState,
  FormField,
  LoadingState,
  MapFrame,
  MetaLabel,
  Notice,
  PageHeader,
  Surface,
} from '@/components/ui'

describe('canonical UI primitives', () => {
  it('renders semantic surface, button, badge, and metadata variants', () => {
    render(
      <MemoryRouter>
        <Surface as="section" tone="muted" padding="compact" elevation="flat">
          <PageHeader eyebrow="Resident activity" title="Saved reports" description="Private references." />
          <MetaLabel>Reference</MetaLabel>
          <DefinitionGrid columns={2}>
            <DefinitionItem label="Status">
              <Badge tone="success">Submitted</Badge>
            </DefinitionItem>
          </DefinitionGrid>
          <Button variant="secondary" size="small">
            Save report
          </Button>
          <ButtonLink to="/activity" variant="ghost">
            View activity
          </ButtonLink>
        </Surface>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'Saved reports' }).closest('section')).toHaveClass(
      'ui-surface',
      'ui-surface--muted',
      'ui-surface--padding-compact',
      'ui-surface--flat',
    )
    expect(screen.getByRole('button', { name: 'Save report' })).toHaveClass(
      'ui-button--secondary',
      'ui-button--compact',
    )
    expect(screen.getByRole('link', { name: 'View activity' })).toHaveClass('ui-button--ghost')
    expect(screen.getByText('Submitted')).toHaveClass('ui-badge--success')
  })

  it('exposes compact, standard, and large button size contracts', () => {
    render(
      <MemoryRouter>
        <Button size="compact">Filter reports</Button>
        <Button size="standard">Save changes</Button>
        <ButtonLink to="/report" size="large" fullWidth>
          Start a report
        </ButtonLink>
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: 'Filter reports' })).toHaveClass(
      'ui-button--compact',
    )
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveClass(
      'ui-button--standard',
    )
    expect(screen.getByRole('link', { name: 'Start a report' })).toHaveClass(
      'ui-button--large',
      'ui-button--full',
    )
  })

  it('connects field hints and errors to the control', () => {
    render(
      <FormField label="Email address" hint="Used only for sign-in." error="Enter a valid email." required>
        <input type="email" />
      </FormField>,
    )

    const input = screen.getByRole('textbox', { name: /email address/i })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).toContain('hint')
    expect(input.getAttribute('aria-describedby')).toContain('error')
  })

  it('provides consistent notice, loading, and empty-state semantics', () => {
    const { rerender } = render(
      <Notice tone="warning" title="Location unavailable" live>
        Try again outdoors.
      </Notice>,
    )

    expect(screen.getByRole('status')).toHaveClass('ui-notice--warning')

    rerender(<LoadingState label="Loading reports" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading reports')

    rerender(<EmptyState title="No reports yet">Submit your first report.</EmptyState>)
    expect(screen.getByRole('heading', { name: 'No reports yet' })).toBeInTheDocument()
  })

  it('renders map and dialog shells with accessible structure', () => {
    const handleClose = vi.fn()

    render(
      <>
        <MapFrame label="Report coordinates">
          <div>Map content</div>
        </MapFrame>
        <Dialog open title="Nearby report found" onClose={handleClose}>
          <button type="button">Keep separate</button>
        </Dialog>
      </>,
    )

    expect(screen.getByRole('region', { name: 'Report coordinates' })).toHaveClass('ui-map-frame')
    expect(screen.getByRole('dialog', { name: 'Nearby report found' })).toBeInTheDocument()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Nearby report found' }), {
      key: 'Escape',
    })
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('configures dialog dismissal without leaking Escape to an outer dialog', () => {
    const handleClose = vi.fn()
    const handleOuterKeyDown = vi.fn()

    const { container } = render(
      <div role="dialog" aria-label="Outer report flow" onKeyDown={handleOuterKeyDown}>
        <Dialog
          open
          title="Similar report nearby"
          closeLabel="Continue with a separate report"
          dismissOnBackdrop={false}
          onClose={handleClose}
        >
          <button type="button">Add to this report</button>
        </Dialog>
      </div>,
    )

    expect(
      screen.getByRole('button', { name: 'Continue with a separate report' }),
    ).toBeInTheDocument()

    fireEvent.mouseDown(container.querySelector('.ui-dialog-backdrop') as HTMLElement)
    expect(handleClose).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Similar report nearby' }), {
      key: 'Escape',
    })
    expect(handleClose).toHaveBeenCalledTimes(1)
    expect(handleOuterKeyDown).not.toHaveBeenCalled()
  })
})
