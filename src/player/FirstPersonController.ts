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

  constructor(camera: THREE.Camera, input: InputManager) {
    this.camera = camera
    this.input = input
  }

  update(delta: number) {
    const { dx, dy } = this.input.consumeMouseDelta()

    if (this.input.isPointerLocked()) {
      this.yaw   -= dx * PLAYER_CONFIG.mouseSensitivity
      this.pitch -= dy * PLAYER_CONFIG.mouseSensitivity
      this.pitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, this.pitch))
    }

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(euler)

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.yaw, 0))
    const right   = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.yaw, 0))

    const move = new THREE.Vector3()
    if (this.input.isDown('KeyW') || this.input.isDown('ArrowUp'))    move.add(forward)
    if (this.input.isDown('KeyS') || this.input.isDown('ArrowDown'))  move.sub(forward)
    if (this.input.isDown('KeyD') || this.input.isDown('ArrowRight')) move.add(right)
    if (this.input.isDown('KeyA') || this.input.isDown('ArrowLeft'))  move.sub(right)

    if (move.lengthSq() > 0) move.normalize()

    const isSprinting = this.input.isDown('ShiftLeft') || this.input.isDown('ShiftRight')
    const speed = isSprinting ? PLAYER_CONFIG.sprintSpeed : PLAYER_CONFIG.moveSpeed

    this.velocity.lerp(move.multiplyScalar(speed), delta * 10)
    this.camera.position.addScaledVector(this.velocity, delta)

    // Jump
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
}
