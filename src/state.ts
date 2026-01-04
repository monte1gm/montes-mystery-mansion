import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  type DocumentReference,
} from 'firebase/firestore'
import { getDb } from './firebase'
import type { RoomId } from './world'

export interface PuzzleState {
  solved: boolean
  drawerUnlocked: boolean
  keyTaken: boolean
}

export interface GameStateDoc {
  currentRoomId: RoomId
  inventory: string[]
  puzzle: PuzzleState
  doubtPhase: number
  aiHelpEnabled: boolean
  updatedAt?: unknown
}

export const defaultPuzzleState: PuzzleState = {
  solved: false,
  drawerUnlocked: false,
  keyTaken: false,
}

export const defaultGameState: GameStateDoc = {
  currentRoomId: 'entrance',
  inventory: [],
  puzzle: { ...defaultPuzzleState },
  doubtPhase: 0,
  aiHelpEnabled: false,
}

function gameStateRef(uid: string): DocumentReference {
  return doc(getDb(), 'gameState', uid)
}

function normalizePuzzle(puzzle: Partial<PuzzleState> | undefined): PuzzleState {
  return {
    solved: Boolean(puzzle?.solved),
    drawerUnlocked: Boolean(puzzle?.drawerUnlocked),
    keyTaken: Boolean(puzzle?.keyTaken),
  }
}

export async function ensureGameState(uid: string): Promise<GameStateDoc> {
  const ref = gameStateRef(uid)
  const snap = await getDoc(ref)

  if (!snap.exists()) {
    const data: GameStateDoc = {
      ...defaultGameState,
      puzzle: { ...defaultPuzzleState },
      updatedAt: serverTimestamp(),
    }
    await setDoc(ref, data)
    return { ...defaultGameState, puzzle: { ...defaultPuzzleState } }
  }

  const data = snap.data()
  return {
    currentRoomId:
      data?.currentRoomId === 'main' || data?.currentRoomId === 'entrance'
        ? data.currentRoomId
        : 'entrance',
    inventory: Array.isArray(data?.inventory)
      ? data.inventory.filter((item: unknown): item is string => typeof item === 'string')
      : [],
    puzzle: normalizePuzzle(data?.puzzle),
    doubtPhase: typeof data?.doubtPhase === 'number' ? data.doubtPhase : 0,
    aiHelpEnabled: Boolean(data?.aiHelpEnabled),
    updatedAt: data?.updatedAt,
  }
}

export async function saveGameState(uid: string, partial: Partial<GameStateDoc>) {
  const ref = gameStateRef(uid)
  await updateDoc(ref, { ...partial, updatedAt: serverTimestamp() })
}
