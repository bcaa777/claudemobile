import * as THREE from 'three'
import { World } from '../world/World'
import { FirstPersonController } from './FirstPersonController'
import { TERRAIN_CONFIG } from '../config'

const PLAYER_HEIGHT   = 1.8
const TERRAIN_OFFSET  = 0.05
const AUTO_STEP_HEIGHT = 0.8          // bumps up to this height are auto-stepped
const SLIDE_TAN       = Math.tan(TERRAIN_CONFIG.slopeSlideAngle * Math.PI / 180)
const SLOWDOWN_TAN    = Math.tan(TERRAIN_CONFIG.slopeSlowdownStart * Math.PI / 180)

const _tmpVec = new THREE.Vector3()

export class CollisionSystem {
  private world: World
  private smoothY = -Infinity
  private prevGroundY = -Infinity
  private groundedFrames = 0

  constructor(world: World) {
    this.world = world
  }

  private getGroundY(pos: THREE.Vector3, playerY: number): number {
    const terrainY = this.world.getHeightAt(pos.x, pos.z)
    const rawObj   = this.world.getObjectFloorAt(pos.x, pos.z)
    const objectY  = rawObj !== null && rawObj < playerY ? rawObj : null

    const MAX_SNAP_UP = 8
    const validTerrainY = terrainY !== null && terrainY < playerY + MAX_SNAP_UP ? terrainY : null

    return Math.max(
      validTerrainY !== null ? validTerrainY : -Infinity,
      objectY       !== null ? objectY       : -Infinity,
    )
  }

  update(camera: THREE.Camera, controller: FirstPersonController, delta: number) {
    const pos     = camera.position
    const prevPos = controller.prevPos

    const groundYAtNew  = this.getGroundY(pos, pos.y)
    const groundYAtPrev = this.getGroundY(prevPos, pos.y)

    // ── Grounded frame tracking ─────────────────────────────────────────────
    if (controller.isGrounded) {
      this.groundedFrames++
    } else {
      this.groundedFrames = 0
      controller.isSliding = false
    }

    // ── Slope handling ──────────────────────────────────────────────────────
    // Only check slopes when walking on ground for several frames (not mid-jump).
    if (this.groundedFrames > 5 && controller.verticalVelocity <= 0
        && groundYAtNew > -Infinity && groundYAtPrev > -Infinity) {
      const stepUp = groundYAtNew - groundYAtPrev
      if (stepUp > AUTO_STEP_HEIGHT) {
        const dx = pos.x - prevPos.x
        const dz = pos.z - prevPos.z
        const horizDist = Math.sqrt(dx * dx + dz * dz)

        if (horizDist > 0.01) {
          const slopeTan = stepUp / horizDist

          if (slopeTan > SLIDE_TAN) {
            // ── Steep slope: block movement + slide downhill ──────────────
            controller.isSliding = true

            // Revert horizontal position (can't walk up)
            pos.x = prevPos.x
            pos.z = prevPos.z

            // Gentle downhill push so player slides away from cliff
            const slideStr = Math.min(4.0, stepUp * 0.3) * delta
            pos.x -= (dx / horizDist) * slideStr
            pos.z -= (dz / horizDist) * slideStr

          } else if (slopeTan > SLOWDOWN_TAN) {
            // ── Moderate slope: slow down ─────────────────────────────────
            controller.isSliding = false
            const t = (slopeTan - SLOWDOWN_TAN) / (SLIDE_TAN - SLOWDOWN_TAN)
            const smooth = t * t * (3 - 2 * t)
            controller.frictionMultiplier = 1.0 - smooth * TERRAIN_CONFIG.slopeSlowdownFactor

          } else {
            // ── Gentle slope: slide along axes like before ────────────────
            controller.isSliding = false
            controller.frictionMultiplier = 1.0
            // Per-axis slide (original behavior for moderate bumps)
            const gX = this.getGroundY(_tmpVec.set(pos.x, pos.y, prevPos.z), pos.y)
            const gZ = this.getGroundY(_tmpVec.set(prevPos.x, pos.y, pos.z), pos.y)
            const stepX = gX - groundYAtPrev
            const stepZ = gZ - groundYAtPrev
            const canX = stepX <= AUTO_STEP_HEIGHT || (Math.abs(dx) > 0.001 && stepX / Math.abs(dx) <= SLIDE_TAN)
            const canZ = stepZ <= AUTO_STEP_HEIGHT || (Math.abs(dz) > 0.001 && stepZ / Math.abs(dz) <= SLIDE_TAN)
            if (!canX) pos.x = prevPos.x
            if (!canZ) pos.z = prevPos.z
          }
        } else {
          controller.isSliding = false
          controller.frictionMultiplier = 1.0
        }
      } else {
        controller.isSliding = false
        controller.frictionMultiplier = 1.0
      }
    } else {
      if (!controller.isGrounded) controller.isSliding = false
      controller.frictionMultiplier = 1.0
    }

    // ── Ground snap (smoothed) ───────────────────────────────────────────────
    const groundY = this.getGroundY(pos, pos.y)

    const avgGroundY = this.prevGroundY > -Infinity
      ? (groundY + this.prevGroundY) * 0.5
      : groundY
    this.prevGroundY = groundY

    if (avgGroundY > -Infinity) {
      const targetY = avgGroundY + PLAYER_HEIGHT + TERRAIN_OFFSET
      if (pos.y <= targetY) {
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
