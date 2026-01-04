import { getAuth } from 'firebase/auth'
import type { PuzzleState } from './state'
import type { RoomId } from './world'
import { app } from './firebase'

export interface AiParsePayload {
  text: string
  roomId: RoomId
  inventory: string[]
  puzzle: PuzzleState
}

export interface AiParseResponse {
  command?: string
  error?: string
}

const ENDPOINT =
  'https://us-central1-montes-mystery-mansion.cloudfunctions.net/aiParse'

export async function aiParse(payload: AiParsePayload): Promise<AiParseResponse> {
  try {
    const auth = getAuth(app)
    const user = auth.currentUser
    if (!user) return { command: '', error: 'UNAUTHENTICATED' }

    const token = await user.getIdToken()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const data = (await res.json().catch(() => ({}))) as AiParseResponse

    if (!res.ok) {
      return { command: '', error: data?.error || 'INTERNAL' }
    }

    return {
      command: typeof data.command === 'string' ? data.command : '',
      error: typeof data.error === 'string' ? data.error : undefined,
    }
  } catch (err: any) {
    console.error('aiParse fetch failed:', err?.message || err, err)
    return { command: '', error: 'INTERNAL' }
  }
}
