import { addEntity, addComponent } from 'bitecs'
import type { IWorld } from 'bitecs'
import {
  Position, Velocity, Health, Renderable, AIState, WeaponComponent,
  IsPlayer, IsEnemy, IsCompanion, IsProjectile, IsPickup,
} from './components'

interface CreateEntityOptions {
  position?: { x: number; y: number; z: number }
  velocity?: { x: number; y: number; z: number }
  health?: { current: number; max: number }
  meshId?: number
}

/** Create a generic entity with specified components */
export function createEntity(world: IWorld, opts: CreateEntityOptions = {}): number {
  const eid = addEntity(world)

  if (opts.position) {
    addComponent(world, Position, eid)
    Position.x[eid] = opts.position.x
    Position.y[eid] = opts.position.y
    Position.z[eid] = opts.position.z
  }

  if (opts.velocity) {
    addComponent(world, Velocity, eid)
    Velocity.x[eid] = opts.velocity.x
    Velocity.y[eid] = opts.velocity.y
    Velocity.z[eid] = opts.velocity.z
  }

  if (opts.health) {
    addComponent(world, Health, eid)
    Health.current[eid] = opts.health.current
    Health.max[eid] = opts.health.max
  }

  if (opts.meshId !== undefined) {
    addComponent(world, Renderable, eid)
    Renderable.meshId[eid] = opts.meshId
    Renderable.visible[eid] = 1
    Renderable.scale[eid] = 1
  }

  return eid
}

/** Create an enemy entity */
export function createEnemy(world: IWorld, opts: CreateEntityOptions & { ai?: { behavior: number } }): number {
  const eid = createEntity(world, opts)
  addComponent(world, IsEnemy, eid)

  if (opts.ai) {
    addComponent(world, AIState, eid)
    AIState.behavior[eid] = opts.ai.behavior
    AIState.timer[eid] = 0
  }

  return eid
}

/** Create the player entity */
export function createPlayer(world: IWorld, opts: CreateEntityOptions): number {
  const eid = createEntity(world, opts)
  addComponent(world, IsPlayer, eid)
  return eid
}

/** Create a projectile entity */
export function createProjectile(world: IWorld, opts: CreateEntityOptions): number {
  const eid = createEntity(world, opts)
  addComponent(world, IsProjectile, eid)
  return eid
}
