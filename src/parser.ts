export type CommandKind =
  | 'help'
  | 'look'
  | 'move'
  | 'examine'
  | 'search'
  | 'openDrawer'
  | 'enterCode'
  | 'takeKey'
  | 'inventory'
  | 'aiToggle'
  | 'mmmHelp'
  | 'mmmHelpCommand'
  | 'mmmRoom'
  | 'mmmExit'
  | 'quit'
  | 'unknown'

export interface ParsedCommand {
  kind: CommandKind
  raw: string
  direction?: 'inside' | 'out' | 'north' | 'east' | 'west' | 'south'
  target?: 'desk' | 'drawer' | 'room' | 'mirror' | 'table'
  code?: string
  aiEnabled?: boolean
  helpQuery?: string
}

const directionAliases: Record<string, ParsedCommand['direction']> = {
  inside: 'inside',
  in: 'inside',
  into: 'inside',
  out: 'out',
  outside: 'out',
  exit: 'out',
  north: 'north',
  n: 'north',
  east: 'east',
  e: 'east',
  west: 'west',
  w: 'west',
  south: 'south',
  s: 'south',
}

const examineTargets: Record<string, ParsedCommand['target']> = {
  desk: 'desk',
  drawer: 'drawer',
  room: 'room',
  mirror: 'mirror',
  table: 'table',
}

function parseEnterCode(cleaned: string, raw: string): ParsedCommand | null {
  const match = cleaned.match(/^(enter|use)\s+code\s+(\d{4})$/)
  if (match) {
    return { kind: 'enterCode', raw, code: match[2] }
  }
  return null
}

export function parseCommand(input: string): ParsedCommand {
  const raw = input
  const cleaned = input.trim().toLowerCase().replace(/\s+/g, ' ')

  if (!cleaned) {
    return { kind: 'unknown', raw }
  }

  if (cleaned === 'help' || cleaned === 'commands') return { kind: 'help', raw }
  if (cleaned === 'look') return { kind: 'look', raw }
  if (cleaned === 'quit' || cleaned === 'exit') return { kind: 'quit', raw }
  if (cleaned === 'inventory' || cleaned === 'inv') return { kind: 'inventory', raw }
  if (cleaned === 'ai help on') return { kind: 'aiToggle', raw, aiEnabled: true }
  if (cleaned === 'ai help off') return { kind: 'aiToggle', raw, aiEnabled: false }

  if (cleaned.startsWith('mmm')) {
    const rest = cleaned.slice(3).trim()
    if (rest === 'help') {
      return { kind: 'mmmHelp', raw }
    }
    if (rest.startsWith('help -')) {
      return { kind: 'mmmHelpCommand', raw, helpQuery: rest.slice(7).trim() }
    }
    if (rest === 'room' || rest === 'room description') {
      return { kind: 'mmmRoom', raw }
    }
    if (rest === 'exit') {
      return { kind: 'mmmExit', raw }
    }
    return { kind: 'unknown', raw }
  }

  if (cleaned === 'enter' || cleaned === 'go inside') {
    return { kind: 'move', direction: 'inside', raw }
  }
  if (cleaned === 'back' || cleaned === 'go out') {
    return { kind: 'move', direction: 'out', raw }
  }
  if (cleaned.startsWith('go ')) {
    const dir = cleaned.slice(3).trim()
    const direction = directionAliases[dir]
    if (direction) {
      return { kind: 'move', direction, raw }
    }
    return { kind: 'unknown', raw }
  }

  if (cleaned.startsWith('examine ')) {
    const target = examineTargets[cleaned.slice(8).trim()]
    if (target) {
      return { kind: 'examine', target, raw }
    }
    return { kind: 'unknown', raw }
  }

  if (cleaned === 'search' || cleaned === 'search room') {
    return { kind: 'search', raw }
  }

  if (cleaned === 'open drawer') {
    return { kind: 'openDrawer', raw }
  }

  const codeAttempt = parseEnterCode(cleaned, raw)
  if (codeAttempt) return codeAttempt

  if (cleaned === 'take key' || cleaned === 'grab key') {
    return { kind: 'takeKey', raw }
  }

  return { kind: 'unknown', raw }
}
