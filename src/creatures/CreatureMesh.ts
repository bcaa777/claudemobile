import * as THREE from 'three'
import { Creature } from './Creature'
import { SPECIES } from './Species'

// Phase 6: Shared geometry and material caches
const _geoCache = new Map<string, THREE.BoxGeometry>()
const _matCache = new Map<number, THREE.MeshLambertMaterial>()
const _sphereCache = new Map<string, THREE.SphereGeometry>()

function getCachedBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w}_${h}_${d}`
  let geo = _geoCache.get(key)
  if (!geo) { geo = new THREE.BoxGeometry(w, h, d); _geoCache.set(key, geo) }
  return geo
}

function getCachedMat(color: number, opts?: { side?: THREE.Side }): THREE.MeshLambertMaterial {
  const key = opts?.side ? color + 0x1000000 : color
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

// LOD distance thresholds (squared)
const LOD_FULL_DIST_SQ = 20 * 20     // < 20 units: full detail
// > 20 units: simple body-only mesh (1 draw call)

export class CreatureMesh {
  group: THREE.Group
  private legs: THREE.Mesh[] = []
  private wings: THREE.Mesh[] = []
  private tailFin: THREE.Mesh | null = null
  private crocLegs: THREE.Mesh[] = []
  private animTime = 0
  private lod: 'full' | 'simple' = 'simple'
  private bodyMesh: THREE.Mesh | null = null

  constructor(creature: Creature, scene: THREE.Scene, distSq: number) {
    this.group = new THREE.Group()
    if (distSq < LOD_FULL_DIST_SQ) {
      this.buildGeometry(creature)
      this.lod = 'full'
    } else {
      this.buildSimple(creature)
      this.lod = 'simple'
    }
    scene.add(this.group)
    this.group.position.copy(creature.position)
    this.group.scale.setScalar(creature.scale)
  }

  /** Switch LOD if distance changed bracket */
  updateLOD(creature: Creature, distSq: number, scene: THREE.Scene) {
    const wantFull = distSq < LOD_FULL_DIST_SQ
    if (wantFull && this.lod !== 'full') {
      this.clearGroup()
      this.buildGeometry(creature)
      this.lod = 'full'
    } else if (!wantFull && this.lod !== 'simple') {
      this.clearGroup()
      this.buildSimple(creature)
      this.lod = 'simple'
    }
  }

  private clearGroup() {
    while (this.group.children.length > 0) {
      this.group.remove(this.group.children[0])
    }
    this.legs = []
    this.wings = []
    this.tailFin = null
    this.crocLegs = []
    this.bodyMesh = null
  }

  /** Simple LOD: just a single colored box (1 draw call) */
  private buildSimple(creature: Creature) {
    const sp = SPECIES[creature.species]
    const mesh = new THREE.Mesh(
      getCachedBox(sp.bodyW, sp.bodyH, sp.bodyD),
      getCachedMat(sp.bodyColor)
    )
    this.group.add(mesh)
    this.bodyMesh = mesh
  }

  private box(w: number, h: number, d: number, color: number): THREE.Mesh {
    return new THREE.Mesh(getCachedBox(w, h, d), getCachedMat(color))
  }

  private buildGeometry(creature: Creature) {
    const sp = SPECIES[creature.species]
    const { bodyW, bodyH, bodyD, bodyColor, headColor, legColor } = sp

    if (sp.mobility === 'ground') {
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      const head = this.box(bodyW * 0.6, bodyH * 0.7, bodyD * 0.5, headColor)
      head.position.set(0, bodyH * 0.2, bodyD * 0.55)
      this.group.add(head)

      // Eyes
      const eyeGeo = getCachedSphere(0.06, 4, 4)
      const eyeMat = getCachedMat(0x111111)
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
      eyeL.position.set(-bodyW * 0.22, bodyH * 0.35, bodyD * 0.79)
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
      eyeR.position.set(bodyW * 0.22, bodyH * 0.35, bodyD * 0.79)
      this.group.add(eyeL, eyeR)

      // 4 legs
      const legH = bodyH * 1.0
      const legW = bodyW * 0.18
      const legOffsets: [number, number, number][] = [
        [-bodyW * 0.35, -bodyH * 0.95, bodyD * 0.28],
        [ bodyW * 0.35, -bodyH * 0.95, bodyD * 0.28],
        [-bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.28],
        [ bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.28],
      ]
      for (const [lx, ly, lz] of legOffsets) {
        const leg = this.box(legW, legH, legW, legColor)
        leg.position.set(lx, ly, lz)
        this.group.add(leg)
        this.legs.push(leg)
      }

      // Species-specific
      if (creature.species === 'deer') {
        const antlerMat = getCachedMat(0x6b4c1e)
        const antlerGeo = getCachedBox(0.08, 0.4, 0.08)
        const aL = new THREE.Mesh(antlerGeo, antlerMat)
        aL.position.set(-bodyW * 0.2, bodyH * 0.82, bodyD * 0.52)
        const aR = new THREE.Mesh(antlerGeo, antlerMat)
        aR.position.set(bodyW * 0.2, bodyH * 0.82, bodyD * 0.52)
        this.group.add(aL, aR)
      }
      if (creature.species === 'camel') {
        const hump = this.box(bodyW * 0.5, bodyH * 0.6, bodyW * 0.4, bodyColor)
        hump.position.set(0, bodyH * 0.9, -bodyD * 0.1)
        this.group.add(hump)
      }
      if (creature.species === 'fox') {
        const tail = this.box(bodyW * 0.3, bodyW * 0.35, bodyD * 0.4, 0xffffff)
        tail.position.set(0, bodyH * 0.35, -bodyD * 0.55)
        this.group.add(tail)
      }
      if (creature.species === 'lion') {
        const mane = this.box(bodyW * 1.0, bodyH * 1.0, bodyD * 0.35, 0xb8780a)
        mane.position.set(0, bodyH * 0.2, bodyD * 0.55)
        this.group.add(mane)
      }
      if (creature.species === 'mammoth') {
        const tuskMat = getCachedMat(0xfffff0)
        const tuskGeo = getCachedBox(bodyW * 0.12, bodyW * 0.12, bodyD * 0.35)
        const tuskL = new THREE.Mesh(tuskGeo, tuskMat)
        tuskL.position.set(-bodyW * 0.28, -bodyH * 0.15, bodyD * 0.55)
        const tuskR = new THREE.Mesh(tuskGeo, tuskMat)
        tuskR.position.set(bodyW * 0.28, -bodyH * 0.15, bodyD * 0.55)
        this.group.add(tuskL, tuskR)
      }

    } else if (sp.mobility === 'air') {
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      const head = this.box(bodyW * 0.7, bodyH * 0.65, bodyD * 0.4, headColor)
      head.position.set(0, bodyH * 0.12, bodyD * 0.58)
      this.group.add(head)

      const eyeGeo2 = getCachedSphere(0.05, 4, 4)
      const eyeMat2 = getCachedMat(0x111111)
      const eyeL = new THREE.Mesh(eyeGeo2, eyeMat2)
      eyeL.position.set(-bodyW * 0.28, bodyH * 0.2, bodyD * 0.76)
      const eyeR = new THREE.Mesh(eyeGeo2, eyeMat2)
      eyeR.position.set(bodyW * 0.28, bodyH * 0.2, bodyD * 0.76)
      this.group.add(eyeL, eyeR)

      const wingSpan = sp.id === 'dragon' ? bodyD * 1.5 : bodyD * 1.1
      const wingD = bodyD * 0.45
      const wingMat = getCachedMat(bodyColor, { side: THREE.DoubleSide })
      const wingGeo = getCachedBox(wingSpan, 0.1, wingD)

      const wingL = new THREE.Mesh(wingGeo, wingMat)
      wingL.position.set(-(bodyW * 0.5 + wingSpan * 0.5), 0, -bodyD * 0.1)
      const wingR = new THREE.Mesh(wingGeo, wingMat)
      wingR.position.set( bodyW * 0.5 + wingSpan * 0.5, 0, -bodyD * 0.1)
      this.group.add(wingL, wingR)
      this.wings.push(wingL, wingR)

      if (sp.id === 'dragon') {
        const ridgeMat = getCachedMat(0x440000)
        for (let i = 0; i < 4; i++) {
          const ridge = new THREE.Mesh(getCachedBox(0.15, 0.38 - i * 0.06, 0.15), ridgeMat)
          ridge.position.set(0, bodyH * 0.58, bodyD * 0.28 - i * bodyD * 0.18)
          this.group.add(ridge)
        }
      }

    } else if (creature.species === 'croc') {
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      const snout = this.box(bodyW * 0.65, bodyH * 0.7, bodyD * 0.38, headColor)
      snout.position.set(0, -bodyH * 0.15, bodyD * 0.69)
      this.group.add(snout)

      const tail = this.box(bodyW * 0.5, bodyH * 0.5, bodyD * 0.4, bodyColor)
      tail.position.set(0, -bodyH * 0.1, -bodyD * 0.7)
      tail.rotation.x = 0.2
      this.group.add(tail)
      this.tailFin = tail

      const legOffsets: [number, number, number][] = [
        [-bodyW * 0.55, -bodyH * 0.5,  bodyD * 0.25],
        [ bodyW * 0.55, -bodyH * 0.5,  bodyD * 0.25],
        [-bodyW * 0.55, -bodyH * 0.5, -bodyD * 0.25],
        [ bodyW * 0.55, -bodyH * 0.5, -bodyD * 0.25],
      ]
      for (const [lx, ly, lz] of legOffsets) {
        const leg = this.box(bodyW * 0.18, bodyH * 0.9, bodyW * 0.18, sp.legColor)
        leg.position.set(lx, ly, lz)
        this.group.add(leg)
        this.crocLegs.push(leg)
      }

      const crocEyeGeo = getCachedSphere(0.07, 5, 4)
      const crocEyeMat = getCachedMat(0xffcc00)
      const eyeL = new THREE.Mesh(crocEyeGeo, crocEyeMat)
      eyeL.position.set(-bodyW * 0.28, bodyH * 0.55, bodyD * 0.35)
      const eyeR = new THREE.Mesh(crocEyeGeo, crocEyeMat)
      eyeR.position.set(bodyW * 0.28, bodyH * 0.55, bodyD * 0.35)
      this.group.add(eyeL, eyeR)

    } else {
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      const tail = this.box(bodyW * 0.8, bodyH * 0.9, bodyD * 0.22, headColor)
      tail.position.set(0, 0, -bodyD * 0.6)
      this.group.add(tail)
      this.tailFin = tail

      const dorsal = this.box(bodyW * 0.12, bodyH * 0.5, bodyD * 0.28, headColor)
      dorsal.position.set(0, bodyH * 0.62, 0)
      this.group.add(dorsal)
    }
  }

  update(creature: Creature, delta: number) {
    this.group.position.copy(creature.position)
    this.group.scale.setScalar(creature.scale)
    this.group.rotation.y = creature.heading + Math.PI

    // Simple LOD — no animation needed
    if (this.lod === 'simple') {
      if (creature.state === 'dead') {
        this.group.rotation.z = Math.min(Math.PI * 0.5, creature.deathTimer * 1.2)
      }
      return
    }

    this.animTime += delta
    const sp = SPECIES[creature.species]
    const moving = creature.velocity.lengthSq() > 0.04

    // Leg animation
    if (sp.mobility === 'ground' && this.legs.length >= 4) {
      if (moving) {
        const freq = creature.velocity.length() * 2.5
        const sinVal = Math.sin(this.animTime * freq) * 0.5
        this.legs[0].rotation.x =  sinVal
        this.legs[1].rotation.x = -sinVal
        this.legs[2].rotation.x = -sinVal
        this.legs[3].rotation.x =  sinVal
      } else {
        for (const leg of this.legs) leg.rotation.x = 0
      }
    }

    // Wing flap
    if (sp.mobility === 'air' && this.wings.length >= 2) {
      const flapSpeed = sp.id === 'dragon' ? 2.5 : 6.0
      const flapAmp  = sp.id === 'dragon' ? 0.4 : 0.6
      const angle = Math.sin(this.animTime * flapSpeed) * flapAmp
      this.wings[0].rotation.z =  angle
      this.wings[1].rotation.z = -angle
    }

    // Tail fin / croc tail
    if (sp.mobility === 'water' && this.tailFin) {
      if (creature.species === 'croc') {
        this.tailFin.rotation.y = Math.sin(this.animTime * 1.2) * 0.35
        if (moving && this.crocLegs.length >= 4) {
          const rock = Math.sin(this.animTime * 2.5) * 0.15
          this.crocLegs[0].rotation.x =  rock
          this.crocLegs[1].rotation.x = -rock
          this.crocLegs[2].rotation.x = -rock
          this.crocLegs[3].rotation.x =  rock
        }
      } else {
        this.tailFin.rotation.y = Math.sin(this.animTime * 3.0) * 0.4
      }
    }

    // Death tilt
    if (creature.state === 'dead') {
      this.group.rotation.z = Math.min(Math.PI * 0.5, creature.deathTimer * 1.2)
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
  }
}
