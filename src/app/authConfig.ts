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
}

function readStringEnv(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
}

function readCognitoConfig(): CognitoConfig | null {
  const region = readStringEnv(import.meta.env.VITE_COGNITO_REGION)
  const userPoolId = readStringEnv(import.meta.env.VITE_COGNITO_USER_POOL_ID)
  const userPoolClientId = readStringEnv(import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID)
  const identityPoolId = readStringEnv(import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID)
  const hostedUiDomain = readStringEnv(import.meta.env.VITE_COGNITO_HOSTED_UI_DOMAIN)
  const redirectSignIn = readStringEnv(import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN)
  const redirectSignOut = readStringEnv(import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT)

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

const cognito = readCognitoConfig()
const isHostedUiReady = Boolean(
  cognito?.hostedUiDomain && cognito.redirectSignIn && cognito.redirectSignOut,
)

export const authRuntimeConfig: AuthRuntimeConfig = {
  providerTarget: cognito ? 'cognito' : 'mock',
  sessionMode: isHostedUiReady ? 'cognito' : 'local',
  cognito,
  isHostedUiReady,
}
