/** Generic system interface — all engine systems implement this */
export interface System {
  update(delta: number, elapsed: number): void
  dispose?(): void
}

/** Engine configuration passed at initialization */
export interface EngineConfig {
  container: HTMLElement
  systems: System[]
}

/** Event handler type for the event bus */
export type EventHandler<T = unknown> = (data: T) => void
