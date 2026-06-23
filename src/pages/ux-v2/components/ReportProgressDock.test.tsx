import { render, screen } from '@testing-library/react'
import { ReportWizardChrome } from '@/pages/ux-v2/components/ReportWizardChrome'
import { reportSteps } from '@/pages/ux-v2/reportWizard'

describe('segmented report progress', () => {
  it('exposes all five progress states through accessible segment names', () => {
    render(
      <ReportWizardChrome
        currentStep={1}
        steps={reportSteps}
        onBack={() => {}}
        onClose={() => {}}
        onStepSelect={() => {}}
        canOpenStep={(stepIndex) => stepIndex < 3}
        getStepBlockedReason={(stepIndex) =>
          stepIndex >= 3 ? 'Complete the previous step first.' : ''
        }
        isStepComplete={(stepIndex) => stepIndex === 0}
      />,
    )

    expect(screen.getByRole('button', { name: 'Take image, complete' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Confirm location, current step' }),
    ).toHaveAttribute('aria-current', 'step')
    expect(screen.getByRole('button', { name: 'Consent form, available' })).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'AI inference results, locked' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Report confirmation, locked' }),
    ).toHaveAttribute('title', 'Complete the previous step first.')
  })
})
