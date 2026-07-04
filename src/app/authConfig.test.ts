import { resolveAuthRuntimeConfig } from '@/app/authConfig'
import { cognitoOAuthScopes } from '@/app/authConfig'

describe('resolveAuthRuntimeConfig', () => {
  it('does not silently enable mock accounts in an unconfigured production build', () => {
    const config = resolveAuthRuntimeConfig({}, true)

    expect(config.providerTarget).toBe('cognito')
    expect(config.sessionMode).toBe('local')
    expect(config.isAccountAvailable).toBe(false)
    expect(config.configurationError).toMatch(/not fully configured/i)
  })

  it('allows an explicit local account mode for deliberate local builds', () => {
    const config = resolveAuthRuntimeConfig({
      VITE_AUTH_MODE: 'local',
      VITE_COGNITO_REGION: 'ap-southeast-1',
      VITE_COGNITO_USER_POOL_ID: 'pool',
      VITE_COGNITO_USER_POOL_CLIENT_ID: 'client',
    }, true)

    expect(config.providerTarget).toBe('mock')
    expect(config.sessionMode).toBe('local')
    expect(config.isAccountAvailable).toBe(true)
  })

  it('enables Cognito only when all required browser settings are present', () => {
    const config = resolveAuthRuntimeConfig({
      VITE_AUTH_MODE: 'cognito',
      VITE_COGNITO_REGION: 'ap-southeast-1',
      VITE_COGNITO_USER_POOL_ID: 'pool',
      VITE_COGNITO_USER_POOL_CLIENT_ID: 'client',
    }, true)

    expect(config.sessionMode).toBe('cognito')
    expect(config.isAccountAvailable).toBe(true)
  })

  it('always requests the Google profile scope needed for name and picture claims', () => {
    expect(cognitoOAuthScopes).toEqual(expect.arrayContaining(['openid', 'email', 'profile']))
  })
})
