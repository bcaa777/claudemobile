import * as THREE from 'three'
import { HollowType, ENEMY_DEFS } from './EnemyTypes'

// ── Shared geometry / material caches ─────────────────────────────────────────
const _geoCache = new Map<string, THREE.BoxGeometry>()
const _matCache = new Map<string, THREE.MeshLambertMaterial>()

function cachedBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w}_${h}_${d}`
  let geo = _geoCache.get(key)
  if (!geo) { geo = new THREE.BoxGeometry(w, h, d); _geoCache.set(key, geo) }
  return geo
}

function cachedMat(color: number, emissive?: number, emissiveIntensity?: number): THREE.MeshLambertMaterial {
  const key = `${color}_${emissive ?? 0}_${emissiveIntensity ?? 0}`
  let mat = _matCache.get(key)
  if (!mat) {
    mat = new THREE.MeshLambertMaterial({
      color,
      ...(emissive !== undefined ? { emissive, emissiveIntensity: emissiveIntensity ?? 1.0 } : {}),
    })
    _matCache.set(key, mat)
  }
  return mat
}

function box(w: number, h: number, d: number, color: number, emissive?: number, emissiveIntensity?: number): THREE.Mesh {
  return new THREE.Mesh(cachedBox(w, h, d), cachedMat(color, emissive, emissiveIntensity))
}

/**
 * Build a mesh group for the given Hollow enemy type.
 * Returns a THREE.Group ready to be added to a scene.
 */
export function buildEnemyMesh(type: HollowType, scale: number): THREE.Group {
  const group = new THREE.Group()
  const def = ENEMY_DEFS[type]

  switch (type) {
    case 'shambler':
      buildShambler(group, def)
      break
    case 'spitter':
      buildSpitter(group, def)
      break
    case 'stalker':
      buildStalker(group, def)
      break
    case 'warden':
      buildWarden(group, def)
      break
  }

  group.scale.setScalar(scale)
  return group
}

// ─── Shambler: hunched humanoid ───────────────────────────────────────────────
function buildShambler(group: THREE.Group, def: typeof ENEMY_DEFS['shambler']): void {
  const bodyColor = def.bodyColor
  const emColor = def.emissiveColor

  // Body
  const body = box(0.6, 0.8, 0.4, bodyColor)
  group.add(body)

  // Head — slightly lighter, offset forward and down (hunched)
  const headColor = lerpColor(bodyColor, 0xffffff, 0.1)
  const head = box(0.35, 0.3, 0.3, headColor)
  head.position.set(0, 0.35, 0.2)
  group.add(head)

  // Eye slit — magenta emissive
  const eye = box(0.2, 0.05, 0.02, emColor, emColor, 1.0)
  eye.position.set(0, 0.4, 0.36)
  group.add(eye)

  // Arms — hanging low
  const armL = box(0.15, 0.6, 0.15, bodyColor)
  armL.position.set(-0.38, -0.1, 0)
  group.add(armL)

  const armR = box(0.15, 0.6, 0.15, bodyColor)
  armR.position.set(0.38, -0.1, 0)
  group.add(armR)

  // Legs — short, wide stance
  const legL = box(0.18, 0.4, 0.18, bodyColor)
  legL.position.set(-0.2, -0.6, 0)
  group.add(legL)

  const legR = box(0.18, 0.4, 0.18, bodyColor)
  legR.position.set(0.2, -0.6, 0)
  group.add(legR)
}

// ─── Spitter: tall floating form ──────────────────────────────────────────────
function buildSpitter(group: THREE.Group, def: typeof ENEMY_DEFS['spitter']): void {
  const bodyColor = def.bodyColor
  const emColor = def.emissiveColor

  // Body — tall, narrow
  const body = box(0.4, 1.4, 0.3, bodyColor)
  body.position.y = 0.5 // floats above ground
  group.add(body)

  // Head area
  const head = box(0.25, 0.25, 0.2, lerpColor(bodyColor, 0xffffff, 0.08))
  head.position.set(0, 1.35, 0.1)
  group.add(head)

  // Eye slit
  const eye = box(0.15, 0.04, 0.02, emColor, emColor, 1.0)
  eye.position.set(0, 1.38, 0.22)
  group.add(eye)

  // Arm protrusions — angled outward with emissive tips
  for (const side of [-1, 1]) {
    const arm = box(0.1, 0.5, 0.1, bodyColor)
    arm.position.set(side * 0.3, 0.8, 0)
    arm.rotation.z = side * 0.4
    group.add(arm)

    // Emissive tip
    const tip = box(0.06, 0.1, 0.06, emColor, emColor, 1.0)
    tip.position.set(side * 0.42, 0.5, 0)
    group.add(tip)
  }
}

// ─── Stalker: low quadruped ──────────────────────────────────────────────────
function buildStalker(group: THREE.Group, def: typeof ENEMY_DEFS['stalker']): void {
  const bodyColor = def.bodyColor
  const emColor = def.emissiveColor

  // Body — low and wide
  const body = box(0.8, 0.3, 0.5, bodyColor)
  body.position.y = 0.35
  group.add(body)

  // Four legs — elongated, spread wide
  const legPositions: [number, number][] = [[-0.35, 0.2], [0.35, 0.2], [-0.35, -0.2], [0.35, -0.2]]
  for (const [lx, lz] of legPositions) {
    const leg = box(0.1, 0.4, 0.1, bodyColor)
    leg.position.set(lx, 0.0, lz)
    group.add(leg)
  }

  // Maw (front, no head) — emissive interior
  const maw = box(0.3, 0.15, 0.2, emColor, emColor, 0.8)
  maw.position.set(0, 0.38, 0.35)
  group.add(maw)

  // Tail — trailing behind
  const tail = box(0.06, 0.06, 0.5, bodyColor)
  tail.position.set(0, 0.35, -0.5)
  group.add(tail)
}

// ─── Warden: towering humanoid (3x shambler + crown + veins) ─────────────────
function buildWarden(group: THREE.Group, def: typeof ENEMY_DEFS['warden']): void {
  const bodyColor = def.bodyColor
  const emColor = def.emissiveColor

  // Body (same proportions as shambler, scaled up by group scale)
  const body = box(0.6, 0.8, 0.4, bodyColor)
  group.add(body)

  // Head
  const headColor = lerpColor(bodyColor, 0xffffff, 0.1)
  const head = box(0.35, 0.3, 0.3, headColor)
  head.position.set(0, 0.35, 0.2)
  group.add(head)

  // Eye slit
  const eye = box(0.2, 0.05, 0.02, emColor, emColor, 1.0)
  eye.position.set(0, 0.4, 0.36)
  group.add(eye)

  // Arms
  const armL = box(0.15, 0.6, 0.15, bodyColor)
  armL.position.set(-0.38, -0.1, 0)
  group.add(armL)

  const armR = box(0.15, 0.6, 0.15, bodyColor)
  armR.position.set(0.38, -0.1, 0)
  group.add(armR)

  // Legs
  const legL = box(0.18, 0.4, 0.18, bodyColor)
  legL.position.set(-0.2, -0.6, 0)
  group.add(legL)

  const legR = box(0.18, 0.4, 0.18, bodyColor)
  legR.position.set(0.2, -0.6, 0)
  group.add(legR)

  // Crown of 5 spire boxes arranged in arc on top of head
  for (let i = 0; i < 5; i++) {
    const angle = (i / 4 - 0.5) * Math.PI * 0.6
    const spire = box(0.08, 0.5, 0.08, emColor, emColor, 0.6)
    spire.position.set(
      Math.sin(angle) * 0.15,
      0.75,
      0.2 + Math.cos(angle) * 0.05
    )
    spire.rotation.z = angle * 0.3
    group.add(spire)
    // Tag spire for pulsing animation
    spire.userData.isSpire = true
  }

  // Vein lines on torso — emissive magenta
  const veinPositions: [number, number, number, number][] = [
    [-0.15, 0.1, 0.21, 0.5],   // [x, y, z, height]
    [0.1, -0.1, 0.21, 0.4],
    [-0.05, -0.05, 0.21, 0.6],
    [0.2, 0.15, 0.21, 0.35],
  ]
  for (const [vx, vy, vz, vh] of veinPositions) {
    const vein = box(0.02, vh, 0.02, emColor, emColor, 0.8)
    vein.position.set(vx, vy, vz)
    group.add(vein)
    // Tag for pulsing
    vein.userData.isVein = true
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return (r << 16) | (g << 8) | bl
}
