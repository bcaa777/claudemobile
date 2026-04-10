import type { EventHandler } from './types'

/**
 * Typed event bus for cross-system communication.
 * Systems subscribe to events by name. Any system can emit events.
 * Handlers are called synchronously in subscription order.
 */
export class EventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>()

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  /** Emit an event to all subscribers. */
  emit<T = unknown>(event: string, data: T): void {
    const set = this.handlers.get(event)
    if (set) {
      for (const handler of set) {
        handler(data)
      }
    }
  }

  /** Remove all handlers for an event, or all handlers if no event specified. */
  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
  }
}
