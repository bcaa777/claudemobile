import * as THREE from 'three'
import type { CreatureDNA } from './CreatureDNA'
import { dnaToStats, quantizeLegCount, quantizeEyeCount } from './CreatureDNA'

export interface MeshRefs {
  legs: THREE.Mesh[]
  wings: THREE.Mesh[]
  tail: THREE.Mesh | null
  body: THREE.Mesh
}

const _boxCache = new Map<string, THREE.BoxGeometry>()
const _sphereCache = new Map<string, THREE.SphereGeometry>()
const _matCache = new Map<number, THREE.MeshLambertMaterial>()

function box(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`
  let g = _boxCache.get(key)
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _boxCache.set(key, g) }
  return g
}

function sphere(r: number, seg = 8): THREE.SphereGeometry {
  const key = `${r.toFixed(3)}_${seg}`
  let g = _sphereCache.get(key)
  if (!g) { g = new THREE.SphereGeometry(r, seg, seg); _sphereCache.set(key, g) }
  return g
}

function mat(color: number, opts?: { side?: THREE.Side; emissive?: number; emissiveIntensity?: number }): THREE.MeshLambertMaterial {
  const key = color + (opts?.side === THREE.DoubleSide ? 0x2000000 : 0) + (opts?.emissive ?? 0)
  let m = _matCache.get(key)
  if (!m) { m = new THREE.MeshLambertMaterial({ color, ...opts }); _matCache.set(key, m) }
  return m
}

function rgbToHex(r: number, g: number, b: number): number {
  return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255))
}

function darken(r: number, g: number, b: number, amount: number): number {
  return rgbToHex(Math.max(0, r - amount), Math.max(0, g - amount), Math.max(0, b - amount))
}

export function buildFromDNA(dna: CreatureDNA, group: THREE.Group): MeshRefs {
  const stats = dnaToStats(dna)
  const { bodyW, bodyH, bodyD } = stats

  const [br, bg, bb] = dna.bodyColor
  const [ar, ag, ab] = dna.accentColor
  const bodyCol = rgbToHex(br, bg, bb)
  const accentCol = rgbToHex(ar, ag, ab)
  const legCol = darken(br, bg, bb, 0.1)
  const isPredator = dna.aggression > 0.5

  const refs: MeshRefs = { legs: [], wings: [], tail: null, body: null! }

  // Body
  const bodyMesh = new THREE.Mesh(box(bodyW, bodyH, bodyD), mat(bodyCol))
  group.add(bodyMesh)
  refs.body = bodyMesh

  // Serpentine: extra body segments
  if (dna.bodyPlan === 'serpentine') {
    for (let s = 1; s <= 2; s++) {
      const segScale = 1 - s * 0.2
      const seg = new THREE.Mesh(box(bodyW * segScale, bodyH * segScale, bodyD * 0.7), mat(bodyCol))
      seg.position.set(0, 0, -bodyD * 0.6 * s)
      group.add(seg)
    }
  }

  // Head (sphere)
  const headR = bodyH * dna.headSize * 0.8
  const headMesh = new THREE.Mesh(sphere(headR, 8), mat(accentCol))
  const neckOffset = dna.neckLength * bodyD * 0.5
  headMesh.position.set(0, bodyH * 0.15, bodyD * 0.5 + neckOffset + headR * 0.5)
  group.add(headMesh)

  // Eyes
  const eyeCount = quantizeEyeCount(dna.eyeCount)
  const eyeR = 0.04 + dna.eyeSize * 0.04
  const eyeMat = isPredator
    ? mat(0xff2200, { emissive: 0xff2200, emissiveIntensity: 0.5 })
    : mat(0x111111)

  for (let e = 0; e < eyeCount; e++) {
    const eye = new THREE.Mesh(sphere(eyeR, 6), eyeMat)
    const angle = ((e - (eyeCount - 1) / 2) / Math.max(1, eyeCount - 1)) * 1.2
    eye.position.set(Math.sin(angle) * headR * 0.8, headR * 0.2, headR * 0.7)
    headMesh.add(eye)
  }

  // Legs
  let legCount = quantizeLegCount(dna.legCount)
  if (dna.bodyPlan === 'aquatic' || dna.bodyPlan === 'serpentine') legCount = 0
  if (dna.bodyPlan === 'avian' && legCount > 2) legCount = 2

  const legH = bodyH * (0.5 + dna.legLength * 1.0)
  const legW = bodyW * (0.05 + dna.legThickness * 0.1)

  if (legCount > 0) {
    const pairs = Math.ceil(legCount / 2)
    for (let p = 0; p < pairs; p++) {
      const zFrac = pairs === 1 ? 0 : (p / (pairs - 1) - 0.5)
      const zPos = zFrac * bodyD * 0.7
      for (const side of [-1, 1]) {
        if (refs.legs.length >= legCount) break
        const leg = new THREE.Mesh(box(legW, legH, legW), mat(legCol))
        leg.position.set(side * bodyW * 0.4, -bodyH * 0.5 - legH * 0.5, zPos)
        group.add(leg)
        refs.legs.push(leg)

        // Joint sphere at hip
        const joint = new THREE.Mesh(sphere(legW * 0.8, 6), mat(legCol))
        joint.position.set(side * bodyW * 0.4, -bodyH * 0.5, zPos)
        group.add(joint)

        // Claws
        if (dna.hasClaws > 0.5) {
          const clawSize = 0.03 + dna.clawSize * 0.05
          const claw = new THREE.Mesh(box(clawSize, clawSize * 0.5, clawSize * 2), mat(accentCol))
          claw.position.set(0, -legH * 0.5, legW * 0.5)
          leg.add(claw)
        }
      }
    }
  }

  // Wings
  const wingsPresent = dna.hasWings > 0.5 || dna.bodyPlan === 'avian'
  if (wingsPresent) {
    const wingW = bodyD * (0.5 + dna.wingSpan * 1.5)
    const wingH = bodyH * 0.05
    const wingD = bodyD * 0.8
    const wingMat = mat(accentCol, { side: THREE.DoubleSide })
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(box(wingW, wingH, wingD), wingMat)
      wing.position.set(side * (bodyW * 0.5 + wingW * 0.4), bodyH * 0.2, 0)
      group.add(wing)
      refs.wings.push(wing)
    }
  }

  // Tail
  const tailPresent = dna.hasTail > 0.5 || dna.bodyPlan === 'aquatic'
  if (tailPresent) {
    const tailLen = bodyD * (0.3 + dna.tailLength * 0.8)
    const tailW = bodyW * 0.15
    const tailH = bodyH * 0.2
    const tailMesh = new THREE.Mesh(box(tailW, tailH, tailLen), mat(bodyCol))
    tailMesh.position.set(0, 0, -bodyD * 0.5 - tailLen * 0.5)
    group.add(tailMesh)
    refs.tail = tailMesh

    if (dna.bodyPlan === 'aquatic') {
      const finMesh = new THREE.Mesh(
        box(bodyW * 0.5, tailH * 3, tailLen * 0.3),
        mat(accentCol, { side: THREE.DoubleSide }),
      )
      finMesh.position.set(0, 0, -tailLen * 0.5)
      tailMesh.add(finMesh)
    }
  }

  // Horns
  if (dna.hasHorns > 0.5) {
    const hornLen = headR * (0.5 + dna.hornSize * 1.5)
    const hornW = headR * 0.15
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(box(hornW, hornLen, hornW), mat(accentCol))
      horn.position.set(side * headR * 0.5, headR * 0.6 + hornLen * 0.3, 0)
      horn.rotation.z = side * -0.3
      headMesh.add(horn)
    }
  }

  // Mandibles
  if (dna.hasMandibles > 0.5) {
    const mandLen = headR * 0.8
    const mandW = headR * 0.1
    for (const side of [-1, 1]) {
      const mand = new THREE.Mesh(box(mandW, mandW, mandLen), mat(legCol))
      mand.position.set(side * headR * 0.4, -headR * 0.3, headR * 0.5)
      mand.rotation.y = side * 0.3
      headMesh.add(mand)
    }
  }

  // Fins
  if (dna.hasFins > 0.5 || dna.bodyPlan === 'aquatic') {
    const finH = bodyH * (0.3 + dna.finSize * 0.6)
    const finD = bodyD * 0.4
    const dorsal = new THREE.Mesh(box(bodyW * 0.05, finH, finD), mat(accentCol, { side: THREE.DoubleSide }))
    dorsal.position.set(0, bodyH * 0.5 + finH * 0.3, 0)
    group.add(dorsal)

    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(
        box(bodyW * 0.4, bodyH * 0.05, finD * 0.6),
        mat(accentCol, { side: THREE.DoubleSide }),
      )
      pec.position.set(side * bodyW * 0.5, -bodyH * 0.2, bodyD * 0.15)
      pec.rotation.z = side * 0.3
      group.add(pec)
    }
  }

  // Antennae
  if (dna.hasAntennae > 0.5) {
    const antLen = headR * 2
    const antW = headR * 0.05
    for (const side of [-1, 1]) {
      const ant = new THREE.Mesh(box(antW, antW, antLen), mat(legCol))
      ant.position.set(side * headR * 0.3, headR * 0.5, headR * 0.3 + antLen * 0.3)
      ant.rotation.x = -0.4
      headMesh.add(ant)
    }
  }

  return refs
}
