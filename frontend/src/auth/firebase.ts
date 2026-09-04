import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

let app: FirebaseApp | undefined
let auth: Auth | undefined

export function getFirebaseAuth(): Auth | null {
  if (import.meta.env.VITE_AUTH_BYPASS === 'true') return null
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY
  if (!apiKey) return null
  if (!app) {
    app = initializeApp({
      apiKey,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    })
    auth = getAuth(app)
  }
  return auth!
}
