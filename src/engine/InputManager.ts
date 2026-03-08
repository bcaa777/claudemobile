export class InputManager {
  private keys: Set<string> = new Set()
  private mouseDeltaX = 0
  private mouseDeltaY = 0
  private locked = false
  private jumpQueued = false

  constructor() {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (e.code === 'Space') this.jumpQueued = true
    })
    document.addEventListener('keyup', (e) => this.keys.delete(e.code))
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDeltaX += e.movementX
        this.mouseDeltaY += e.movementY
      }
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = !!document.pointerLockElement
    })
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }

  consumeMouseDelta(): { dx: number; dy: number } {
    const result = { dx: this.mouseDeltaX, dy: this.mouseDeltaY }
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
    return result
  }

  isPointerLocked(): boolean {
    return this.locked
  }

  consumeJump(): boolean {
    const v = this.jumpQueued
    this.jumpQueued = false
    return v
  }
}
