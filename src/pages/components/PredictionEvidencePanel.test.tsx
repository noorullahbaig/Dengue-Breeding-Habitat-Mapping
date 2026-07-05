import { fireEvent, render, screen } from '@testing-library/react'
import { PredictionEvidencePanel } from '@/pages/components/PredictionEvidencePanel'
import type { PredictionSummary } from '@/types/report'

const prediction: PredictionSummary = {
  label: 'artificial_container',
  confidenceBand: 'moderate',
  advisoryText: 'Advisory only.',
  detections: [
    {
      rawLabel: 'artificial_container',
      confidence: 0.91,
      bbox: [10, 20, 160, 180],
      bboxNormalized: [0.1, 0.2, 0.6, 0.7],
    },
  ],
}

describe('PredictionEvidencePanel', () => {
  it('renders the preview image and contained normalized bounding boxes after load', () => {
    render(
      <PredictionEvidencePanel
        prediction={prediction}
        imageUrl="blob:preview"
        imageAlt="Submitted evidence preview"
        showDetections
      />,
    )

    const image = screen.getByRole('img', { name: 'Submitted evidence preview' })
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 1200 })
    Object.defineProperty(image, 'naturalHeight', { configurable: true, value: 900 })

    fireEvent.load(image)

    const box = screen.getByText(/Artificial container 91%/i).closest('.prediction-evidence__box')
    expect(box).not.toBeNull()
    expect(box).toHaveStyle({ left: '10%', top: '20%', width: '50%' })
    expect(Number.parseFloat(box?.style.height ?? '0')).toBeCloseTo(50, 3)
  })

  it('shows a visible failure state when the preview image cannot load', () => {
    render(
      <PredictionEvidencePanel
        prediction={prediction}
        imageUrl="blob:missing-preview"
        imageAlt="Submitted evidence preview"
        showDetections
      />,
    )

    const image = screen.getByRole('img', { name: 'Submitted evidence preview' })
    fireEvent.error(image)

    expect(screen.getByText('Evidence preview unavailable')).toBeInTheDocument()
    expect(screen.getByText(/The image could not be loaded/i)).toBeInTheDocument()
  })
})
