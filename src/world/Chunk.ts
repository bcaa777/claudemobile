import * as THREE from 'three'
import { generateHeightmap, sampleHeight, CHUNK_SIZE, CHUNK_SEGMENTS, WATER_LEVEL, riverMask } from './TerrainGenerator'
import { BiomeMap } from './BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType, SpriteCategory } from '../biomes/types'
import { SpriteAtlas, VARIANTS } from '../sprites/SpriteAtlas'
import { createBillboard, createGroundDecal } from '../sprites/BillboardSprite'
import { ParticleSystem } from '../sprites/ParticleSystem'
import { PointLightPool } from '../lighting/PointLightPool'
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'
import { SPRITE_CONFIG, TERRAIN_CONFIG } from '../config'
import { ExplodableStructure } from './ExplodableStructure'

const VERTICES = CHUNK_SEGMENTS + 1

// ─── Walkable surface AABB ────────────────────────────────────────────────────
// All coords in chunk-local space. y = top surface players stand on.
export interface WalkableBox {
  minX: number; maxX: number
  minZ: number; maxZ: number
  y: number
}

// ─── Structure helpers ───────────────────────────────────────────────────────

const ROCK_COLORS: Record<number, number> = {
  [BiomeType.Forest]:   0x3a3228,
  [BiomeType.Desert]:   0x8a6040,
  [BiomeType.Volcanic]: 0x2a1008,
  [BiomeType.Snow]:     0x7080a0,
}

function buildRockFormation(rng: SeededRandom, pos: THREE.Vector3, biome: BiomeType): THREE.Group {
  const g   = new THREE.Group()
  g.position.copy(pos)
  const mat = new THREE.MeshLambertMaterial({ color: ROCK_COLORS[biome] ?? 0x404040 })

  const count = 1 + rng.int(0, 3)
  for (let i = 0; i < count; i++) {
    const w  = rng.range(1.2, 3.2)
    const h  = rng.range(4, 22)
    const ox = rng.range(-4, 4)
    const oz = rng.range(-4, 4)
    const geo = new THREE.BoxGeometry(w * rng.range(0.7, 1.3), h, w * rng.range(0.7, 1.3))
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(ox, h / 2, oz)
    mesh.rotation.set(rng.range(-0.12, 0.12), rng.range(0, Math.PI * 2), rng.range(-0.08, 0.08))
    g.add(mesh)
    if (rng.next() > 0.55) {
      const cw = w * rng.range(1.2, 1.8)
      const ch = rng.range(0.6, 2.0)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cw), mat)
      cap.position.set(ox + rng.range(-0.5, 0.5), h + ch / 2, oz + rng.range(-0.5, 0.5))
      g.add(cap)
    }
  }
  return g
}

const ARCH_COLORS: Record<number, number> = {
  [BiomeType.Forest]:   0x2a2018,
  [BiomeType.Desert]:   0x6a4820,
  [BiomeType.Volcanic]: 0x180804,
  [BiomeType.Snow]:     0x5a6878,
}

function buildCaveArch(rng: SeededRandom, pos: THREE.Vector3, biome: BiomeType, axis: 'x' | 'z'): THREE.Group {
  const g   = new THREE.Group()
  g.position.copy(pos)
  const mat = new THREE.MeshLambertMaterial({ color: ARCH_COLORS[biome] ?? 0x303030 })

  const span  = rng.range(9, 18)
  const h     = rng.range(5, 10)
  const thick = rng.range(1.8, 3.0)

  for (const side of [-span / 2, span / 2]) {
    const pGeo  = new THREE.BoxGeometry(thick, h, thick)
    const pillar = new THREE.Mesh(pGeo, mat)
    axis === 'x' ? pillar.position.set(side, h / 2, 0) : pillar.position.set(0, h / 2, side)
    g.add(pillar)
  }

  const segs = 7
  for (let i = 0; i < segs; i++) {
    const t     = (i + 0.5) / segs
    const angle = Math.PI * t
    const along = -span / 2 + span * t
    const ay    = h + Math.sin(angle) * h * 0.45
    const segLen = span / segs + 0.3
    const aGeo  = new THREE.BoxGeometry(
      axis === 'x' ? segLen : thick,
      thick,
      axis === 'z' ? segLen : thick,
    )
    const block = new THREE.Mesh(aGeo, mat)
    axis === 'x'
      ? block.position.set(along, ay, 0)
      : block.position.set(0, ay, along)
    block.rotation.z = axis === 'x' ? -Math.cos(angle) * 0.22 : 0
    block.rotation.x = axis === 'z' ?  Math.cos(angle) * 0.22 : 0
    g.add(block)
  }
  return g
}

function buildBridge(rng: SeededRandom, pos: THREE.Vector3, length: number, axis: 'x' | 'z'): THREE.Group {
  const g       = new THREE.Group()
  g.position.copy(pos)
  const deckW   = 3.6
  const plankT  = 0.25
  const railH   = 1.1
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x5a3210 })
  const stoneMat= new THREE.MeshLambertMaterial({ color: 0x504538 })

  const pCount = Math.ceil(length / 0.85)
  for (let i = 0; i < pCount; i++) {
    const t   = (i + 0.5) / pCount
    const off = t * length - length / 2
    const geo = new THREE.BoxGeometry(
      axis === 'x' ? length / pCount - 0.07 : deckW,
      plankT,
      axis === 'z' ? length / pCount - 0.07 : deckW,
    )
    const m = new THREE.Mesh(geo, woodMat)
    axis === 'x' ? m.position.set(off, 0, 0) : m.position.set(0, 0, off)
    g.add(m)
  }

  const beams = Math.floor(length / 5) + 1
  for (let i = 0; i <= beams; i++) {
    const t   = i / beams
    const off = t * length - length / 2
    const bGeo = new THREE.BoxGeometry(
      axis === 'x' ? 0.3 : deckW + 0.5,
      0.3,
      axis === 'z' ? 0.3 : deckW + 0.5,
    )
    const beam = new THREE.Mesh(bGeo, woodMat)
    axis === 'x' ? beam.position.set(off, -plankT, 0) : beam.position.set(0, -plankT, off)
    g.add(beam)
    if (i > 0 && i < beams) {
      const pilGeo = new THREE.CylinderGeometry(0.35, 0.55, 6, 6)
      for (const side of [-deckW / 2 + 0.5, deckW / 2 - 0.5]) {
        const pil = new THREE.Mesh(pilGeo, stoneMat)
        axis === 'x' ? pil.position.set(off, -3.3, side) : pil.position.set(side, -3.3, off)
        g.add(pil)
      }
    }
  }

  const postCount = Math.floor(length / 3) + 1
  for (let i = 0; i <= postCount; i++) {
    const t   = i / postCount
    const off = t * length - length / 2
    const pGeo = new THREE.BoxGeometry(0.2, railH, 0.2)
    for (const side of [-deckW / 2, deckW / 2]) {
      const post = new THREE.Mesh(pGeo, woodMat)
      axis === 'x'
        ? post.position.set(off, railH / 2 + plankT / 2, side)
        : post.position.set(side, railH / 2 + plankT / 2, off)
      g.add(post)
    }
  }
  for (const side of [-deckW / 2, deckW / 2]) {
    const rGeo = new THREE.BoxGeometry(
      axis === 'x' ? length : 0.15,
      0.15,
      axis === 'z' ? length : 0.15,
    )
    const rail = new THREE.Mesh(rGeo, woodMat)
    axis === 'x'
      ? rail.position.set(0, railH + plankT / 2, side)
      : rail.position.set(side, railH + plankT / 2, 0)
    g.add(rail)
  }
  return g
}

