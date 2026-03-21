// Deadzone for analog sticks
const STICK_DEADZONE = 0.15

function applyDeadzone(value: number): number {
  if (Math.abs(value) < STICK_DEADZONE) return 0
  const sign = Math.sign(value)
  return sign * (Math.abs(value) - STICK_DEADZONE) / (1 - STICK_DEADZONE)
}

export class InputManager {
  private keys: Set<string> = new Set()
  private mouseDeltaX = 0
  private mouseDeltaY = 0
  private locked = false
  private jumpQueued = false
  private flyToggleQueued = false
  private gliderToggleQueued = false
  private grappleQueued = false
  private interactQueued = false
  private journalToggleQueued = false
  private campfireQueued = false
  private fastTravelQueued = false
  private muteToggleQueued = false
  crouchHeld = false

  // Gamepad state
  gamepadLeftX = 0
  gamepadLeftY = 0
  gamepadRightX = 0
  gamepadRightY = 0
  gamepadSprint = false
  gamepadJump = false
  gamepadAscend = false
  gamepadDescend = false
  gamepadConnected = false
  private prevJumpButton = false
  private prevFlyButton = false

  constructor() {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code)
      if (e.code === 'Space') this.jumpQueued = true
      if (e.code === 'KeyF') this.flyToggleQueued = true
      if (e.code === 'KeyG') this.gliderToggleQueued = true
      if (e.code === 'KeyQ') this.grappleQueued = true
      if (e.code === 'KeyE') this.interactQueued = true
      if (e.code === 'KeyJ') this.journalToggleQueued = true
      if (e.code === 'KeyC') this.campfireQueued = true
      if (e.code === 'KeyT') this.fastTravelQueued = true
      if (e.code === 'KeyV') this.muteToggleQueued = true
    })
    document.addEventListener('keyup', (e) => this.keys.delete(e.code))
    document.addEventListener('keydown', (e) => { if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.crouchHeld = true })
    document.addEventListener('keyup', (e) => { if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.crouchHeld = false })
    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDeltaX += e.movementX
        this.mouseDeltaY += e.movementY
      }
    })
    document.addEventListener('pointerlockchange', () => {
      this.locked = !!document.pointerLockElement
    })

    window.addEventListener('gamepadconnected', () => { this.gamepadConnected = true })
    window.addEventListener('gamepaddisconnected', () => { this.gamepadConnected = false })
  }

  /** Poll gamepad state — call once per frame */
  pollGamepad() {
    const gamepads = navigator.getGamepads()
    let gp: Gamepad | null = null
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) { gp = gamepads[i]; break }
    }
    if (!gp) {
      this.gamepadLeftX = 0; this.gamepadLeftY = 0
      this.gamepadRightX = 0; this.gamepadRightY = 0
      this.gamepadSprint = false; this.gamepadJump = false
      return
    }

    this.gamepadConnected = true

    // Standard gamepad mapping:
    // Left stick: axes 0 (X), 1 (Y)
    // Right stick: axes 2 (X), 3 (Y)
    this.gamepadLeftX  = applyDeadzone(gp.axes[0] ?? 0)
    this.gamepadLeftY  = applyDeadzone(gp.axes[1] ?? 0)
    this.gamepadRightX = applyDeadzone(gp.axes[2] ?? 0)
    this.gamepadRightY = applyDeadzone(gp.axes[3] ?? 0)

    // Buttons (standard mapping):
    // 0 = X/A (cross), 1 = O/B (circle), 2 = □/X (square), 3 = △/Y (triangle)
    // 4 = L1, 5 = R1, 6 = L2, 7 = R2
    // 8 = Share, 9 = Options, 10 = L3 (stick press), 11 = R3 (stick press)
    // 12 = D-Up, 13 = D-Down, 14 = D-Left, 15 = D-Right
    const jumpButton = gp.buttons[0]?.pressed ?? false  // Cross/A to jump
    this.gamepadSprint = (gp.buttons[10]?.pressed ?? false) || (gp.buttons[6]?.value ?? 0) > 0.5  // L3 or L2 to sprint

    // Edge-detect jump (only trigger on press, not hold)
    if (jumpButton && !this.prevJumpButton) {
      this.jumpQueued = true
    }
    this.prevJumpButton = jumpButton

    // Fly toggle via Triangle/Y (button 3) with edge detection
    const flyButton = gp.buttons[3]?.pressed ?? false
    if (flyButton && !this.prevFlyButton) {
      this.flyToggleQueued = true
    }
    this.prevFlyButton = flyButton

    // Ascend/Descend for fly mode
    this.gamepadAscend = gp.buttons[4]?.pressed ?? false
    this.gamepadDescend = gp.buttons[5]?.pressed ?? false
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

  consumeFlyToggle(): boolean {
    const v = this.flyToggleQueued
    this.flyToggleQueued = false
    return v
  }

  consumeGliderToggle(): boolean {
    const v = this.gliderToggleQueued
    this.gliderToggleQueued = false
    return v
  }

  consumeGrapple(): boolean {
    const v = this.grappleQueued
    this.grappleQueued = false
    return v
  }

  consumeInteract(): boolean {
    const v = this.interactQueued
    this.interactQueued = false
    return v
  }

  consumeJournalToggle(): boolean {
    const v = this.journalToggleQueued
    this.journalToggleQueued = false
    return v
  }

  consumeCampfire(): boolean {
    const v = this.campfireQueued
    this.campfireQueued = false
    return v
  }

  consumeFastTravel(): boolean {
    const v = this.fastTravelQueued
    this.fastTravelQueued = false
    return v
  }

  consumeMuteToggle(): boolean {
    const v = this.muteToggleQueued
    this.muteToggleQueued = false
    return v
  }
}
