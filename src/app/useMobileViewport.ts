import { useEffect, useState } from 'react'
import { MOBILE_VIEWPORT_MEDIA_QUERY } from '@/app/layoutConstants'

export function useMobileViewport() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY)
    const update = () => setIsMobile(media.matches)

    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return isMobile
}
