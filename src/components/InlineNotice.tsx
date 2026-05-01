import type { PropsWithChildren } from 'react'

interface InlineNoticeProps extends PropsWithChildren {
  tone?: 'neutral' | 'warning' | 'success'
}

export function InlineNotice({
  children,
  tone = 'neutral',
}: InlineNoticeProps) {
  return <div className={`inline-notice inline-notice--${tone}`}>{children}</div>
}
