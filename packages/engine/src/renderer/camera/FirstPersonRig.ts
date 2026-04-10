import * as THREE from 'three'
import type { InputManager } from '../../input'
import type { CameraRig, CameraMode } from './CameraRig'

export class FirstPersonRig implements CameraRig {
  readonly mode: CameraMode = 'first-person'

  private yaw = 0
  private pitch = 0

  private static readonly MOUSE_SENSITIVITY = 0.002
  private static readonly GAMEPAD_LOOK_SPEED = 2.5
  private static readonly MAX_PITCH = Math.PI * 0.45

  setDirection(yaw: number, pitch: number): void {
    this.yaw = yaw
    this.pitch = pitch
  }

  getYaw(): number { return this.yaw }
  getPitch(): number { return this.pitch }

  update(delta: number, camera: THREE.Camera, input: InputManager): void {
    const { dx, dy } = input.consumeMouseDelta()

    if (input.isPointerLocked()) {
      this.yaw -= dx * FirstPersonRig.MOUSE_SENSITIVITY
      this.pitch -= dy * FirstPersonRig.MOUSE_SENSITIVITY
      this.pitch = Math.max(-FirstPersonRig.MAX_PITCH, Math.min(FirstPersonRig.MAX_PITCH, this.pitch))
    }

    if (input.gamepadRightX !== 0 || input.gamepadRightY !== 0) {
      this.yaw -= input.gamepadRightX * FirstPersonRig.GAMEPAD_LOOK_SPEED * delta
      this.pitch -= input.gamepadRightY * FirstPersonRig.GAMEPAD_LOOK_SPEED * delta
      this.pitch = Math.max(-FirstPersonRig.MAX_PITCH, Math.min(FirstPersonRig.MAX_PITCH, this.pitch))
    }

    camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'))
  }
}
