import * as functions from 'firebase-functions'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import OpenAI from 'openai'

const app = initializeApp()
const db = getFirestore(app)
const openAiApiKey = defineSecret('OPENAI_API_KEY')
const model =
  process.env.OPENAI_MODEL ?? functions.config().openai?.model ?? 'gpt-5-mini-2025-08-07'
console.log('aiParse model:', model)

type RoomId = 'entrance' | 'main'

interface PuzzleState {
  solved?: boolean
  drawerUnlocked?: boolean
  keyTaken?: boolean
}

interface AiRequest {
  text?: string
  roomId?: RoomId
  inventory?: string[]
  puzzle?: PuzzleState
}

const allowedPatterns: RegExp[] = [
  /^help$/i,
  /^look$/i,
  /^enter$/i,
  /^back$/i,
  /^go (inside|out|north|east|west|south)$/i,
  /^examine (desk|drawer|mirror|table|room)$/i,
  /^search( room)?$/i,
  /^open drawer$/i,
  /^(enter|use) code \d{4}$/i,
  /^take key$/i,
  /^inventory$/i,
  /^ai help (on|off)$/i,
  /^(quit|exit)$/i,
]

function enforceAllowed(command: string) {
  return allowedPatterns.some((pattern) => pattern.test(command.trim()))
}

function sanitizeText(text?: string) {
  if (!text || typeof text !== 'string') return ''
  return text.trim().slice(0, 200)
}

function getOpenAiClient(apiKey?: string) {
  const resolvedKey = apiKey || process.env.OPENAI_API_KEY
  if (!resolvedKey) {
    return null
  }
  return new OpenAI({ apiKey: resolvedKey })
}

function getApiKeyFromSecrets() {
  try {
    return openAiApiKey.value()
  } catch {
    return undefined
  }
}

export const aiParse = onCall(
  { enforceAppCheck: false, maxInstances: 10, secrets: [openAiApiKey] },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign-in required.')
    }

    const allow = await db.doc(`allowlist/${uid}`).get()
    if (!allow.exists) {
      throw new HttpsError('permission-denied', 'Not allowlisted.')
    }

    const payload = request.data as AiRequest
    const text = sanitizeText(payload?.text)
    if (!text) {
      throw new HttpsError('invalid-argument', 'Text is required and must be under 200 chars.')
    }

    const roomId: RoomId | undefined =
      payload?.roomId === 'entrance' || payload?.roomId === 'main'
        ? payload.roomId
        : undefined

    if (!roomId) {
      throw new HttpsError('invalid-argument', 'Room id is required.')
    }

    const inventory =
      Array.isArray(payload?.inventory) && payload.inventory.every((i) => typeof i === 'string')
        ? payload.inventory
        : []

    const puzzle: PuzzleState = {
      solved: Boolean(payload?.puzzle?.solved),
      drawerUnlocked: Boolean(payload?.puzzle?.drawerUnlocked),
      keyTaken: Boolean(payload?.puzzle?.keyTaken),
    }

    const client = getOpenAiClient(getApiKeyFromSecrets())
    if (!client) {
      return { command: '', error: 'AI_NOT_CONFIGURED' }
    }

    const prompt = [
      'You translate player input into ONE allowed command line for a two-room text adventure.',
      'Allowed commands only:',
      'help | look | enter | back | go inside | go out | go north | go east | go west | go south | examine desk | examine drawer | examine mirror | examine table | examine room | search | search room | open drawer | enter code #### | use code #### | take key | inventory | ai help on | ai help off | quit | exit',
      'Output ONLY one command line, nothing else.',
      'If input is impossible, map to the closest allowed command or return empty.',
      `Context: room=${roomId}; inventory=${inventory.join(', ') || 'empty'}; puzzle: unlocked=${Boolean(puzzle.drawerUnlocked)}, solved=${Boolean(puzzle.solved)}, keyTaken=${Boolean(puzzle.keyTaken)}.`,
    ].join('\n')

    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 30,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text },
      ],
    })

    const candidate =
      completion.choices[0]?.message?.content?.trim().split('\n')[0].trim() ?? ''

    if (!candidate || !enforceAllowed(candidate)) {
      return { command: '' }
    }

    return { command: candidate.toLowerCase() }
  },
)
