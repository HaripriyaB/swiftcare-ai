import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  deleteUser,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth, getGoogleProvider } from './firebase'
import { clearApiCache, setTokenGetter } from '../api/client'
import { clearPageMemory } from '../utils/pageMemory'

type AuthState = {
  user: { uid: string; email: string | null; displayName: string | null } | null
  bypass: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  continueAsDev: () => void
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
  requestPasswordReset: () => Promise<void>
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const bypass = import.meta.env.VITE_AUTH_BYPASS === 'true'
  const [user, setUser] = useState<AuthState['user']>(
    bypass ? { uid: 'dev-user', email: 'dev-user@local', displayName: 'Demo user' } : null,
  )
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!bypass)

  useEffect(() => {
    if (bypass) {
      setLoading(false)
      return
    }
    const auth = getFirebaseAuth()
    if (!auth) {
      setLoading(false)
      return
    }
    return onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u)
      setUser(u ? { uid: u.uid, email: u.email, displayName: u.displayName } : null)
      setLoading(false)
    })
  }, [bypass])

  const getIdToken = useCallback(async () => {
    if (bypass) return 'bypass-dev-user'
    if (!firebaseUser) return null
    return firebaseUser.getIdToken()
  }, [bypass, firebaseUser])

  // Child pages start their data requests in passive effects. Register the
  // token first so their very first request is authenticated.
  useLayoutEffect(() => {
    setTokenGetter(getIdToken)
  }, [getIdToken])

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase Auth is not configured')
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth()
    const provider = getGoogleProvider()
    if (!auth || !provider) throw new Error('Firebase Auth is not configured')
    await signInWithPopup(auth, provider)
  }, [])

  const continueAsDev = useCallback(() => {
    setUser({ uid: 'dev-user', email: 'dev-user@local', displayName: 'Demo user' })
  }, [])

  const signOut = useCallback(async () => {
    clearPageMemory()
    clearApiCache()
    if (bypass) {
      setUser(null)
      return
    }
    const auth = getFirebaseAuth()
    if (auth) await fbSignOut(auth)
  }, [bypass])

  const requestPasswordReset = useCallback(async () => {
    if (!firebaseUser?.email) throw new Error('A password-reset email is unavailable for this account.')
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase Auth is not configured')
    await sendPasswordResetEmail(auth, firebaseUser.email)
  }, [firebaseUser])

  const deleteAccount = useCallback(async () => {
    if (bypass) throw new Error('The local demo account cannot be deleted.')
    if (!firebaseUser) throw new Error('No signed-in account was found.')
    await deleteUser(firebaseUser)
  }, [bypass, firebaseUser])

  const value = useMemo(
    () => ({
      user,
      bypass,
      loading,
      signIn,
      signInWithGoogle,
      continueAsDev,
      signOut,
      getIdToken,
      requestPasswordReset,
      deleteAccount,
    }),
    [user, bypass, loading, signIn, signInWithGoogle, continueAsDev, signOut, getIdToken, requestPasswordReset, deleteAccount],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
