const manualSections: Record<string, string[]> = {
  Movement: [
    'Movement:',
    '- enter / go inside: step from entrance into main room.',
    '- back / go out: return to the entrance.',
    '- go north/east/west: exits are blocked for now.',
    '',
    'Examples:',
    '- enter',
    '- go inside',
    '- back',
    '- go west (will be blocked)',
  ],
  Interact: [
    'Looking / Interacting:',
    '- look: describe the current room.',
    '- examine desk/drawer/mirror/table/room.',
    '- search: look for clues.',
    '- open drawer: try the drawer.',
    '- take key: pick up the brass key if visible.',
    '',
    'Examples:',
    '- look',
    '- examine mirror',
    '- search',
    '- open drawer',
    '- take key',
  ],
  Puzzle: [
    'Puzzle:',
    '- enter code #### / use code ####: try a 4-digit code (4312 is correct).',
    '- Drawer unlocks with the right code; then take the brass key.',
    '',
    'Examples:',
    '- enter code 4312',
    '- use code 4312',
  ],
  AI: [
    'AI Help:',
    '- ai help on / ai help off: toggle AI typo helper.',
    '- AI only tries to fix small typos in known commands.',
    '',
    'Example:',
    '- ai help on',
  ],
  Debug: [
    'Debug / Manual (MMM):',
    '- mmm help: full manual (this).',
    '- mmm help -<command>: detailed help for one command.',
    '- mmm room description: print room info + exits.',
    '- mmm exit: leave current room (like back/out).',
    '',
    'Examples:',
    '- mmm help',
    '- mmm help -look',
    '- mmm room description',
    '- mmm exit',
  ],
  Other: [
    'Other:',
    '- inventory: list what you carry.',
    '- quit / exit: end the session.',
    '',
    'Examples:',
    '- inventory',
    '- quit',
  ],
}

interface CommandHelpEntry {
  keys: string[]
  lines: string[]
}

const commandHelpEntries: CommandHelpEntry[] = [
  {
    keys: ['help', 'commands'],
    lines: [
      'HELP',
      'Shows the brief command list.',
      'Syntax: help',
      'Example: help',
    ],
  },
  {
    keys: ['look'],
    lines: [
      'LOOK',
      'Describe the current room.',
      'Syntax: look',
      'Example: look',
    ],
  },
  {
    keys: ['go', 'move'],
    lines: [
      'GO',
      'Move between rooms. North/east/west are blocked for now.',
      'Syntax: go inside | go out | go north | go east | go west',
      'Examples:',
      '- go inside',
      '- go out',
      '- go west (blocked)',
    ],
  },
  {
    keys: ['enter'],
    lines: ['ENTER', 'Same as go inside from entrance.', 'Syntax: enter', 'Example: enter'],
  },
  {
    keys: ['back'],
    lines: ['BACK', 'Return to the entrance.', 'Syntax: back | go out', 'Example: back'],
  },
  {
    keys: ['examine'],
    lines: [
      'EXAMINE',
      'Inspect something in the room.',
      'Syntax: examine desk|drawer|mirror|table|room',
      'Examples:',
      '- examine desk',
      '- examine mirror',
      '- examine room',
    ],
  },
  {
    keys: ['search'],
    lines: ['SEARCH', 'Look for clues.', 'Syntax: search | search room', 'Example: search'],
  },
  {
    keys: ['open drawer'],
    lines: [
      'OPEN DRAWER',
      'Try to open the drawer.',
      'Syntax: open drawer',
      'Example: open drawer',
      'Note: requires the code first.',
    ],
  },
  {
    keys: ['enter code', 'use code'],
    lines: [
      'ENTER CODE',
      'Enter a 4-digit code. The correct code is 4312.',
      'Syntax: enter code #### | use code ####',
      'Examples:',
      '- enter code 4312',
      '- use code 4312',
    ],
  },
  {
    keys: ['take key'],
    lines: ['TAKE KEY', 'Pick up the brass key if visible.', 'Syntax: take key', 'Example: take key'],
  },
  {
    keys: ['inventory'],
    lines: [
      'INVENTORY',
      'List what you are carrying.',
      'Syntax: inventory | inv',
      'Example: inventory',
    ],
  },
  {
    keys: ['ai help'],
    lines: [
      'AI HELP',
      'Toggle AI typo helper (fixes small mistakes).',
      'Syntax: ai help on | ai help off',
      'Examples:',
      '- ai help on',
      '- ai help off',
    ],
  },
  {
    keys: ['quit'],
    lines: [
      'QUIT',
      'End the session.',
      'Syntax: quit | exit',
      'Example: quit',
    ],
  },
  {
    keys: ['mmm help'],
    lines: [
      'MMM HELP',
      'Show the full manual.',
      'Syntax: mmm help',
      'Example: mmm help',
    ],
  },
  {
    keys: ['mmm room description', 'mmm room'],
    lines: [
      'MMM ROOM DESCRIPTION',
      'Print the current room description and exits.',
      'Syntax: mmm room description | mmm room',
      'Example: mmm room description',
    ],
  },
  {
    keys: ['mmm exit'],
    lines: [
      'MMM EXIT',
      'Leave the current room (like back/out).',
      'Syntax: mmm exit',
      'Examples:',
      '- mmm exit (from main: goes to entrance)',
      '- mmm exit (from entrance: tells you to go inside)',
    ],
  },
]

export function getFullManual(): string[] {
  return [
    'MMM MANUAL',
    '-------------',
    ...manualSections.Movement,
    '',
    ...manualSections.Interact,
    '',
    ...manualSections.Puzzle,
    '',
    ...manualSections.AI,
    '',
    ...manualSections.Debug,
    '',
    ...manualSections.Other,
  ]
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getCommandHelp(query: string): string[] | null {
  const normalized = normalizeQuery(query.replace(/^-+/, ''))

  const match = commandHelpEntries.find((entry) =>
    entry.keys.some((key) => normalizeQuery(key) === normalized),
  )

  if (!match) return null

  return match.lines
}
