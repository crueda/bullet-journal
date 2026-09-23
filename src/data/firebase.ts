import { initializeApp } from 'firebase/app'
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  signInAnonymously,
  type User,
} from 'firebase/auth'
import { initializeFirestore } from 'firebase/firestore'

// Configuración web pública del proyecto compartido con Agatsu.
// Nunca añadir aquí una cuenta de servicio, clave privada ni token personal.
const firebaseConfig = {
  apiKey: 'AIzaSyBWhaaw0hKgQwKZ2v7ZVEcy-UvGt5d1A9k',
  authDomain: 'habits-tracker-78d9b.firebaseapp.com',
  projectId: 'habits-tracker-78d9b',
  storageBucket: 'habits-tracker-78d9b.firebasestorage.app',
  messagingSenderId: '456160025103',
  appId: '1:456160025103:web:2286964bbd6f01f672617a',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)
export const firestore = initializeFirestore(firebaseApp, { ignoreUndefinedProperties: true })

let authPromise: Promise<User> | undefined

export function ensureAnonymousUser(): Promise<User> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser)

  authPromise ??= (async () => {
    await setPersistence(auth, browserLocalPersistence)
    await auth.authStateReady()
    if (auth.currentUser) return auth.currentUser
    const credentials = await signInAnonymously(auth)
    return credentials.user
  })().finally(() => {
    authPromise = undefined
  })

  return authPromise
}
