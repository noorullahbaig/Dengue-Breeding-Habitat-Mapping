import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { PublicMapPage } from '@/pages/PublicMapPage'
import type { PublicHotspot, PublicMapReport } from '@/types/report'

const {
  listPublicReportsMock,
  listHotspotsMock,
  mapPropsSpy,
} = vi.hoisted(() => ({
  listPublicReportsMock: vi.fn(),
  listHotspotsMock: vi.fn(),
  mapPropsSpy: vi.fn(),
}))

vi.mock('@/app/useServices', () => ({
  useServices: () => ({
    mapService: {
      listPublicReports: listPublicReportsMock,
      listHotspots: listHotspotsMock,
    },
  }),
}))

vi.mock('@/features/public-map/PublicReportsMap', () => ({
  PublicReportsMap: (props: {
    reports: PublicMapReport[]
    hotspots: PublicHotspot[]
    showHotspots: boolean
    hotspotError?: string
  }) => {
    mapPropsSpy(props)
    return <div data-testid="public-reports-map">Public map</div>
  },
}))

describe('PublicMapPage', () => {
  beforeEach(() => {
    listPublicReportsMock.mockReset()
    listHotspotsMock.mockReset()
    mapPropsSpy.mockReset()
  })

  it('keeps report markers visible when hotspot loading fails and exposes the hotspot toggle', async () => {
    const user = userEvent.setup()

    listPublicReportsMock.mockResolvedValue([
      {
        id: 'report-1',
        reference: 'KL-TEST-1234',
        publicLocation: {
          latitude: 3.139,
          longitude: 101.6869,
          source: 'public',
        },
        habitatClass: 'tire',
        status: 'submitted',
        neighborhood: 'Cheras',
        reportedAt: '2026-04-20T01:00:00.000Z',
        latestReportedAt: '2026-04-20T01:00:00.000Z',
        reportCount: 1,
        thumbnailUrl: 'data:image/jpeg;base64,thumb',
        imageUrl: 'data:image/jpeg;base64,image',
        privacyNote: 'Public evidence marker.',
      },
    ] satisfies PublicMapReport[])
    listHotspotsMock.mockRejectedValue(new Error('source unavailable'))

    render(
      <MemoryRouter>
        <PublicMapPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('checkbox', { name: /show hotspot context/i })).toBeChecked()

    await waitFor(() => {
      expect(screen.getByTestId('public-reports-map')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(mapPropsSpy).toHaveBeenCalled()
    })

    const initialProps = mapPropsSpy.mock.calls.at(-1)?.[0]
    expect(initialProps.reports).toHaveLength(1)
    expect(initialProps.showHotspots).toBe(true)
    expect(initialProps.hotspotError).toMatch(/temporarily unavailable/i)
    expect(
      screen.getByRole('link', { name: /iDengue hotspot search/i }),
    ).toHaveAttribute('href', 'https://idengue.mysa.gov.my/hotspotutama.php')
    expect(
      screen.getByText(
        /circles show a 200 m hotspot core and a 400 m warning buffer proxy from the iDengue hotspot point, not an official boundary/i,
      ),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /show hotspot context/i }))

    await waitFor(() => {
      expect(mapPropsSpy.mock.calls.at(-1)?.[0].showHotspots).toBe(false)
    })
  })

  it('renders the live hotspot table as passive English context', async () => {
    listPublicReportsMock.mockResolvedValue([] satisfies PublicMapReport[])
    listHotspotsMock.mockResolvedValue([
      {
        id: 'hotspot-1',
        locality: 'Palm Court',
        district: 'Lembah Pantai',
        center: {
          latitude: 3.12,
          longitude: 101.68,
          source: 'public',
        },
        radiusMeters: 200,
        cumulativeCases: 8,
        outbreakDurationDays: 67,
        outbreakStartDate: '2026-02-18T00:00:00.000Z',
        weekNumber: 16,
        year: 2026,
        snapshotDate: '2026-04-20T00:00:00.000Z',
        sourceLabel: 'iDengue hotspot context',
      },
      {
        id: 'hotspot-2',
        locality: 'Desa Tasik',
        district: 'Cheras',
        center: {
          latitude: 3.09,
          longitude: 101.74,
          source: 'public',
        },
        radiusMeters: 200,
        cumulativeCases: 14,
        outbreakDurationDays: 61,
        outbreakStartDate: '2026-03-18T00:00:00.000Z',
        weekNumber: 16,
        year: 2026,
        snapshotDate: '2026-04-20T00:00:00.000Z',
        sourceLabel: 'iDengue hotspot context',
      },
    ] satisfies PublicHotspot[])

    render(
      <MemoryRouter>
        <PublicMapPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/wilayah persekutuan hotspot context/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/week 16 \/ 2026/i)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'No.' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Locality' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'District' })).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Cumulative outbreak cases' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Outbreak start date' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Outbreak duration' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /palm court/i })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: /desa tasik/i })).toBeInTheDocument()
    expect(screen.queryByText(/map zoom/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/browse hotspots/i)).not.toBeInTheDocument()
    expect(mapPropsSpy.mock.calls.at(-1)?.[0]).not.toHaveProperty('selectedHotspotId')
    expect(mapPropsSpy.mock.calls.at(-1)?.[0]).not.toHaveProperty('onSelectHotspot')
  })
})
