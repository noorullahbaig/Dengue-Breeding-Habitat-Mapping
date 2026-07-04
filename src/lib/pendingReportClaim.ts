const PENDING_REPORT_CLAIM_PREFIX = 'dwkl.report.claim.'

function claimKey(reference: string) {
  return `${PENDING_REPORT_CLAIM_PREFIX}${reference.trim().toUpperCase()}`
}

export function storePendingReportClaim(reference: string, claimToken: string) {
  if (typeof window === 'undefined' || !reference.trim() || !claimToken) return
  window.sessionStorage.setItem(claimKey(reference), claimToken)
}

export function readPendingReportClaim(reference: string) {
  if (typeof window === 'undefined' || !reference.trim()) return null
  return window.sessionStorage.getItem(claimKey(reference))
}

export function clearPendingReportClaim(reference: string) {
  if (typeof window === 'undefined' || !reference.trim()) return
  window.sessionStorage.removeItem(claimKey(reference))
}
