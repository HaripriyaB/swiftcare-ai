import { Link } from 'react-router-dom'

type BrandLockupProps = {
  /** When null/empty, renders a non-linking lockup (e.g. login). */
  to?: string | null
  size?: 'sm' | 'lg'
  showWordmark?: boolean
}

export function BrandLockup({
  to = '/',
  size = 'sm',
  showWordmark = true,
}: BrandLockupProps) {
  const logoPx = size === 'lg' ? 48 : 32
  const fontSize = size === 'lg' ? '1.85rem' : '1.35rem'

  const inner = (
    <span
      className="brand-lockup"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'lg' ? '0.85rem' : '0.55rem',
        color: 'var(--sc-ink)',
        textDecoration: 'none',
      }}
    >
      <img
        src="/swiftcare-logo.svg"
        alt=""
        width={logoPx}
        height={logoPx}
        style={{ display: 'block', flexShrink: 0 }}
      />
      {showWordmark ? (
        <span
          style={{
            fontFamily: 'var(--sc-font-display)',
            fontWeight: 700,
            fontSize,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}
        >
          SwiftCare AI
        </span>
      ) : null}
    </span>
  )

  if (to == null || to === '') return inner

  return (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit' }} aria-label="SwiftCare AI home">
      {inner}
    </Link>
  )
}
