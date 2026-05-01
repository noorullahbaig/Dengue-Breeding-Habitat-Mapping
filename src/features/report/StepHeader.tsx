interface StepHeaderProps {
  currentStep: number
  totalSteps: number
  title: string
  description: string
}

export function StepHeader({
  currentStep,
  totalSteps,
  title,
  description,
}: StepHeaderProps) {
  return (
    <div className="step-header">
      <span className="step-header__eyebrow">
        Step {currentStep} of {totalSteps}
      </span>
      <h2 className="step-header__title">{title}</h2>
      <p className="step-header__description">{description}</p>
    </div>
  )
}
