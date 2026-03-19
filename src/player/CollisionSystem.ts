import * as THREE from 'three'
import { World } from '../world/World'
import { FirstPersonController } from './FirstPersonController'

const PLAYER_HEIGHT   = 1.8
const TERRAIN_OFFSET  = 0.05
const AUTO_STEP_HEIGHT = 0.6          // bumps up to this height are auto-stepped
const MAX_SLOPE_TAN    = Math.tan(50 * Math.PI / 180)  // tan(50°) ≈ 1.19

const _tmpVec = new THREE.Vector3()

export class CollisionSystem {
  private world: World
  private smoothY = -Infinity
  private prevGroundY = -Infinity

  constructor(world: World) {
    this.world = world
  }

  private getGroundY(pos: THREE.Vector3, playerY: number): number {
    const terrainY = this.world.getHeightAt(pos.x, pos.z)
    const rawObj   = this.world.getObjectFloorAt(pos.x, pos.z)
    // Only accept object floors that are at or below the player's eye level
    const objectY  = rawObj !== null && rawObj < playerY ? rawObj : null

    // Only accept terrain that is reasonably close below the player (not far above).
    // This prevents snapping up to the surface when the player is underground.
    const MAX_SNAP_UP = 8  // max units terrain can be above player and still snap
    const validTerrainY = terrainY !== null && terrainY < playerY + MAX_SNAP_UP ? terrainY : null

    return Math.max(
      validTerrainY !== null ? validTerrainY : -Infinity,
      objectY       !== null ? objectY       : -Infinity,
    )
  }

  update(camera: THREE.Camera, controller: FirstPersonController, delta: number) {
    if (controller.isFlying) return

    const pos     = camera.position
    const prevPos = controller.prevPos

    const groundYAtNew  = this.getGroundY(pos, pos.y)
    const groundYAtPrev = this.getGroundY(prevPos, pos.y)

    // ── Slope blocking with sliding ──────────────────────────────────────────
    // Only block when grounded (not jumping/falling) and the step is large enough
    // to be a steep slope rather than a small bump.
    if (controller.verticalVelocity <= 0 && groundYAtNew > -Infinity && groundYAtPrev > -Infinity) {
      const stepUp = groundYAtNew - groundYAtPrev
      if (stepUp > AUTO_STEP_HEIGHT) {
        const dx = pos.x - prevPos.x
        const dz = pos.z - prevPos.z
        const horizDist = Math.sqrt(dx * dx + dz * dz)
        if (horizDist > 0.001) {
          const slopeTan = stepUp / horizDist
          if (slopeTan > MAX_SLOPE_TAN) {
            // Slope sliding: project velocity along the slope face instead of full stop
            const nx = dx / horizDist
            const nz = dz / horizDist
            // Try sliding along each axis independently
            const gX = this.getGroundY(_tmpVec.set(pos.x, pos.y, prevPos.z), pos.y)
            const gZ = this.getGroundY(_tmpVec.set(prevPos.x, pos.y, pos.z), pos.y)
            const stepX = gX - groundYAtPrev
            const stepZ = gZ - groundYAtPrev
            const canSlideX = stepX <= AUTO_STEP_HEIGHT || (Math.abs(dx) > 0.001 && stepX / Math.abs(dx) <= MAX_SLOPE_TAN)
            const canSlideZ = stepZ <= AUTO_STEP_HEIGHT || (Math.abs(dz) > 0.001 && stepZ / Math.abs(dz) <= MAX_SLOPE_TAN)
            if (!canSlideX) pos.x = prevPos.x
            if (!canSlideZ) pos.z = prevPos.z
          }
        }
      }
    }

    // ── Ground snap (smoothed) ───────────────────────────────────────────────
    const groundY = this.getGroundY(pos, pos.y)

    // Average ground height over 2 frames to reduce jitter
    const avgGroundY = this.prevGroundY > -Infinity
      ? (groundY + this.prevGroundY) * 0.5
      : groundY
    this.prevGroundY = groundY

    if (avgGroundY > -Infinity) {
      const targetY = avgGroundY + PLAYER_HEIGHT + TERRAIN_OFFSET
      if (pos.y <= targetY) {
        // Smooth ground snap: lerp toward target instead of instant teleport
        const lerpRate = Math.min(1, delta * 20)
        if (this.smoothY === -Infinity) this.smoothY = pos.y
        this.smoothY = this.smoothY + (targetY - this.smoothY) * lerpRate
        pos.y = this.smoothY
        controller.isGrounded = true
        if (controller.verticalVelocity < 0) controller.verticalVelocity = 0
      } else {
        controller.isGrounded = false
        this.smoothY = pos.y
      }
    }
  }
}
