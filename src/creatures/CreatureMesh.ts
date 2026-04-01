import * as THREE from 'three'
import { Creature } from './Creature'
import { SPECIES } from './Species'
import { texGen, type TexturePattern } from '../utils/PixelTextureGenerator'
import { buildEnemyMesh } from '../combat/EnemyMesh'
import { ENEMY_DEFS } from '../combat/EnemyTypes'
import { buildFromDNA, type MeshRefs } from './DNAMeshBuilder'
import { dnaToStats } from './CreatureDNA'

// Phase 6: Shared geometry and material caches
const _geoCache = new Map<string, THREE.BoxGeometry>()
const _matCache = new Map<number, THREE.MeshLambertMaterial>()
const _sphereCache = new Map<string, THREE.SphereGeometry>()
const _texMatCache = new Map<string, THREE.MeshLambertMaterial>()

function getTexturedMat(color: number, pattern: TexturePattern, opts?: { side?: THREE.Side, emissive?: number, emissiveIntensity?: number }): THREE.MeshLambertMaterial {
  const key = `${color}_${pattern}_${opts?.side ?? 0}_${opts?.emissive ?? 0}`
  let mat = _texMatCache.get(key)
  if (!mat) {
    const tex = texGen.getTexture(pattern, color)
    mat = new THREE.MeshLambertMaterial({ color, map: tex.map, ...opts })
    _texMatCache.set(key, mat)
  }
  return mat
}

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
  private dnaRefs: MeshRefs | null = null

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
    this.dnaRefs = null
  }

  /** Simple LOD: just a single colored box (1 draw call) */
  private buildSimple(creature: Creature) {
    if (creature.isEnemy && creature.enemyType) {
      // Enemies: use enemy body color for simple LOD box
      const def = ENEMY_DEFS[creature.enemyType]
      const mesh = new THREE.Mesh(
        getCachedBox(0.6, 0.8, 0.4),
        getCachedMat(def?.bodyColor ?? 0x2a1030)
      )
      this.group.add(mesh)
      this.bodyMesh = mesh
      return
    }
    if (creature.dna) {
      const stats = dnaToStats(creature.dna)
      const mesh = new THREE.Mesh(
        getCachedBox(stats.bodyW, stats.bodyH, stats.bodyD),
        getCachedMat(stats.bodyColor)
      )
      this.group.add(mesh)
      this.bodyMesh = mesh
      return
    }
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
    // ── Enemy creatures — delegate to EnemyMesh builder ────────────────────
    if (creature.isEnemy && creature.enemyType) {
      const enemyGroup = buildEnemyMesh(creature.enemyType, 1) // scale applied via group.scale
      // Merge children into our group
      while (enemyGroup.children.length > 0) {
        const child = enemyGroup.children[0]
        enemyGroup.remove(child)
        this.group.add(child)
      }
      // Set bodyMesh to first child for glow support
      if (this.group.children.length > 0) {
        this.bodyMesh = this.group.children[0] as THREE.Mesh
      }
      return
    }

    // DNA-driven creatures
    if (creature.dna) {
      this.dnaRefs = buildFromDNA(creature.dna, this.group)
      this.bodyMesh = this.dnaRefs.body
      this.legs = this.dnaRefs.legs
      this.wings = this.dnaRefs.wings
      this.tailFin = this.dnaRefs.tail
      return
    }

    const sp = SPECIES[creature.species]
    const { bodyW, bodyH, bodyD, bodyColor, headColor, legColor } = sp

    // ── Giant creatures — special detailed meshes ──────────────────────────
    if (creature.species === 'titan') {
      this.buildTitan(sp)
      return
    }
    if (creature.species === 'skywhale') {
      this.buildSkywhale(sp)
      return
    }
    if (creature.species === 'wurm') {
      this.buildWurm(sp)
      return
    }
    if (creature.species === 'infernal') {
      this.buildInfernal(sp)
      return
    }

    if (sp.mobility === 'ground') {
      const bodyMesh = new THREE.Mesh(getCachedBox(bodyW, bodyH, bodyD), getTexturedMat(bodyColor, 'scales'))
      this.group.add(bodyMesh)

      const head = new THREE.Mesh(getCachedBox(bodyW * 0.6, bodyH * 0.7, bodyD * 0.5), getTexturedMat(headColor, 'scales'))
      head.position.set(0, bodyH * 0.2, bodyD * 0.55)
      this.group.add(head)

      // Eyes
      const eyeGeo = getCachedSphere(0.06, 4, 4)
      const eyeMat = sp.role === 'predator'
        ? getTexturedMat(0xff4400, 'scales', { emissive: 0xff2200, emissiveIntensity: 0.6 })
        : getCachedMat(0x111111)
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
        const leg = new THREE.Mesh(getCachedBox(legW, legH, legW), getTexturedMat(legColor, 'scales'))
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
      if (creature.species === 'hellhound') {
        // Ridge spines along back
        const spineMat = getCachedMat(0x661100)
        for (let i = 0; i < 4; i++) {
          const spine = new THREE.Mesh(getCachedBox(0.08, 0.25 - i * 0.04, 0.08), spineMat)
          spine.position.set(0, bodyH * 0.7, bodyD * 0.2 - i * bodyD * 0.15)
          this.group.add(spine)
        }
      }
      if (creature.species === 'lion') {
        const mane = this.box(bodyW * 1.0, bodyH * 1.0, bodyD * 0.35, 0xb8780a)
        mane.position.set(0, bodyH * 0.2, bodyD * 0.55)
        this.group.add(mane)
      }
      if (creature.species === 'crab') {
        // Wide flat body with side-mounted eyes and claws
        const eyeStalk1 = this.box(0.06, 0.15, 0.06, headColor)
        eyeStalk1.position.set(-bodyW * 0.35, bodyH * 0.55, bodyD * 0.35)
        const eyeStalk2 = this.box(0.06, 0.15, 0.06, headColor)
        eyeStalk2.position.set(bodyW * 0.35, bodyH * 0.55, bodyD * 0.35)
        this.group.add(eyeStalk1, eyeStalk2)
        // Claws
        const clawMat = getCachedMat(0xdd5533)
        for (const side of [-1, 1]) {
          const claw = new THREE.Mesh(getCachedBox(bodyW * 0.25, bodyH * 0.5, bodyD * 0.2), clawMat)
          claw.position.set(side * bodyW * 0.6, 0, bodyD * 0.4)
          this.group.add(claw)
        }
      }
      if (creature.species === 'goat') {
        // Small horns
        const hornMat = getCachedMat(0x888877)
        const hornGeo = getCachedBox(0.06, 0.2, 0.06)
        const hL = new THREE.Mesh(hornGeo, hornMat)
        hL.position.set(-bodyW * 0.15, bodyH * 0.7, bodyD * 0.48)
        hL.rotation.z = 0.3
        const hR = new THREE.Mesh(hornGeo, hornMat)
        hR.position.set(bodyW * 0.15, bodyH * 0.7, bodyD * 0.48)
        hR.rotation.z = -0.3
        this.group.add(hL, hR)
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
      const airBody = new THREE.Mesh(getCachedBox(bodyW, bodyH, bodyD), getTexturedMat(bodyColor, 'scales'))
      this.group.add(airBody)

      const head = new THREE.Mesh(getCachedBox(bodyW * 0.7, bodyH * 0.65, bodyD * 0.4), getTexturedMat(headColor, 'scales'))
      head.position.set(0, bodyH * 0.12, bodyD * 0.58)
      this.group.add(head)

      const eyeGeo2 = getCachedSphere(0.05, 4, 4)
      const eyeMat2 = sp.role === 'predator'
        ? getTexturedMat(0xff4400, 'scales', { emissive: 0xff2200, emissiveIntensity: 0.6 })
        : getCachedMat(0x111111)
      const eyeL = new THREE.Mesh(eyeGeo2, eyeMat2)
      eyeL.position.set(-bodyW * 0.28, bodyH * 0.2, bodyD * 0.76)
      const eyeR = new THREE.Mesh(eyeGeo2, eyeMat2)
      eyeR.position.set(bodyW * 0.28, bodyH * 0.2, bodyD * 0.76)
      this.group.add(eyeL, eyeR)

      const wingSpan = sp.id === 'dragon' ? bodyD * 1.5 : bodyD * 1.1
      const wingD = bodyD * 0.45
      const wingMat = getTexturedMat(bodyColor, 'scales', { side: THREE.DoubleSide })
      const wingGeo = getCachedBox(wingSpan, 0.1, wingD)

      const wingL = new THREE.Mesh(wingGeo, wingMat)
      wingL.position.set(-(bodyW * 0.5 + wingSpan * 0.5), 0, -bodyD * 0.1)
      const wingR = new THREE.Mesh(wingGeo, wingMat)
      wingR.position.set( bodyW * 0.5 + wingSpan * 0.5, 0, -bodyD * 0.1)
      this.group.add(wingL, wingR)
      this.wings.push(wingL, wingR)

      if (creature.species === 'imp') {
        // Two small horns on head
        const hornMat = getCachedMat(0x661100)
        const hornGeo = getCachedBox(0.06, 0.18, 0.06)
        const hornL = new THREE.Mesh(hornGeo, hornMat)
        hornL.position.set(-bodyW * 0.2, bodyH * 0.45, bodyD * 0.55)
        const hornR = new THREE.Mesh(hornGeo, hornMat)
        hornR.position.set(bodyW * 0.2, bodyH * 0.45, bodyD * 0.55)
        this.group.add(hornL, hornR)
      }

      if (sp.id === 'dragon') {
        const ridgeMat = getCachedMat(0x440000)
        for (let i = 0; i < 4; i++) {
          const ridge = new THREE.Mesh(getCachedBox(0.15, 0.38 - i * 0.06, 0.15), ridgeMat)
          ridge.position.set(0, bodyH * 0.58, bodyD * 0.28 - i * bodyD * 0.18)
          this.group.add(ridge)
        }
      }
      if (creature.species === 'eagle') {
        // Hooked beak
        const beakMat = getCachedMat(0xccaa00)
        const beak = new THREE.Mesh(getCachedBox(bodyW * 0.2, bodyH * 0.2, bodyD * 0.25), beakMat)
        beak.position.set(0, bodyH * 0.0, bodyD * 0.75)
        this.group.add(beak)
      }
      if (creature.species === 'parrot') {
        // Colorful tail feathers
        const tailMat = getCachedMat(0x2244ff)
        const tail = new THREE.Mesh(getCachedBox(bodyW * 0.2, bodyH * 0.1, bodyD * 0.4), tailMat)
        tail.position.set(0, 0, -bodyD * 0.5)
        this.group.add(tail)
      }

    } else if (creature.species === 'croc') {
      const crocBody = new THREE.Mesh(getCachedBox(bodyW, bodyH, bodyD), getTexturedMat(bodyColor, 'scales'))
      this.group.add(crocBody)

      const snout = new THREE.Mesh(getCachedBox(bodyW * 0.65, bodyH * 0.7, bodyD * 0.38), getTexturedMat(headColor, 'scales'))
      snout.position.set(0, -bodyH * 0.15, bodyD * 0.69)
      this.group.add(snout)

      const tail = new THREE.Mesh(getCachedBox(bodyW * 0.5, bodyH * 0.5, bodyD * 0.4), getTexturedMat(bodyColor, 'scales'))
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
        const leg = new THREE.Mesh(getCachedBox(bodyW * 0.18, bodyH * 0.9, bodyW * 0.18), getTexturedMat(sp.legColor, 'scales'))
        leg.position.set(lx, ly, lz)
        this.group.add(leg)
        this.crocLegs.push(leg)
      }

      const crocEyeGeo = getCachedSphere(0.07, 5, 4)
      const crocEyeMat = getTexturedMat(0xffcc00, 'scales', { emissive: 0xccaa00, emissiveIntensity: 0.5 })
      const eyeL = new THREE.Mesh(crocEyeGeo, crocEyeMat)
      eyeL.position.set(-bodyW * 0.28, bodyH * 0.55, bodyD * 0.35)
      const eyeR = new THREE.Mesh(crocEyeGeo, crocEyeMat)
      eyeR.position.set(bodyW * 0.28, bodyH * 0.55, bodyD * 0.35)
      this.group.add(eyeL, eyeR)

    } else {
      const fishBody = new THREE.Mesh(getCachedBox(bodyW, bodyH, bodyD), getTexturedMat(bodyColor, 'scales'))
      this.group.add(fishBody)

      const tail = new THREE.Mesh(getCachedBox(bodyW * 0.8, bodyH * 0.9, bodyD * 0.22), getTexturedMat(headColor, 'scales'))
      tail.position.set(0, 0, -bodyD * 0.6)
      this.group.add(tail)
      this.tailFin = tail

      const dorsal = new THREE.Mesh(getCachedBox(bodyW * 0.12, bodyH * 0.5, bodyD * 0.28), getTexturedMat(headColor, 'scales'))
      dorsal.position.set(0, bodyH * 0.62, 0)
      this.group.add(dorsal)
    }
  }

  // ── Giant: Titan — massive stone golem ─────────────────────────────────
  private buildTitan(sp: typeof SPECIES[keyof typeof SPECIES]) {
    const { bodyW, bodyH, bodyD, bodyColor, headColor, legColor } = sp

    // Massive body — slightly hunched
    const torso = new THREE.Mesh(getCachedBox(bodyW, bodyH, bodyD), getTexturedMat(bodyColor, 'stone'))
    torso.position.set(0, bodyH * 0.1, 0)
    this.group.add(torso)

    // Upper body / shoulders — wider
    const shoulders = new THREE.Mesh(getCachedBox(bodyW * 1.3, bodyH * 0.5, bodyD * 0.6), getTexturedMat(bodyColor, 'stone'))
    shoulders.position.set(0, bodyH * 0.75, bodyD * 0.1)
    this.group.add(shoulders)

    // Head — small relative to body (like a colossus)
    const head = new THREE.Mesh(getCachedBox(bodyW * 0.5, bodyH * 0.45, bodyD * 0.35), getTexturedMat(headColor, 'stone'))
    head.position.set(0, bodyH * 1.15, bodyD * 0.3)
    this.group.add(head)

    // Eyes — glowing
    const eyeMat = getTexturedMat(0xffcc44, 'scales', { emissive: 0xffcc00, emissiveIntensity: 0.8 })
    const eyeGeo = getCachedSphere(0.18, 4, 4)
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
    eyeL.position.set(-bodyW * 0.15, bodyH * 1.22, bodyD * 0.48)
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
    eyeR.position.set(bodyW * 0.15, bodyH * 1.22, bodyD * 0.48)
    this.group.add(eyeL, eyeR)

    // 4 massive legs — thick pillars
    const legH = bodyH * 1.2
    const legW = bodyW * 0.3
    const legOffsets: [number, number, number][] = [
      [-bodyW * 0.35, -bodyH * 0.95, bodyD * 0.25],
      [ bodyW * 0.35, -bodyH * 0.95, bodyD * 0.25],
      [-bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.25],
      [ bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.25],
    ]
    for (const [lx, ly, lz] of legOffsets) {
      const leg = new THREE.Mesh(getCachedBox(legW, legH, legW), getTexturedMat(legColor, 'stone'))
      leg.position.set(lx, ly, lz)
      this.group.add(leg)
      this.legs.push(leg)
    }

    // Back spines / ridges
    const ridgeMat = getCachedMat(0x4a4a50)
    for (let i = 0; i < 5; i++) {
      const rh = bodyH * (0.4 - i * 0.05)
      const ridge = new THREE.Mesh(getCachedBox(bodyW * 0.15, rh, bodyD * 0.12), ridgeMat)
      ridge.position.set(0, bodyH * 0.85, bodyD * 0.25 - i * bodyD * 0.15)
      this.group.add(ridge)
    }

    // Arms — hanging massive slabs
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(getCachedBox(bodyW * 0.22, bodyH * 0.9, bodyW * 0.22), getTexturedMat(legColor, 'stone'))
      arm.position.set(side * bodyW * 0.75, bodyH * 0.1, bodyD * 0.15)
      this.group.add(arm)
    }
  }

  // ── Giant: Skywhale — enormous flying whale ──────────────────────────────
  private buildSkywhale(sp: typeof SPECIES[keyof typeof SPECIES]) {
    const { bodyW, bodyH, bodyD, bodyColor, headColor, legColor } = sp

    // Main body — elongated, slightly tapered
    const body = new THREE.Mesh(getCachedBox(bodyW, bodyH, bodyD), getTexturedMat(bodyColor, 'ice'))
    this.group.add(body)

    // Belly — lighter underside
    const belly = new THREE.Mesh(getCachedBox(bodyW * 0.85, bodyH * 0.4, bodyD * 0.9), getTexturedMat(0x7799cc, 'ice'))
    belly.position.set(0, -bodyH * 0.35, 0)
    this.group.add(belly)

    // Head / front — rounded snout
    const snout = new THREE.Mesh(getCachedBox(bodyW * 0.7, bodyH * 0.8, bodyD * 0.25), getTexturedMat(headColor, 'ice'))
    snout.position.set(0, 0, bodyD * 0.55)
    this.group.add(snout)

    // Eyes — large, gentle
    const eyeMat = getCachedMat(0x222244)
    const eyeGeo = getCachedSphere(0.25, 5, 5)
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
    eyeL.position.set(-bodyW * 0.38, bodyH * 0.1, bodyD * 0.45)
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
    eyeR.position.set(bodyW * 0.38, bodyH * 0.1, bodyD * 0.45)
    this.group.add(eyeL, eyeR)

    // Huge wings / fins
    const wingSpan = bodyD * 1.2
    const wingD = bodyD * 0.5
    const wingMat = getTexturedMat(bodyColor, 'ice', { side: THREE.DoubleSide })
    const wingGeo = getCachedBox(wingSpan, 0.2, wingD)

    const wingL = new THREE.Mesh(wingGeo, wingMat)
    wingL.position.set(-(bodyW * 0.5 + wingSpan * 0.5), 0, -bodyD * 0.1)
    const wingR = new THREE.Mesh(wingGeo, wingMat)
    wingR.position.set(bodyW * 0.5 + wingSpan * 0.5, 0, -bodyD * 0.1)
    this.group.add(wingL, wingR)
    this.wings.push(wingL, wingR)

    // Tail flukes
    const tailW = bodyW * 0.8
    const tailH = bodyH * 0.15
    const tailD = bodyD * 0.3
    const tail = new THREE.Mesh(getCachedBox(tailW, tailH, tailD), getTexturedMat(legColor, 'ice'))
    tail.position.set(0, 0, -bodyD * 0.6)
    this.group.add(tail)
    this.tailFin = tail

    // Dorsal ridge bumps
    const ridgeMat = getTexturedMat(0x3355aa, 'ice')
    for (let i = 0; i < 4; i++) {
      const bump = new THREE.Mesh(getCachedBox(bodyW * 0.2, bodyH * (0.3 - i * 0.05), bodyD * 0.08), ridgeMat)
      bump.position.set(0, bodyH * 0.6, bodyD * 0.2 - i * bodyD * 0.15)
      this.group.add(bump)
    }
  }

  // ── Giant: Wurm — massive segmented worm ─────────────────────────────────
  private buildWurm(sp: typeof SPECIES[keyof typeof SPECIES]) {
    const { bodyW, bodyH, bodyD, bodyColor, headColor } = sp

    // Head segment — rounded, with mandibles
    const head = new THREE.Mesh(getCachedBox(bodyW * 1.1, bodyH * 1.1, bodyD * 0.15), getTexturedMat(headColor, 'obsidian'))
    head.position.set(0, bodyH * 0.1, bodyD * 0.5)
    this.group.add(head)

    // Eyes — menacing
    const eyeMat = getTexturedMat(0xff4400, 'scales', { emissive: 0xff2200, emissiveIntensity: 0.8 })
    const eyeGeo = getCachedSphere(0.2, 4, 4)
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
    eyeL.position.set(-bodyW * 0.35, bodyH * 0.35, bodyD * 0.52)
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
    eyeR.position.set(bodyW * 0.35, bodyH * 0.35, bodyD * 0.52)
    this.group.add(eyeL, eyeR)

    // Mandibles
    const mandMat = getTexturedMat(0x5a2a10, 'obsidian')
    for (const side of [-1, 1]) {
      const mandible = new THREE.Mesh(getCachedBox(bodyW * 0.15, bodyH * 0.3, bodyD * 0.1), mandMat)
      mandible.position.set(side * bodyW * 0.5, -bodyH * 0.2, bodyD * 0.55)
      this.group.add(mandible)
    }

    // Body segments — 6 segments creating a long body
    const segCount = 6
    const segLen = bodyD / segCount
    for (let i = 0; i < segCount; i++) {
      // Each segment slightly smaller toward the tail
      const taper = 1 - i * 0.08
      const segW = bodyW * taper
      const segH = bodyH * taper
      const seg = new THREE.Mesh(getCachedBox(segW, segH, segLen * 0.9), getTexturedMat(bodyColor, 'obsidian'))
      seg.position.set(0, 0, bodyD * 0.35 - i * segLen)
      this.group.add(seg)

      // Ridge plates on top of each segment
      if (i < segCount - 1) {
        const plate = new THREE.Mesh(
          getCachedBox(segW * 0.7, segH * 0.35, segLen * 0.5),
          getTexturedMat(0x9a5430, 'obsidian')
        )
        plate.position.set(0, segH * 0.65, bodyD * 0.35 - i * segLen)
        this.group.add(plate)
      }
    }

    // Tail spike
    const spike = new THREE.Mesh(getCachedBox(bodyW * 0.3, bodyH * 0.3, bodyD * 0.12), getTexturedMat(0x5a2a10, 'obsidian'))
    spike.position.set(0, bodyH * 0.2, -bodyD * 0.5)
    this.group.add(spike)
  }

  // ── Giant: Infernal — massive fire titan ────────────────────────────
  private buildInfernal(sp: typeof SPECIES[keyof typeof SPECIES]) {
    const { bodyW, bodyH, bodyD, bodyColor, headColor, legColor } = sp

    // Massive body
    const torso = new THREE.Mesh(getCachedBox(bodyW, bodyH, bodyD), getTexturedMat(bodyColor, 'obsidian'))
    torso.position.set(0, bodyH * 0.1, 0)
    this.group.add(torso)

    // Lava vein accents on torso
    const lavaMat = getTexturedMat(0xff3300, 'lava', { emissive: 0xff2200, emissiveIntensity: 0.5 })
    for (let i = 0; i < 3; i++) {
      const vein = new THREE.Mesh(getCachedBox(bodyW * 0.08, bodyH * 0.6, bodyD * 0.15), lavaMat)
      vein.position.set(bodyW * (0.3 - i * 0.3), bodyH * 0.1, bodyD * 0.1)
      this.group.add(vein)
    }

    // Upper body / shoulders
    const shoulders = new THREE.Mesh(getCachedBox(bodyW * 1.3, bodyH * 0.5, bodyD * 0.6), getTexturedMat(bodyColor, 'obsidian'))
    shoulders.position.set(0, bodyH * 0.75, bodyD * 0.1)
    this.group.add(shoulders)

    // Head
    const head = new THREE.Mesh(getCachedBox(bodyW * 0.5, bodyH * 0.45, bodyD * 0.35), getTexturedMat(headColor, 'obsidian'))
    head.position.set(0, bodyH * 1.15, bodyD * 0.3)
    this.group.add(head)

    // Crown of flame spikes
    const flameMat = getCachedMat(0xff4400)
    for (let i = 0; i < 4; i++) {
      const spike = new THREE.Mesh(getCachedBox(0.15, bodyH * (0.35 - i * 0.05), 0.15), flameMat)
      spike.position.set(bodyW * (0.15 - i * 0.1), bodyH * 1.5, bodyD * 0.3)
      this.group.add(spike)
    }

    // Glowing eyes
    const eyeMat = getTexturedMat(0xff4400, 'scales', { emissive: 0xff2200, emissiveIntensity: 0.8 })
    const eyeGeo = getCachedSphere(0.18, 4, 4)
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
    eyeL.position.set(-bodyW * 0.15, bodyH * 1.22, bodyD * 0.48)
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat)
    eyeR.position.set(bodyW * 0.15, bodyH * 1.22, bodyD * 0.48)
    this.group.add(eyeL, eyeR)

    // 4 massive legs
    const legH = bodyH * 1.2
    const legW = bodyW * 0.3
    const legOffsets: [number, number, number][] = [
      [-bodyW * 0.35, -bodyH * 0.95, bodyD * 0.25],
      [ bodyW * 0.35, -bodyH * 0.95, bodyD * 0.25],
      [-bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.25],
      [ bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.25],
    ]
    for (const [lx, ly, lz] of legOffsets) {
      const leg = new THREE.Mesh(getCachedBox(legW, legH, legW), getTexturedMat(legColor, 'obsidian'))
      leg.position.set(lx, ly, lz)
      this.group.add(leg)
      this.legs.push(leg)
    }

    // Arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(getCachedBox(bodyW * 0.22, bodyH * 0.9, bodyW * 0.22), getTexturedMat(legColor, 'obsidian'))
      arm.position.set(side * bodyW * 0.75, bodyH * 0.1, bodyD * 0.15)
      this.group.add(arm)
    }
  }

  private collar: THREE.Mesh | null = null
  private hasCollar = false
  private glowMat: THREE.MeshLambertMaterial | null = null
  private originalMat: THREE.Material | null = null
  private isGlowing = false

  update(creature: Creature, delta: number) {
    this.group.position.copy(creature.position)
    this.group.scale.setScalar(creature.scale)
    this.group.rotation.y = creature.heading

    // Add golden collar for companions
    if (creature.isCompanion && !this.hasCollar && this.lod === 'full') {
      const sp = creature.stats ?? SPECIES[creature.species]
      const collarGeo = getCachedBox(sp.bodyW * 0.8, sp.bodyH * 0.15, sp.bodyW * 0.8)
      const collarMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 })
      this.collar = new THREE.Mesh(collarGeo, collarMat)
      this.collar.position.set(0, sp.bodyH * 0.35, sp.bodyD * 0.4)
      this.group.add(this.collar)
      this.hasCollar = true
    }

    // Attuned glow: emissive pulse when creature.glowing is set
    if (creature.glowing && this.bodyMesh) {
      if (!this.isGlowing) {
        // Save original material and create a glow material (non-cached, per creature)
        this.originalMat = this.bodyMesh.material as THREE.Material
        const sp2 = creature.stats ?? SPECIES[creature.species]
        this.glowMat = new THREE.MeshLambertMaterial({
          color: sp2.bodyColor,
          emissive: creature.glowColor,
          emissiveIntensity: 0.3,
        })
        this.bodyMesh.material = this.glowMat
        this.isGlowing = true
      }
      // Gentle pulsing: sine wave at 0.5 Hz
      if (this.glowMat) {
        const pulse = 0.2 + Math.sin(this.animTime * Math.PI) * 0.15 // range 0.05 to 0.35
        this.glowMat.emissiveIntensity = pulse
        this.glowMat.emissive.setHex(creature.glowColor)
      }
    } else if (this.isGlowing && this.bodyMesh && this.originalMat) {
      // Restore original material
      this.bodyMesh.material = this.originalMat
      this.glowMat?.dispose()
      this.glowMat = null
      this.originalMat = null
      this.isGlowing = false
    }

    // Simple LOD — no animation needed
    if (this.lod === 'simple') {
      if (creature.state === 'dead') {
        this.group.rotation.z = Math.min(Math.PI * 0.5, creature.deathTimer * 1.2)
      }
      return
    }

    this.animTime += delta

    // DNA creatures: custom animation using dnaRefs
    if (creature.dna && creature.stats) {
      const st = creature.stats
      const moving = creature.velocity.lengthSq() > 0.04

      if (st.mobility === 'ground' && this.legs.length >= 2) {
        if (moving) {
          const freq = st.isGiant ? creature.velocity.length() * 0.8 : creature.velocity.length() * 2.5
          const amp = st.isGiant ? 0.25 : 0.5
          const sinVal = Math.sin(this.animTime * freq) * amp
          for (let i = 0; i < this.legs.length; i++) {
            this.legs[i].rotation.x = sinVal * (i % 2 === 0 ? 1 : -1)
          }
        } else {
          for (const leg of this.legs) leg.rotation.x = 0
        }
      }

      if (st.isGiant && st.mobility === 'ground') {
        this.group.rotation.x = Math.sin(this.animTime * 0.6) * 0.015
        this.group.rotation.z = Math.sin(this.animTime * 0.4 + 1.5) * 0.01
      }

      if (this.wings.length >= 2) {
        const flapSpeed = st.isGiant ? 0.8 : creature.dna.size > 0.6 ? 2.5 : 5.0
        const flapAmp = st.isGiant ? 0.2 : creature.dna.size > 0.6 ? 0.4 : 0.6
        const angle = Math.sin(this.animTime * flapSpeed) * flapAmp
        this.wings[0].rotation.z = angle
        this.wings[1].rotation.z = -angle
      }

      if (this.tailFin) {
        this.tailFin.rotation.y = Math.sin(this.animTime * 1.5) * 0.3
      }

      if (creature.state === 'dead') {
        this.group.rotation.z = Math.min(Math.PI * 0.5, creature.deathTimer * 1.2)
      }
      return
    }

    const sp = SPECIES[creature.species]
    const moving = creature.velocity.lengthSq() > 0.04

    // Leg animation
    if (sp.mobility === 'ground' && this.legs.length >= 4) {
      if (moving) {
        // Giants: slow, heavy footsteps
        const freq = sp.isGiant ? creature.velocity.length() * 0.8 : creature.velocity.length() * 2.5
        const amp  = sp.isGiant ? 0.25 : 0.5
        const sinVal = Math.sin(this.animTime * freq) * amp
        this.legs[0].rotation.x =  sinVal
        this.legs[1].rotation.x = -sinVal
        this.legs[2].rotation.x = -sinVal
        this.legs[3].rotation.x =  sinVal
      } else {
        for (const leg of this.legs) leg.rotation.x = 0
      }
    }

    // Giant body sway (gentle rocking as they move)
    if (sp.isGiant && sp.mobility === 'ground') {
      this.group.rotation.x = Math.sin(this.animTime * 0.6) * 0.015
      this.group.rotation.z = Math.sin(this.animTime * 0.4 + 1.5) * 0.01
    }

    // Wing flap
    if (sp.mobility === 'air' && this.wings.length >= 2) {
      const flapSpeed = sp.id === 'skywhale' ? 0.8 : sp.id === 'dragon' ? 2.5 : sp.id === 'eagle' ? 3.0 : 6.0
      const flapAmp  = sp.id === 'skywhale' ? 0.2 : sp.id === 'dragon' ? 0.4 : sp.id === 'eagle' ? 0.5 : 0.6
      const angle = Math.sin(this.animTime * flapSpeed) * flapAmp
      this.wings[0].rotation.z =  angle
      this.wings[1].rotation.z = -angle
    }

    // Skywhale tail sway
    if (creature.species === 'skywhale' && this.tailFin) {
      this.tailFin.rotation.y = Math.sin(this.animTime * 0.6) * 0.2
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
