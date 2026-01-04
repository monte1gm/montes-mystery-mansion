import { doc, getDoc } from 'firebase/firestore'
import { getDb } from './firebase'

export interface AllowlistResult {
  allowed: boolean
  email?: string
}

export async function isAllowlisted(uid: string): Promise<AllowlistResult> {
  const snapshot = await getDoc(doc(getDb(), 'allowlist', uid))

  if (!snapshot.exists()) {
    return { allowed: false }
  }

  const data = snapshot.data()
  const email = typeof data.email === 'string' ? data.email : undefined

  return { allowed: true, email }
}
