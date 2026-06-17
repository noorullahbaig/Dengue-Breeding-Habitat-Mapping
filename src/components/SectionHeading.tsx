import type { ReactNode } from 'react'

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
    <div className={`section-heading section-heading--${variant}`}>
      <span className="section-heading__eyebrow">{eyebrow}</span>
      <h1 className="section-heading__title">{title}</h1>
      <p className="section-heading__description">{description}</p>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  )
}
