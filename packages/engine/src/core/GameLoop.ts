import type { System } from './types'

const FIXED_DT = 1 / 60 // 60 Hz physics step
const MAX_FRAME_DT = 0.1 // clamp to avoid spiral of death

/**
 * Fixed-timestep game loop.
 * Systems are updated at a fixed rate (60Hz). Rendering happens every frame.
 * Games register systems in execution order.
 */
export class GameLoop {
  private systems: System[] = []
  private running = false
  private lastTime = 0
  private accumulator = 0
  private elapsed = 0
  private frameId = 0

  /** Register a system. Systems update in registration order. */
  addSystem(system: System): void {
    this.systems.push(system)
  }

  /** Remove a system. */
  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system)
    if (idx !== -1) this.systems.splice(idx, 1)
  }

  /** Start the loop. */
  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now() / 1000
    this.accumulator = 0
    this.tick()
  }

  /** Stop the loop. */
  stop(): void {
    this.running = false
    if (this.frameId) cancelAnimationFrame(this.frameId)
  }

  /** Current elapsed time in seconds. */
  getElapsed(): number {
    return this.elapsed
  }

  private tick = (): void => {
    if (!this.running) return
    this.frameId = requestAnimationFrame(this.tick)

    const now = performance.now() / 1000
    let frameDt = now - this.lastTime
    this.lastTime = now

    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT

    this.accumulator += frameDt

    while (this.accumulator >= FIXED_DT) {
      for (const system of this.systems) {
        system.update(FIXED_DT, this.elapsed)
      }
      this.elapsed += FIXED_DT
      this.accumulator -= FIXED_DT
    }
  }

  /** Dispose all systems and stop the loop. */
  dispose(): void {
    this.stop()
    for (const system of this.systems) {
      system.dispose?.()
    }
    this.systems.length = 0
  }
}
