export interface CognitoConfig {
  region: string
  userPoolId: string
  userPoolClientId: string
  identityPoolId?: string
  hostedUiDomain?: string
  redirectSignIn?: string
  redirectSignOut?: string
}

export interface AuthRuntimeConfig {
  providerTarget: 'mock' | 'cognito'
  sessionMode: 'local' | 'cognito'
  cognito: CognitoConfig | null
  isHostedUiReady: boolean
  isAccountAvailable: boolean
  configurationError: string | null
}

export const cognitoOAuthScopes = ['openid', 'email', 'profile', 'phone'] as const

function readStringEnv(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function readCognitoConfig(env: Record<string, unknown>): CognitoConfig | null {
  const region = readStringEnv(env.VITE_COGNITO_REGION)
  const userPoolId = readStringEnv(env.VITE_COGNITO_USER_POOL_ID)
  const userPoolClientId = readStringEnv(env.VITE_COGNITO_USER_POOL_CLIENT_ID)
  const identityPoolId = readStringEnv(env.VITE_COGNITO_IDENTITY_POOL_ID)
  const hostedUiDomain = readStringEnv(env.VITE_COGNITO_HOSTED_UI_DOMAIN)
  const redirectSignIn = readStringEnv(env.VITE_COGNITO_REDIRECT_SIGN_IN)
  const redirectSignOut = readStringEnv(env.VITE_COGNITO_REDIRECT_SIGN_OUT)

  if (!region || !userPoolId || !userPoolClientId) {
    return null
  }

  return {
    region,
    userPoolId,
    userPoolClientId,
    identityPoolId: identityPoolId || undefined,
    hostedUiDomain: hostedUiDomain || undefined,
    redirectSignIn: redirectSignIn || undefined,
    redirectSignOut: redirectSignOut || undefined,
  }
}

export function resolveAuthRuntimeConfig(
  env: Record<string, unknown>,
  isProduction: boolean,
): AuthRuntimeConfig {
  const cognito = readCognitoConfig(env)
  const requestedMode = readStringEnv(env.VITE_AUTH_MODE)
  const productionRequiresCognito = isProduction && requestedMode !== 'local'
  const wantsCognito = requestedMode === 'local'
    ? false
    : requestedMode === 'cognito' || productionRequiresCognito || Boolean(cognito)
  const isOAuthConfigured = Boolean(
    cognito?.hostedUiDomain && cognito.redirectSignIn && cognito.redirectSignOut,
  )

  return {
    providerTarget: wantsCognito ? 'cognito' : 'mock',
    sessionMode: cognito && wantsCognito ? 'cognito' : 'local',
    cognito,
    isHostedUiReady: isOAuthConfigured,
    isAccountAvailable: !wantsCognito || Boolean(cognito),
    configurationError: wantsCognito && !cognito
      ? 'Account sign-in is unavailable because Cognito is not fully configured.'
      : null,
  }
}

const runtimeEnv = import.meta.env.MODE === 'test'
  ? { ...import.meta.env, VITE_AUTH_MODE: 'local' }
  : import.meta.env

export const authRuntimeConfig = resolveAuthRuntimeConfig(runtimeEnv, import.meta.env.PROD)
