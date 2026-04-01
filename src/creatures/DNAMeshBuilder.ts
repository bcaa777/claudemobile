import * as THREE from 'three'
import type { CreatureDNA } from './CreatureDNA'
import { dnaToStats, quantizeLegCount, quantizeEyeCount } from './CreatureDNA'

export interface MeshRefs {
  legs: THREE.Mesh[]     // top segment of each leg (rotate this for walking)
  wings: THREE.Mesh[]
  tail: THREE.Mesh | null
  body: THREE.Mesh
}

// ─── Caches ─────────────────────────────────────────────────────────────────

const _boxCache = new Map<string, THREE.BoxGeometry>()
const _sphereCache = new Map<string, THREE.SphereGeometry>()
const _matCache = new Map<string, THREE.MeshLambertMaterial>()

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
  const key = `${color}_${opts?.side ?? 0}_${opts?.emissive ?? 0}_${opts?.emissiveIntensity ?? 0}`
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

// ─── Main builder ───────────────────────────────────────────────────────────

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

  // ── Body ──────────────────────────────────────────────────────────────
  const bodyMesh = new THREE.Mesh(box(bodyW, bodyH, bodyD), mat(bodyCol))
  group.add(bodyMesh)
  refs.body = bodyMesh

  // Belly for larger creatures
  if (dna.size > 0.5) {
    const bellyW = bodyW * 0.9
    const bellyH = bodyH * 0.3
    const bellyD = bodyD * 0.7
    const belly = new THREE.Mesh(box(bellyW, bellyH, bellyD), mat(bodyCol))
    belly.position.set(0, -bodyH * 0.4, 0)
    group.add(belly)
  }

  // Shoulder bumps at top of body where legs attach
  let legCount = quantizeLegCount(dna.legCount)
  if (dna.bodyPlan === 'aquatic' || dna.bodyPlan === 'serpentine') legCount = 0
  if (dna.bodyPlan === 'avian' && legCount > 2) legCount = 2

  if (legCount >= 4) {
    const shoulderR = bodyW * 0.12
    for (const zSide of [-1, 1]) {
      for (const xSide of [-1, 1]) {
        const sh = new THREE.Mesh(sphere(shoulderR, 6), mat(bodyCol))
        sh.position.set(xSide * bodyW * 0.4, bodyH * 0.35, zSide * bodyD * 0.3)
        group.add(sh)
      }
    }
  }

  // Serpentine: extra body segments
  if (dna.bodyPlan === 'serpentine') {
    for (let s = 1; s <= 2; s++) {
      const segScale = 1 - s * 0.2
      const seg = new THREE.Mesh(box(bodyW * segScale, bodyH * segScale, bodyD * 0.7), mat(bodyCol))
      seg.position.set(0, 0, -bodyD * 0.6 * s)
      group.add(seg)
      // Joint sphere between segments
      const jt = new THREE.Mesh(sphere(bodyH * segScale * 0.4, 6), mat(bodyCol))
      jt.position.set(0, 0, -bodyD * 0.6 * s + bodyD * 0.35)
      group.add(jt)
    }
  }

  // ── Neck (visible geometry) ───────────────────────────────────────────
  const headR = bodyH * dna.headSize * 0.8
  const neckLen = dna.neckLength * bodyD * 0.5

  if (neckLen > bodyD * 0.05) {
    const neckW = headR * 0.6
    const neckMesh = new THREE.Mesh(box(neckW, neckW, neckLen), mat(accentCol))
    neckMesh.position.set(0, bodyH * 0.15, bodyD * 0.5 + neckLen * 0.5)
    group.add(neckMesh)

    // Neck joint spheres at start and end
    const neckJointR = neckW * 0.6
    const nj1 = new THREE.Mesh(sphere(neckJointR, 6), mat(accentCol))
    nj1.position.set(0, bodyH * 0.15, bodyD * 0.5)
    group.add(nj1)
    const nj2 = new THREE.Mesh(sphere(neckJointR, 6), mat(accentCol))
    nj2.position.set(0, bodyH * 0.15, bodyD * 0.5 + neckLen)
    group.add(nj2)
  }

  // ── Head (sphere) ─────────────────────────────────────────────────────
  const headMesh = new THREE.Mesh(sphere(headR, 8), mat(accentCol))
  headMesh.position.set(0, bodyH * 0.15, bodyD * 0.5 + neckLen + headR * 0.5)
  group.add(headMesh)

  // Snout/beak for predators
  if (isPredator) {
    const snoutLen = headR * 0.7
    const snoutW = headR * 0.35
    const snoutH = headR * 0.25
    const snout = new THREE.Mesh(box(snoutW, snoutH, snoutLen), mat(accentCol))
    snout.position.set(0, -headR * 0.1, headR * 0.6 + snoutLen * 0.3)
    headMesh.add(snout)
  }

  // ── Eyes ───────────────────────────────────────────────────────────────
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

  // ── Legs (multi-segment) ──────────────────────────────────────────────
  const totalLegH = bodyH * (0.5 + dna.legLength * 1.0)
  const legW = bodyW * (0.05 + dna.legThickness * 0.1)

  // Determine segment count from leg length
  const segCount = dna.legLength < 0.3 ? 1 : dna.legLength < 0.7 ? 2 : 3
  const segH = totalLegH / segCount

  if (legCount > 0) {
    const pairs = Math.ceil(legCount / 2)
    for (let p = 0; p < pairs; p++) {
      const zFrac = pairs === 1 ? 0 : (p / (pairs - 1) - 0.5)
      const zPos = zFrac * bodyD * 0.7
      for (const side of [-1, 1]) {
        if (refs.legs.length >= legCount) break

        // Build leg as chain of parent-child segments
        // Top segment is positioned relative to body and stored in refs.legs
        let parentNode: THREE.Object3D = group
        let attachY = -bodyH * 0.5
        const xPos = side * bodyW * 0.4

        let topSeg: THREE.Mesh | null = null

        for (let s = 0; s < segCount; s++) {
          const taper = 1 - s * 0.15  // each lower segment slightly thinner
          const segW = legW * taper
          const seg = new THREE.Mesh(box(segW, segH, segW), mat(legCol))

          if (s === 0) {
            // Top segment: positioned in world relative to body
            seg.position.set(xPos, attachY - segH * 0.5, zPos)
            group.add(seg)
            topSeg = seg

            // Hip joint sphere
            const hip = new THREE.Mesh(sphere(legW * 0.8, 6), mat(legCol))
            hip.position.set(xPos, attachY, zPos)
            group.add(hip)
          } else {
            // Lower segments: child of previous segment, positioned at bottom
            seg.position.set(0, -segH, 0)
            parentNode.add(seg)

            // Knee joint sphere between segments
            const knee = new THREE.Mesh(sphere(segW * 0.7, 6), mat(legCol))
            knee.position.set(0, -segH * 0.5, 0)
            parentNode.add(knee)
          }

          parentNode = seg
        }

        if (topSeg) refs.legs.push(topSeg)

        // Claws at the bottom of the last segment
        if (dna.hasClaws > 0.5) {
          const clawSize = 0.03 + dna.clawSize * 0.05
          const claw = new THREE.Mesh(box(clawSize, clawSize * 0.5, clawSize * 2), mat(accentCol))
          claw.position.set(0, -segH * 0.5, legW * 0.5)
          parentNode.add(claw)
        }
      }
    }
  }

  // ── Wings ─────────────────────────────────────────────────────────────
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

      // Wing tip — smaller outer section
      const tipW = wingW * 0.5
      const tipD = wingD * 0.6
      const tip = new THREE.Mesh(box(tipW, wingH, tipD), wingMat)
      tip.position.set(side * tipW * 0.4, 0, -wingD * 0.15)
      wing.add(tip)
    }
  }

  // ── Tail ──────────────────────────────────────────────────────────────
  const tailPresent = dna.hasTail > 0.5 || dna.bodyPlan === 'aquatic'
  if (tailPresent) {
    const tailLen = bodyD * (0.3 + dna.tailLength * 0.8)
    const tailW = bodyW * 0.15
    const tailH = bodyH * 0.2
    const tailMesh = new THREE.Mesh(box(tailW, tailH, tailLen), mat(bodyCol))
    tailMesh.position.set(0, 0, -bodyD * 0.5 - tailLen * 0.5)
    group.add(tailMesh)
    refs.tail = tailMesh

    // Tail tip (tapered)
    const tipLen = tailLen * 0.5
    const tipMesh = new THREE.Mesh(box(tailW * 0.6, tailH * 0.6, tipLen), mat(bodyCol))
    tipMesh.position.set(0, 0, -tailLen * 0.5 - tipLen * 0.3)
    tailMesh.add(tipMesh)

    if (dna.bodyPlan === 'aquatic') {
      const finMesh = new THREE.Mesh(
        box(bodyW * 0.5, tailH * 3, tailLen * 0.3),
        mat(accentCol, { side: THREE.DoubleSide }),
      )
      finMesh.position.set(0, 0, -tailLen * 0.5)
      tailMesh.add(finMesh)
    }
  }

  // ── Horns ─────────────────────────────────────────────────────────────
  if (dna.hasHorns > 0.5) {
    const hornLen = headR * (0.5 + dna.hornSize * 1.5)
    const hornW = headR * 0.15
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(box(hornW, hornLen, hornW), mat(accentCol))
      horn.position.set(side * headR * 0.5, headR * 0.6 + hornLen * 0.3, 0)
      horn.rotation.z = side * -0.3
      headMesh.add(horn)

      // Horn tip (thinner)
      const tipH = hornLen * 0.4
      const tip = new THREE.Mesh(box(hornW * 0.5, tipH, hornW * 0.5), mat(accentCol))
      tip.position.set(0, hornLen * 0.5 + tipH * 0.3, 0)
      horn.add(tip)
    }
  }

  // ── Mandibles ─────────────────────────────────────────────────────────
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

  // ── Fins ──────────────────────────────────────────────────────────────
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

  // ── Antennae ──────────────────────────────────────────────────────────
  if (dna.hasAntennae > 0.5) {
    const antLen = headR * 2
    const antW = headR * 0.05
    for (const side of [-1, 1]) {
      const ant = new THREE.Mesh(box(antW, antW, antLen), mat(legCol))
      ant.position.set(side * headR * 0.3, headR * 0.5, headR * 0.3 + antLen * 0.3)
      ant.rotation.x = -0.4
      headMesh.add(ant)

      // Antenna tip bulb
      const bulb = new THREE.Mesh(sphere(antW * 3, 6), mat(accentCol))
      bulb.position.set(0, 0, antLen * 0.45)
      ant.add(bulb)
    }
  }

  return refs
}
