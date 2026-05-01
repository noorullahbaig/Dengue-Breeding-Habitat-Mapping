import type { PropsWithChildren } from 'react'
import { ReportDraftProvider } from '@/app/ReportDraftContext'
import { ServicesProvider } from '@/app/ServicesContext'

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ServicesProvider>
      <ReportDraftProvider>{children}</ReportDraftProvider>
    </ServicesProvider>
  )
}
