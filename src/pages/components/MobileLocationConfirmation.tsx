import { Button } from "@/components/ui"

interface MobileLocationConfirmationProps {
  status: string
  tone: 'default' | 'valid' | 'warning'
  disabled: boolean
  onConfirm: () => void
}

export function MobileLocationConfirmation({
  status,
  tone,
  disabled,
  onConfirm,
}: MobileLocationConfirmationProps) {
  const toneClass =
    tone === 'default' ? '' : ` report-location-sheet__status--${tone}`

  return (
    <div className="report-location-confirmation-panel">
      <div className="report-location-sheet">
        <p className={`report-location-sheet__status${toneClass}`}>{status}</p>
        <Button
          variant="primary"
          className="report-location-sheet__confirm"
          disabled={disabled}
          onClick={onConfirm}
        >
          Confirm this exact site
        </Button>
      </div>
    </div>
  )
}
