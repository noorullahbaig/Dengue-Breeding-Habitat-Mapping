import { useState, type PropsWithChildren } from 'react'
import { createApiAppServices } from '@/services/apiServices'
import { createMockAppServices } from '@/mocks/mockServices'
import { ServicesContext } from '@/app/servicesStore'
import type { AppServices } from '@/services/contracts'
import { API_BASE_URL } from '@/config'

export function ServicesProvider({ children }: PropsWithChildren) {
  const [services] = useState<AppServices>(() => {
    // If not in test mode, we always use the API_BASE_URL (defaults to /api if not set)
    const shouldUseApi = import.meta.env.MODE !== 'test'
    return shouldUseApi ? createApiAppServices(API_BASE_URL) : createMockAppServices()
  })

  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
}
