import { useNavigate, useLocation } from 'react-router-dom'

/**
 * Navigates to the previous history entry. Never type="submit".
 * Falls back to Home (or stays put on login with no history).
 */
export function BackButton({ fallback = '/' }: { fallback?: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  const goBack = () => {
    // index 0 = first entry in this tab session; prefer real history when available
    if (window.history.length > 1 && location.key !== 'default') {
      navigate(-1)
      return
    }
    if (location.pathname !== fallback) {
      navigate(fallback)
    }
  }

  // Hide only when already on fallback and no prior history to use
  const hide =
    location.pathname === fallback &&
    (window.history.length <= 1 || location.key === 'default')

  if (hide) return null

  return (
    <button
      type="button"
      className="ghost"
      aria-label="Go back to previous page"
      onClick={goBack}
      style={{ marginBottom: '0.75rem', alignSelf: 'flex-start' }}
    >
      ← Back
    </button>
  )
}
