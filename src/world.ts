import { doc, getDoc } from 'firebase/firestore'
import { getDb } from './firebase'

export type RoomId = 'entrance' | 'main'

export interface Room {
  id: RoomId
  name: string
  description: string
  exits: Record<string, RoomId>
  createdAt?: unknown
}

export type RoomMap = Record<RoomId, Room>

function normalizeExits(value: unknown): Record<string, RoomId> {
  if (!value || typeof value !== 'object') return {}
  const exits: Record<string, RoomId> = {}
  Object.entries(value as Record<string, unknown>).forEach(([dir, target]) => {
    if (typeof target === 'string') {
      exits[dir.toLowerCase()] = target as RoomId
    }
  })
  return exits
}

async function fetchRoom(id: RoomId): Promise<Room> {
  const snapshot = await getDoc(doc(getDb(), 'rooms', id))
  if (!snapshot.exists()) {
    throw new Error(`Room "${id}" is missing. Run the seed script to create it.`)
  }
  const data = snapshot.data()
  return {
    id,
    name: typeof data.name === 'string' ? data.name : id,
    description: typeof data.description === 'string' ? data.description : 'No description.',
    exits: normalizeExits(data.exits),
    createdAt: data.createdAt,
  }
}

export async function loadWorld(): Promise<RoomMap> {
  const [entrance, main] = await Promise.all([fetchRoom('entrance'), fetchRoom('main')])
  return { entrance, main }
}
