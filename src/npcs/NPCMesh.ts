import * as THREE from 'three'
import type { NPCVisualConfig } from './NPCData'

// Shared caches (same pattern as CreatureMesh.ts)
const _geoCache = new Map<string, THREE.BoxGeometry>()
const _matCache = new Map<number, THREE.MeshLambertMaterial>()
const _sphereCache = new Map<string, THREE.SphereGeometry>()

function getCachedBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w}_${h}_${d}`
  let geo = _geoCache.get(key)
  if (!geo) { geo = new THREE.BoxGeometry(w, h, d); _geoCache.set(key, geo) }
  return geo
}

function getCachedMat(color: number, opts?: { emissive?: number; emissiveIntensity?: number }): THREE.MeshLambertMaterial {
  const key = color + (opts?.emissive ?? 0) * 0x10000000
  let mat = _matCache.get(key)
  if (!mat) { mat = new THREE.MeshLambertMaterial({ color, ...opts }); _matCache.set(key, mat) }
  return mat
}

function getCachedSphere(r: number, ws: number, hs: number): THREE.SphereGeometry {
  const key = `${r}_${ws}_${hs}`
  let geo = _sphereCache.get(key)
  if (!geo) { geo = new THREE.SphereGeometry(r, ws, hs); _sphereCache.set(key, geo) }
  return geo
}

const LOD_FULL_DIST_SQ = 30 * 30

export class NPCMesh {
  group: THREE.Group
  private fullGroup: THREE.Group
  private simpleBox: THREE.Mesh
  private glowHalo: THREE.Mesh | null = null
  private leftLeg: THREE.Mesh
  private rightLeg: THREE.Mesh
  private currentLOD: 'full' | 'simple' = 'full'

  constructor(visual: NPCVisualConfig) {
    this.group = new THREE.Group()
    const s = visual.bodyScale

    // Full detail group
    this.fullGroup = new THREE.Group()
    this.group.add(this.fullGroup)

    const robeMat = getCachedMat(visual.robeColor)
    const trimMat = getCachedMat(visual.trimColor)

    // Legs
    this.leftLeg = new THREE.Mesh(getCachedBox(0.3 * s, 0.7 * s, 0.3 * s), robeMat)
    this.leftLeg.position.set(-0.2 * s, 0.35 * s, 0)
    this.fullGroup.add(this.leftLeg)

    this.rightLeg = new THREE.Mesh(getCachedBox(0.3 * s, 0.7 * s, 0.3 * s), robeMat)
    this.rightLeg.position.set(0.2 * s, 0.35 * s, 0)
    this.fullGroup.add(this.rightLeg)

    // Robe skirt
    const skirt = new THREE.Mesh(getCachedBox(0.9 * s, 0.4 * s, 0.6 * s), trimMat)
    skirt.position.set(0, 0.7 * s, 0)
    this.fullGroup.add(skirt)

    // Torso
    const torso = new THREE.Mesh(getCachedBox(0.7 * s, 0.8 * s, 0.5 * s), robeMat)
    torso.position.set(0, 1.3 * s, 0)
    this.fullGroup.add(torso)

    // Head
    const headMat = getCachedMat(0xddbb99)
    const head = new THREE.Mesh(getCachedBox(0.5 * s, 0.5 * s, 0.5 * s), headMat)
    head.position.set(0, 2.0 * s, 0)
    this.fullGroup.add(head)

    // Eyes
    const eyeMat = visual.eyeEmissive
      ? getCachedMat(visual.eyeColor, { emissive: visual.eyeColor, emissiveIntensity: 1.5 })
      : getCachedMat(visual.eyeColor)
    const leftEye = new THREE.Mesh(getCachedSphere(0.06 * s, 6, 6), eyeMat)
    leftEye.position.set(-0.12 * s, 2.05 * s, 0.25 * s)
    this.fullGroup.add(leftEye)
    const rightEye = new THREE.Mesh(getCachedSphere(0.06 * s, 6, 6), eyeMat)
    rightEye.position.set(0.12 * s, 2.05 * s, 0.25 * s)
    this.fullGroup.add(rightEye)

    // Glow halo
    if (visual.hasGlow) {
      const haloMat = new THREE.MeshBasicMaterial({
        color: visual.glowColor,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
      this.glowHalo = new THREE.Mesh(getCachedBox(0.4 * s, 0.15 * s, 0.4 * s), haloMat)
      this.glowHalo.position.set(0, 2.5 * s, 0)
      this.fullGroup.add(this.glowHalo)
    }

    // Per-NPC features
    this.buildFeatures(visual, s)

    // Simple LOD box
    this.simpleBox = new THREE.Mesh(getCachedBox(0.8 * s, 2.0 * s, 0.5 * s), robeMat)
    this.simpleBox.position.set(0, 1.0 * s, 0)
    this.simpleBox.visible = false
    this.group.add(this.simpleBox)
  }

  private buildFeatures(v: NPCVisualConfig, s: number) {
    const trimMat = getCachedMat(v.trimColor)
    const robeMat = getCachedMat(v.robeColor)

    // Hats
    if (v.hat === 'wideBrim') {
      const brim = new THREE.Mesh(getCachedBox(1.0 * s, 0.08 * s, 1.0 * s), trimMat)
      brim.position.set(0, 2.3 * s, 0)
      this.fullGroup.add(brim)
      const crown = new THREE.Mesh(getCachedBox(0.4 * s, 0.3 * s, 0.4 * s), trimMat)
      crown.position.set(0, 2.5 * s, 0)
      this.fullGroup.add(crown)
    } else if (v.hat === 'pointed') {
      const cone = new THREE.Mesh(getCachedBox(0.35 * s, 0.8 * s, 0.35 * s), trimMat)
      cone.position.set(0, 2.65 * s, 0)
      this.fullGroup.add(cone)
    } else if (v.hat === 'starOrnament') {
      const starMat = getCachedMat(v.glowColor, { emissive: v.glowColor, emissiveIntensity: 0.8 })
      const star = new THREE.Mesh(getCachedBox(0.2 * s, 0.2 * s, 0.2 * s), starMat)
      star.position.set(0, 2.45 * s, 0)
      star.rotation.set(0, Math.PI / 4, Math.PI / 4)
      this.fullGroup.add(star)
    }

    // Back items
    if (v.backItem === 'scroll') {
      const scroll = new THREE.Mesh(getCachedBox(0.15 * s, 0.6 * s, 0.15 * s), getCachedMat(0xddcc88))
      scroll.position.set(0, 1.3 * s, -0.35 * s)
      this.fullGroup.add(scroll)
    } else if (v.backItem === 'brokenSword') {
      const blade = new THREE.Mesh(getCachedBox(0.08 * s, 1.0 * s, 0.15 * s), getCachedMat(0x888899))
      blade.position.set(0.15 * s, 1.6 * s, -0.35 * s)
      blade.rotation.z = 0.15
      this.fullGroup.add(blade)
      const hilt = new THREE.Mesh(getCachedBox(0.25 * s, 0.08 * s, 0.08 * s), getCachedMat(0x554433))
      hilt.position.set(0.15 * s, 1.1 * s, -0.35 * s)
      this.fullGroup.add(hilt)
    } else if (v.backItem === 'hammer') {
      const handle = new THREE.Mesh(getCachedBox(0.08 * s, 0.9 * s, 0.08 * s), getCachedMat(0x664422))
      handle.position.set(-0.15 * s, 1.5 * s, -0.35 * s)
      handle.rotation.z = -0.2
      this.fullGroup.add(handle)
      const hammerHead = new THREE.Mesh(getCachedBox(0.3 * s, 0.2 * s, 0.2 * s),
        getCachedMat(0xcc5500, { emissive: 0xff4400, emissiveIntensity: 0.4 }))
      hammerHead.position.set(-0.15 * s, 2.0 * s, -0.35 * s)
      this.fullGroup.add(hammerHead)
    } else if (v.backItem === 'pouches') {
      for (let i = 0; i < 3; i++) {
        const pouch = new THREE.Mesh(getCachedBox(0.15 * s, 0.15 * s, 0.12 * s), trimMat)
        pouch.position.set((i - 1) * 0.2 * s, 0.9 * s, -0.3 * s)
        this.fullGroup.add(pouch)
      }
    } else if (v.backItem === 'books') {
      for (let i = 0; i < 3; i++) {
        const book = new THREE.Mesh(getCachedBox(0.35 * s, 0.08 * s, 0.25 * s), getCachedMat(0x553322 + i * 0x111100))
        book.position.set(0, 1.2 * s + i * 0.1, -0.35 * s)
        this.fullGroup.add(book)
      }
      // Monocle
      const monocle = new THREE.Mesh(getCachedSphere(0.08 * s, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xaaddff, transparent: true, opacity: 0.5 }))
      monocle.position.set(0.18 * s, 2.08 * s, 0.25 * s)
      this.fullGroup.add(monocle)
    }

    // Pearl special: brighter halo
    if (v.glowColor === 0xeeeeff && v.hasGlow && this.glowHalo) {
      (this.glowHalo.material as THREE.MeshBasicMaterial).opacity = 0.6
    }
  }

  setLOD(distSq: number) {
    const target = distSq < LOD_FULL_DIST_SQ ? 'full' : 'simple'
    if (target !== this.currentLOD) {
      this.currentLOD = target
      this.fullGroup.visible = target === 'full'
      this.simpleBox.visible = target === 'simple'
    }
  }

  update(delta: number, time: number) {
    // Idle Y-bob
    this.group.position.y += Math.sin(time * 2.0) * 0.003

    // Leg weight-shift
    const shift = Math.sin(time * 1.5) * 0.03
    this.leftLeg.position.y = 0.35 + shift
    this.rightLeg.position.y = 0.35 - shift

    // Glow pulse
    if (this.glowHalo) {
      const mat = this.glowHalo.material as THREE.MeshBasicMaterial
      mat.opacity = 0.25 + Math.sin(time * 3.0) * 0.15
    }
  }

  dispose() {
    this.group.parent?.remove(this.group)
  }
}
