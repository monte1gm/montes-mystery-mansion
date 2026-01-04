import './styles.css'

import { signIn, signOut, watchAuth } from './auth'
import { isAllowlisted } from './access'
import { aiParse } from './aiClient'
import { processCommand, describeRoom, RuntimeState } from './app'
import { getDoubtLine, getTypoWhisper } from './doubt'
import { parseCommand } from './parser'
import { ensureGameState, saveGameState } from './state'
import { isLikelyTypo } from './typo'
import { loadWorld } from './world'
import {
  appendLine,
  appendLines,
  clearTerminal,
  commandForm,
  commandInput,
  deniedSignOutButton,
  deniedScreen,
  gameScreen,
  loginScreen,
  setDoubtLine,
  setStatus,
  setStatusAi,
  setStatusEmail,
  showDenied,
  showGame,
  showLogin,
  signInButton,
  signOutButton,
  toggleTypewriter,
  typewriterToggle,
  disableInput,
} from './ui'

let runtime: RuntimeState | null = null
let currentUid: string | null = null
let currentEmail: string | null = null
let lastDoubtLine: string | null = null
let commandCount = 0
let lastTypoWhisperCommand = -10

function resetGame() {
  runtime = null
  currentUid = null
  currentEmail = null
  clearTerminal()
  commandInput.value = ''
  setDoubtLine('')
  lastDoubtLine = null
  commandCount = 0
  lastTypoWhisperCommand = -10
}

function updateStatusLine() {
  if (!runtime) return
  const room = runtime.rooms[runtime.doc.currentRoomId]
  setStatus(room.name)
  setStatusEmail(currentEmail || '')
  setStatusAi(runtime.doc.aiHelpEnabled)
}

async function handleApproved(user: import('firebase/auth').User) {
  setStatus('Loading world...')
  clearTerminal()
  appendLine('Checking room data...')

  let rooms
  try {
    rooms = await loadWorld()
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while loading rooms.'
    showGame()
    appendLines(
      [
        'Unable to load room data from Firestore.',
        message,
        'If you are an admin, run the seed script and try again.',
      ],
      false,
    )
    disableInput('Input disabled until rooms are available.')
    setStatus('DATA MISSING')
    return
  }

  let doc
  try {
    doc = await ensureGameState(user.uid)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load or create your save data.'
    showDenied(user.email ?? 'Unknown user')
    appendLines(
      [
        'Could not access your save slot.',
        message,
        'Ensure allowlist access and Firestore rules are deployed.',
      ],
      false,
    )
    return
  }

  runtime = {
    rooms,
    doc,
    quit: false,
    hasSeenMainIntro: doc.currentRoomId === 'main',
  }
  currentUid = user.uid
  currentEmail = user.email ?? ''

  showGame()
  setStatusEmail(currentEmail)
  setStatusAi(runtime.doc.aiHelpEnabled)

  const activeRoom = runtime.rooms[runtime.doc.currentRoomId]
  setStatus(activeRoom.name)

  const welcome = [
    'WELCOME TO MONTES MYSTERY MANSION',
    'TYPE "HELP" FOR COMMANDS.',
    '',
  ]
  clearTerminal()
  appendLines(welcome, false)
  appendLines(describeRoom(activeRoom, { isMainIntro: false }))
}

