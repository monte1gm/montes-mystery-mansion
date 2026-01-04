import { clampPhase, DoubtTrigger } from './doubt'
import { ParsedCommand } from './parser'
import { getFullManual, getCommandHelp } from './help'
import { GameStateDoc, PuzzleState } from './state'
import { Room, RoomId, RoomMap } from './world'

export interface RuntimeState {
  rooms: RoomMap
  doc: GameStateDoc
  quit: boolean
  hasSeenMainIntro: boolean
}

export interface CommandResult {
  lines: string[]
  updates?: Partial<GameStateDoc>
  doubtTrigger?: DoubtTrigger
}

const blockedExitResponses = [
  'That way is sealed for now.',
  'A hallway waits, but you cannot enter it yet.',
  'Not yet.',
]

function exitsText(room: Room) {
  const exits = Object.keys(room.exits || {})
  return exits.length > 0 ? exits.map((exit) => exit.toUpperCase()).join(', ') : 'None'
}

function mainIntroLines(): string[] {
  return [
    'You step into the main room.',
    'A long table sits in the center.',
    'A desk rests near the far wall.',
    'A tall mirror stands to the right.',
    'The air feels heavier here.',
  ]
}

function mainLookLines(): string[] {
  return [
    'The main room is quiet.',
    'You see:',
    '- a table',
    '- a desk',
    '- a mirror',
    '- doorways to the north, east, and west',
    '- the doorway back out',
  ]
}

export function describeRoom(room: Room, opts?: { isMainIntro?: boolean }): string[] {
  if (room.id === 'main') {
    return opts?.isMainIntro ? mainIntroLines() : mainLookLines()
  }

  return [
    `${room.name}`,
    'You stand before a creaking door. A dim light spills from inside.',
    `Exits: ${exitsText(room)}`,
  ]
}

function updateDoubtPhase(current: number, target: number) {
  return clampPhase(Math.max(current, target))
}

function handleBlockedExit(): CommandResult {
  const line = blockedExitResponses[Math.floor(Math.random() * blockedExitResponses.length)]
  return { lines: [line], doubtTrigger: 'blockedExitAttempt' }
}

function move(state: RuntimeState, direction: ParsedCommand['direction']): CommandResult {
  if (direction === 'north' || direction === 'east' || direction === 'west') {
    return handleBlockedExit()
  }

  if (direction === 'south') {
    direction = 'out'
  }

  if (direction !== 'inside' && direction !== 'out') {
    return { lines: ['Choose a direction. Try inside or out.'] }
  }

  const currentRoom = state.rooms[state.doc.currentRoomId]
  const nextRoomId = currentRoom.exits[direction]
  if (!nextRoomId) {
    return {
      lines: [
        "You can't go that way.",
        'Type "help" to see options or "look" to check exits.',
      ],
    }
  }

  const updates: Partial<GameStateDoc> = {
    currentRoomId: nextRoomId,
  }

  let doubtTrigger: DoubtTrigger | undefined

  if (nextRoomId === 'main') {
    updates.doubtPhase = updateDoubtPhase(state.doc.doubtPhase, 1)
    doubtTrigger = 'enteredMain'
  }

  state.doc.currentRoomId = nextRoomId
  state.doc.doubtPhase = updates.doubtPhase ?? state.doc.doubtPhase

  const destination = state.rooms[nextRoomId]
  const intro = nextRoomId === 'main' && !state.hasSeenMainIntro
  state.hasSeenMainIntro = state.hasSeenMainIntro || nextRoomId === 'main'

  return {
    lines: [`You move ${direction}.`, ...describeRoom(destination, { isMainIntro: intro })],
    updates,
    doubtTrigger,
  }
}

