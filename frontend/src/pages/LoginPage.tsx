import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BrandLockup } from '../components/BrandLockup'
import { NoticeBoard } from '../components/NoticeBoard'

const FEATURES = [
  {
    title: 'Patient lookup',
    body: 'Find charts by name and open the active workspace in one step.',
  },
  {
    title: 'Care insights',
    body: 'Surface at-risk patterns and operational signals for the front desk.',
  },
  {
    title: 'Staff directory',
    body: 'Browse doctors by specialty, hours, and clinic location.',
  },
]

export function LoginPage() {
  const { bypass, signIn, continueAsDev } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const firebaseReady = bypass || Boolean(import.meta.env.VITE_FIREBASE_API_KEY)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!firebaseReady) {
      setError(
        'Firebase is not configured. Set VITE_FIREBASE_* in frontend/.env (or rebuild the image with those build args).',
      )
      return
    }
    try {
      await signIn(email, password)
      nav('/')
    } catch {
      setError('Sign-in failed. Check email/password or Firebase Auth settings.')
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__atmosphere" aria-hidden="true" />
      <div className="login-page__grid">
        <section className="login-page__intro stack">
          <BrandLockup size="lg" to={null} />
          <p className="login-page__promise">
            Front-desk workspace for patient lookup, guardrailed advisories, and clinic ops.
          </p>
          <ul className="login-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span className="muted">{f.body}</span>
              </li>
            ))}
          </ul>
          <NoticeBoard variant="compact" limit={2} />
        </section>

        <div className="panel stack login-page__form" style={{ width: 'min(400px, 100%)' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--sc-font-display)',
              fontSize: '1.35rem',
            }}
          >
            Sign in
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Staff access to SwiftCare AI
          </p>
          {bypass ? (
            <button
              type="button"
              className="primary"
              onClick={() => {
                continueAsDev()
                nav('/')
              }}
            >
              Continue as dev-user
            </button>
          ) : (
            <form className="stack" onSubmit={(e) => void onSubmit(e)}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
              {error ? <p style={{ color: 'var(--sc-high)' }}>{error}</p> : null}
              <button type="submit" className="primary">
                Sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
