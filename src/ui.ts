export const terminal = document.getElementById('terminal-output') as HTMLDivElement
export const statusLine = document.getElementById('status-line') as HTMLDivElement
export const statusEmail = document.getElementById('status-email') as HTMLSpanElement
export const statusAi = document.getElementById('status-ai') as HTMLSpanElement
export const commandForm = document.getElementById('command-form') as HTMLFormElement
export const commandInput = document.getElementById('command-input') as HTMLInputElement
export const typewriterToggle = document.getElementById('typewriter-toggle') as HTMLButtonElement
export const loginScreen = document.getElementById('login-screen') as HTMLDivElement
export const deniedScreen = document.getElementById('denied-screen') as HTMLDivElement
export const deniedEmail = document.getElementById('denied-email') as HTMLParagraphElement
export const gameScreen = document.getElementById('game-screen') as HTMLDivElement
export const signInButton = document.getElementById('sign-in') as HTMLButtonElement
export const signOutButton = document.getElementById('sign-out') as HTMLButtonElement
export const deniedSignOutButton = document.getElementById('denied-sign-out') as HTMLButtonElement
export const doubtOverlay = document.getElementById('doubt-overlay') as HTMLDivElement

export const uiState = {
  typewriterEnabled: false,
}

export function setStatus(text: string) {
  statusLine.textContent = text.toUpperCase()
}

export function setStatusEmail(text: string) {
  statusEmail.textContent = text || ''
}

export function setStatusAi(enabled: boolean) {
  statusAi.textContent = enabled ? 'AI HELP: ON' : 'AI HELP: OFF'
}

export function showLogin() {
  loginScreen.classList.remove('hidden')
  deniedScreen.classList.add('hidden')
  gameScreen.classList.add('hidden')
  commandInput.disabled = true
}

export function showDenied(email?: string | null) {
  loginScreen.classList.add('hidden')
  deniedScreen.classList.remove('hidden')
  gameScreen.classList.add('hidden')
  deniedEmail.textContent = email ? `Signed in as ${email}` : 'Signed in, not approved.'
  commandInput.disabled = true
}

export function showGame() {
  loginScreen.classList.add('hidden')
  deniedScreen.classList.add('hidden')
  gameScreen.classList.remove('hidden')
  commandInput.disabled = false
  commandInput.focus()
}

function scrollToBottom() {
  terminal.scrollTop = terminal.scrollHeight
}

export function appendLine(text: string, useTypewriter = uiState.typewriterEnabled) {
  const line = document.createElement('div')
  line.className = 'line monospace'
  terminal.appendChild(line)

  if (!text) {
    line.textContent = ''
    scrollToBottom()
    return
  }

  if (!useTypewriter) {
    line.textContent = text
    scrollToBottom()
    return
  }

  let index = 0
  const step = () => {
    line.textContent = text.slice(0, index)
    scrollToBottom()
    index += 1
    if (index <= text.length) {
      window.setTimeout(step, 12)
    }
  }

  step()
}

export function appendLines(lines: string[], useTypewriter?: boolean) {
  lines.forEach((line) => appendLine(line, useTypewriter))
}

export function clearTerminal() {
  terminal.innerHTML = ''
}

export function disableInput(message?: string) {
  commandInput.disabled = true
  if (message) {
    appendLine(message, false)
  }
}

export function toggleTypewriter() {
  uiState.typewriterEnabled = !uiState.typewriterEnabled
  typewriterToggle.textContent = uiState.typewriterEnabled ? 'Typewriter: On' : 'Typewriter: Off'
}

export function setDoubtLine(text: string) {
  doubtOverlay.textContent = text || ''
}
