import type { PropsWithChildren } from 'react'
import { createContext, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authRuntimeConfig } from '@/app/authConfig'
import { signIn as cognitoSignIn, signUp as cognitoSignUp, confirmSignUp as cognitoConfirmSignUp, signInWithRedirect, signOut as cognitoSignOut, getCurrentUser, fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth'
import { Hub } from 'aws-amplify/utils'

const AUTH_SESSION_STORAGE_KEY = 'dwkl.auth.session'
const AUTH_ACTIVITY_STORAGE_KEY = 'dwkl.auth.activity'
const OAUTH_REDIRECT_STORAGE_KEY = 'dwkl.oauth.redirect'

// Capture the custom OAuth state on boot, before React component trees mount
if (typeof window !== 'undefined') {
  Hub.listen('auth', ({ payload }) => {
    if (payload.event === 'customOAuthState' && payload.data) {
      window.sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, payload.data)
    }
  })
}

export interface AuthUser {
  id: string
  email: string
  displayName: string
  photoUrl?: string
  provider: 'local' | 'cognito'
}

export interface SignInInput {
  email: string
  password?: string
}

export interface SignUpInput {
  email: string
  password?: string
  displayName: string
}

export interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  providerTarget: 'mock' | 'cognito'
  sessionMode: 'local' | 'cognito'
  signIn: (input: SignInInput) => Promise<AuthUser>
  signUp: (input: SignUpInput) => Promise<void>
  confirmSignUp: (email: string, code: string) => Promise<void>
  signInWithGoogle: (redirectPath?: string) => Promise<void>
  signInWithHostedUI: (redirectPath?: string) => Promise<void>
  signOut: () => Promise<void>
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

function buildMockUser(input: { email: string; displayName?: string }): AuthUser {
  const email = (input.email || '').trim().toLowerCase()
  const displayName = input.displayName?.trim() || buildDisplayName(email) || 'Resident'

  return {
    id: `resident:${email}`,
    email,
    displayName,
    provider: authRuntimeConfig.sessionMode,
  }
}

interface AuthAdapter {
  restoreSession: () => Promise<AuthUser | null>
  signIn: (input: SignInInput) => Promise<AuthUser>
  signUp: (input: SignUpInput) => Promise<void>
  confirmSignUp: (email: string, code: string) => Promise<void>
  signInWithGoogle: (redirectPath?: string) => Promise<void>
  signInWithHostedUI: (redirectPath?: string) => Promise<void>
  signOut: () => Promise<void>
}

function createLocalSessionAdapter(): AuthAdapter {
  return {
    async restoreSession() {
      return readStoredSession()
    },
    async signIn(input) {
      const nextUser = buildMockUser(input)
      writeStoredSession(nextUser)
      return nextUser
    },
    async signUp(_input) {
      // Mock signup
    },
    async confirmSignUp(_email, _code) {
      // Mock confirm
    },
    async signInWithGoogle(redirectPath) {
      if (redirectPath) {
        window.sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, redirectPath)
      }
      const nextUser = buildMockUser({ email: 'google@example.com' })
      writeStoredSession(nextUser)
    },
    async signInWithHostedUI(redirectPath) {
      if (redirectPath) {
        window.sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, redirectPath)
      }
      const nextUser = buildMockUser({ email: 'hostedui@example.com' })
      writeStoredSession(nextUser)
    },
    async signOut() {
      writeStoredSession(null)
    },
  }
}

