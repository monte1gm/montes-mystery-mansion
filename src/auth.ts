import type { User } from 'firebase/auth'
import { onAuthChange, signInWithGoogle, signOutUser } from './firebase'

export type AuthCallback = (user: User | null) => void

export function watchAuth(callback: AuthCallback) {
  return onAuthChange(callback)
}

export function signIn() {
  return signInWithGoogle()
}

export function signOut() {
  return signOutUser()
}
