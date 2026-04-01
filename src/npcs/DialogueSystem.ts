const CHARS_PER_SEC = 30

export class DialogueSystem {
  private container: HTMLElement
  private nameEl: HTMLElement
  private textEl: HTMLElement
  private promptEl: HTMLElement
  private interactPrompt: HTMLElement

  private lines: string[] = []
  private currentLine = 0
  private charIndex = 0
  private charTimer = 0
  private active = false
  private fullTextShown = false
  private onSpeak: ((text: string) => void) | null = null
  private onClose: (() => void) | null = null

  constructor() {
    this.container = document.getElementById('dialogue-box')!
    this.nameEl = document.getElementById('dialogue-name')!
    this.textEl = document.getElementById('dialogue-text')!
    this.promptEl = document.getElementById('dialogue-prompt')!
    this.interactPrompt = document.getElementById('interact-prompt')!
  }

  startDialogue(name: string, title: string, lines: string[]) {
    this.lines = lines
    this.currentLine = 0
    this.charIndex = 0
    this.charTimer = 0
    this.active = true
    this.fullTextShown = false

    this.nameEl.textContent = `${name} — ${title}`
    this.textEl.textContent = ''
    this.promptEl.textContent = '[E] Continue'
    this.container.style.display = 'block'
    if (this.onSpeak && this.lines.length > 0) {
      this.onSpeak(this.lines[0])
    }
    this.hideInteractPrompt()
  }

  setOnSpeak(cb: ((text: string) => void) | null, onClose?: (() => void) | null): void {
    this.onSpeak = cb
    this.onClose = onClose ?? null
  }

  /** Call when E is pressed. Returns true if dialogue consumed the input. */
  handleInteract(): boolean {
    if (!this.active) return false

    if (!this.fullTextShown) {
      // Show full text instantly
      this.textEl.textContent = this.lines[this.currentLine]
      this.fullTextShown = true
      this.promptEl.textContent = this.currentLine < this.lines.length - 1 ? '[E] Continue' : '[E] Close'
      return true
    }

    // Advance to next line or close
    this.currentLine++
    if (this.currentLine >= this.lines.length) {
      this.close()
      return true
    }

    // Start next line
    this.charIndex = 0
    this.charTimer = 0
    this.fullTextShown = false
    this.textEl.textContent = ''
    this.promptEl.textContent = '[E] Continue'
    if (this.onSpeak) {
      this.onSpeak(this.lines[this.currentLine])
    }
    return true
  }

  update(delta: number) {
    if (!this.active || this.fullTextShown) return

    this.charTimer += delta
    const charsToShow = Math.floor(this.charTimer * CHARS_PER_SEC)
    const line = this.lines[this.currentLine]

    if (charsToShow >= line.length) {
      this.textEl.textContent = line
      this.fullTextShown = true
      this.promptEl.textContent = this.currentLine < this.lines.length - 1 ? '[E] Continue' : '[E] Close'
    } else if (charsToShow > this.charIndex) {
      this.charIndex = charsToShow
      this.textEl.textContent = line.substring(0, this.charIndex)
    }
  }

  isActive(): boolean {
    return this.active
  }

  close() {
    this.active = false
    this.container.style.display = 'none'
    this.lines = []
    if (this.onClose) this.onClose()
    this.onSpeak = null
    this.onClose = null
  }

  showInteractPrompt() {
    this.interactPrompt.style.display = 'block'
  }

  hideInteractPrompt() {
    this.interactPrompt.style.display = 'none'
  }
}
