import { httpsCallable } from 'firebase/functions'
import { getFunctionsInstance } from './firebase'
import type { PuzzleState } from './state'
import type { RoomId } from './world'

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

export async function aiParse(payload: AiParsePayload): Promise<AiParseResponse> {
  const fn = httpsCallable<AiParsePayload, AiParseResponse>(
    getFunctionsInstance(),
    'aiParse',
  )

  try {
    const result = await fn(payload)
    const data = result.data || {}
    return {
      command: typeof data.command === 'string' ? data.command : '',
      error: typeof data.error === 'string' ? data.error : undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI helper error.'
    return { command: '', error: message }
  }
}
