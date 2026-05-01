import { useState, type PropsWithChildren } from 'react'
import { createApiAppServices } from '@/services/apiServices'
import { createMockAppServices } from '@/mocks/mockServices'
import { ServicesContext } from '@/app/servicesStore'
import type { AppServices } from '@/services/contracts'

export function ServicesProvider({ children }: PropsWithChildren) {
  const [services] = useState<AppServices>(() => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
    const shouldUseApi = import.meta.env.MODE !== 'test' && Boolean(apiBaseUrl)
    return shouldUseApi && apiBaseUrl ? createApiAppServices(apiBaseUrl) : createMockAppServices()
  })

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}
