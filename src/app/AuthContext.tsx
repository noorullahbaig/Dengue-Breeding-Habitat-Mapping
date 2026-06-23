import type { PropsWithChildren } from 'react'
import { createContext, useEffect, useState } from 'react'
import { authRuntimeConfig } from '@/app/authConfig'

const AUTH_SESSION_STORAGE_KEY = 'dwkl.auth.session'
const AUTH_ACTIVITY_STORAGE_KEY = 'dwkl.auth.activity'

export interface AuthUser {
  id: string
  email: string
  displayName: string
  provider: 'local' | 'cognito'
}

export interface SignInInput {
  email: string
  displayName?: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  providerTarget: 'mock' | 'cognito'
  sessionMode: 'local' | 'cognito'
  signIn: (input: SignInInput) => Promise<AuthUser>
  signOut: () => void
  trackReport: (reference: string) => void
  untrackReport: (reference: string) => void
  trackedReferences: string[]
}

export const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredSession() {
  if (typeof window === 'undefined') {
    return null
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return null
  }
}

function writeStoredSession(user: AuthUser | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!user) {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
    return
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(user))
}

function readTrackedReportsMap() {
  if (typeof window === 'undefined') {
    return {} as Record<string, string[]>
  }

  const raw = window.localStorage.getItem(AUTH_ACTIVITY_STORAGE_KEY)
  if (!raw) {
    return {} as Record<string, string[]>
  }

  try {
    return JSON.parse(raw) as Record<string, string[]>
  } catch {
    window.localStorage.removeItem(AUTH_ACTIVITY_STORAGE_KEY)
    return {} as Record<string, string[]>
  }
}

function writeTrackedReportsMap(nextValue: Record<string, string[]>) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AUTH_ACTIVITY_STORAGE_KEY, JSON.stringify(nextValue))
}

function sanitizeReference(reference: string) {
  return reference.trim().toUpperCase()
}

function buildDisplayName(email: string) {
  const [localPart] = email.split('@')
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function buildMockUser(input: SignInInput): AuthUser {
  const email = input.email.trim().toLowerCase()
  const displayName = input.displayName?.trim() || buildDisplayName(email) || 'Resident'

  return {
    id: `resident:${email}`,
    email,
    displayName,
    provider: authRuntimeConfig.sessionMode,
  }
}

interface AuthAdapter {
  restoreSession: () => AuthUser | null
  signIn: (input: SignInInput) => Promise<AuthUser>
  signOut: () => void
}

function createLocalSessionAdapter(): AuthAdapter {
  return {
    restoreSession: readStoredSession,
    async signIn(input) {
      const nextUser = buildMockUser(input)
      writeStoredSession(nextUser)
      return nextUser
    },
    signOut() {
      writeStoredSession(null)
    },
  }
}

const authAdapter = createLocalSessionAdapter()

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [trackedReferences, setTrackedReferences] = useState<string[]>([])

  useEffect(() => {
    const storedUser = authAdapter.restoreSession()
    setUser(storedUser)

    if (storedUser) {
      const trackedMap = readTrackedReportsMap()
      setTrackedReferences(trackedMap[storedUser.id] ?? [])
    }
  }, [])

  async function signIn(input: SignInInput) {
    const nextUser = await authAdapter.signIn(input)
    setUser(nextUser)

    const trackedMap = readTrackedReportsMap()
    setTrackedReferences(trackedMap[nextUser.id] ?? [])

    return nextUser
  }

  function signOut() {
    authAdapter.signOut()
    setUser(null)
    setTrackedReferences([])
  }

  function trackReport(reference: string) {
    if (!user) {
      return
    }

    const normalizedReference = sanitizeReference(reference)
    if (!normalizedReference) {
      return
    }

    const trackedMap = readTrackedReportsMap()
    const nextTrackedReferences = Array.from(
      new Set([normalizedReference, ...(trackedMap[user.id] ?? [])]),
    )
    const nextTrackedMap = {
      ...trackedMap,
      [user.id]: nextTrackedReferences,
    }

    writeTrackedReportsMap(nextTrackedMap)
    setTrackedReferences(nextTrackedReferences)
  }

  function untrackReport(reference: string) {
    if (!user) {
      return
    }

    const normalizedReference = sanitizeReference(reference)
    const trackedMap = readTrackedReportsMap()
    const nextTrackedReferences = (trackedMap[user.id] ?? []).filter(
      (item) => item !== normalizedReference,
    )
    const nextTrackedMap = {
      ...trackedMap,
      [user.id]: nextTrackedReferences,
    }

    writeTrackedReportsMap(nextTrackedMap)
    setTrackedReferences(nextTrackedReferences)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        providerTarget: authRuntimeConfig.providerTarget,
        sessionMode: authRuntimeConfig.sessionMode,
        signIn,
        signOut,
        trackReport,
        untrackReport,
        trackedReferences,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