function handleExamine(
  state: RuntimeState,
  target: NonNullable<ParsedCommand['target']>,
): CommandResult {
  const inMain = state.doc.currentRoomId === 'main'

  switch (target) {
    case 'room':
      return { lines: describeRoom(state.rooms[state.doc.currentRoomId], { isMainIntro: false }) }
    case 'desk':
      if (!inMain) return { lines: ["There's nothing like that here."] }
      if (state.doc.puzzle.solved && !state.doc.puzzle.keyTaken) {
        return {
          lines: [
            'The desk drawer hangs slightly open now.',
            'Something glints inside.',
          ],
        }
      }
      if (state.doc.puzzle.solved && state.doc.puzzle.keyTaken) {
        return { lines: ['The desk is quiet and empty now.'] }
      }
      return {
        lines: [
          'The desk is old but well-kept.',
          'A drawer is set into it, locked by a small code panel.',
        ],
      }
    case 'drawer':
      if (!inMain) return { lines: ["There's nothing like that here."] }
      if (!state.doc.puzzle.drawerUnlocked) {
        return {
          lines: [
            'The drawer is locked.',
            'A small code panel waits for four digits.',
          ],
        }
      }
      if (!state.doc.puzzle.keyTaken) {
        return { lines: ['The drawer can be opened.'] }
      }
      return { lines: ['The drawer is empty.'] }
    case 'mirror':
      if (!inMain) return { lines: ["There's nothing like that here."] }
      if (state.doc.puzzle.solved) {
        return {
          lines: [
            'The mirror looks normal now.',
            'The scratches are easier to notice.',
          ],
        }
      }
      return {
        lines: [
          'The mirror reflects the room.',
          'Something about it feels watched.',
        ],
      }
    case 'table':
      if (!inMain) return { lines: ["There's nothing like that here."] }
      if (state.doc.puzzle.solved) {
        return {
          lines: [
            'The table seems unchanged.',
            'Only you feel different.',
          ],
        }
      }
      return {
        lines: [
          'Dust lies across the table.',
          'It has not been used in a long time.',
        ],
      }
    default:
      return { lines: ["You don't see that here."] }
  }
}

function handleSearch(state: RuntimeState): CommandResult {
  if (state.doc.currentRoomId !== 'main') {
    return { lines: ['You search around but find nothing useful.'] }
  }

  if (!state.doc.puzzle.solved) {
    return {
      lines: [
        'You search the room carefully.',
        "On the mirror's edge, faint scratches form four numbers: 4 3 1 2",
      ],
    }
  }

  return {
    lines: [
      'You search again.',
      'Nothing else seems important.',
    ],
  }
}

function handleOpenDrawer(state: RuntimeState): CommandResult {
  if (state.doc.currentRoomId !== 'main') {
    return { lines: ["There's no drawer here."] }
  }
  if (!state.doc.puzzle.drawerUnlocked) {
    return { lines: ['It will not open.'] }
  }
  if (state.doc.puzzle.keyTaken) {
    return { lines: ['The drawer is empty.'] }
  }
  return {
    lines: ['The drawer opens.', 'Inside is a brass key.'],
    doubtTrigger: 'openedDrawer',
  }
}

function handleEnterCode(state: RuntimeState, code: string): CommandResult {
  if (state.doc.currentRoomId !== 'main') {
    return { lines: ["There's nowhere to enter a code here."] }
  }

  if (state.doc.puzzle.drawerUnlocked) {
    return { lines: ['The panel is already quiet.'] }
  }

  if (code === '4312') {
    const updates: Partial<GameStateDoc> = {
      puzzle: { ...state.doc.puzzle, drawerUnlocked: true, solved: true },
      doubtPhase: updateDoubtPhase(state.doc.doubtPhase, 2),
    }

    state.doc.puzzle = updates.puzzle!
    state.doc.doubtPhase = updates.doubtPhase!

    return {
      lines: ['The panel clicks.', 'The drawer unlocks.'],
      updates,
      doubtTrigger: 'solvedCode',
    }
  }

  return { lines: ['The panel buzzes softly.', 'Nothing opens.'] }
}

