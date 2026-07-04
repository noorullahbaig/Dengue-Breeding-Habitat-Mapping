import {
  clearPendingReportClaim,
  readPendingReportClaim,
  storePendingReportClaim,
} from '@/lib/pendingReportClaim'

describe('pending report claims', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('keeps a private claim token in session storage and clears it after use', () => {
    storePendingReportClaim('kl-test-0001', 'private-token')

    expect(readPendingReportClaim('KL-TEST-0001')).toBe('private-token')

    clearPendingReportClaim('KL-TEST-0001')
    expect(readPendingReportClaim('KL-TEST-0001')).toBeNull()
  })
})