// ─── Chunk ───────────────────────────────────────────────────────────────────

export class Chunk {
  public cx: number
  public cz: number
  public group: THREE.Group
  public heightGrid: Float32Array | null = null
  public walkableSurfaces: WalkableBox[] = []
  public explodables: ExplodableStructure[] = []

  private terrainMesh: THREE.Mesh | null = null
  private extras: THREE.Object3D[] = []
  private sprites: THREE.Object3D[] = []
  private particleSystems: ParticleSystem[] = []
  private pointLights: THREE.PointLight[] = []
  private time = 0
  private rngForExplode: SeededRandom

  constructor(
    cx: number, cz: number,
    scene: THREE.Scene,
    biomeMap: BiomeMap,
    atlas: SpriteAtlas,
    lightPool: PointLightPool,
  ) {
    this.cx    = cx
    this.cz    = cz
    this.group = new THREE.Group()
    this.group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE)
    this.rngForExplode = new SeededRandom(chunkSeed(cx, cz, 99))
    scene.add(this.group)
    this.build(biomeMap, atlas, lightPool)
  }

  // ── Register a walkable surface (local coords) ────────────────────────────

  private addWalkable(centerX: number, centerZ: number, halfW: number, halfL: number, y: number) {
    this.walkableSurfaces.push({
      minX: centerX - halfW, maxX: centerX + halfW,
      minZ: centerZ - halfL, maxZ: centerZ + halfL,
      y,
    })
  }

  // ── Terrain mesh ──────────────────────────────────────────────────────────

  private build(biomeMap: BiomeMap, atlas: SpriteAtlas, lightPool: PointLightPool) {
    const { positions, normals, colors, indices, heightGrid, hasWater } =
      generateHeightmap(this.cx, this.cz, biomeMap)
    this.heightGrid = heightGrid

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('normal',   new THREE.BufferAttribute(normals,   3))
    geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))

    this.terrainMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, fog: true }))
    this.group.add(this.terrainMesh)

    const rng = new SeededRandom(chunkSeed(this.cx, this.cz))

    if (hasWater)                                this.buildWater(biomeMap)
    if (TERRAIN_CONFIG.enableRockFormations)     this.buildRocks(rng, biomeMap)
    if (TERRAIN_CONFIG.enableCaveArches)         this.buildArches(rng, biomeMap)
    if (TERRAIN_CONFIG.enableBridges)            this.buildBridges(rng, biomeMap)
    if (TERRAIN_CONFIG.enableMountainBridges)    this.buildMountainBridges(rng, biomeMap)
    if (TERRAIN_CONFIG.enableRoads)              this.buildRoads(rng, biomeMap)
    if (TERRAIN_CONFIG.enableGiantTrees)         this.buildGiantTrees(rng, biomeMap)
    if (TERRAIN_CONFIG.enableMegaStructures)     this.buildMegaStructures(rng, biomeMap)
    if (TERRAIN_CONFIG.enableChapels)            this.buildChapels(rng, biomeMap)
    if (TERRAIN_CONFIG.enableCemeteries)         this.buildCemeteries(rng, biomeMap)
    if (TERRAIN_CONFIG.enableSwampPiers)         this.buildSwampPiers(rng, biomeMap)

    this.placeSprites(rng, biomeMap, atlas, lightPool)
    this.buildParticles(biomeMap)
  }

  // ── Water surface ─────────────────────────────────────────────────────────

  private buildWater(biomeMap: BiomeMap) {
    const centerBiome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    const waterColor = getBiome(centerBiome).waterColor

    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE)
    const mat = new THREE.MeshLambertMaterial({
      color: waterColor,
      transparent: true,
      opacity: 0.80,
      fog: true,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(CHUNK_SIZE / 2, WATER_LEVEL, CHUNK_SIZE / 2)
    this.group.add(mesh)
    this.extras.push(mesh)
  }

  // ── Rock formations ───────────────────────────────────────────────────────

  private buildRocks(rng: SeededRandom, biomeMap: BiomeMap) {
    const step  = 20
    const cols  = Math.floor(CHUNK_SIZE / step)
    const rows  = Math.floor(CHUNK_SIZE / step)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng.next() > TERRAIN_CONFIG.rockDensity) continue

        const lx = (c + 0.5) * step + rng.range(-step * 0.3, step * 0.3)
        const lz = (r + 0.5) * step + rng.range(-step * 0.3, step * 0.3)
        if (!this.heightGrid) continue
        const h = sampleHeight(this.heightGrid, lx, lz)

        if (h < WATER_LEVEL + 0.5) continue
        if (h < 3) continue

        const hN  = sampleHeight(this.heightGrid, lx, Math.max(0, lz - 2))
        const hS  = sampleHeight(this.heightGrid, lx, Math.min(CHUNK_SIZE - 0.1, lz + 2))
        const hE  = sampleHeight(this.heightGrid, Math.min(CHUNK_SIZE - 0.1, lx + 2), lz)
        const hW  = sampleHeight(this.heightGrid, Math.max(0, lx - 2), lz)
        const grad = Math.max(Math.abs(hN-hS), Math.abs(hE-hW))
        if (grad < 0.5 && h < 8) continue

        const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
        const formation = buildRockFormation(rng, new THREE.Vector3(lx, h, lz), biome)
        this.group.add(formation)
        this.extras.push(formation)
      }
    }
  }

  // ── Cave arches ───────────────────────────────────────────────────────────

  private buildArches(rng: SeededRandom, biomeMap: BiomeMap) {
    const step = 24
    const cols = Math.floor(CHUNK_SIZE / step)
    const rows = Math.floor(CHUNK_SIZE / step)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng.next() > TERRAIN_CONFIG.archDensity) continue
        if (!this.heightGrid) continue

        const lx   = (c + 0.5) * step + rng.range(-4, 4)
        const lz   = (r + 0.5) * step + rng.range(-4, 4)
        const h    = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 2) continue

        const hN   = sampleHeight(this.heightGrid, lx, Math.max(0, lz - 4))
        const hS   = sampleHeight(this.heightGrid, lx, Math.min(CHUNK_SIZE-0.1, lz + 4))
        const hE   = sampleHeight(this.heightGrid, Math.min(CHUNK_SIZE-0.1, lx + 4), lz)
        const hW   = sampleHeight(this.heightGrid, Math.max(0, lx - 4), lz)
        const gradZ = Math.abs(hN - hS)
        const gradX = Math.abs(hE - hW)

        if (Math.max(gradZ, gradX) < 5) continue

        const axis  = gradX > gradZ ? 'z' : 'x'
        const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
        const arch  = buildCaveArch(rng, new THREE.Vector3(lx, h, lz), biome, axis)
        this.group.add(arch)
        this.extras.push(arch)
      }
    }
  }

  // ── River bridges ─────────────────────────────────────────────────────────

  private buildBridges(rng: SeededRandom, _biomeMap: BiomeMap) {
    if (!this.heightGrid) return

    const vtxSpacing = CHUNK_SIZE / CHUNK_SEGMENTS
    const minWaterRun = 3
    const maxWaterRun = 20

    const tryBridge = (axis: 'x' | 'z') => {
      const midIdx   = Math.floor(CHUNK_SEGMENTS / 2)
      let runStart   = -1
      let runLen     = 0

      const getH = (i: number) =>
        axis === 'x'
          ? this.heightGrid![midIdx * VERTICES + i]
          : this.heightGrid![i      * VERTICES + midIdx]

      for (let i = 0; i <= CHUNK_SEGMENTS; i++) {
        const underwater = getH(i) < WATER_LEVEL + 0.3
        if (underwater) {
          if (runStart === -1) runStart = i
          runLen++
        } else {
          if (runStart !== -1 && runLen >= minWaterRun && runLen <= maxWaterRun) {
            const preH  = runStart > 0        ? getH(runStart - 1) : WATER_LEVEL + 2
            const postH = i < CHUNK_SEGMENTS  ? getH(i)            : WATER_LEVEL + 2
            if (preH > WATER_LEVEL + 1 && postH > WATER_LEVEL + 1) {
              const bridgeLen = (runLen + 2) * vtxSpacing
              const midVtx    = (runStart + runLen / 2) * vtxSpacing
              const crossVtx  = midIdx * vtxSpacing
              const deckY     = WATER_LEVEL + 0.9

              const pos = axis === 'x'
                ? new THREE.Vector3(midVtx, deckY, crossVtx)
                : new THREE.Vector3(crossVtx, deckY, midVtx)

              const bridge = buildBridge(rng, pos, bridgeLen, axis)
              this.group.add(bridge)
              this.extras.push(bridge)

              // Register deck as walkable
              const hw = bridgeLen / 2 + 0.5
              const hl = 1.8 + 0.5
              if (axis === 'x') {
                this.addWalkable(midVtx, crossVtx, hw, hl, deckY + 0.13)
              } else {
                this.addWalkable(crossVtx, midVtx, hl, hw, deckY + 0.13)
              }
            }
          }
          runStart = -1; runLen = 0
        }
      }
    }

    tryBridge('x')
    tryBridge('z')
  }

  // ── Mountain-to-mountain bridges ─────────────────────────────────────────

  private buildMountainBridges(rng: SeededRandom, _biomeMap: BiomeMap) {
    if (!this.heightGrid) return

    const PEAK_MIN = 13
    const VALLEY_DROP = 10
    const SAMPLE_COUNT = 8

    const sampleEdge = (axis: 'x' | 'z', edge: 'lo' | 'hi'): { pos: number; h: number } => {
      let bestH = -Infinity
      let bestPos = CHUNK_SIZE / 2
      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const t = (i + 0.5) / SAMPLE_COUNT
        const along = t * CHUNK_SIZE
        const cross = edge === 'lo' ? 1 : CHUNK_SIZE - 1
        const lx = axis === 'x' ? along : cross
        const lz = axis === 'x' ? cross : along
        const h = sampleHeight(this.heightGrid!, lx, lz)
        if (h > bestH) { bestH = h; bestPos = along }
      }
      return { pos: bestPos, h: bestH }
    }

    const tryMountainBridge = (axis: 'x' | 'z') => {
      const lo = sampleEdge(axis, 'lo')
      const hi = sampleEdge(axis, 'hi')

      if (lo.h < PEAK_MIN || hi.h < PEAK_MIN) return

      // Check midpoint is a real valley
      const midCross = CHUNK_SIZE / 2
      const midAlong = (lo.pos + hi.pos) / 2
      const mlx = axis === 'x' ? midAlong : midCross
      const mlz = axis === 'x' ? midCross : midAlong
      const midH = sampleHeight(this.heightGrid!, mlx, mlz)

      const peakAvg = (lo.h + hi.h) / 2
      if (midH > peakAvg - VALLEY_DROP) return  // no real valley

      const deckY = peakAvg - 1
      const bridgeLen = CHUNK_SIZE - 4
      const stoneMat = new THREE.MeshLambertMaterial({ color: 0x5a4838 })

      // Build elevated bridge with tall pillars
      const g = new THREE.Group()
      const deckW = 4.0
      const plankT = 0.35

      // Deck planks
      const pCount = Math.ceil(bridgeLen / 1.2)
      for (let i = 0; i < pCount; i++) {
        const t = (i + 0.5) / pCount
        const off = t * bridgeLen - bridgeLen / 2
        const pGeo = new THREE.BoxGeometry(
          axis === 'x' ? bridgeLen / pCount - 0.1 : deckW,
          plankT,
          axis === 'z' ? bridgeLen / pCount - 0.1 : deckW,
        )
        const plank = new THREE.Mesh(pGeo, new THREE.MeshLambertMaterial({ color: 0x6a4820 }))
        axis === 'x' ? plank.position.set(off, 0, 0) : plank.position.set(0, 0, off)
        g.add(plank)
      }

      // Stone pillars reaching down to terrain
      const pillarSpacing = 8
      const pillarCount = Math.floor(bridgeLen / pillarSpacing) - 1
      for (let i = 0; i < pillarCount; i++) {
        const t = (i + 1) / (pillarCount + 1)
        const off = t * bridgeLen - bridgeLen / 2
        const pillarLx = axis === 'x' ? t * bridgeLen + 2 : midCross
        const pillarLz = axis === 'x' ? midCross : t * bridgeLen + 2
        const terrainH = sampleHeight(
          this.heightGrid!,
          Math.max(0, Math.min(CHUNK_SIZE - 0.1, pillarLx)),
          Math.max(0, Math.min(CHUNK_SIZE - 0.1, pillarLz)),
        )
        const pillarH = deckY - terrainH
        if (pillarH < 1) continue
        const pilGeo = new THREE.CylinderGeometry(0.5, 0.8, pillarH, 7)
        for (const side of [-deckW / 2 + 0.5, deckW / 2 - 0.5]) {
          const pil = new THREE.Mesh(pilGeo, stoneMat)
          const pilY = terrainH + pillarH / 2 - deckY
          axis === 'x' ? pil.position.set(off, pilY, side) : pil.position.set(side, pilY, off)
          g.add(pil)
        }
      }

      // Rope-style suspension cables
      const cableMat = new THREE.MeshLambertMaterial({ color: 0x3a2810 })
      for (const side of [-deckW / 2, deckW / 2]) {
        const cGeo = new THREE.BoxGeometry(
          axis === 'x' ? bridgeLen : 0.12,
          0.12,
          axis === 'z' ? bridgeLen : 0.12,
        )
        const cable = new THREE.Mesh(cGeo, cableMat)
        axis === 'x'
          ? cable.position.set(0, plankT / 2 + 1.2, side)
          : cable.position.set(side, plankT / 2 + 1.2, 0)
        g.add(cable)
      }

      // Railings
      const postCount = Math.floor(bridgeLen / 4) + 1
      const railMat = new THREE.MeshLambertMaterial({ color: 0x6a4820 })
      for (let i = 0; i <= postCount; i++) {
        const t = i / postCount
        const off = t * bridgeLen - bridgeLen / 2
        for (const side of [-deckW / 2, deckW / 2]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.2, 0.2), railMat)
          axis === 'x'
            ? post.position.set(off, 0.6 + plankT / 2, side)
            : post.position.set(side, 0.6 + plankT / 2, off)
          g.add(post)
        }
      }

      // Position bridge group
      const cx = axis === 'x' ? CHUNK_SIZE / 2 : midCross
      const cz = axis === 'x' ? midCross : CHUNK_SIZE / 2
      g.position.set(cx, deckY, cz)
      this.group.add(g)
      this.extras.push(g)

      // Register deck as walkable surface
      const hw = bridgeLen / 2 + 0.5
      const hl = deckW / 2 + 0.2
      this.addWalkable(cx, cz, axis === 'x' ? hw : hl, axis === 'x' ? hl : hw, deckY + plankT / 2)
    }

    tryMountainBridge('x')
    tryMountainBridge('z')
  }

  // ── Mountain roads ────────────────────────────────────────────────────────

  private buildRoads(rng: SeededRandom, _biomeMap: BiomeMap) {
    if (!this.heightGrid) return

    const roadMat  = new THREE.MeshLambertMaterial({ color: 0x5a5040 })
    const slabSize = 4.0
    const slabT    = 0.3
    const stepLen  = 3.5
    const steps    = 10

    // Find highest point in each quadrant as road start
    for (let q = 0; q < 2; q++) {
      if (rng.next() > 0.6) continue  // 40% chance per quadrant

      const qx0 = q === 0 ? 4 : CHUNK_SIZE / 2
      const qx1 = q === 0 ? CHUNK_SIZE / 2 : CHUNK_SIZE - 4
      let bestH = -Infinity, bestX = CHUNK_SIZE / 2, bestZ = CHUNK_SIZE / 2

      // Sample grid in quadrant
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 6; j++) {
          const lx = qx0 + (qx1 - qx0) * (i / 5)
          const lz = 4 + (CHUNK_SIZE - 8) * (j / 5)
          const h = sampleHeight(this.heightGrid!, lx, lz)
          if (h > bestH) { bestH = h; bestX = lx; bestZ = lz }
        }
      }

      if (bestH < 10) continue  // only on real mountains

      // Gradient descent path
      let cx = bestX, cz = bestZ
      for (let s = 0; s < steps; s++) {
        cx = Math.max(2, Math.min(CHUNK_SIZE - 2, cx))
        cz = Math.max(2, Math.min(CHUNK_SIZE - 2, cz))
        const h = sampleHeight(this.heightGrid!, cx, cz)
        if (h < WATER_LEVEL + 1) break

        // Find downhill direction
        const hN = sampleHeight(this.heightGrid!, cx,           Math.max(2, cz - stepLen))
        const hS = sampleHeight(this.heightGrid!, cx,           Math.min(CHUNK_SIZE - 2, cz + stepLen))
        const hE = sampleHeight(this.heightGrid!, Math.min(CHUNK_SIZE - 2, cx + stepLen), cz)
        const hW = sampleHeight(this.heightGrid!, Math.max(2, cx - stepLen),              cz)

        // Slab at this position
        const slabY = h + slabT / 2
        const slab = new THREE.Mesh(new THREE.BoxGeometry(slabSize, slabT, slabSize), roadMat)
        slab.position.set(cx, slabY, cz)
        this.group.add(slab)
        this.extras.push(slab)

        // Register slab as walkable (world-axis-aligned AABB, conservative)
        const half = slabSize / 2
        this.addWalkable(cx, cz, half, half, slabY + slabT / 2)

        // Step downhill
        const minH = Math.min(hN, hS, hE, hW)
        if (minH === hN)      cz -= stepLen
        else if (minH === hS) cz += stepLen
        else if (minH === hE) cx += stepLen
        else                  cx -= stepLen
      }
    }
  }

  // ── Giant trees ───────────────────────────────────────────────────────────

  private buildGiantTrees(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    if (rng.next() > 0.22) return  // ~22% chance per chunk

    const biome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    // Only in forest-type biomes
    if (biome !== BiomeType.Forest && biome !== BiomeType.Swamp && biome !== BiomeType.Mushroom) return

    // Find a suitable spot: high ground, not too steep
    let bestH = -Infinity, bestX = CHUNK_SIZE / 2, bestZ = CHUNK_SIZE / 2
    for (let i = 0; i < 12; i++) {
      const lx = 8 + rng.range(0, CHUNK_SIZE - 16)
      const lz = 8 + rng.range(0, CHUNK_SIZE - 16)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      const hN = sampleHeight(this.heightGrid!, lx, Math.max(1, lz - 3))
      const hS = sampleHeight(this.heightGrid!, lx, Math.min(CHUNK_SIZE - 1, lz + 3))
      const hE = sampleHeight(this.heightGrid!, Math.min(CHUNK_SIZE - 1, lx + 3), lz)
      const hW = sampleHeight(this.heightGrid!, Math.max(1, lx - 3), lz)
      const grad = Math.max(Math.abs(hN - hS), Math.abs(hE - hW))
      if (h > bestH && h > 8 && grad < 4) { bestH = h; bestX = lx; bestZ = lz }
    }
    if (bestH < 8) return

    const treeH = rng.range(20, 30)
    const trunkR = rng.range(1.5, 2.5)
    const config = getBiome(biome)

    // Colors
    const trunkColor = biome === BiomeType.Mushroom ? 0x6090b0
      : biome === BiomeType.Swamp ? 0x2a3010
      : 0x3a2010
    const canopyColor = biome === BiomeType.Mushroom ? 0x7030a0
      : biome === BiomeType.Swamp ? 0x182808
      : 0x1a3a08

    const g = new THREE.Group()
    g.position.set(bestX, bestH, bestZ)

    // Trunk
    const trunkMat = new THREE.MeshLambertMaterial({ color: trunkColor })
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.6, trunkR, treeH, 8), trunkMat)
    trunk.position.y = treeH / 2
    g.add(trunk)

    // Root buttresses
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2
      const bw = rng.range(0.6, 1.0)
      const bh = rng.range(3, 6)
      const bGeo = new THREE.BoxGeometry(bw, bh, trunkR * 1.5)
      const buttress = new THREE.Mesh(bGeo, trunkMat)
      buttress.position.set(
        Math.cos(angle) * (trunkR + bw * 0.3),
        bh / 2,
        Math.sin(angle) * (trunkR + bw * 0.3),
      )
      buttress.rotation.y = angle
      g.add(buttress)
    }

    // Mid platform
    const midY = treeH * 0.5
    const midR = 5.5
    const platMat = new THREE.MeshLambertMaterial({ color: trunkColor })
    const midPlat = new THREE.Mesh(new THREE.CylinderGeometry(midR, midR * 1.1, 0.6, 8), platMat)
    midPlat.position.y = midY
    g.add(midPlat)
    // Mid walkable (world Y = bestH + midY + 0.3)
    this.addWalkable(bestX, bestZ, midR - 0.5, midR - 0.5, bestH + midY + 0.3)

    // Spiral ramp sections from mid to ground (visual only — just ledges)
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2
      const rampY = midY * (i / 4) * 0.9
      const rampR = trunkR + 1.0
      const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.4, 2.5), platMat)
      rampMesh.position.set(
        Math.cos(angle) * rampR,
        rampY,
        Math.sin(angle) * rampR,
      )
      rampMesh.rotation.y = angle
      g.add(rampMesh)
      this.addWalkable(
        bestX + Math.cos(angle) * rampR,
        bestZ + Math.sin(angle) * rampR,
        1.2, 1.2,
        bestH + rampY + 0.2,
      )
    }

    // Canopy platform
    const canopyY = treeH * 0.9
    const canopyR = rng.range(7, 10)
    const canopyPlat = new THREE.Mesh(new THREE.CylinderGeometry(canopyR, canopyR * 1.1, 0.8, 10), platMat)
    canopyPlat.position.y = canopyY
    g.add(canopyPlat)
    // Canopy walkable
    this.addWalkable(bestX, bestZ, canopyR - 1, canopyR - 1, bestH + canopyY + 0.4)

    // Foliage dome above canopy
    const foliageMat = new THREE.MeshLambertMaterial({ color: canopyColor, transparent: true, opacity: 0.9 })
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(canopyR * 1.1, 7, 5), foliageMat)
    foliage.position.y = canopyY + canopyR * 0.6
    g.add(foliage)

    // For mushroom biome: glowing spots on canopy
    if (biome === BiomeType.Mushroom) {
      const spotMat = new THREE.MeshLambertMaterial({ color: 0xff80ff, emissive: new THREE.Color(0x440044) })
      for (let i = 0; i < 6; i++) {
        const angle = rng.range(0, Math.PI * 2)
        const r = rng.range(0, canopyR * 0.8)
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.6, 5, 4), spotMat)
        spot.position.set(
          Math.cos(angle) * r,
          canopyY + 0.5,
          Math.sin(angle) * r,
        )
        g.add(spot)
      }
    }

    this.group.add(g)
    this.extras.push(g)
  }

  // ── Mega structures ───────────────────────────────────────────────────────

  private buildMegaStructures(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    if (rng.next() > 0.08) return  // 8% chance

    // Find flat terrain away from water
    let bestH = -Infinity, bestX = CHUNK_SIZE / 2, bestZ = CHUNK_SIZE / 2, bestGrad = Infinity
    for (let i = 0; i < 16; i++) {
      const lx = 10 + rng.range(0, CHUNK_SIZE - 20)
      const lz = 10 + rng.range(0, CHUNK_SIZE - 20)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      const hN = sampleHeight(this.heightGrid!, lx, Math.max(1, lz - 4))
      const hS = sampleHeight(this.heightGrid!, lx, Math.min(CHUNK_SIZE - 1, lz + 4))
      const hE = sampleHeight(this.heightGrid!, Math.min(CHUNK_SIZE - 1, lx + 4), lz)
      const hW = sampleHeight(this.heightGrid!, Math.max(1, lx - 4), lz)
      const grad = Math.max(Math.abs(hN - hS), Math.abs(hE - hW))
      if (h > WATER_LEVEL + 2 && grad < bestGrad) {
        bestGrad = grad; bestH = h; bestX = lx; bestZ = lz
      }
    }
    if (bestH < WATER_LEVEL + 2 || bestGrad > 3) return

    const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + bestX, this.cz * CHUNK_SIZE + bestZ)
    const stoneColor = (
      biome === BiomeType.Volcanic ? 0x3a1a08 :
      biome === BiomeType.Snow     ? 0x7888a0 :
      biome === BiomeType.Desert   ? 0x8a6030 :
      biome === BiomeType.Crystal  ? 0x2860a0 :
                                     0x4a3828
    )

    const g = new THREE.Group()
    g.position.set(bestX, bestH, bestZ)

    const stoneMat = new THREE.MeshLambertMaterial({ color: stoneColor })
    const accentMat = new THREE.MeshLambertMaterial({ color: stoneColor + 0x101010 })

    // 4 stacked platforms (ziggurat)
    const tiers = [
      { w: 16, d: 16, h: 3, y: 0 },
      { w: 12, d: 12, h: 3, y: 3 },
      { w:  9, d:  9, h: 3, y: 6 },
      { w:  6, d:  6, h: 3, y: 9 },
    ]

    for (const tier of tiers) {
      const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(tier.w, tier.h, tier.d), stoneMat)
      tierMesh.position.y = tier.y + tier.h / 2
      g.add(tierMesh)

      // Carved block lines on faces
      for (let bx = -tier.w / 2 + 2; bx < tier.w / 2; bx += 3) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(0.15, tier.h * 0.7, tier.d + 0.02), accentMat)
        groove.position.set(bx, tier.y + tier.h / 2, 0)
        g.add(groove)
      }
      for (let bz = -tier.d / 2 + 2; bz < tier.d / 2; bz += 3) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(tier.w + 0.02, tier.h * 0.7, 0.15), accentMat)
        groove.position.set(0, tier.y + tier.h / 2, bz)
        g.add(groove)
      }
    }

    // Steps on each face of bottom tier
    const stepMat = new THREE.MeshLambertMaterial({ color: stoneColor })
    for (let i = 0; i < 3; i++) {
      const sw = 16 - i * 1.5
      const sh = 0.5
      const step = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, 2), stepMat)
      step.position.set(0, i * sh, tiers[0].d / 2 + 1 - i * 0.5)
      g.add(step)
      this.addWalkable(bestX, bestZ + tiers[0].d / 2 + 1 - i * 0.5, sw / 2 - 0.3, 1.0, bestH + i * sh + sh / 2)
    }

    // Top altar/flame effect (emissive column)
    const altarColor = biome === BiomeType.Volcanic ? 0xff4400 : 0xffa020
    const altarMat = new THREE.MeshLambertMaterial({
      color: altarColor,
      emissive: new THREE.Color(altarColor).multiplyScalar(0.3),
    })
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 2, 6), altarMat)
    altar.position.y = tiers[3].y + tiers[3].h + 1
    g.add(altar)

    // Top platform walkable surface
    const topY = tiers[3].y + tiers[3].h
    this.addWalkable(bestX, bestZ, tiers[3].w / 2 - 0.3, tiers[3].d / 2 - 0.3, bestH + topY)

    this.group.add(g)
    this.extras.push(g)

    // Register as explodable
    const worldPos = new THREE.Vector3(
      this.cx * CHUNK_SIZE + bestX,
      bestH,
      this.cz * CHUNK_SIZE + bestZ,
    )
    const explodable = new ExplodableStructure(g, worldPos, 7)
    this.explodables.push(explodable)
  }

  // ── Chapels ───────────────────────────────────────────────────────────────

  private buildChapels(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    if (rng.next() > 0.05) return  // ~5% per chunk

    const biome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    if (biome !== BiomeType.Forest && biome !== BiomeType.Snow && biome !== BiomeType.Tundra) return

    // Find flat spot
    let bestH = -Infinity, bestX = CHUNK_SIZE / 2, bestZ = CHUNK_SIZE / 2
    for (let i = 0; i < 12; i++) {
      const lx = 8 + rng.range(0, CHUNK_SIZE - 16)
      const lz = 8 + rng.range(0, CHUNK_SIZE - 16)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      const hN = sampleHeight(this.heightGrid!, lx, Math.max(1, lz - 3))
      const hS = sampleHeight(this.heightGrid!, lx, Math.min(CHUNK_SIZE - 1, lz + 3))
      const hE = sampleHeight(this.heightGrid!, Math.min(CHUNK_SIZE - 1, lx + 3), lz)
      const hW = sampleHeight(this.heightGrid!, Math.max(1, lx - 3), lz)
      const grad = Math.max(Math.abs(hN - hS), Math.abs(hE - hW))
      if (h > WATER_LEVEL + 1 && grad < 2.5 && h > bestH) { bestH = h; bestX = lx; bestZ = lz }
    }
    if (bestH < WATER_LEVEL + 1) return

    const stoneColor = biome === BiomeType.Snow ? 0x7888a0 : biome === BiomeType.Tundra ? 0x606878 : 0x5a4838
    const darkStone  = biome === BiomeType.Snow ? 0x505870 : biome === BiomeType.Tundra ? 0x484858 : 0x3a2e28
    const woodColor  = 0x5a3010

    const stoneMat = new THREE.MeshLambertMaterial({ color: stoneColor })
    const darkMat  = new THREE.MeshLambertMaterial({ color: darkStone })
    const woodMat  = new THREE.MeshLambertMaterial({ color: woodColor })

    const g = new THREE.Group()
    g.position.set(bestX, bestH, bestZ)

    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      g.add(m)
      return m
    }

    // Foundation slab
    box(10, 0.6, 8, stoneMat, 0, 0.3, 0)
    this.addWalkable(bestX, bestZ, 5, 4, bestH + 0.6)

    // Nave
    box(8, 5, 10, stoneMat, 0, 3.1, 0)

    // Roof ridge A & B (angled)
    const roofA = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.6, 5.5), darkMat)
    roofA.position.set(0, 5.6, 2.0)
    roofA.rotation.z = -0.49  // ~28°
    g.add(roofA)
    const roofB = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.6, 5.5), darkMat)
    roofB.position.set(0, 5.6, -2.0)
    roofB.rotation.z = 0.49
    g.add(roofB)

    // Bell tower at north end
    box(2, 7, 2, stoneMat, 0, 3.5, -6)

    // Tower roof cap (rotated 45° on Y)
    const towerRoof = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.5, 2.5), darkMat)
    towerRoof.position.set(0, 7.25, -6)
    towerRoof.rotation.y = Math.PI / 4
    g.add(towerRoof)

    // Cross on tower
    box(0.2, 1.4, 0.2, darkMat, 0, 8.2, -6)   // vertical bar
    box(0.2, 0.2, 1.2, darkMat, 0, 8.5, -6)   // horizontal bar

    // Door arch (south face)
    box(1.8, 2.2, 0.3, darkMat, 0, 1.7, 5.15)

    // Two windows (east/west)
    box(0.2, 1.0, 0.8, darkMat, -4.05, 3.5, 0)
    box(0.2, 1.0, 0.8, darkMat,  4.05, 3.5, 0)

    this.group.add(g)
    this.extras.push(g)
  }

  // ── Cemeteries ────────────────────────────────────────────────────────────

  private buildCemeteries(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    if (rng.next() > 0.04) return  // ~4% per chunk

    const biome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    if (biome !== BiomeType.Forest && biome !== BiomeType.Swamp) return

    // Find flat spot
    let bestH = -Infinity, bestX = CHUNK_SIZE / 2, bestZ = CHUNK_SIZE / 2
    for (let i = 0; i < 12; i++) {
      const lx = 10 + rng.range(0, CHUNK_SIZE - 20)
      const lz = 10 + rng.range(0, CHUNK_SIZE - 20)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      const hN = sampleHeight(this.heightGrid!, lx, Math.max(1, lz - 3))
      const hS = sampleHeight(this.heightGrid!, lx, Math.min(CHUNK_SIZE - 1, lz + 3))
      const hE = sampleHeight(this.heightGrid!, Math.min(CHUNK_SIZE - 1, lx + 3), lz)
      const hW = sampleHeight(this.heightGrid!, Math.max(1, lx - 3), lz)
      const grad = Math.max(Math.abs(hN - hS), Math.abs(hE - hW))
      if (h > WATER_LEVEL + 0.5 && grad < 2.0 && h > bestH) { bestH = h; bestX = lx; bestZ = lz }
    }
    if (bestH < WATER_LEVEL + 0.5) return

    const stoneColor = biome === BiomeType.Swamp ? 0x2a3820 : 0x363228
    const fenceColor = biome === BiomeType.Swamp ? 0x1e2814 : 0x282420

    const stoneMat = new THREE.MeshLambertMaterial({ color: stoneColor })
    const fenceMat = new THREE.MeshLambertMaterial({ color: fenceColor })

    const g = new THREE.Group()
    g.position.set(bestX, bestH, bestZ)

    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.rotation.y = ry
      g.add(m)
    }

    // Ground slab (barely raised)
    box(14, 0.3, 12, new THREE.MeshLambertMaterial({ color: biome === BiomeType.Swamp ? 0x1e2814 : 0x252220 }), 0, 0.15, 0)

    // Fence N/S
    box(14, 1, 0.25, fenceMat, 0, 0.8, -6)
    box(14, 1, 0.25, fenceMat, 0, 0.8,  6)
    // Fence E/W
    box(0.25, 1, 12, fenceMat, -7, 0.8, 0)
    box(0.25, 1, 12, fenceMat,  7, 0.8, 0)

    // Corner and midpoint posts
    const postPos: [number, number][] = [
      [-7, -6], [0, -6], [7, -6],
      [-7,  0],          [7,  0],
      [-7,  6], [0,  6], [7,  6],
    ]
    for (const [px, pz] of postPos) {
      box(0.4, 1.2, 0.4, fenceMat, px, 0.9, pz)
    }

    // 6–8 tombstones
    const tsCount = 6 + rng.int(0, 2)
    for (let i = 0; i < tsCount; i++) {
      const tx = rng.range(-5.5, 5.5)
      const tz = rng.range(-4.5, 4.5)
      const th = 1.0 + rng.range(0, 0.8)
      const td = 0.6 + rng.range(0, 0.4)
      const trot = rng.range(-0.21, 0.21)
      box(0.2, th, td, stoneMat, tx, th / 2 + 0.3, tz, trot)
    }

    // 1–2 iron crosses
    const crossCount = 1 + rng.int(0, 1)
    const crossMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
    for (let i = 0; i < crossCount; i++) {
      const cx2 = rng.range(-5, 5)
      const cz2 = rng.range(-4, 4)
      // vertical bar
      const vbar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), crossMat)
      vbar.position.set(cx2, 1.1, cz2)
      g.add(vbar)
      // horizontal bar
      const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.9), crossMat)
      hbar.position.set(cx2, 1.5, cz2)
      g.add(hbar)
    }

    this.group.add(g)
    this.extras.push(g)
  }

  // ── Swamp Piers ───────────────────────────────────────────────────────────

  private buildSwampPiers(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return

    const biome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    if (biome !== BiomeType.Swamp) return

    // Scan for a water-edge transition
    const step = CHUNK_SIZE / CHUNK_SEGMENTS
    let edgeX = -1, edgeZ = -1, axis: 'x' | 'z' = 'x'

    outer:
    for (let r = 2; r < CHUNK_SEGMENTS - 2; r++) {
      for (let c = 2; c < CHUNK_SEGMENTS - 2; c++) {
        const lx = c * step
        const lz = r * step
        const h = sampleHeight(this.heightGrid!, lx, lz)
        const hAhead = sampleHeight(this.heightGrid!, lx + step * 3, lz)
        const hBelow = sampleHeight(this.heightGrid!, lx, lz + step * 3)
        if (h > WATER_LEVEL && hAhead < WATER_LEVEL) {
          edgeX = lx; edgeZ = lz; axis = 'x'; break outer
        }
        if (h > WATER_LEVEL && hBelow < WATER_LEVEL) {
          edgeX = lx; edgeZ = lz; axis = 'z'; break outer
        }
      }
    }

    if (edgeX < 0 || rng.next() > 0.20) return  // 20% chance when edge found

    const worldH = sampleHeight(this.heightGrid!, edgeX, edgeZ)
    const deckY = WATER_LEVEL + 0.15
    const woodMat  = new THREE.MeshLambertMaterial({ color: 0x5a3210 })
    const darkWood = new THREE.MeshLambertMaterial({ color: 0x3a2010 })

    const g = new THREE.Group()
    g.position.set(edgeX, 0, edgeZ)

    // Deck planks
    const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(
      axis === 'x' ? 8 : 4,
      0.25,
      axis === 'z' ? 8 : 4,
    ), woodMat)
    deckMesh.position.set(axis === 'x' ? 4 : 0, deckY, axis === 'z' ? 4 : 0)
    g.add(deckMesh)
    this.addWalkable(
      edgeX + (axis === 'x' ? 4 : 0),
      edgeZ + (axis === 'z' ? 4 : 0),
      axis === 'x' ? 4 : 2,
      axis === 'z' ? 4 : 2,
      deckY + 0.13,
    )

    // 4 support posts reaching down to terrain
    const postOffsets: [number, number][] = axis === 'x'
      ? [[ 1, -1.5], [1, 1.5], [7, -1.5], [7, 1.5]]
      : [[-1.5, 1], [1.5, 1], [-1.5, 7], [1.5, 7]]
    for (const [ox, oz] of postOffsets) {
      const ph = deckY - worldH + 0.1
      if (ph < 0.3) continue
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, ph, 0.25), darkWood)
      post.position.set(ox, worldH + ph / 2, oz)
      g.add(post)
    }

    // Dock end box
    const dockEnd = new THREE.Mesh(new THREE.BoxGeometry(
      axis === 'x' ? 1.5 : 2,
      0.4,
      axis === 'z' ? 1.5 : 2,
    ), woodMat)
    dockEnd.position.set(axis === 'x' ? 8.75 : 0, deckY + 0.075, axis === 'z' ? 8.75 : 0)
    g.add(dockEnd)
    this.addWalkable(
      edgeX + (axis === 'x' ? 8.75 : 0),
      edgeZ + (axis === 'z' ? 8.75 : 0),
      axis === 'x' ? 0.75 : 1,
      axis === 'z' ? 0.75 : 1,
      deckY + 0.28,
    )

    // 2 bollards at deck start
    for (const side of [-1.5, 1.5]) {
      const bollard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.7, 0.3), darkWood)
      bollard.position.set(
        axis === 'x' ? 0.5 : side,
        deckY + 0.35,
        axis === 'z' ? 0.5 : side,
      )
      g.add(bollard)
    }

    this.group.add(g)
    this.extras.push(g)
  }

  // ── Sprites ───────────────────────────────────────────────────────────────

  private placeSprites(rng: SeededRandom, biomeMap: BiomeMap, atlas: SpriteAtlas, lightPool: PointLightPool) {
    const worldX = this.cx * CHUNK_SIZE
    const worldZ = this.cz * CHUNK_SIZE
    const { gridStep, spawnDensity, positionJitter, globalScaleMultiplier, heightOffset } = SPRITE_CONFIG
    const cols = Math.floor(CHUNK_SIZE / gridStep)
    const rows = Math.floor(CHUNK_SIZE / gridStep)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng.next() > spawnDensity) continue

        const lx = c * gridStep + rng.range(0, gridStep * positionJitter)
        const lz = r * gridStep + rng.range(0, gridStep * positionJitter)
        const wx = worldX + lx
        const wz = worldZ + lz

        const height = this.heightGrid ? sampleHeight(this.heightGrid, lx, lz) : 0

        if (height < WATER_LEVEL + 0.4) continue

        const biome  = biomeMap.getBiomeAt(wx, wz)
        const config = getBiome(biome)

        const totalWeight = config.spriteTypes.reduce((s, t) => s + t.weight, 0)
        let roll = rng.range(0, totalWeight)
        let chosen = config.spriteTypes[0]
        for (const st of config.spriteTypes) { roll -= st.weight; if (roll <= 0) { chosen = st; break } }

        const scale   = rng.range(chosen.minScale, chosen.maxScale) * globalScaleMultiplier
        const variant = rng.int(0, VARIANTS - 1)
        const tex     = atlas.getTexture(biome, chosen.category as SpriteCategory, variant)
        const pos     = new THREE.Vector3(lx, height + heightOffset, lz)

        const obj = chosen.isBillboard ? createBillboard(tex, scale, pos) : createGroundDecal(tex, scale, pos)
        this.group.add(obj)
        this.sprites.push(obj)

        if (config.hasPointLights && rng.next() < 0.08) {
          const light = lightPool.acquire()
          if (light) {
            light.position.set(wx, height + 2, wz)
            light.intensity = rng.range(0.8, 2.0)
            this.pointLights.push(light)
          }
        }
      }
    }
  }

  // ── Particles ─────────────────────────────────────────────────────────────

  private buildParticles(biomeMap: BiomeMap) {
    const worldX = this.cx * CHUNK_SIZE
    const worldZ = this.cz * CHUNK_SIZE
    const config = getBiome(biomeMap.getBiomeAt(worldX + CHUNK_SIZE/2, worldZ + CHUNK_SIZE/2))
    if (!config.particleType) return

    const centerH = this.heightGrid ? sampleHeight(this.heightGrid, CHUNK_SIZE/2, CHUNK_SIZE/2) : 0
    const ps = new ParticleSystem(
      config.particleType, config.particleCount, config.particleColor,
      new THREE.Vector3(worldX + CHUNK_SIZE/2, centerH, worldZ + CHUNK_SIZE/2),
      CHUNK_SIZE * 0.6,
      new SeededRandom(chunkSeed(this.cx, this.cz, 1)),
    )
    ps.points.position.set(CHUNK_SIZE/2, 0, CHUNK_SIZE/2)
    this.group.add(ps.points)
    this.particleSystems.push(ps)
  }

  // ── Public API ────────────────────────────────────────────────────────────

  getHeightAt(lx: number, lz: number): number {
    return this.heightGrid ? sampleHeight(this.heightGrid, lx, lz) : 0
  }

  update(delta: number) {
    this.time += delta
    for (const ps of this.particleSystems) ps.update(delta, this.time)
    for (const ex of this.explodables) ex.update(delta, this.rngForExplode)
  }

  dispose(scene: THREE.Scene, lightPool: PointLightPool) {
    scene.remove(this.group)
    if (this.terrainMesh) {
      this.terrainMesh.geometry.dispose()
      ;(this.terrainMesh.material as THREE.Material).dispose()
    }
    for (const obj of [...this.sprites, ...this.extras]) {
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose()
          ;(child.material as THREE.Material).dispose()
        }
      })
    }
    for (const ps of this.particleSystems) ps.dispose()
    for (const light of this.pointLights) lightPool.release(light)
    this.sprites = []; this.extras = []
    this.particleSystems = []; this.pointLights = []
    this.walkableSurfaces = []; this.explodables = []
    this.heightGrid = null
  }
}
