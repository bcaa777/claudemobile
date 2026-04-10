import { createWorld, IWorld } from 'bitecs'

/**
 * Create a new bitECS world.
 * Each game creates its own world instance.
 */
export function createGameWorld(): IWorld {
  return createWorld()
}

export type GameWorld = IWorld
