import * as THREE from 'three'

/** Shorthand for creating a box mesh */
export function box(
  w: number, h: number, d: number,
  mat: THREE.Material | THREE.Material[]
): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}

/**
 * Animate floating particles using direct Float32Array access.
 * Replaces per-element getX/setX accessor calls with bulk array writes.
 */
export function updateParticles(
  particles: THREE.Points | null | undefined,
  delta: number,
  time: number,
  boundsXZ = 80,
  boundsY = 50,
) {
  if (!particles) return
  const pos = particles.geometry.attributes.position as THREE.BufferAttribute
  const arr = pos.array as Float32Array
  for (let i = 0; i < pos.count; i++) {
    const ix = i * 3, iy = i * 3 + 1, iz = i * 3 + 2
    arr[ix] += Math.sin(time * 0.5 + i * 2.1) * delta * 0.5
    arr[iy] += Math.cos(time * 0.4 + i * 1.7) * delta * 0.25
    arr[iz] += Math.sin(time * 0.6 + i * 1.3) * delta * 0.5
    if (arr[iy] < 0 || arr[iy] > boundsY) arr[iy] = Math.random() * boundsY
    if (Math.abs(arr[ix]) > boundsXZ) arr[ix] = (Math.random() - 0.5) * boundsXZ * 2
    if (Math.abs(arr[iz]) > boundsXZ) arr[iz] = (Math.random() - 0.5) * boundsXZ * 2
  }
  pos.needsUpdate = true
}

/** Animate torch lights with flickering */
export function updateTorches(
  torchLights: THREE.PointLight[],
  torchIntensities: number[],
  time: number,
) {
  for (let i = 0; i < torchLights.length; i++) {
    const base = torchIntensities[i]
    torchLights[i].intensity = base * (0.8 + 0.35 * Math.sin(time * 7 + i * 1.3))
  }
}
