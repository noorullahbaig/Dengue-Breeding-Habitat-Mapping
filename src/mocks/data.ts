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
    status: 'submitted',
    prediction: {
      label: 'drain_inlet',
      confidence: 0.62,
      confidenceBand: 'low',
      topRawLabel: 'Drain-Inlet',
      detections: [{ rawLabel: 'Drain-Inlet', confidence: 0.62, bbox: [36, 30, 280, 210] }],
      advisoryText:
        'The image is ambiguous; human verification is required.',
    },
    neighborhood: 'Cheras',
    statusMessage: 'Report received and available for tracking.',
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
    status: 'submitted',
    prediction: {
      label: 'tire',
      confidence: 0.88,
      confidenceBand: 'high',
      topRawLabel: 'Tire',
      detections: [{ rawLabel: 'Tire', confidence: 0.88, bbox: [54, 42, 300, 238] }],
      advisoryText:
        'The model is highly confident in this detection, but final verification is still required.',
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
    status: 'submitted',
    prediction: {
      label: 'artificial_container',
      confidence: 0.67,
      confidenceBand: 'high',
      topRawLabel: 'Bottle',
      detections: [{ rawLabel: 'Bottle', confidence: 0.67, bbox: [70, 52, 250, 230] }],
      advisoryText:
        'The model is highly confident in this detection, but final verification is still required.',
    },
    neighborhood: 'Kepong',
    statusMessage: 'Report received and available for tracking.',
    notes: 'Plastic container collecting rainwater.',
  },
]
