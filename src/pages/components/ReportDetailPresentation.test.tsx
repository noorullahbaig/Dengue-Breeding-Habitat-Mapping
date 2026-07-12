import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ReportDetailPresentation } from '@/pages/components/ReportDetailPresentation'

vi.mock('@/pages/components/PredictionEvidencePanel', () => ({
  PredictionEvidencePanel: () => <div>evidence-panel</div>,
}))

vi.mock('@/pages/components/StaticReceiptMap', () => ({
  StaticReceiptMap: () => <div>location-map</div>,
}))

const baseModel = {
  mode: 'owner' as const,
  backTo: '/activity',
  backLabel: 'Back to My Reports',
  reference: 'KL-OWNER-0001',
  status: 'submitted' as const,
  neighborhood: 'Bukit Jalil',
  eyebrow: 'Your private report details',
  evidence: {
    prediction: {
      label: 'tire' as const,
      confidence: 0.9,
      confidenceBand: 'high' as const,
      advisoryText: 'Advisory only.',
      detections: [],
    },
    imageUrl: '/image.jpg',
    imageAlt: 'Evidence',
    description: 'Your submitted photo and model result',
  },
  location: {
    point: { latitude: 3.1, longitude: 101.7, source: 'public' as const },
    description: 'Public location used on the map',
  },
  metadata: [{ label: 'Submitted', value: '12 Jul 2026' }],
}

describe('ReportDetailPresentation', () => {
  it('renders the shared report structure from a normalized model', () => {
    render(
      <MemoryRouter>
        <ReportDetailPresentation model={baseModel} />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Back to My Reports' })).toHaveAttribute('href', '/activity')
    expect(screen.getByRole('heading', { name: 'Bukit Jalil' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Evidence review' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Location context' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Report metadata' })).toBeInTheDocument()
    expect(screen.getByText('evidence-panel')).toBeInTheDocument()
    expect(screen.getByText('location-map')).toBeInTheDocument()
  })

  it('renders mode-specific slots without changing the shared structure', () => {
    render(
      <MemoryRouter>
        <ReportDetailPresentation
          model={{ ...baseModel, mode: 'public', backTo: '/map', backLabel: 'Back to map' }}
          primaryAfterEvidence={<section aria-label="Observation history">history</section>}
          locationAfterMap={<div>hotspot context</div>}
          metadataAfter={<div>privacy note</div>}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: 'Back to map' })).toHaveAttribute('href', '/map')
    expect(screen.getByRole('region', { name: 'Observation history' })).toBeInTheDocument()
    expect(screen.getByText('hotspot context')).toBeInTheDocument()
    expect(screen.getByText('privacy note')).toBeInTheDocument()
  })
})
