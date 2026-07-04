import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ReportOverlay } from '@/app/ReportOverlay'
import { ReportDraftContext } from '@/app/reportDraftStore'

const resetDraft = vi.fn()

function renderOverlay() {
  return render(
    <MemoryRouter initialEntries={['/report']}>
      <ReportDraftContext.Provider
        value={{
          draft: { photoPreviewUrl: 'blob:report-evidence', wizardStep: 2 },
          updateDraft: vi.fn(),
          resetDraft,
          lastSubmittedReference: '',
          setLastSubmittedReference: vi.fn(),
        }}
      >
        <div className="app-shell">Background application</div>
        <ReportOverlay routeState={{ promptForDraft: true }}>
          {() => <div>Active report flow</div>}
        </ReportOverlay>
      </ReportDraftContext.Provider>
    </MemoryRouter>,
  )
}

describe('ReportOverlay draft recovery', () => {
  beforeEach(() => {
    resetDraft.mockClear()
  })

  it('offers to resume an unfinished report', async () => {
    const user = userEvent.setup()
    renderOverlay()

    expect(screen.getByRole('heading', { name: 'Continue where you left off?' })).toBeInTheDocument()
    expect(screen.getByTestId('brand-logo')).toHaveAttribute('data-variant', 'mark')
    expect(screen.getByTestId('brand-logo')).toHaveAttribute('data-treatment', 'framed')
    await user.click(screen.getByRole('button', { name: 'Resume report' }))

    expect(screen.getByText('Active report flow')).toBeInTheDocument()
    expect(resetDraft).not.toHaveBeenCalled()
  })

  it('discards the draft before starting over', async () => {
    const user = userEvent.setup()
    renderOverlay()

    await user.click(screen.getByRole('button', { name: 'Start over' }))

    expect(resetDraft).toHaveBeenCalledOnce()
    expect(screen.getByText('Active report flow')).toBeInTheDocument()
  })
})
