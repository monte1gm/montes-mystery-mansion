const canonicalCommands = [
  'help',
  'commands',
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
]

function levenshtein(a: string, b: string) {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }
  return dp[m][n]
}

function withinThreshold(input: string, target: string): boolean {
  const len = target.length
  const dist = levenshtein(input, target)
  if (len <= 4) return dist <= 1
  if (len <= 9) return dist <= 2
  return dist <= 3
}

export function isLikelyTypo(raw: string): boolean {
  const cleaned = raw.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!cleaned) return false

  // Handle code patterns with wrong length digits
  const codeMatch = cleaned.match(/^(enter|use)\s+code\s+(\d+)$/)
  if (codeMatch) {
    const digits = codeMatch[2]
    if (digits.length !== 4 && digits.length > 0 && digits.length <= 5) {
      return true
    }
  }

  for (const target of canonicalCommands) {
    // Replace #### placeholder for code patterns
    if (target.includes('####')) {
      const stripped = target.replace(' ####', '')
      if (cleaned.startsWith(stripped)) {
        return true
      }
    }

    if (withinThreshold(cleaned, target)) {
      return true
    }
  }

  return false
}
