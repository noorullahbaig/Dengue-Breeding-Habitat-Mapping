import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react'
import type { HabitatClass, LocationPoint } from '@/types/report'

export type PublicMapHabitatFilter = HabitatClass | 'all'

export interface MapViewport {
  center: [number, number]
  zoom: number
}

export interface MapReportSelection {
  kind: 'report'
  reportReferences: string[]
  center: [number, number]
  isExactStack: boolean
  totalReportCount: number
  selectedReportReference?: string
}

export interface MapHotspotSelection {
  kind: 'hotspot'
  hotspotId: string
}

export type MapSelection = MapReportSelection | MapHotspotSelection

export interface UserLocationFix {
  location: LocationPoint
  obtainedAt: number
}

export interface PublicMapSessionState {
  viewport?: MapViewport
  habitatFilter: PublicMapHabitatFilter
  selection?: MapSelection
  userLocationFix?: UserLocationFix
}

interface PublicMapSessionValue {
  session: PublicMapSessionState
  patchSession: (patch: Partial<PublicMapSessionState>) => void
}

const PublicMapSessionContext = createContext<PublicMapSessionValue | null>(null)

const DEFAULT_SESSION: PublicMapSessionState = {
  habitatFilter: 'all',
}

export function PublicMapSessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<PublicMapSessionState>(DEFAULT_SESSION)

  const patchSession = useCallback((patch: Partial<PublicMapSessionState>) => {
    setSession((current) => ({ ...current, ...patch }))
  }, [])

  const value = useMemo(() => ({ session, patchSession }), [patchSession, session])

  return (
    <PublicMapSessionContext.Provider value={value}>
      {children}
    </PublicMapSessionContext.Provider>
  )
}

export function usePublicMapSession() {
  const value = useContext(PublicMapSessionContext)

  if (!value) {
    throw new Error('usePublicMapSession must be used within PublicMapSessionProvider.')
  }

  return value
}
