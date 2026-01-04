import { onRequest, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import OpenAI from 'openai'

const app = initializeApp()
const db = getFirestore(app)

const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY')
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.2'

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
  /^examine (desk|drawer|mirror|table|room|key)$/i,
  /^search( room)?$/i,
  /^open drawer$/i,
  /^(enter|use) code \d{4}$/i,
  /^take key$/i,
  /^use headlamp$/i,
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

function normalizeRoomId(roomId: unknown): RoomId | null {
  if (roomId === 'entrance' || roomId === 'main') return roomId
  return null
}

function normalizeInventory(inv: unknown): string[] {
  if (!Array.isArray(inv)) return []
  return inv.filter((i) => typeof i === 'string').map((s) => s.trim()).filter(Boolean)
}

function normalizePuzzle(p: unknown): Required<PuzzleState> {
  const obj = (p && typeof p === 'object' ? (p as any) : {}) as any
  return {
    solved: Boolean(obj.solved),
    drawerUnlocked: Boolean(obj.drawerUnlocked),
    keyTaken: Boolean(obj.keyTaken),
  }
}

function corsify(req: any, res: any) {
  const origin = req.headers.origin
  // Allow your hosting origin(s). Add localhost for dev if needed.
  const allowed = new Set([
    'https://montes-mystery-mansion.web.app',
    'https://montes-mystery-mansion.firebaseapp.com',
    'http://localhost:5173',
  ])

  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '3600')
}

export const aiParse = onRequest(
  {
    region: 'us-central1',
    secrets: [OPENAI_API_KEY],
    maxInstances: 10,
  },
  async (req, res) => {
    corsify(req, res)

    // Preflight
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }

    if (req.method !== 'POST') {
      res.status(405).json({ command: '', error: 'METHOD_NOT_ALLOWED' })
      return
    }

    try {
      // 1) Verify Firebase ID token from Authorization header: "Bearer <token>"
      const authHeader = String(req.headers.authorization || '')
      const match = authHeader.match(/^Bearer\s+(.+)$/i)
      if (!match) {
        res.status(401).json({ command: '', error: 'UNAUTHENTICATED' })
        return
      }

      const token = match[1]
      const decoded = await getAuth().verifyIdToken(token)
      const uid = decoded.uid

      // 2) Allowlist check
      const allow = await db.doc(`allowlist/${uid}`).get()
      if (!allow.exists) {
        res.status(403).json({ command: '', error: 'NOT_ALLOWLISTED' })
        return
      }

      const payload = (req.body || {}) as AiRequest
      const text = sanitizeText(payload.text)
      if (!text) {
        res.status(400).json({ command: '', error: 'INVALID_ARGUMENT' })
        return
      }

      const roomId = normalizeRoomId(payload.roomId)
      if (!roomId) {
        res.status(400).json({ command: '', error: 'INVALID_ARGUMENT' })
        return
      }

      const inventory = normalizeInventory(payload.inventory)
      const puzzle = normalizePuzzle(payload.puzzle)

      const key = OPENAI_API_KEY.value()
      if (!key) {
        res.status(500).json({ command: '', error: 'AI_NOT_CONFIGURED' })
        return
      }

      const client = new OpenAI({ apiKey: key })

      const systemPrompt = [
        'You translate player input into EXACTLY ONE allowed command line for a two-room text adventure.',
        'Output must be a single line and must match ONE of the allowed formats exactly.',
        'If you are not confident, output an empty string.',
        '',
        'ALLOWED COMMANDS:',
        'help',
        'look',
        'enter',
        'back',
        'go inside',
        'go out',
        'go north',
        'go east',
        'go west',
        'go south',
        'examine desk',
        'examine drawer',
        'examine mirror',
        'examine table',
        'examine key',
        'examine room',
        'search',
        'search room',
        'open drawer',
        'enter code ####',
        'use code ####',
        'take key',
        'use headlamp',
        'inventory',
        'ai help on',
        'ai help off',
        'quit',
        'exit',
        '',
        `CONTEXT: room=${roomId}; inventory=${inventory.join(', ') || 'empty'}; ` +
          `puzzle: unlocked=${puzzle.drawerUnlocked}, solved=${puzzle.solved}, keyTaken=${puzzle.keyTaken}.`,
      ].join('\n')

      const response = await client.responses.create({
        model: MODEL,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_output_tokens: 30,
      })

      const candidate = (response.output_text || '').trim().split('\n')[0]?.trim() ?? ''

      if (!candidate || !enforceAllowed(candidate)) {
        res.json({ command: '' })
        return
      }

      res.json({ command: candidate.toLowerCase() })
    } catch (err: any) {
      console.error('aiParse error:', err?.message || err)
      res.status(500).json({ command: '', error: 'INTERNAL' })
    }
  },
)
