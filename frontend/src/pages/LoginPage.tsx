import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { BrandLockup } from '../components/BrandLockup'

const FEATURES = [
  {
    title: 'See priority',
    body: 'Open a focused queue of patient-continuity work for today.',
  },
  {
    title: 'Understand why',
    body: 'Review the source-backed evidence behind every operational action.',
  },
  {
    title: 'Record the outcome',
    body: 'Keep staff in control while preserving an auditable action history.',
  },
]

export function LoginPage() {
  const { bypass, signIn, signInWithGoogle, continueAsDev } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
      setBusy(true)
      await signIn(email, password)
      nav('/')
    } catch (err) {
      setError(authErrorMessage(err, 'email'))
    } finally {
      setBusy(false)
    }
  }

  const onGoogle = async () => {
    setError(null)
    if (!firebaseReady) {
      setError('Firebase is not configured. Set VITE_FIREBASE_* and rebuild the app.')
      return
    }
    try {
      setBusy(true)
      await signInWithGoogle()
      nav('/')
    } catch (err) {
      setError(authErrorMessage(err, 'google'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-page__atmosphere" aria-hidden="true" />
      <div className="login-page__grid">
        <section className="login-page__intro stack">
          <BrandLockup size="lg" to={null} />
          <p className="login-page__promise">
            Keep patient follow-up from falling through the cracks.
          </p>
          <ul className="login-features">
            {FEATURES.map((f) => (
              <li key={f.title}>
                <strong>{f.title}</strong>
                <span className="muted">{f.body}</span>
              </li>
            ))}
          </ul>
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
              <button type="button" className="google-signin" disabled={busy} onClick={() => void onGoogle()}>
                <span aria-hidden="true">G</span> Continue with Google
              </button>
              <div className="login-divider"><span>or continue with email</span></div>
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
              <button type="submit" className="primary" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function authErrorMessage(error: unknown, method: 'email' | 'google') {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'auth/popup-blocked') return 'Google sign-in could not open. Allow popups and try again.'
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was closed before it finished. Please try again.'
  if (code === 'auth/unauthorized-domain') return 'This site is not authorized for Firebase sign-in. Add the Cloud Run domain in Firebase Authentication settings.'
  if (code === 'auth/operation-not-allowed') return method === 'google'
    ? 'Google sign-in is not enabled in Firebase Authentication yet.'
    : 'Email/password sign-in is not enabled in Firebase Authentication.'
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'The email or password is not recognized.'
  return method === 'google' ? 'Google sign-in failed. Please try again.' : 'Sign-in failed. Check email/password or Firebase Auth settings.'
}
