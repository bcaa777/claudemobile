import * as THREE from 'three'

const _fwd = new THREE.Vector3()
const _up = new THREE.Vector3()

/** Update the AudioContext listener from a Three.js camera */
export function updateListener(ctx: AudioContext, camera: THREE.Camera) {
  const listener = ctx.listener
  const p = camera.position

  if (listener.positionX) {
    listener.positionX.value = p.x
    listener.positionY.value = p.y
    listener.positionZ.value = p.z
  } else {
    listener.setPosition(p.x, p.y, p.z)
  }

  camera.getWorldDirection(_fwd)
  _up.set(0, 1, 0).applyQuaternion(camera.quaternion)

  if (listener.forwardX) {
    listener.forwardX.value = _fwd.x
    listener.forwardY.value = _fwd.y
    listener.forwardZ.value = _fwd.z
    listener.upX.value = _up.x
    listener.upY.value = _up.y
    listener.upZ.value = _up.z
  } else {
    listener.setOrientation(_fwd.x, _fwd.y, _fwd.z, _up.x, _up.y, _up.z)
  }
}

/** Create a PannerNode for 3D spatial audio at a world position */
export function createSpatialPanner(
  ctx: AudioContext,
  x: number, y: number, z: number,
  refDistance = 5,
  maxDistance = 50,
  rolloff = 1.5,
): PannerNode {
  const panner = ctx.createPanner()
  panner.panningModel = 'HRTF'
  panner.distanceModel = 'inverse'
  panner.refDistance = refDistance
  panner.maxDistance = maxDistance
  panner.rolloffFactor = rolloff
  panner.coneInnerAngle = 360
  panner.coneOuterAngle = 360
  panner.coneOuterGain = 1

  if (panner.positionX) {
    panner.positionX.value = x
    panner.positionY.value = y
    panner.positionZ.value = z
  } else {
    panner.setPosition(x, y, z)
  }

  return panner
}
