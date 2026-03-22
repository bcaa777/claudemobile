import * as THREE from 'three'
import { InputManager } from '../engine/InputManager'
import { PLAYER_CONFIG } from '../config'

export class FirstPersonController {
  private camera: THREE.Camera
  private input: InputManager
  private yaw = 0
  private pitch = 0
  private velocity = new THREE.Vector3()

  public verticalVelocity = 0
  public isGrounded = false
  public isFlying = false
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

  update(delta: number) {
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

    if (this.input.consumeFlyToggle()) {
      this.isFlying = !this.isFlying
      if (this.isFlying) this.verticalVelocity = 0
    }

    if (this.isFlying) {
      const flyForward = new THREE.Vector3(0, 0, -1).applyEuler(euler)
      const flyRight = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0))
      const move = new THREE.Vector3()

      if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp')) move.add(flyForward)
      if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown')) move.sub(flyForward)
      if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) move.add(flyRight)
      if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft')) move.sub(flyRight)

      // Gamepad
      if (this.input.gamepadLeftX !== 0 || this.input.gamepadLeftY !== 0) {
        move.addScaledVector(flyRight, this.input.gamepadLeftX)
        move.addScaledVector(flyForward, -this.input.gamepadLeftY)
      }

      // Vertical
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

      const isSprinting = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight') || this.input.gamepadSprint
      const baseSpeed = isSprinting ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.moveSpeed
      const speed = baseSpeed * this.speedMultiplier

      // Apply friction multiplier to lerp rate (ice = less damping = more slide)
      const lerpRate = delta * 10 * this.frictionMultiplier
      this.velocity.lerp(move.multiplyScalar(speed), Math.min(1, lerpRate))
      this.camera.position.addScaledVector(this.velocity, delta)

      // Jump (keyboard Space or gamepad Cross/A)
      if (this.input.consumeJump() && this.isGrounded) {
        this.verticalVelocity = PLAYER_CONFIG.jumpSpeed
        this.isGrounded = false
      }

      // Gravity
      if (!this.isGrounded) {
        this.verticalVelocity -= PLAYER_CONFIG.gravity * delta
      }

      this.camera.position.y += this.verticalVelocity * delta
    }

    // Reset friction each frame (hazard system re-applies)
    this.frictionMultiplier = 1.0
  }
}
