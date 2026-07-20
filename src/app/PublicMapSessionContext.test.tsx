import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import {
  PublicMapSessionProvider,
  usePublicMapSession,
} from '@/app/PublicMapSessionContext'

function SessionConsumer() {
  const { session, patchSession } = usePublicMapSession()

  return (
    <div>
      <output data-testid="viewport">
        {session.viewport
          ? `${session.viewport.center.join(',')}@${session.viewport.zoom}`
          : 'no viewport'}
      </output>
      <output data-testid="filter">{session.habitatFilter}</output>
      <output data-testid="selection">
        {session.selection?.kind === 'report'
          ? session.selection.selectedReportReference
          : 'no selection'}
      </output>
      <button
        type="button"
        onClick={() => patchSession({
          viewport: { center: [3.139, 101.6869], zoom: 17 },
          habitatFilter: 'tire',
          selection: {
            kind: 'report',
            reportReferences: ['KL-TEST-0001'],
            center: [3.139, 101.6869],
            isExactStack: false,
            totalReportCount: 1,
            selectedReportReference: 'KL-TEST-0001',
          },
        })}
      >
        Save map state
      </button>
    </div>
  )
}

function RemountHarness() {
  const [visible, setVisible] = useState(true)

  return (
    <PublicMapSessionProvider>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle map
      </button>
      {visible ? <SessionConsumer /> : null}
    </PublicMapSessionProvider>
  )
}

describe('PublicMapSessionProvider', () => {
  it('retains viewport, filter, and report selection while the map child remounts', async () => {
    const user = userEvent.setup()
    render(<RemountHarness />)

    expect(screen.getByTestId('filter')).toHaveTextContent('all')
    await user.click(screen.getByRole('button', { name: 'Save map state' }))
    await user.click(screen.getByRole('button', { name: 'Toggle map' }))
    await user.click(screen.getByRole('button', { name: 'Toggle map' }))

    expect(screen.getByTestId('viewport')).toHaveTextContent('3.139,101.6869@17')
    expect(screen.getByTestId('filter')).toHaveTextContent('tire')
    expect(screen.getByTestId('selection')).toHaveTextContent('KL-TEST-0001')
  })
})
