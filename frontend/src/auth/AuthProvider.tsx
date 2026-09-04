import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth } from './firebase'
import { setTokenGetter } from '../api/client'

type AuthState = {
  user: { uid: string; email: string | null } | null
  bypass: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  continueAsDev: () => void
  signOut: () => Promise<void>
  getIdToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const bypass = import.meta.env.VITE_AUTH_BYPASS === 'true'
  const [user, setUser] = useState<AuthState['user']>(
    bypass ? { uid: 'dev-user', email: 'dev-user@local' } : null,
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
      setUser(u ? { uid: u.uid, email: u.email } : null)
      setLoading(false)
    })
  }, [bypass])

  const getIdToken = useCallback(async () => {
    if (bypass) return 'bypass-dev-user'
    if (!firebaseUser) return null
    return firebaseUser.getIdToken()
  }, [bypass, firebaseUser])

  useEffect(() => {
    setTokenGetter(getIdToken)
  }, [getIdToken])

  const signIn = useCallback(async (email: string, password: string) => {
    const auth = getFirebaseAuth()
    if (!auth) throw new Error('Firebase Auth is not configured')
    await signInWithEmailAndPassword(auth, email, password)
  }, [])

  const continueAsDev = useCallback(() => {
    setUser({ uid: 'dev-user', email: 'dev-user@local' })
  }, [])

  const signOut = useCallback(async () => {
    if (bypass) {
      setUser(null)
      return
    }
    const auth = getFirebaseAuth()
    if (auth) await fbSignOut(auth)
  }, [bypass])

  const value = useMemo(
    () => ({
      user,
      bypass,
      loading,
      signIn,
      continueAsDev,
      signOut,
      getIdToken,
    }),
    [user, bypass, loading, signIn, continueAsDev, signOut, getIdToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
