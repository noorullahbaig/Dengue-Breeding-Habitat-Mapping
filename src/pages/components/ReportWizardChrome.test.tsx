import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReportWizardChrome } from '@/pages/components/ReportWizardChrome'
import { reportSteps } from '@/pages/reportWizard'

describe('ReportWizardChrome', () => {
  it('renders the compact segmented header for the active step', () => {
    render(
      <ReportWizardChrome
        currentStep={1}
        steps={reportSteps}
        onBack={() => {}}
        onClose={() => {}}
        onStepSelect={() => {}}
        canOpenStep={() => true}
        getStepBlockedReason={() => ''}
        isStepComplete={(stepIndex) => stepIndex === 0}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Confirm location' })).toBeInTheDocument()
    expect(screen.getByText('Move the pin to the exact site.')).toBeInTheDocument()
    expect(screen.getByText('Step 2 of 5')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Previous report step' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Close report' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: 'Report progress' })).toHaveClass(
      'report-segmented-progress',
    )
    expect(screen.getAllByRole('listitem')).toHaveLength(5)
  })

  it('hides the previous-step control on the first step', () => {
    render(
      <ReportWizardChrome
        currentStep={0}
        steps={reportSteps}
        onBack={() => {}}
        onClose={() => {}}
        onStepSelect={() => {}}
        canOpenStep={(stepIndex) => stepIndex === 0}
        getStepBlockedReason={() => 'Complete the previous step first.'}
        isStepComplete={() => false}
      />,
    )

    expect(screen.queryByRole('button', { name: 'Previous report step' })).not.toBeInTheDocument()
  })

  it('selects reachable segments and exposes locked reasons', async () => {
    const user = userEvent.setup()
    const onStepSelect = vi.fn()

    render(
      <ReportWizardChrome
        currentStep={1}
        steps={reportSteps}
        onBack={() => {}}
        onClose={() => {}}
        onStepSelect={onStepSelect}
        canOpenStep={(stepIndex) => stepIndex < 2}
        getStepBlockedReason={(stepIndex) =>
          stepIndex >= 2 ? 'Complete the previous step first.' : ''
        }
        isStepComplete={(stepIndex) => stepIndex === 0}
      />,
    )

    const lockedStep = screen.getByRole('button', { name: 'Consent form, locked' })

    expect(lockedStep).toBeDisabled()
    expect(lockedStep).toHaveAttribute('title', 'Complete the previous step first.')

    await user.click(screen.getByRole('button', { name: 'Confirm location, current step' }))

    expect(onStepSelect).toHaveBeenCalledWith(1)
  })
})
