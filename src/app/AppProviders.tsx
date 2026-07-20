import type { PropsWithChildren } from 'react'
import { AuthProvider } from '@/app/AuthContext'
import { ReportDraftProvider } from '@/app/ReportDraftContext'
import { PublicMapSessionProvider } from '@/app/PublicMapSessionContext'
import { ServicesProvider } from '@/app/ServicesContext'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <ServicesProvider>
        <ReportDraftProvider>
          <PublicMapSessionProvider>{children}</PublicMapSessionProvider>
        </ReportDraftProvider>
      </ServicesProvider>
    </AuthProvider>
  )
}
