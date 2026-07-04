import type { CSSProperties } from 'react'

type BrandLogoVariant = 'lockup' | 'mark'
type BrandLogoSize = 32 | 48 | 80
type BrandLogoTreatment = 'bare' | 'framed'

interface BrandLogoProps {
  variant: BrandLogoVariant
  size: BrandLogoSize
  treatment: BrandLogoTreatment
  className?: string
}

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

function MosquitoMark({ framed }: { framed: boolean }) {
  if (framed) {
    return (
      <span className="brand-logo__frame">
        <svg
          className="brand-logo__svg brand-logo__svg--framed"
          viewBox="0 0 80 80"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <line x1="40" y1="2" x2="40" y2="11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="40" cy="17" r="6.5" fill="currentColor" />
          <ellipse cx="40" cy="29" rx="9" ry="9.5" fill="currentColor" />
          <ellipse cx="40" cy="53" rx="7" ry="15" fill="currentColor" />
          <ellipse cx="20" cy="25" rx="19" ry="7" transform="rotate(-18 20 25)" fill="currentColor" opacity="0.52" />
          <ellipse cx="60" cy="25" rx="19" ry="7" transform="rotate(18 60 25)" fill="currentColor" opacity="0.52" />
          <ellipse cx="20" cy="37" rx="13.5" ry="5" transform="rotate(-24 20 37)" fill="currentColor" opacity="0.3" />
          <ellipse cx="60" cy="37" rx="13.5" ry="5" transform="rotate(24 60 37)" fill="currentColor" opacity="0.3" />
        </svg>
      </span>
    )
  }

  return (
    <svg
      className="brand-logo__svg brand-logo__svg--bare"
      viewBox="0 0 80 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="40" y1="2" x2="40" y2="11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="17" r="6.5" fill="currentColor" />
      <ellipse cx="40" cy="29" rx="9" ry="9.5" fill="currentColor" />
      <ellipse cx="40" cy="53" rx="7" ry="15" fill="currentColor" />
      <ellipse cx="20" cy="25" rx="19" ry="7" transform="rotate(-18 20 25)" fill="currentColor" opacity="0.52" />
      <ellipse cx="60" cy="25" rx="19" ry="7" transform="rotate(18 60 25)" fill="currentColor" opacity="0.52" />
      <ellipse cx="20" cy="37" rx="13.5" ry="5" transform="rotate(-24 20 37)" fill="currentColor" opacity="0.3" />
      <ellipse cx="60" cy="37" rx="13.5" ry="5" transform="rotate(24 60 37)" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

export function BrandLogo({ variant, size, treatment, className }: BrandLogoProps) {
  const framed = treatment === 'framed'

  return (
    <span
      className={classes('brand-logo', `brand-logo--${variant}`, `brand-logo--${treatment}`, className)}
      style={{ '--brand-logo-size': `${size}px` } as CSSProperties}
      data-testid="brand-logo"
      data-variant={variant}
      data-size={String(size)}
      data-treatment={treatment}
    >
      <MosquitoMark framed={framed} />
      {variant === 'lockup' ? (
        <span className="brand-logo__wordmark">
          <span className="brand-logo__name">DengueWatch</span>
          <span className="brand-logo__tagline">MOSQUITO ALERT</span>
        </span>
      ) : null}
    </span>
  )
}
