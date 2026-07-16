import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AppProviders } from '@/app/AppProviders'
import { AppRoutes } from '@/app/AppRoutes'
import { cognitoOAuthScopes, authRuntimeConfig } from '@/app/authConfig'
import 'leaflet/dist/leaflet.css'
import '@/styles/layers.css'
import '@/styles/tokens.css'
import '@/styles/ui.css'
import '@/styles/stitch.css'
import '@/styles/map.css'
import '@/styles/report.css'
import '@/styles/home.css'
import '@/styles/learn.css'
import { Amplify } from 'aws-amplify'

if (authRuntimeConfig.cognito) {
  const { userPoolId, userPoolClientId, hostedUiDomain, redirectSignIn, redirectSignOut } = authRuntimeConfig.cognito
  
  const oauthConfig = hostedUiDomain && redirectSignIn && redirectSignOut ? {
    domain: hostedUiDomain,
    scopes: [...cognitoOAuthScopes],
    redirectSignIn: [redirectSignIn],
    redirectSignOut: [redirectSignOut],
    responseType: 'code' as const
  } : undefined

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: oauthConfig ? { oauth: oauthConfig } : undefined,
      }
    }
  })
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found.')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </BrowserRouter>
  </StrictMode>,
)
