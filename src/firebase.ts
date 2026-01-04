import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
  type Auth,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'

function getFirebaseConfig() {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID,
  } = import.meta.env

  const missing = [
    ['VITE_FIREBASE_API_KEY', VITE_FIREBASE_API_KEY],
    ['VITE_FIREBASE_AUTH_DOMAIN', VITE_FIREBASE_AUTH_DOMAIN],
    ['VITE_FIREBASE_PROJECT_ID', VITE_FIREBASE_PROJECT_ID],
    ['VITE_FIREBASE_STORAGE_BUCKET', VITE_FIREBASE_STORAGE_BUCKET],
    ['VITE_FIREBASE_MESSAGING_SENDER_ID', VITE_FIREBASE_MESSAGING_SENDER_ID],
    ['VITE_FIREBASE_APP_ID', VITE_FIREBASE_APP_ID],
  ].filter(([, value]) => !value)

  if (missing.length > 0) {
    const names = missing.map(([name]) => name).join(', ')
    throw new Error(`Missing Firebase environment variables: ${names}`)
  }

  return {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: VITE_FIREBASE_APP_ID,
  }
}

function ensureApp() {
  if (getApps().length) {
    return getApp()
  }
  return initializeApp(getFirebaseConfig())
}

let cachedApp: FirebaseApp | null = null
let cachedDb: Firestore | null = null
let cachedAuth: Auth | null = null
let cachedProvider: GoogleAuthProvider | null = null
let cachedFunctions: Functions | null = null

export function getFirebaseApp() {
  if (!cachedApp) {
    cachedApp = ensureApp()
  }
  return cachedApp
}

export function getDb() {
  if (!cachedDb) {
    cachedDb = getFirestore(getFirebaseApp())
  }
  return cachedDb
}

export function getAuthInstance() {
  if (!cachedAuth) {
    cachedAuth = getAuth(getFirebaseApp())
  }
  return cachedAuth
}

export function getGoogleProvider() {
  if (!cachedProvider) {
    cachedProvider = new GoogleAuthProvider()
  }
  return cachedProvider
}

export function getFunctionsInstance() {
  if (!cachedFunctions) {
    cachedFunctions = getFunctions(getFirebaseApp())
  }
  return cachedFunctions
}

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(getAuthInstance(), callback)
}

export async function signInWithGoogle() {
  await signInWithPopup(getAuthInstance(), getGoogleProvider())
}

export async function signOutUser() {
  await signOut(getAuthInstance())
}
