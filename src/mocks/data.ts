import type { SubmittedReport } from '@/types/report'

export const seededReports: SubmittedReport[] = [
  {
    id: 'seed-cheras-1',
    reference: 'KL-CHERAS-2410',
    createdAt: '2026-04-18T10:14:00.000Z',
    reportLocation: {
      latitude: 3.0928,
      longitude: 101.7436,
      source: 'browser',
      accuracyMeters: 18,
    },
    publicLocation: {
      latitude: 3.095,
      longitude: 101.745,
      source: 'public',
    },
    status: 'under_review',
    prediction: {
      label: 'drain_inlet',
      confidenceBand: 'moderate',
      advisoryText:
        'Advisory only. Officers still review the image, location, and hotspot context before any action is recorded.',
    },
    neighborhood: 'Cheras',
    statusMessage: 'Queued for officer review with map context.',
    notes: 'Drain inlet with standing water near a walkway.',
  },
  {
    id: 'seed-bukit-jalil-1',
    reference: 'KL-BJALIL-1922',
    createdAt: '2026-04-19T06:48:00.000Z',
    reportLocation: {
      latitude: 3.0589,
      longitude: 101.6846,
      source: 'manual',
    },
    publicLocation: {
      latitude: 3.06,
      longitude: 101.685,
      source: 'public',
    },
    status: 'prioritized',
    prediction: {
      label: 'tire',
      confidenceBand: 'high',
      advisoryText:
        'Advisory only. Officers still review the image, location, and hotspot context before any action is recorded.',
    },
    neighborhood: 'Bukit Jalil',
    statusMessage: 'Flagged for faster follow-up because the area aligns with active hotspot context.',
    notes: 'Discarded tire behind a fence.',
  },
  {
    id: 'seed-kepong-1',
    reference: 'KL-KEPONG-8024',
    createdAt: '2026-04-16T13:05:00.000Z',
    reportLocation: {
      latitude: 3.2146,
      longitude: 101.6278,
      source: 'browser',
      accuracyMeters: 24,
    },
    publicLocation: {
      latitude: 3.215,
      longitude: 101.63,
      source: 'public',
    },
    status: 'action_recorded',
    prediction: {
      label: 'artificial_container',
      confidenceBand: 'moderate',
      advisoryText:
        'Advisory only. Officers still review the image, location, and hotspot context before any action is recorded.',
    },
    neighborhood: 'Kepong',
    statusMessage: 'An officer logged follow-up activity for this report.',
    notes: 'Plastic container collecting rainwater.',
  },
]