function handleTakeKey(state: RuntimeState): CommandResult {
  if (state.doc.currentRoomId !== 'main') {
    return { lines: ["You don't see a key to take."] }
  }
  if (!state.doc.puzzle.drawerUnlocked) {
    return { lines: ["You don't see a key to take."] }
  }
  if (state.doc.puzzle.keyTaken) {
    return { lines: ['You already have the brass key.'] }
  }

  const inventory = state.doc.inventory.includes('brass key')
    ? state.doc.inventory
    : [...state.doc.inventory, 'brass key']

  const updates: Partial<GameStateDoc> = {
    inventory,
    puzzle: { ...state.doc.puzzle, keyTaken: true },
    doubtPhase: updateDoubtPhase(state.doc.doubtPhase, 3),
  }

  state.doc.inventory = inventory
  state.doc.puzzle = updates.puzzle!
  state.doc.doubtPhase = updates.doubtPhase!

  return {
    lines: ['You take the brass key.'],
    updates,
    doubtTrigger: 'tookKey',
  }
}

function handleInventory(state: RuntimeState): CommandResult {
  if (!state.doc.inventory.length) {
    return { lines: ['You are carrying nothing.'] }
  }
  return { lines: ['You are carrying:', '- brass key'] }
}

function handleAiToggle(state: RuntimeState, enabled: boolean): CommandResult {
  const updates: Partial<GameStateDoc> = { aiHelpEnabled: enabled }
  state.doc.aiHelpEnabled = enabled
  return { lines: [`AI help ${enabled ? 'enabled' : 'disabled'}.`], updates }
}

export function processCommand(state: RuntimeState, command: ParsedCommand): CommandResult {
  if (state.quit) return { lines: ['SESSION ENDED'] }

  switch (command.kind) {
    case 'help':
      return {
        lines: [
          'COMMANDS',
          'help, commands       show this list',
          'look                 describe the room',
          'enter                go inside (entrance only)',
          'back                 go out (main room only)',
          'go inside/out        move between rooms',
          'go north/east/west   (blocked for now)',
          '',
          'examine X            desk, drawer, mirror, table, room',
          'search               search the room for clues',
          'open drawer          try the drawer',
          'enter code ####      attempt a 4-digit code',
          'take key             take the brass key',
          'inventory            show items',
          'quit                 end session',
        ],
      }

    case 'look':
      return { lines: describeRoom(state.rooms[state.doc.currentRoomId], { isMainIntro: false }) }

    case 'move':
      if (!command.direction) return { lines: ['Choose a direction. Try inside or out.'] }
      return move(state, command.direction)

    case 'examine':
      if (!command.target) return { lines: ['Examine what?'] }
      return handleExamine(state, command.target)

    case 'search':
      return handleSearch(state)

    case 'openDrawer':
      return handleOpenDrawer(state)

    case 'enterCode':
      return handleEnterCode(state, command.code ?? '')

    case 'takeKey':
      return handleTakeKey(state)

    case 'inventory':
      return handleInventory(state)

    case 'aiToggle':
      return handleAiToggle(state, Boolean(command.aiEnabled))

    case 'mmmHelp':
      return { lines: getFullManual(), doubtTrigger: undefined }

    case 'mmmHelpCommand': {
      const helpLines = command.helpQuery ? getCommandHelp(command.helpQuery) : null
      if (!helpLines) {
        return { lines: ["I don't have help for that yet. Try: mmm help"] }
      }
      return { lines: helpLines }
    }

    case 'mmmRoom': {
      const room = state.rooms[state.doc.currentRoomId]
      if (room.id === 'entrance') {
        return {
          lines: [
            'You stand before a creaking door. A dim light spills from inside.',
            'Exit: INSIDE',
          ],
        }
      }
      return {
        lines: [
          'The main room is quiet.',
          'You see:',
          '- a table',
          '- a desk',
          '- a mirror',
          '- doorways to the north, east, and west (blocked)',
          '- the doorway back out',
          'Exits: OUT, NORTH (blocked), EAST (blocked), WEST (blocked)',
        ],
      }
    }

    case 'mmmExit': {
      if (state.doc.currentRoomId === 'entrance') {
        return {
          lines: ['You are already at the entrance. The way is inside.'],
        }
      }
      return move(state, 'out')
    }

    case 'quit':
      state.quit = true
      return { lines: ['SESSION ENDED'] }

    case 'unknown':
    default:
      return { lines: ['Command not recognized. Type "help" for options.'], doubtTrigger: 'unknownCommand' }
  }
}
