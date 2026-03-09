import * as THREE from 'three'
import { World } from '../world/World'
import { FirstPersonController } from './FirstPersonController'

const PLAYER_HEIGHT   = 1.8
const TERRAIN_OFFSET  = 0.05
const AUTO_STEP_HEIGHT = 1.5          // bumps up to this height are auto-stepped
const MAX_SLOPE_TAN    = Math.tan(Math.PI / 3)  // tan(60°) ≈ 1.732

export class CollisionSystem {
  private world: World

  constructor(world: World) {
    this.world = world
  }

  private getGroundY(pos: THREE.Vector3, playerY: number): number {
    const terrainY = this.world.getHeightAt(pos.x, pos.z)
    const rawObj   = this.world.getObjectFloorAt(pos.x, pos.z)
    // Only accept object floors that are at or below the player's eye level
    const objectY  = rawObj !== null && rawObj < playerY ? rawObj : null

    return Math.max(
      terrainY !== null ? terrainY : -Infinity,
      objectY  !== null ? objectY  : -Infinity,
    )
  }

  update(camera: THREE.Camera, controller: FirstPersonController) {
    const pos     = camera.position
    const prevPos = controller.prevPos

    const groundYAtNew  = this.getGroundY(pos, pos.y)
    const groundYAtPrev = this.getGroundY(prevPos, pos.y)

    // ── Slope blocking ────────────────────────────────────────────────────────
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
            // Revert horizontal movement; keep Y so gravity still applies
            pos.x = prevPos.x
            pos.z = prevPos.z
          }
        }
      }
    }

    // ── Ground snap ───────────────────────────────────────────────────────────
    const groundY = this.getGroundY(pos, pos.y)

    if (groundY > -Infinity) {
      const minY = groundY + PLAYER_HEIGHT + TERRAIN_OFFSET
      if (pos.y <= minY) {
        pos.y = minY
        controller.isGrounded = true
        if (controller.verticalVelocity < 0) controller.verticalVelocity = 0
      } else {
        controller.isGrounded = false
      }
    }
  }
}
