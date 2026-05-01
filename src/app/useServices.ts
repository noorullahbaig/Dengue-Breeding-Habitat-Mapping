import { useContext } from 'react'
import { ServicesContext } from '@/app/servicesStore'

export function useServices() {
  const value = useContext(ServicesContext)

  if (!value) {
    throw new Error('useServices must be used within ServicesProvider.')
  }

  return value
}
