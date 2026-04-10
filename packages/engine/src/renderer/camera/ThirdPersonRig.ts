import * as THREE from 'three'
import type { InputManager } from '../../input'
import type { CameraRig, CameraMode } from './CameraRig'

export interface ThirdPersonRigOptions {
  distance?: number
  height?: number
  pitchOffset?: number
}

export class ThirdPersonRig implements CameraRig {
  readonly mode: CameraMode = 'third-person'

  private yaw = 0
  private pitch = 0.25 // slight downward angle

  private currentPosition = new THREE.Vector3()
  private idealPosition = new THREE.Vector3()

  private readonly distance: number
  private readonly height: number
  private readonly pitchOffset: number

  private static readonly MOUSE_SENSITIVITY = 0.002
  private static readonly MAX_PITCH = Math.PI * 0.4
  private static readonly MIN_PITCH = -0.1
  private static readonly LERP_FACTOR = 10 // units/s

  constructor(
    options: ThirdPersonRigOptions = {},
    private sampleHeight?: (x: number, z: number) => number,
  ) {
    this.distance = options.distance ?? 8
    this.height = options.height ?? 4
    this.pitchOffset = options.pitchOffset ?? 0
  }

  activate(camera: THREE.Camera): void {
    // Initialise currentPosition to wherever camera currently is so we don't jump
    this.currentPosition.copy(camera.position)
  }

  setYaw(yaw: number): void {
    this.yaw = yaw
  }

  getYaw(): number { return this.yaw }

  update(delta: number, camera: THREE.Camera, input: InputManager, targetPosition?: THREE.Vector3): void {
    const { dx, dy } = input.consumeMouseDelta()

    if (input.isPointerLocked()) {
      this.yaw -= dx * ThirdPersonRig.MOUSE_SENSITIVITY
      this.pitch -= dy * ThirdPersonRig.MOUSE_SENSITIVITY
      this.pitch = Math.max(ThirdPersonRig.MIN_PITCH, Math.min(ThirdPersonRig.MAX_PITCH, this.pitch))
    }

    const target = targetPosition ?? new THREE.Vector3()
    const totalPitch = this.pitch + this.pitchOffset

    // Spherical offset: orbit behind and above target
    const horizontalDist = this.distance * Math.cos(totalPitch)
    const verticalDist = this.distance * Math.sin(totalPitch)

    this.idealPosition.set(
      target.x - Math.sin(this.yaw) * horizontalDist,
      target.y + this.height + verticalDist,
      target.z - Math.cos(this.yaw) * horizontalDist,
    )

    // Terrain collision: don't let camera clip underground
    if (this.sampleHeight) {
      const terrainY = this.sampleHeight(this.idealPosition.x, this.idealPosition.z)
      if (this.idealPosition.y < terrainY + 1) {
        this.idealPosition.y = terrainY + 1
      }
    }

    // Smooth follow
    const t = Math.min(1, ThirdPersonRig.LERP_FACTOR * delta)
    this.currentPosition.lerp(this.idealPosition, t)

    camera.position.copy(this.currentPosition)
    camera.lookAt(target.x, target.y + this.height * 0.5, target.z)
  }
}