async function handleUser(user: import('firebase/auth').User | null) {
  resetGame()

  if (!user) {
    setStatus('Sign in required')
    setStatusEmail('')
    setStatusAi(false)
    showLogin()
    appendLine('Please sign in with Google to continue.', false)
    return
  }

  const email = user.email ?? 'Unknown user'
  setStatus('Checking access')
  setStatusEmail(email)
  loginScreen.classList.add('hidden')
  deniedScreen.classList.add('hidden')
  gameScreen.classList.add('hidden')

  try {
    const result = await isAllowlisted(user.uid)
    if (!result.allowed) {
      showDenied(email)
      setStatus('Access denied')
      appendLines(
        [
          'Access denied.',
          email ? `Signed in as ${email}.` : 'Signed in user not allowlisted.',
          'If you should have access, ask an admin to add you to the allowlist.',
        ],
        false,
      )
      return
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error while checking access.'
    showDenied(email)
    setStatus('Access check failed')
    appendLines(['Error checking allowlist.', message], false)
    return
  }

  await handleApproved(user)
}

function applyUpdates(updates?: Partial<RuntimeState['doc']>) {
  if (!runtime || !updates) return
  runtime.doc = { ...runtime.doc, ...updates }
}

async function persistUpdates(updates?: Partial<RuntimeState['doc']>) {
  if (!runtime || !currentUid || !updates) return
  try {
    await saveGameState(currentUid, updates)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not save progress.'
    appendLine(`Save warning: ${message}`, false)
  }
}

async function handleParsedCommand(parsed: ReturnType<typeof parseCommand>) {
  if (!runtime) {
    appendLine('Game not ready. Try reloading or checking access.', false)
    return
  }

  let commandToUse = parsed
  let typoRecovery = false

  if (parsed.kind === 'unknown' && runtime.doc.aiHelpEnabled && isLikelyTypo(parsed.raw)) {
    appendLine('Doubt tries to read your typo...', false)
    const aiResult = await aiParse({
      text: parsed.raw,
      roomId: runtime.doc.currentRoomId,
      inventory: runtime.doc.inventory,
      puzzle: runtime.doc.puzzle,
    })

    if (aiResult.error) {
      appendLine(`Doubt is silent: ${aiResult.error}`, false)
      return
    }

    if (!aiResult.command) {
      appendLine("I couldn't translate that. Try 'help'.", false)
      return
    }

    typoRecovery = true
    appendLine(`Doubt suggests: ${aiResult.command}`, false)
    commandToUse = parseCommand(aiResult.command)

    if (commandToUse.kind === 'unknown') {
      appendLine("I couldn't translate that. Try 'help'.", false)
      return
    }
  }

  const result = processCommand(runtime, commandToUse)
  appendLines(result.lines)

  applyUpdates(result.updates)
  await persistUpdates(result.updates)
  updateStatusLine()

  if (result.doubtTrigger) {
    const line = getDoubtLine(runtime.doc.doubtPhase, result.doubtTrigger, lastDoubtLine)
    if (line) {
      lastDoubtLine = line
      setDoubtLine(line)
    }
  }

  if (typoRecovery) {
    if (commandCount - lastTypoWhisperCommand >= 2) {
      const line = getTypoWhisper(lastDoubtLine)
      if (line) {
        lastDoubtLine = line
        lastTypoWhisperCommand = commandCount
        setDoubtLine(line)
      }
    }
  }

  if (runtime.quit) {
    disableInput('SESSION ENDED')
  }
}

function handleSubmit(event: SubmitEvent) {
  event.preventDefault()
  const input = commandInput.value.trim()

  if (!input) return

  commandCount += 1

  appendLine(`] ${input}`, false)
  commandInput.value = ''

  const parsed = parseCommand(input)
  handleParsedCommand(parsed).catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown error.'
    appendLine(`Error: ${message}`, false)
  })
}

signInButton.addEventListener('click', () => {
  signIn().catch((error) => {
    appendLine('Sign-in failed. Check console for details.', false)
    console.error(error)
  })
})

signOutButton.addEventListener('click', () => {
  signOut().catch((error) => {
    appendLine('Sign-out failed. Check console for details.', false)
    console.error(error)
  })
})

deniedSignOutButton.addEventListener('click', () => {
  signOut().catch((error) => {
    appendLine('Sign-out failed. Check console for details.', false)
    console.error(error)
  })
})

typewriterToggle.addEventListener('click', toggleTypewriter)
commandForm.addEventListener('submit', handleSubmit)

setStatus('Sign in required')
showLogin()
appendLine('Awaiting authentication...', false)

try {
  watchAuth(handleUser)
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'Failed to initialize Firebase. Check env vars.'
  appendLines(['Unable to initialize Firebase.', message], false)
  setStatus('Config error')
  setStatusEmail('')
  showLogin()
  commandInput.disabled = true
}
