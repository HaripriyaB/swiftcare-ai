import { useState } from 'react'
import { useAuth } from '../auth/useAuth'

export function AccountSettingsPage() {
  const { user, bypass, requestPasswordReset, deleteAccount } = useAuth()
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const resetPassword = async () => {
    setBusy(true); setError(null); setMessage(null)
    try { await requestPasswordReset(); setMessage(`A password-reset link was sent to ${user?.email}.`) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to send a password-reset link.') }
    finally { setBusy(false) }
  }

  const removeAccount = async () => {
    if (!window.confirm('Delete this SwiftCare sign-in account? This cannot be undone.')) return
    setBusy(true); setError(null); setMessage(null)
    try { await deleteAccount() }
    catch (err) { setError(err instanceof Error ? `${err.message} Sign in again, then retry.` : 'Unable to delete this account.') }
    finally { setBusy(false) }
  }

  return <section className="account-settings stack">
    <div><p className="eyebrow">Account</p><h1>Account settings</h1><p className="muted">Manage the SwiftCare sign-in for {user?.email}.</p></div>
    <div className="panel stack"><h2>Password</h2><p className="muted">For email/password accounts, we will send a secure password-reset link to your inbox.</p><div><button className="primary" type="button" onClick={() => void resetPassword()} disabled={busy || bypass}>{busy ? 'Sending…' : 'Send password-reset link'}</button></div></div>
    <div className="panel account-settings__danger stack"><h2>Delete account</h2><p className="muted">This removes your Firebase sign-in account. It does not delete operational audit records.</p><div><button type="button" className="danger" onClick={() => void removeAccount()} disabled={busy || bypass}>Delete my account</button></div></div>
    {message ? <div className="panel account-settings__success">{message}</div> : null}
    {error ? <div className="panel continuity-page__error">{error}</div> : null}
  </section>
}
