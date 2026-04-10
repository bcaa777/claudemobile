import * as THREE from 'three'

const STONE = 0x888888
const DARK_WOOD = 0x553311
const GOLD = 0xccaa44

function box(
  scene: THREE.Scene,
  objects: THREE.Object3D[],
  x: number, y: number, z: number,
  w: number, h: number, d: number,
  color: number,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d)
  const mat = new THREE.MeshLambertMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  scene.add(mesh)
  objects.push(mesh)
  return mesh
}

function cylinder(
  scene: THREE.Scene,
  objects: THREE.Object3D[],
  x: number, y: number, z: number,
  rt: number, rb: number, h: number,
  color: number,
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rt, rb, h, 8)
  const mat = new THREE.MeshLambertMaterial({ color })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  scene.add(mesh)
  objects.push(mesh)
  return mesh
}

function plane(
  scene: THREE.Scene,
  objects: THREE.Object3D[],
  x: number, y: number, z: number,
  w: number, h: number,
  color: number,
  rotY = 0,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h)
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y, z)
  mesh.rotation.y = rotY
  scene.add(mesh)
  objects.push(mesh)
  return mesh
}

function torchLight(
  scene: THREE.Scene,
  objects: THREE.Object3D[],
  x: number, y: number, z: number,
): void {
  box(scene, objects, x, y, z, 0.2, 0.6, 0.2, DARK_WOOD)
  const light = new THREE.PointLight(0xffaa44, 5, 20)
  light.position.set(x, y + 0.5, z)
  scene.add(light)
  objects.push(light)
}

export class HubGrowth {
  /** Build progressive hub meshes based on cleansed biome count. */
  build(scene: THREE.Scene, objects: THREE.Object3D[], cleansedCount: number): void {
    // ── Tier 0: always present — ground plane + 2 ruined walls ──────────────
    const groundGeo = new THREE.PlaneGeometry(50, 50)
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x888888 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    scene.add(ground)
    objects.push(ground)

    // 2 ruined back walls
    box(scene, objects, -8, 2, -10, 1, 4, 8, STONE)
    box(scene, objects,  8, 2, -10, 1, 4, 8, STONE)

    if (cleansedCount < 1) return

    // ── Tier 1 (1-2): 4 more wall segments + torch lights ───────────────────
    box(scene, objects,  0, 2, -10, 10, 4, 1, STONE)   // back center wall
    box(scene, objects, -8, 2,   0,  1, 2, 4, STONE)   // left side partial
    box(scene, objects,  8, 2,   0,  1, 3, 4, STONE)   // right side partial
    box(scene, objects,  0, 1, -6,   8, 2, 1, STONE)   // inner rubble wall

    torchLight(scene, objects, -6, 3, -8)
    torchLight(scene, objects,  6, 3, -8)

    if (cleansedCount < 3) return

    // ── Tier 2 (3-4): tower + fence around companion pen ────────────────────
    // Tower: tall box at back-left corner
    box(scene, objects, -10, 5, -10, 2.5, 10, 2.5, STONE)
    // Tower battlements
    box(scene, objects, -10, 10.5, -10, 3, 1, 3, STONE)

    // Fence posts around companion pen area (near z=2, x=-3 to 3)
    for (let fx = -4; fx <= 4; fx += 2) {
      cylinder(scene, objects, fx, 0.8, 2, 0.1, 0.1, 1.6, DARK_WOOD)
    }
    // Fence rails
    box(scene, objects, 0, 1.0, 2, 8, 0.12, 0.12, DARK_WOOD)
    box(scene, objects, 0, 0.5, 2, 8, 0.12, 0.12, DARK_WOOD)

    torchLight(scene, objects, -9, 5, -9)

    if (cleansedCount < 5) return

    // ── Tier 3 (5-6): great hall + additional lights ─────────────────────────
    // Great hall: large box left of center rear
    box(scene, objects, -5, 3,  -8,  6, 6, 4, STONE)
    // Door opening (dark box to suggest interior depth)
    box(scene, objects, -5, 1.5, -6, 1.6, 3, 0.3, 0x222222)
    // Roof caps
    box(scene, objects, -5, 6.5, -8, 6.4, 1, 4.4, DARK_WOOD)

    // Additional lights inside great hall area
    const hallLight = new THREE.PointLight(0xffcc88, 3.0, 18)
    hallLight.position.set(-5, 4, -8)
    scene.add(hallLight)
    objects.push(hallLight)

    torchLight(scene, objects, -2, 3, -6)
    torchLight(scene, objects, -8, 3, -6)

    if (cleansedCount < 7) return

    // ── Tier 4 (7-8): full castle walls + archway ───────────────────────────
    // Left and right full-height walls
    box(scene, objects, -9, 3, -5, 1, 6, 10, STONE)
    box(scene, objects,  9, 3, -5, 1, 6, 10, STONE)
    // Front wall with gap for gate
    box(scene, objects, -5.5, 3, 0, 8, 6, 1, STONE)
    box(scene, objects,  5.5, 3, 0, 8, 6, 1, STONE)

    // Archway pillars
    box(scene, objects, -1.5, 2, 0, 1, 4, 1.2, STONE)
    box(scene, objects,  1.5, 2, 0, 1, 4, 1.2, STONE)
    // Archway lintel
    box(scene, objects,   0, 4.5, 0, 4, 1, 1.2, STONE)

    // Corner towers on front wall
    cylinder(scene, objects, -9, 4, 0, 1.5, 1.5, 8, STONE)
    cylinder(scene, objects,  9, 4, 0, 1.5, 1.5, 8, STONE)
    // Tower caps
    cylinder(scene, objects, -9, 8.5, 0, 0.2, 1.5, 1, DARK_WOOD)
    cylinder(scene, objects,  9, 8.5, 0, 0.2, 1.5, 1, DARK_WOOD)

    if (cleansedCount < 9) return

    // ── Tier 5 (9+): banners + endgame pedestal ──────────────────────────────
    // Banners on back wall (colored planes)
    plane(scene, objects, -4, 5, -9.4, 1.5, 3, 0xaa2222)  // red banner
    plane(scene, objects,  0, 5, -9.4, 1.5, 3, 0x2244aa)  // blue banner
    plane(scene, objects,  4, 5, -9.4, 1.5, 3, 0xaa2222)  // red banner

    // Banner poles
    box(scene, objects, -4, 5, -9.4, 0.08, 3.5, 0.08, GOLD)
    box(scene, objects,  0, 5, -9.4, 0.08, 3.5, 0.08, GOLD)
    box(scene, objects,  4, 5, -9.4, 0.08, 3.5, 0.08, GOLD)

    // Endgame pedestal at courtyard center
    cylinder(scene, objects, 0, 0.5, -5, 1.2, 1.5, 1, STONE)
    cylinder(scene, objects, 0, 1.3, -5, 0.8, 0.8, 0.6, STONE)
    // Glowing orb on pedestal
    const orbGeo = new THREE.SphereGeometry(0.4, 12, 12)
    const orbMat = new THREE.MeshLambertMaterial({ color: GOLD, emissive: GOLD, emissiveIntensity: 0.6 })
    const orb = new THREE.Mesh(orbGeo, orbMat)
    orb.position.set(0, 1.8, -5)
    scene.add(orb)
    objects.push(orb)

    const orbLight = new THREE.PointLight(0xffdd44, 2.5, 15)
    orbLight.position.set(0, 2.5, -5)
    scene.add(orbLight)
    objects.push(orbLight)
  }
}
