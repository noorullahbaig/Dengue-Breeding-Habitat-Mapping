import type { LocationPoint } from '@/types/report'

export const KL_CENTER: LocationPoint = {
  latitude: 3.139,
  longitude: 101.6869,
  source: 'demo',
}

export const DEFAULT_MAP_ZOOM = 12
export const HOTSPOT_WARNING_RADIUS_METERS = 400
export const REVIEW_MAP_ZOOM = 15
export const STORAGE_KEY = 'dengue-prototype-submissions-v1'
export const LAST_REFERENCE_KEY = 'dengue-prototype-last-reference'
export const PUBLIC_REPORT_CONSENT_TEXT =
  'I confirm this image, exact pin, computer-vision advisory result, confidence, and detection evidence can be shown publicly on the prototype map as crowdsourced dengue habitat evidence.'
