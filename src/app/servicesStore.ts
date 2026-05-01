import { createContext } from 'react'
import type { AppServices } from '@/services/contracts'

export const ServicesContext = createContext<AppServices | null>(null)
