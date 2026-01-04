export type DoubtTrigger =
  | 'enteredEntrance'
  | 'enteredMain'
  | 'blockedExitAttempt'
  | 'solvedCode'
  | 'openedDrawer'
  | 'tookKey'
  | 'unknownCommand'
  | 'typoWhisper'

const lineBank: Record<number, Partial<Record<DoubtTrigger, string[]>>> = {
  0: {
    enteredEntrance: ["I'm already ahead of you.", 'I am here.', 'I know why you stopped.'],
    unknownCommand: ['You hesitate. I notice.', 'I see your doubt.'],
  },
  1: {
    enteredMain: ["I don't like this room.", "I thought you'd stop.", 'I can still turn you around.'],
    blockedExitAttempt: ['That hall is mine.', 'Not that way.'],
    unknownCommand: ['The room unsettles you, does it not?', 'Still unsure. I hear it.'],
  },
  2: {
    solvedCode: ["It pauses.", "It didn't expect you to learn.", 'It speaks, but weaker.'],
    openedDrawer: ['Something just shifted...', 'You moved it forward.'],
    unknownCommand: ['Even now, you question?'],
  },
  3: {
    tookKey: ['A quiet that was not there before.', '...'],
    unknownCommand: ['Silence answers you.'],
  },
}

export function clampPhase(phase: number) {
  return Math.max(0, Math.min(3, Math.floor(phase)))
}

export function updatePhase(current: number, trigger: DoubtTrigger) {
  const phase = clampPhase(current)
  switch (trigger) {
    case 'enteredMain':
      return Math.max(phase, 1)
    case 'solvedCode':
      return Math.max(phase, 2)
    case 'tookKey':
      return 3
    default:
      return phase
  }
}

export function getDoubtLine(
  phase: number,
  trigger: DoubtTrigger,
  lastLine?: string | null,
): string | null {
  const bank = lineBank[clampPhase(phase)]?.[trigger]
  if (!bank || bank.length === 0) return null
  const shuffled = [...bank].sort(() => Math.random() - 0.5)
  const chosen = shuffled.find((line) => line !== lastLine) ?? bank[0]
  return chosen
}

const typoWhispers = [
  'I fixed that.',
  'You meant…',
  'Careful.',
  'Small slip.',
  'Typos are doors.',
  'I noticed.',
  'Again?',
  'Slow down.',
]

export function getTypoWhisper(lastLine?: string | null) {
  const shuffled = [...typoWhispers].sort(() => Math.random() - 0.5)
  const chosen = shuffled.find((line) => line !== lastLine) ?? typoWhispers[0]
  return chosen
}
