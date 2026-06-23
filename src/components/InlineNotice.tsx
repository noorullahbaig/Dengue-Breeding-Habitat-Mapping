import type { PropsWithChildren } from 'react'
import { Notice } from '@/components/ui'

interface InlineNoticeProps extends PropsWithChildren {
  tone?: 'neutral' | 'warning' | 'success'
}

export function InlineNotice({
  children,
  tone = 'neutral',
}: InlineNoticeProps) {
  return (
    <Notice
      tone={tone === 'neutral' ? 'info' : tone}
      className={`inline-notice inline-notice--${tone}`}
    >
      {children}
    </Notice>
  )
}