function createCognitoSessionAdapter(): AuthAdapter {
  return {
    async restoreSession() {
      try {
        const session = await fetchAuthSession()
        if (!session.tokens) return null

        const user = await getCurrentUser()
        
        let attributes: Record<string, string> = {}
        try {
          attributes = await fetchUserAttributes()
        } catch (e) {
          console.warn('Could not fetch attributes', e)
        }

        const payload = session.tokens.idToken?.payload || {}

        return {
          id: user.userId,
          email: attributes.email || (payload.email as string) || user.signInDetails?.loginId || '',
          displayName: attributes.name || (payload.name as string) || attributes.given_name || (payload.given_name as string) || user.username || 'User',
          photoUrl: attributes.picture || (payload.picture as string),
          provider: 'cognito',
        }
      } catch (err) {
        return null
      }
    },
    async signIn(input) {
      if (!input.password) throw new Error('Password required for sign in')
      const result = await cognitoSignIn({ username: input.email, password: input.password })
      if (result.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
        throw new Error('Please confirm your email address first.')
      }
      if (result.nextStep.signInStep !== 'DONE') {
        throw new Error(`Additional step required: ${result.nextStep.signInStep}`)
      }
      const restored = await this.restoreSession()
      if (!restored) throw new Error('Failed to restore session after sign in')
      return restored
    },
    async signUp(input) {
      if (!input.password) throw new Error('Password required for sign up')
      await cognitoSignUp({
        username: input.email,
        password: input.password,
        options: {
          userAttributes: {
            email: input.email,
            name: input.displayName,
          }
        }
      })
    },
    async confirmSignUp(email, code) {
      await cognitoConfirmSignUp({ username: email, confirmationCode: code })
    },
    async signInWithGoogle(redirectPath) {
      const customState = redirectPath || '/activity'
      await signInWithRedirect({ provider: 'Google', customState })
    },
    async signInWithHostedUI(redirectPath) {
      const customState = redirectPath || '/activity'
      await signInWithRedirect({ customState })
    },
    async signOut() {
      await cognitoSignOut()
    },
  }
}

const authAdapter = authRuntimeConfig.sessionMode === 'cognito' 
  ? createCognitoSessionAdapter() 
  : createLocalSessionAdapter()

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [trackedReferences, setTrackedReferences] = useState<string[]>([])

  const navigate = useNavigate()

  useEffect(() => {
    let isMounted = true

    async function initSession() {
      const storedUser = await authAdapter.restoreSession()
      if (!isMounted) return

      setUser(storedUser)
      if (storedUser) {
        const trackedMap = readTrackedReportsMap()
        setTrackedReferences(trackedMap[storedUser.id] ?? [])
        
        // Handle deferred OAuth redirect (Google Sign In)
        const pendingRedirect = window.sessionStorage.getItem(OAUTH_REDIRECT_STORAGE_KEY)
        if (pendingRedirect) {
          window.sessionStorage.removeItem(OAUTH_REDIRECT_STORAGE_KEY)
          navigate(pendingRedirect)
        }
      }
    }
    
    initSession()

    // Listen for other Cognito OAuth events
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signInWithRedirect':
          // OAuth sign-in completed (e.g. Google) — restore session
          initSession()
          break
        case 'signInWithRedirect_failure':
          console.error('OAuth sign in failed', payload.data)
          break
      }
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [navigate])

  async function signIn(input: SignInInput) {
    const nextUser = await authAdapter.signIn(input)
    if (nextUser.id) {
      setUser(nextUser)
      const trackedMap = readTrackedReportsMap()
      setTrackedReferences(trackedMap[nextUser.id] ?? [])
    }
    return nextUser
  }
  
  async function signUp(input: SignUpInput) {
    await authAdapter.signUp(input)
  }

  async function confirmSignUp(email: string, code: string) {
    await authAdapter.confirmSignUp(email, code)
  }

  async function signInWithGoogle(redirectPath?: string) {
    if (redirectPath) {
      window.sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, redirectPath)
    }
    if (authRuntimeConfig.sessionMode === 'local') {
      const nextUser = buildMockUser({ email: 'google@example.com' })
      writeStoredSession(nextUser)
      setUser(nextUser)
      if (redirectPath) navigate(redirectPath)
    } else {
      await authAdapter.signInWithGoogle(redirectPath)
    }
  }

  async function signInWithHostedUI(redirectPath?: string) {
    if (redirectPath) {
      window.sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, redirectPath)
    }
    if (authRuntimeConfig.sessionMode === 'local') {
      const nextUser = buildMockUser({ email: 'hostedui@example.com' })
      writeStoredSession(nextUser)
      setUser(nextUser)
      if (redirectPath) navigate(redirectPath)
    } else {
      await authAdapter.signInWithHostedUI(redirectPath)
    }
  }

  async function signOut() {
    await authAdapter.signOut()
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
        signUp,
        confirmSignUp,
        signInWithGoogle,
        signInWithHostedUI,
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
