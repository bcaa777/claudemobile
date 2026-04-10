import * as THREE from 'three'
import { InputManager } from '@engine/core'
import { PLAYER_CONFIG, STAMINA_CONFIG } from '../config'
import type { PlayerState } from './PlayerState'

export class FirstPersonController {
  private camera: THREE.Camera
  private input: InputManager
  public yaw = 0
  public pitch = 0
  private velocity = new THREE.Vector3()

  public verticalVelocity = 0
  public isGrounded = false
  public isFlying = false
  public airJumpsUsed: number = 0
  public isGliding: boolean = false
  public isSprinting: boolean = false
  public isSliding: boolean = false
  public prevPos = new THREE.Vector3()
  public targetY = 0
  public frictionMultiplier = 1.0
  public speedMultiplier = 1.0
  /** When true, movement and look input are suppressed (e.g. ritual cinematic) */
  public inputLocked = false
  public get heading(): number { return this.yaw }

  constructor(camera: THREE.Camera, input: InputManager) {
    this.camera = camera
    this.input = input
  }

  // Gamepad look sensitivity (radians per second at full stick deflection)
  private static readonly GAMEPAD_LOOK_SPEED = 2.5

  update(delta: number, playerState?: PlayerState) {
    this.prevPos.copy(this.camera.position)

    // During ritual cinematics, suppress all input (camera stays still)
    if (this.inputLocked) return

    // Poll gamepad
    this.input.pollGamepad()

    const { dx, dy } = this.input.consumeMouseDelta()

    // Mouse look
    if (this.input.isPointerLocked()) {
      this.yaw   -= dx * PLAYER_CONFIG.mouseSensitivity
      this.pitch -= dy * PLAYER_CONFIG.mouseSensitivity
    }

    // Gamepad right stick look
    if (this.input.gamepadRightX !== 0 || this.input.gamepadRightY !== 0) {
      this.yaw   -= this.input.gamepadRightX * FirstPersonController.GAMEPAD_LOOK_SPEED * delta
      this.pitch -= this.input.gamepadRightY * FirstPersonController.GAMEPAD_LOOK_SPEED * delta
    }

    this.pitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.pitch))

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(euler)

    // Fly mode removed — multi-jump + glide replaces it
    this.input.consumeFlyToggle() // consume input but do nothing

    if (false) { // fly mode disabled
      const flyForward = new THREE.Vector3(0, 0, -1).applyEuler(euler)
      const flyRight = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0))
      const move = new THREE.Vector3()

      if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp')) move.add(flyForward)
      if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown')) move.sub(flyForward)
      if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) move.add(flyRight)
      if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft')) move.sub(flyRight)

      if (this.input.gamepadLeftX !== 0 || this.input.gamepadLeftY !== 0) {
        move.addScaledVector(flyRight, this.input.gamepadLeftX)
        move.addScaledVector(flyForward, -this.input.gamepadLeftY)
      }

      if (this.input.isDown('Space') || this.input.gamepadAscend) move.y += 1
      if (this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') || this.input.gamepadDescend) move.y -= 1

      if (move.lengthSq() > 0) move.normalize()

      const speed = PLAYER_CONFIG.sprintSpeed
      this.velocity.lerp(move.multiplyScalar(speed), delta * 10)
      this.camera.position.addScaledVector(this.velocity, delta)
    } else {
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.yaw, 0))
      const right   = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0))

      const move = new THREE.Vector3()

      // Keyboard movement
      if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp'))    move.add(forward)
      if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown'))  move.sub(forward)
      if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) move.add(right)
      if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft'))  move.sub(right)

      // Gamepad left stick movement
      if (this.input.gamepadLeftX !== 0 || this.input.gamepadLeftY !== 0) {
        move.addScaledVector(right, this.input.gamepadLeftX)
        move.addScaledVector(forward, -this.input.gamepadLeftY)
      }

      if (move.lengthSq() > 0) move.normalize()

      this.isSprinting = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') || this.input.gamepadSprint
      const baseSpeed = this.isSprinting ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.moveSpeed
      const speed = baseSpeed * this.speedMultiplier

      // Apply friction multiplier to lerp rate (ice = less damping = more slide)
      const lerpRate = delta * 10 * this.frictionMultiplier
      this.velocity.lerp(move.multiplyScalar(speed), Math.min(1, lerpRate))
      this.camera.position.addScaledVector(this.velocity, delta)

      // Reset air state on ground
      if (this.isGrounded) {
        this.airJumpsUsed = 0
        this.isGliding = false
      }

      // Jump — ground or air (with stamina)
      if (this.input.consumeJump() && !this.isSliding) {
        if (this.isGrounded) {
          if (!playerState || playerState.drainStamina(STAMINA_CONFIG.jumpCost)) {
            this.verticalVelocity = STAMINA_CONFIG.airJumpVelocities[0]
            this.isGrounded = false
            this.airJumpsUsed = 0
          }
        } else if (this.airJumpsUsed < STAMINA_CONFIG.maxAirJumps) {
          if (!playerState || playerState.drainStamina(STAMINA_CONFIG.jumpCost)) {
            const idx = Math.min(this.airJumpsUsed, STAMINA_CONFIG.airJumpVelocities.length - 1)
            this.verticalVelocity = STAMINA_CONFIG.airJumpVelocities[idx]
            this.airJumpsUsed++
          }
        }
      }

      // Gravity + Glide
      if (!this.isGrounded) {
        if (this.verticalVelocity < -2 && this.input.isDown('Space')) {
          // Gliding — gentle fall
          this.isGliding = true
          this.verticalVelocity -= STAMINA_CONFIG.glideGravity * delta
          this.verticalVelocity = Math.max(this.verticalVelocity, -3)
          // Gliding is free — stamina only drains on jump
        } else {
          // Normal falling
          this.isGliding = false
          this.verticalVelocity -= PLAYER_CONFIG.gravity * delta
        }
      }

      this.camera.position.y += this.verticalVelocity * delta
    }

    // Reset friction each frame (hazard system re-applies)
    this.frictionMultiplier = 1.0
  }
}
