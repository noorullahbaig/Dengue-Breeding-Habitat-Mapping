import type { PropsWithChildren } from 'react'
import { AuthProvider } from '@/app/AuthContext'
import { ReportDraftProvider } from '@/app/ReportDraftContext'
import { ServicesProvider } from '@/app/ServicesContext'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ServicesProvider>
      <AuthProvider>
        <ReportDraftProvider>{children}</ReportDraftProvider>
      </AuthProvider>
    </ServicesProvider>
  )
}
