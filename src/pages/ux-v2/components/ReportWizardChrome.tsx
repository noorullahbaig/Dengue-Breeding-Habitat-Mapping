import { Check, ChevronLeft, X } from 'lucide-react'
import type { RefObject } from 'react'

interface ReportWizardStep {
  title: string
  description: string
}

interface ReportWizardChromeProps {
  currentStep: number
  steps: readonly ReportWizardStep[]
  titleRef?: RefObject<HTMLHeadingElement | null>
  onBack: () => void
  onClose?: () => void
  onStepSelect: (stepIndex: number) => void
  canOpenStep: (stepIndex: number) => boolean
  getStepBlockedReason: (stepIndex: number) => string
  isStepComplete: (stepIndex: number) => boolean
}

export function ReportWizardChrome({
  currentStep,
  steps,
  titleRef,
  onBack,
  onClose,
  onStepSelect,
  canOpenStep,
  getStepBlockedReason,
  isStepComplete,
}: ReportWizardChromeProps) {
  const activeStep = steps[currentStep]
  return (
    <header className="report-stepper-header">
      <div className="report-stepper-header__top">
        <div className="report-stepper-header__side">
          {currentStep > 0 ? (
            <button
              type="button"
              className="report-stepper-header__icon-button"
              onClick={onBack}
              aria-label="Previous report step"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
          ) : null}
        </div>

        <div className="report-stepper-header__copy">
          <span className="report-stepper-header__count">
            Step {currentStep + 1} of {steps.length}
          </span>
          <h1 ref={titleRef} className="report-stepper-header__title" tabIndex={-1}>
            {activeStep.title}
          </h1>
          <p className="report-stepper-header__description">{activeStep.description}</p>
        </div>

        <div className="report-stepper-header__side report-stepper-header__side--end">
          {onClose ? (
            <button
              type="button"
              className="report-stepper-header__icon-button report-stepper-header__close"
              onClick={onClose}
              aria-label="Close report"
            >
              <X size={19} strokeWidth={2.4} />
            </button>
          ) : null}
        </div>
      </div>

      <nav className="report-segmented-progress" aria-label="Report progress">
        <ol className="report-segmented-progress__list">
          {steps.map((step, index) => {
            const isActive = index === currentStep
            const isComplete = isStepComplete(index)
            const isOpen = canOpenStep(index)
            const state = isActive ? 'current' : isComplete ? 'complete' : isOpen ? 'available' : 'locked'

            return (
              <li key={step.title} className="report-segmented-progress__item" data-state={state}>
                <button
                  type="button"
                  className="report-segmented-progress__button"
                  disabled={!isOpen}
                  onClick={() => onStepSelect(index)}
                  title={getStepBlockedReason(index) || step.description}
                  aria-current={isActive ? 'step' : undefined}
                  aria-label={`${step.title}, ${
                    isActive ? 'current step' : isComplete ? 'complete' : isOpen ? 'available' : 'locked'
                  }`}
                >
                  <span className="report-segmented-progress__bar" aria-hidden="true">
                    {state === 'complete' ? (
                      <span className="report-segmented-progress__check">
                        <Check size={11} strokeWidth={3} />
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </nav>
    </header>
  )
}
