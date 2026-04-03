import * as THREE from 'three'
import { World } from '../world/World'
import { FirstPersonController } from './FirstPersonController'
import { TERRAIN_CONFIG } from '../config'

const PLAYER_HEIGHT   = 1.8
const TERRAIN_OFFSET  = 0.05
const AUTO_STEP_HEIGHT = 0.8          // bumps up to this height are auto-stepped
const MAX_SLOPE_TAN    = Math.tan(70 * Math.PI / 180)  // tan(70°) ≈ 2.75 — only block near-vertical walls

const _tmpVec = new THREE.Vector3()

export class CollisionSystem {
  private world: World
  private smoothY = -Infinity
  private prevGroundY = -Infinity
  private groundedFrames = 0  // count frames on ground to avoid slope-blocking on landing

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
    // Fly mode removed — multi-jump + glide replaces it

    const pos     = camera.position
    const prevPos = controller.prevPos

    const groundYAtNew  = this.getGroundY(pos, pos.y)
    const groundYAtPrev = this.getGroundY(prevPos, pos.y)

    // ── Slope detection: slide on steep slopes, slow on moderate slopes ──────
    if (controller.isGrounded) {
      this.groundedFrames++
    } else {
      this.groundedFrames = 0
      controller.isSliding = false
    }

    const slideAngleRad = TERRAIN_CONFIG.slopeSlideAngle * Math.PI / 180
    const slideTan = Math.tan(slideAngleRad)
    const slowdownStartRad = TERRAIN_CONFIG.slopeSlowdownStart * Math.PI / 180
    const slowdownTan = Math.tan(slowdownStartRad)

    if (this.groundedFrames > 5 && controller.verticalVelocity <= 0 && groundYAtNew > -Infinity && groundYAtPrev > -Infinity) {
      const stepUp = groundYAtNew - groundYAtPrev
      if (stepUp > AUTO_STEP_HEIGHT) {
        const dx = pos.x - prevPos.x
        const dz = pos.z - prevPos.z
        const horizDist = Math.sqrt(dx * dx + dz * dz)
        if (horizDist > 0.001) {
          const slopeTan = stepUp / horizDist
          const slopeAngle = Math.atan(slopeTan) * 180 / Math.PI

          if (slopeTan > slideTan) {
            // ── Slide down the slope ──────────────────────────────────────
            controller.isSliding = true

            // Push player back to previous position
            pos.x = prevPos.x
            pos.z = prevPos.z

            // Apply downhill slide velocity
            const nx = dx / horizDist
            const nz = dz / horizDist
            const slideSpeed = 28 * Math.sin(slopeAngle * Math.PI / 180) * delta
            pos.x -= nx * slideSpeed
            pos.z -= nz * slideSpeed

            // Suppress jump while sliding
            controller.verticalVelocity = 0

          } else if (slopeTan > slowdownTan) {
            // ── Moderate slope: reduce speed ──────────────────────────────
            controller.isSliding = false
            const t = (slopeAngle - TERRAIN_CONFIG.slopeSlowdownStart)
                    / (TERRAIN_CONFIG.slopeSlideAngle - TERRAIN_CONFIG.slopeSlowdownStart)
            const smooth = t * t * (3 - 2 * t)
            controller.frictionMultiplier = 1.0 - smooth * TERRAIN_CONFIG.slopeSlowdownFactor

          } else {
            controller.isSliding = false
            controller.frictionMultiplier = 1.0
          }
        } else {
          controller.isSliding = false
          controller.frictionMultiplier = 1.0
        }
      } else {
        // Exit sliding with hysteresis
        if (controller.isSliding) {
          const exitAngle = TERRAIN_CONFIG.slopeSlideAngle - 5
          const exitTan = Math.tan(exitAngle * Math.PI / 180)
          const edx = pos.x - prevPos.x, edz = pos.z - prevPos.z
          const eHoriz = Math.sqrt(edx * edx + edz * edz)
          if (stepUp <= AUTO_STEP_HEIGHT || (eHoriz > 0.001 && stepUp / eHoriz < exitTan)) {
            controller.isSliding = false
          }
        }
        controller.frictionMultiplier = 1.0
      }
    } else {
      controller.frictionMultiplier = 1.0
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
