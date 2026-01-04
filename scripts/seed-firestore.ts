import fs from 'node:fs'
import path from 'node:path'

import { cert, getApp, getApps, initializeApp, ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

type RoomId = 'entrance' | 'main'

interface RoomSeed {
  name: string
  description: string
  exits: Record<string, RoomId>
  createdAt: FirebaseFirestore.Timestamp
}

function loadServiceAccount(): ServiceAccount {
  const inline = process.env.SERVICE_ACCOUNT_JSON
  if (inline) {
    return JSON.parse(inline) as ServiceAccount
  }

  const fallbackPath =
    process.env.SERVICE_ACCOUNT_PATH ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    'serviceAccountKey.json'

  const resolved = path.resolve(process.cwd(), fallbackPath)

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Service account JSON not found. Set SERVICE_ACCOUNT_JSON or place a file at ${resolved}.`,
    )
  }

  const contents = fs.readFileSync(resolved, 'utf8')
  return JSON.parse(contents) as ServiceAccount
}

function getProjectId(serviceAccount: ServiceAccount) {
  const projectId = process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id

  if (!projectId) {
    throw new Error(
      'Missing project id. Set FIREBASE_PROJECT_ID or include project_id in the service account JSON.',
    )
  }

  return projectId
}

function getDb() {
  if (getApps().length) {
    return getFirestore(getApp())
  }

  const serviceAccount = loadServiceAccount()
  const projectId = getProjectId(serviceAccount)

  const app = initializeApp({
    credential: cert(serviceAccount),
    projectId,
  })

  return getFirestore(app)
}

async function ensureUsersAndAllowlist(
  approvedEmails: string[],
  firestore: FirebaseFirestore.Firestore,
) {
  const auth = getAuth()
  for (const email of approvedEmails) {
    const trimmed = email.trim()
    if (!trimmed) continue

    let user
    try {
      user = await auth.getUserByEmail(trimmed)
    } catch {
      user = await auth.createUser({ email: trimmed })
      console.log(`Created Firebase Auth user for ${trimmed}`)
    }

    await firestore
      .collection('allowlist')
      .doc(user.uid)
      .set({ email: trimmed, approvedAt: Timestamp.now() })

    console.log(`Allowlisted ${trimmed} (uid: ${user.uid})`)
  }
}

async function seedRooms(firestore: FirebaseFirestore.Firestore) {
  const now = Timestamp.now()

  const rooms: Record<RoomId, RoomSeed> = {
    entrance: {
      name: 'Mansion Entrance',
      description: 'You stand before a creaking door. A dim light spills from inside.',
      exits: { inside: 'main' },
      createdAt: now,
    },
    main: {
      name: 'Main Room',
      description: 'Dusty portraits stare back. A cold draft whispers toward the exit.',
      exits: { out: 'entrance' },
      createdAt: now,
    },
  }

  await Promise.all(
    Object.entries(rooms).map(([id, room]) =>
      firestore
        .collection('rooms')
        .doc(id)
        .set(room)
        .then(() => console.log(`Seeded room: ${id}`)),
    ),
  )
}

async function main() {
  const approved = process.env.APPROVED_EMAILS
  if (!approved) {
    throw new Error('APPROVED_EMAILS is required (comma-separated emails).')
  }

  const emails = approved.split(',').map((e) => e.trim()).filter(Boolean)

  if (emails.length === 0) {
    throw new Error('APPROVED_EMAILS contained no valid emails.')
  }

  const db = getDb()

  await ensureUsersAndAllowlist(emails, db)
  await seedRooms(db)

  console.log('Seeding complete. Allowlist and rooms are ready.')
}

main().catch((error) => {
  console.error('Failed to seed Firestore:')
  console.error(error)
  process.exitCode = 1
})
