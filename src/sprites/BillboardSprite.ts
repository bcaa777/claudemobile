import * as THREE from 'three'

// Y-axis billboard: sprite always faces camera on horizontal plane
// Uses a PlaneGeometry that updates rotation each frame
export function createBillboard(
  texture: THREE.CanvasTexture,
  scale: number,
  position: THREE.Vector3
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(scale, scale)
  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: false,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    depthWrite: true,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.copy(position)
  mesh.position.y += scale * 0.5  // pivot at bottom

  // Custom Y-axis billboard update
  mesh.onBeforeRender = (_renderer, _scene, camera) => {
    const camPos = camera.position
    const dx = camPos.x - mesh.position.x
    const dz = camPos.z - mesh.position.z
    mesh.rotation.y = Math.atan2(dx, dz)
  }

  return mesh
}

// Flat ground decal (PlaneGeometry laying flat, no billboard)
export function createGroundDecal(
  texture: THREE.CanvasTexture,
  scale: number,
  position: THREE.Vector3
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(scale, scale)
  const mat = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: false,
    alphaTest: 0.5,
    depthWrite: true,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(position)
  mesh.position.y += 0.05  // slight offset to avoid z-fighting
  return mesh
}
