import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { getPublicHotspotContext, PublicReportDetailPage } from '@/pages/PublicReportDetailPage'

const getPublicReport = vi.fn()
const reportsService = { getPublicReport }

vi.mock('@/app/useServices', () => ({
  useServices: () => ({ reportsService }),
}))

vi.mock('@/pages/components/PredictionEvidencePanel', () => ({
  PredictionEvidencePanel: () => <div>evidence-panel</div>,
}))

vi.mock('@/pages/components/StaticReceiptMap', () => ({
  StaticReceiptMap: () => <div>location-map</div>,
}))

describe("getPublicHotspotContext", () => {
	it("presents core and warning with the same concise prioritized label", () => {
		const core = getPublicHotspotContext({
			priorityLevel: "core",
			priorityReason: "Within core radius.",
		});
		const warning = getPublicHotspotContext({
			priorityLevel: "warning",
			priorityReason: "Within warning radius.",
		});

		expect(core).toEqual(warning);
		expect(core).toEqual({
			state: "prioritized",
			badge: "Prioritized report",
		});
	});

	it("presents every non-prioritized value as a normal report", () => {
		expect(
			getPublicHotspotContext({
				priorityLevel: "routine",
				priorityReason: "Outside warning radius.",
			}),
		).toEqual({
			state: "normal",
			badge: "Normal report",
		});
		expect(getPublicHotspotContext(undefined)).toEqual({
			state: "normal",
			badge: "Normal report",
		});
		expect(
			getPublicHotspotContext({
				priorityLevel: "unavailable",
				priorityReason: "Mirror unavailable.",
			}),
		).toEqual(getPublicHotspotContext(undefined));
		expect(JSON.stringify(getPublicHotspotContext(undefined))).not.toContain("400");
	});
});

describe('PublicReportDetailPage presentation', () => {
  it('uses the shared public detail presentation and keeps map navigation', async () => {
    getPublicReport.mockResolvedValue({
      id: 'root-1',
      reference: 'KL-ROOT-0001',
      publicLocation: { latitude: 3.1, longitude: 101.7, source: 'public' },
      habitatClass: 'tire',
      prediction: {
        label: 'tire',
        confidence: 0.9,
        confidenceBand: 'high',
        advisoryText: 'Advisory only.',
        detections: [],
      },
      status: 'submitted',
      neighborhood: 'Bukit Jalil',
      reportedAt: '2026-07-12T10:00:00.000Z',
      latestReportedAt: '2026-07-12T12:00:00.000Z',
      reportCount: 1,
      thumbnailUrl: '/thumbnail.jpg',
      imageUrl: '/image.jpg',
      privacyNote: 'Public by consent.',
      hotspotPriority: { priorityLevel: 'routine', priorityReason: 'Routine.' },
      observations: [],
    })

    const { container } = render(
      <MemoryRouter initialEntries={['/map/reports/KL-ROOT-0001']}>
        <Routes>
          <Route path="/map/reports/:reference" element={<PublicReportDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('link', { name: 'Back to map' })).toHaveAttribute('href', '/map')
    expect(container.querySelector('[data-detail-mode="public"]')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Observation history' })).toBeInTheDocument()
    expect(screen.getByText('This location has 1 stacked citizen submission')).toBeInTheDocument()
    expect(screen.getByText('1 report')).toBeInTheDocument()
  })
})
