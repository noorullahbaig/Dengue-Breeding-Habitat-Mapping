import type { ReactNode } from 'react'
import { PageHeader } from '@/components/ui'

interface SectionHeadingProps {
  eyebrow: string
  title: string
  description: string
  variant?: 'default' | 'compact'
  actions?: ReactNode
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  actions,
  variant = 'default',
}: SectionHeadingProps) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
      compact={variant === 'compact'}
      className={`section-heading section-heading--${variant}`}
    />
  )
}
