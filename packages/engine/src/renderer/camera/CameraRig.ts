import * as THREE from 'three'
import type { InputManager } from '../../input'

/** Camera perspective mode */
export type CameraMode = 'first-person' | 'third-person' | 'top-down' | 'isometric' | 'cinematic'

/** Base interface for all camera rigs */
export interface CameraRig {
  readonly mode: CameraMode
  update(delta: number, camera: THREE.Camera, input: InputManager, targetPosition?: THREE.Vector3): void
  activate?(camera: THREE.Camera): void
  deactivate?(): void
}
