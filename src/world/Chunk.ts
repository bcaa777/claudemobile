import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { generateHeightmap, sampleHeight, CHUNK_SIZE, CHUNK_SEGMENTS, WATER_LEVEL, HELL_DEPTH, riverMask } from './TerrainGenerator'
import { BiomeMap } from './BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType, SpriteCategory } from '../biomes/types'
import { SpriteAtlas, VARIANTS } from '../sprites/SpriteAtlas'
import { BillboardBatch } from '../sprites/BillboardBatch'
import { ParticleSystem } from '../sprites/ParticleSystem'
import { PointLightPool } from '../lighting/PointLightPool'
import { MaterialCache } from '../utils/MaterialCache'
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'
import { texGen } from '../utils/PixelTextureGenerator'
import { SPRITE_CONFIG, TERRAIN_CONFIG, RENDER_CONFIG } from '../config'
import { ExplodableStructure } from './ExplodableStructure'
import { createWaterMaterial } from '../shaders/WaterMaterial'
import type { RoadNetwork } from '../traversal/RoadNetwork'
import { buildRoadSegments } from '../traversal/RoadRenderer'
import { buildBiomeFeatures } from '../traversal/BiomeTraversal'
import { updateLavaRocks } from '../traversal/LavaRocks'
import type { TraversalAnchor, LavaRockState } from '../traversal/traversalTypes'

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

function buildRockFormation(rng: SeededRandom, pos: THREE.Vector3, biome: BiomeType, matCache: MaterialCache): { group: THREE.Group, topY: number, topX: number, topZ: number, topHalfW: number } {
  const g   = new THREE.Group()
  g.position.copy(pos)
  const rockColor = ROCK_COLORS[biome] ?? 0x404040
  const mat = matCache.getLambert(rockColor, { map: texGen.getTexture('stone', rockColor).map })

  let topY = 0, topX = 0, topZ = 0, topHalfW = 1
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
    if (h > topY) { topY = h; topX = ox; topZ = oz; topHalfW = w * 0.5 }
    if (rng.next() > 0.55) {
      const cw = w * rng.range(1.2, 1.8)
      const ch = rng.range(0.6, 2.0)
      const cap = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cw), mat)
      cap.position.set(ox + rng.range(-0.5, 0.5), h + ch / 2, oz + rng.range(-0.5, 0.5))
      g.add(cap)
      const capTop = h + ch
      if (capTop > topY) { topY = capTop; topX = ox; topZ = oz; topHalfW = cw * 0.5 }
    }
  }
  return { group: g, topY, topX, topZ, topHalfW }
}

const ARCH_COLORS: Record<number, number> = {
  [BiomeType.Forest]:   0x2a2018,
  [BiomeType.Desert]:   0x6a4820,
  [BiomeType.Volcanic]: 0x180804,
  [BiomeType.Snow]:     0x5a6878,
}

function buildCaveArch(rng: SeededRandom, pos: THREE.Vector3, biome: BiomeType, axis: 'x' | 'z', matCache: MaterialCache): { group: THREE.Group, span: number, pillarH: number, thick: number } {
  const g   = new THREE.Group()
  g.position.copy(pos)
  const archColor = ARCH_COLORS[biome] ?? 0x303030
  const mat = matCache.getLambert(archColor, { map: texGen.getTexture('stone', archColor).map })

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
  return { group: g, span, pillarH: h, thick }
}

function buildBridge(rng: SeededRandom, pos: THREE.Vector3, length: number, axis: 'x' | 'z', matCache: MaterialCache): THREE.Group {
  const g       = new THREE.Group()
  g.position.copy(pos)
  const deckW   = 3.6
  const plankT  = 0.25
  const railH   = 1.1
  const woodMat = matCache.getLambert(0x5a3210, { map: texGen.getTexture('wood', 0x5a3210).map })
  const stoneMat= matCache.getLambert(0x504538, { map: texGen.getTexture('stone', 0x504538).map })

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
  public traversalAnchors: TraversalAnchor[] = []
  private lavaRocks: LavaRockState[] = []

  private terrainMesh: THREE.Mesh | null = null
  private extras: THREE.Object3D[] = []
  private mergedMeshes: THREE.Mesh[] = []
  private billboardBatches: BillboardBatch[] = []
  private decalBatches: BillboardBatch[] = []
  private particleSystems: ParticleSystem[] = []
  private pointLights: THREE.PointLight[] = []
  private time = 0
  private rngForExplode: SeededRandom
  private matCache: MaterialCache

  constructor(
    cx: number, cz: number,
    scene: THREE.Scene,
    biomeMap: BiomeMap,
    atlas: SpriteAtlas,
    lightPool: PointLightPool,
    matCache: MaterialCache,
    roadNetwork?: RoadNetwork | null,
  ) {
    this.cx    = cx
    this.cz    = cz
    this.group = new THREE.Group()
    this.group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE)
    this.rngForExplode = new SeededRandom(chunkSeed(cx, cz, 99))
    this.matCache = matCache
    scene.add(this.group)
    this.build(biomeMap, atlas, lightPool, scene, roadNetwork)
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

  private build(biomeMap: BiomeMap, atlas: SpriteAtlas, lightPool: PointLightPool, scene?: THREE.Scene, roadNetwork?: RoadNetwork | null) {
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
    if (TERRAIN_CONFIG.enableForestRuins)       this.buildForestRuins(rng, biomeMap)
    if (TERRAIN_CONFIG.enableForestWells)        this.buildForestWells(rng, biomeMap)
    if (TERRAIN_CONFIG.enableDesertRuinedWalls)  this.buildDesertRuinedWalls(rng, biomeMap)
    if (TERRAIN_CONFIG.enableDesertTents)        this.buildDesertTents(rng, biomeMap)
    if (TERRAIN_CONFIG.enableVolcanicVents)      this.buildVolcanicVents(rng, biomeMap)
    if (TERRAIN_CONFIG.enableVolcanicForges)     this.buildVolcanicForges(rng, biomeMap)
    if (TERRAIN_CONFIG.enableIgloos)             this.buildIgloos(rng, biomeMap)
    if (TERRAIN_CONFIG.enableSnowFortWalls)      this.buildSnowFortWalls(rng, biomeMap)
    if (TERRAIN_CONFIG.enableTundraStoneCircles) this.buildTundraStoneCircles(rng, biomeMap)
    if (TERRAIN_CONFIG.enableTundraBoneRacks)    this.buildTundraBoneRacks(rng, biomeMap)
    if (TERRAIN_CONFIG.enableSwampHuts)          this.buildSwampHuts(rng, biomeMap)
    if (TERRAIN_CONFIG.enableSwampBoardwalks)    this.buildSwampBoardwalks(rng, biomeMap)
    if (TERRAIN_CONFIG.enableSavannaHuts)        this.buildSavannaHuts(rng, biomeMap)
    if (TERRAIN_CONFIG.enableSavannaFences)      this.buildSavannaFences(rng, biomeMap)
    if (TERRAIN_CONFIG.enableCrystalArches)      this.buildCrystalArches(rng, biomeMap)
    if (TERRAIN_CONFIG.enableCrystalPedestals)   this.buildCrystalPedestals(rng, biomeMap)
    if (TERRAIN_CONFIG.enableAshCrypts)          this.buildAshCrypts(rng, biomeMap)
    if (TERRAIN_CONFIG.enableAshPyres)           this.buildAshPyres(rng, biomeMap)
    if (TERRAIN_CONFIG.enableMushroomAltars)     this.buildMushroomAltars(rng, biomeMap)
    if (TERRAIN_CONFIG.enableMushroomHollowLogs) this.buildMushroomHollowLogs(rng, biomeMap)
    if (TERRAIN_CONFIG.enableHeavenPillars)      this.buildHeavenPillars(rng, biomeMap)
    if (TERRAIN_CONFIG.enableHeavenArches)       this.buildHeavenArches(rng, biomeMap)
    if (TERRAIN_CONFIG.enableHeavenWaterfalls)   this.buildHeavenWaterfalls(rng, biomeMap)
    if (TERRAIN_CONFIG.enableHellLavaPools)      this.buildHellLavaPools(rng, biomeMap)
    if (TERRAIN_CONFIG.enableHellSpires)         this.buildHellSpires(rng, biomeMap)
    if (TERRAIN_CONFIG.enableHellLavaFalls)      this.buildHellLavaFalls(rng, biomeMap)
    if (TERRAIN_CONFIG.enableAlpineRocks)        this.buildAlpineRocks(rng, biomeMap)
    if (TERRAIN_CONFIG.enableAlpineCabins)       this.buildAlpineCabins(rng, biomeMap)
    if (TERRAIN_CONFIG.enableCliffLedges)        this.buildCliffLedges(rng, biomeMap)
    if (TERRAIN_CONFIG.enableCliffNests)         this.buildCliffNests(rng, biomeMap)
    if (TERRAIN_CONFIG.enableFloatingRocks)      this.buildFloatingRocks(rng, biomeMap)
    if (TERRAIN_CONFIG.enableSkyBridges)         this.buildSkyBridges(rng, biomeMap)
    if (TERRAIN_CONFIG.enableJungleCanopy)       this.buildJungleCanopy(rng, biomeMap)
    if (TERRAIN_CONFIG.enableJungleRuins)        this.buildJungleRuins(rng, biomeMap)
    if (TERRAIN_CONFIG.enableMesaPillars)        this.buildMesaPillars(rng, biomeMap)
    if (TERRAIN_CONFIG.enableMesaDwellings)      this.buildMesaDwellings(rng, biomeMap)
    if (TERRAIN_CONFIG.enableCoralFormations)    this.buildCoralFormations(rng, biomeMap)
    if (TERRAIN_CONFIG.enableReefCaves)          this.buildReefCaves(rng, biomeMap)
    if (TERRAIN_CONFIG.enableBogMounds)          this.buildBogMounds(rng, biomeMap)
    if (TERRAIN_CONFIG.enableBogBridges)         this.buildBogBridges(rng, biomeMap)
    if (TERRAIN_CONFIG.enableBadlandsHoodoos)    this.buildBadlandsHoodoos(rng, biomeMap)
    if (TERRAIN_CONFIG.enableBadlandsArches)     this.buildBadlandsArches(rng, biomeMap)
    if (TERRAIN_CONFIG.enableTaigaLogs)          this.buildTaigaLogs(rng, biomeMap)
    if (TERRAIN_CONFIG.enableTaigaCamps)         this.buildTaigaCamps(rng, biomeMap)
    if (TERRAIN_CONFIG.enableOasisPalms)         this.buildOasisPalms(rng, biomeMap)
    if (TERRAIN_CONFIG.enableOasisWells)         this.buildOasisWells(rng, biomeMap)

    // ── Inter-biome roads ──────────────────────────────────────────────────
    if (TERRAIN_CONFIG.enableInterBiomeRoads && roadNetwork && this.heightGrid) {
      const waypoints = roadNetwork.getWaypointsForChunk(this.cx, this.cz)
      if (waypoints.length > 0) {
        const result = buildRoadSegments(this.cx, this.cz, waypoints, biomeMap, this.matCache, this.group)
        for (const m of result.meshes) this.extras.push(m)
        for (const w of result.walkables) this.walkableSurfaces.push(w)
      }
    }


    // ── Biome-specific traversal features (ziplines, vines, ice, lava) ──
    if (TERRAIN_CONFIG.enableBiomeTraversal && this.heightGrid && scene) {
      const result = buildBiomeFeatures(this.cx, this.cz, biomeMap, this.heightGrid, this.group, this.matCache, scene)
      for (const m of result.meshes) this.extras.push(m)
      for (const w of result.walkables) this.walkableSurfaces.push(w)
      this.traversalAnchors.push(...result.anchors)
      this.lavaRocks.push(...result.lavaRocks)
    }

    this.mergeStructures()
    this.placeSprites(rng, biomeMap, atlas, lightPool)
    this.buildParticles(biomeMap)
  }

  // ── Water surface ─────────────────────────────────────────────────────────

  public waterMaterial: THREE.ShaderMaterial | null = null

  private buildWater(biomeMap: BiomeMap) {
    const centerBiome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    const waterColor = getBiome(centerBiome).waterColor
    const color = waterColor instanceof THREE.Color ? waterColor : new THREE.Color(waterColor)

    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, 16, 16)
    const mat = createWaterMaterial(color)
    this.waterMaterial = mat
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
        const { group: formation, topY, topX, topZ, topHalfW } = buildRockFormation(rng, new THREE.Vector3(lx, h, lz), biome, this.matCache)
        this.group.add(formation)
        this.extras.push(formation)
        this.addWalkable(lx + topX, lz + topZ, topHalfW, topHalfW, h + topY)
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
        const { group: arch, span, pillarH, thick } = buildCaveArch(rng, new THREE.Vector3(lx, h, lz), biome, axis, this.matCache)
        this.group.add(arch)
        this.extras.push(arch)
        // Walkable on top of each pillar
        const halfT = thick * 0.5
        for (const side of [-span / 2, span / 2]) {
          if (axis === 'x') {
            this.addWalkable(lx + side, lz, halfT, halfT, h + pillarH)
          } else {
            this.addWalkable(lx, lz + side, halfT, halfT, h + pillarH)
          }
        }
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

              const bridge = buildBridge(rng, pos, bridgeLen, axis, this.matCache)
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
      const stoneMat = this.matCache.getLambert(0x5a4838, { map: texGen.getTexture('stone', 0x5a4838).map })

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
        const plank = new THREE.Mesh(pGeo, this.matCache.getLambert(0x6a4820, { map: texGen.getTexture('wood', 0x6a4820).map }))
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
      const cableMat = this.matCache.getLambert(0x3a2810, { map: texGen.getTexture('wood', 0x3a2810).map })
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
      const railMat = this.matCache.getLambert(0x6a4820, { map: texGen.getTexture('wood', 0x6a4820).map })
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

    const roadMat  = this.matCache.getLambert(0x5a5040, { map: texGen.getTexture('stone', 0x5a5040).map })
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
    if (rng.next() > 0.30) return  // ~30% chance per chunk

    const biome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    // Only in forest-type biomes
    if (biome !== BiomeType.Forest && biome !== BiomeType.Swamp) return

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
    const trunkColor = biome === BiomeType.Swamp ? 0x2a3010 : 0x3a2010
    const canopyColor = biome === BiomeType.Swamp ? 0x182808 : 0x1a3a08

    const g = new THREE.Group()
    g.position.set(bestX, bestH, bestZ)

    // Trunk
    const trunkMat = this.matCache.getLambert(trunkColor, { map: texGen.getTexture('wood', trunkColor).map })
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
    const platMat = this.matCache.getLambert(trunkColor, { map: texGen.getTexture('wood', trunkColor).map })
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
    const foliageMat = this.matCache.getLambert(canopyColor, { transparent: true, opacity: 0.9 })
    const foliage = new THREE.Mesh(new THREE.SphereGeometry(canopyR * 1.1, 7, 5), foliageMat)
    foliage.position.y = canopyY + canopyR * 0.6
    g.add(foliage)

    this.group.add(g)
    this.extras.push(g)
  }

  // ── Mega structures ───────────────────────────────────────────────────────

  private buildMegaStructures(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    if (rng.next() > 0.12) return  // 12% chance

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

    const stoneMat = this.matCache.getLambert(stoneColor, { map: texGen.getTexture('stone', stoneColor).map })
    const accentMat = this.matCache.getLambert(stoneColor + 0x101010, { map: texGen.getTexture('stone', stoneColor + 0x101010).map })

    // 4 stacked platforms (ziggurat)
    const tiers = [
      { w: 16, d: 16, h: 3, y: 0 },
      { w: 12, d: 12, h: 3, y: 3 },
      { w:  9, d:  9, h: 3, y: 6 },
      { w:  6, d:  6, h: 3, y: 9 },
    ]

    for (let ti = 0; ti < tiers.length; ti++) {
      const tier = tiers[ti]
      const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(tier.w, tier.h, tier.d), stoneMat)
      tierMesh.position.y = tier.y + tier.h / 2
      g.add(tierMesh)

      // Walkable on top of each tier (tier 3 handled separately below with altar)
      if (ti < 3) {
        this.addWalkable(bestX, bestZ, tier.w / 2 - 0.3, tier.d / 2 - 0.3, bestH + tier.y + tier.h)
      }

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
    const stepMat = this.matCache.getLambert(stoneColor, { map: texGen.getTexture('stone', stoneColor).map })
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
    const altarEmissive = new THREE.Color(altarColor).multiplyScalar(0.6).getHex()
    const altarMat = this.matCache.getLambert(altarColor, { emissive: altarEmissive, emissiveIntensity: 1.0, map: texGen.getTexture('emberGlow', altarColor).map })
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
    if (rng.next() > 0.08) return  // ~8% per chunk

    const biome = biomeMap.getBiomeAt(
      this.cx * CHUNK_SIZE + CHUNK_SIZE / 2,
      this.cz * CHUNK_SIZE + CHUNK_SIZE / 2,
    )
    if (biome !== BiomeType.Forest && biome !== BiomeType.Snow) return

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

    const stoneColor = biome === BiomeType.Snow ? 0x7888a0 : 0x5a4838
    const darkStone  = biome === BiomeType.Snow ? 0x505870 : 0x3a2e28
    const woodColor  = 0x5a3010

    const stoneMat = this.matCache.getLambert(stoneColor, { map: texGen.getTexture('stone', stoneColor).map })
    const darkMat  = this.matCache.getLambert(darkStone, { map: texGen.getTexture('darkStone', darkStone).map })
    const woodMat  = this.matCache.getLambert(woodColor, { map: texGen.getTexture('wood', woodColor).map })

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

    // Two windows (east/west) — glowing warm light from inside
    const windowGlow = this.matCache.getLambert(0xffaa44, { emissive: 0xff8822, emissiveIntensity: 0.7, map: texGen.getTexture('beaconGlow', 0xffaa44).map })
    box(0.2, 1.0, 0.8, windowGlow, -4.05, 3.5, 0)
    box(0.2, 1.0, 0.8, windowGlow,  4.05, 3.5, 0)

    this.group.add(g)
    this.extras.push(g)
  }

  // ── Cemeteries ────────────────────────────────────────────────────────────

  private buildCemeteries(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    if (rng.next() > 0.06) return  // ~6% per chunk

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

    const stoneMat = this.matCache.getLambert(stoneColor, { map: texGen.getTexture('stone', stoneColor).map })
    const fenceMat = this.matCache.getLambert(fenceColor, { map: texGen.getTexture('darkStone', fenceColor).map })

    const g = new THREE.Group()
    g.position.set(bestX, bestH, bestZ)

    const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, ry = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(x, y, z)
      m.rotation.y = ry
      g.add(m)
    }

    // Ground slab (barely raised)
    const groundSlabColor = biome === BiomeType.Swamp ? 0x1e2814 : 0x252220
    box(14, 0.3, 12, this.matCache.getLambert(groundSlabColor, { map: texGen.getTexture('stone', groundSlabColor).map }), 0, 0.15, 0)

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
    const crossMat = this.matCache.getLambert(0x1a1a1a, { map: texGen.getTexture('darkStone', 0x1a1a1a).map })
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
    // Cemetery ground slab walkable
    this.addWalkable(bestX, bestZ, 7.0, 6.0, bestH + 0.3)
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
    const woodMat  = this.matCache.getLambert(0x5a3210, { map: texGen.getTexture('wood', 0x5a3210).map })
    const darkWood = this.matCache.getLambert(0x3a2010, { map: texGen.getTexture('wood', 0x3a2010).map })

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

  // ── Forest Ruins ──────────────────────────────────────────────────────────

  private buildForestRuins(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 24; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Forest) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const stone = this.matCache.getLambert(0x5a4838, { map: texGen.getTexture('stone', 0x5a4838).map })
      const dark = this.matCache.getLambert(0x3a2e28, { map: texGen.getTexture('darkStone', 0x3a2e28).map })
      // Foundation
      g.add(new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 10), stone))
      // Partial walls
      for (let i = 0; i < 2 + rng.int(0, 1); i++) {
        const wh = rng.range(2, 5); const ww = rng.range(3, 6)
        const m = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, 0.8), i % 2 === 0 ? stone : dark)
        m.position.set(rng.range(-4, 4), wh / 2 + 0.25, rng.range(-3, 3))
        m.rotation.y = rng.range(-0.3, 0.3); g.add(m)
      }
      // Corner piece
      const corner = new THREE.Mesh(new THREE.BoxGeometry(1.2, rng.range(3, 5), 1.2), dark)
      corner.position.set(-5, corner.geometry.parameters.height / 2 + 0.25, -4); g.add(corner)
      // Rubble
      for (let i = 0; i < 3; i++) {
        const rb = new THREE.Mesh(new THREE.BoxGeometry(rng.range(0.5, 1.5), rng.range(0.3, 0.8), rng.range(0.5, 1.5)), stone)
        rb.position.set(rng.range(-5, 5), 0.5, rng.range(-4, 4))
        rb.rotation.y = rng.range(0, Math.PI); g.add(rb)
      }
      // Glowing rune on ruins floor
      const ruinsRune = new THREE.MeshBasicMaterial({ color: 0x22aa88, map: texGen.getTexture('runeGlow', 0x22aa88).map })
      const runeM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.5), ruinsRune)
      runeM.position.set(rng.range(-2, 2), 0.28, rng.range(-2, 2)); g.add(runeM)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 6, 5, h + 0.5)
    }
  }

  // ── Forest Wells ──────────────────────────────────────────────────────────

  private buildForestWells(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 28; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.06) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Forest && biome !== BiomeType.Snow) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const stone = this.matCache.getLambert(0x5a4838, { map: texGen.getTexture('stone', 0x5a4838).map })
      const wood = this.matCache.getLambert(0x5a3010, { map: texGen.getTexture('wood', 0x5a3010).map })
      // Ring walls
      for (const [ox, oz, w, d] of [[-1.5, 0, 0.5, 3.5], [1.5, 0, 0.5, 3.5], [0, -1.5, 3.5, 0.5], [0, 1.5, 3.5, 0.5]] as [number, number, number, number][]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), stone)
        wall.position.set(ox, 0.6, oz); g.add(wall)
      }
      // Uprights
      for (const sx of [-1.2, 1.2]) {
        const up = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), wood)
        up.position.set(sx, 1.5, 0); g.add(up)
      }
      // Crossbar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 0.25), wood)
      bar.position.set(0, 3, 0); g.add(bar)
      // Bucket
      const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), wood)
      bucket.position.set(0.3, 2.2, 0); g.add(bucket)
      // Cap stones
      const cap = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.3, 3.8), stone)
      cap.position.set(0, 1.35, 0); g.add(cap)
      // Glowing water inside well
      const wellGlow = new THREE.MeshBasicMaterial({ color: 0x2288cc, map: texGen.getTexture('crystalGlow', 0x2288cc).map })
      const wellWater = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 2.2), wellGlow)
      wellWater.position.set(0, 0.3, 0); g.add(wellWater)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 1.75, 1.75, h + 1.5)
    }
  }

  // ── Desert Ruined Walls ──────────────────────────────────────────────────

  private buildDesertRuinedWalls(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 22; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.10) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Desert) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const sand = this.matCache.getLambert(0x8a6040, { map: texGen.getTexture('sand', 0x8a6040).map })
      const dark = this.matCache.getLambert(0x6a4820, { map: texGen.getTexture('sand', 0x6a4820).map })
      const ry = rng.range(0, Math.PI)
      // Main wall
      const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 1.5), sand)
      wall.position.y = 1.5; wall.rotation.y = ry; g.add(wall)
      // Pillars
      for (const side of [-6, 6]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(1.8, 4, 1.8), dark)
        pil.position.set(Math.cos(ry) * side, 2, Math.sin(ry) * side); g.add(pil)
      }
      // Decorative band
      const band = new THREE.Mesh(new THREE.BoxGeometry(14, 0.4, 1.6), dark)
      band.position.y = 2.8; band.rotation.y = ry; g.add(band)
      // Rubble
      for (let i = 0; i < 3; i++) {
        const rb = new THREE.Mesh(new THREE.BoxGeometry(rng.range(0.5, 1.5), rng.range(0.3, 0.8), rng.range(0.5, 1.5)), sand)
        rb.position.set(rng.range(-4, 4), 0.3, rng.range(-2, 2)); g.add(rb)
      }
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 7, 0.75, h + 3)
    }
  }

  // ── Desert Tents ──────────────────────────────────────────────────────────

  private buildDesertTents(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 26; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Desert) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const poles = this.matCache.getLambert(0x5a3210, { map: texGen.getTexture('wood', 0x5a3210).map })
      const fabric = this.matCache.getLambert(0x8a6840, { map: texGen.getTexture('sand', 0x8a6840).map })
      const rug = this.matCache.getLambert(0x6a4020, { map: texGen.getTexture('sand', 0x6a4020).map })
      // Poles
      for (const sx of [-1.5, 1.5]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.2), poles)
        pole.position.set(sx, 1.75, 0); g.add(pole)
      }
      // Ridge pole
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.15, 0.15), poles)
      ridge.position.y = 3.5; g.add(ridge)
      // Roof panels
      const roofA = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 2.5), fabric)
      roofA.position.set(0, 3.0, 1.0); roofA.rotation.x = 0.4; g.add(roofA)
      const roofB = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 2.5), fabric)
      roofB.position.set(0, 3.0, -1.0); roofB.rotation.x = -0.4; g.add(roofB)
      // Ground rug
      const rugMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 4.5), rug)
      rugMesh.position.y = 0.05; g.add(rugMesh)
      // Campfire glow inside tent
      const fireMat = new THREE.MeshBasicMaterial({ color: 0xff6622, map: texGen.getTexture('emberGlow', 0xff6622).map })
      const campfire = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), fireMat)
      campfire.position.y = 0.2; g.add(campfire)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 1.75, 2.25, h + 0.1)
    }
  }

  // ── Volcanic Vents ──────────────────────────────────────────────────────

  private buildVolcanicVents(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 22; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.09) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Volcanic) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const obsidian = this.matCache.getLambert(0x2a1008, { map: texGen.getTexture('obsidian', 0x2a1008).map })
      const pit = this.matCache.getLambert(0x0a0404, { map: texGen.getTexture('obsidian', 0x0a0404).map })
      const lava = new THREE.MeshBasicMaterial({ color: 0xff4400, map: texGen.getTexture('lava', 0xff4400).map })
      // Crater ring
      for (const [ox, oz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]] as [number, number][]) {
        const ring = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), obsidian)
        ring.position.set(ox, 0.75, oz); g.add(ring)
      }
      // Pit center
      const pitMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 3), pit)
      pitMesh.position.y = -0.25; g.add(pitMesh)
      // Lava glow
      const glow = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 2), lava)
      glow.position.y = 0.05; g.add(glow)
      // Raised lip
      const lip = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.5, 5.5), obsidian)
      lip.position.y = 0.25; g.add(lip)
      // Spikes
      for (let i = 0; i < 2 + rng.int(0, 1); i++) {
        const spike = new THREE.Mesh(new THREE.BoxGeometry(0.5, rng.range(2, 4), 0.5), obsidian)
        spike.position.set(rng.range(-3, 3), spike.geometry.parameters.height / 2, rng.range(-3, 3))
        spike.rotation.set(rng.range(-0.2, 0.2), 0, rng.range(-0.2, 0.2)); g.add(spike)
      }
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 2.25, 2.25, h + 1.5)
    }
  }

  // ── Volcanic Forges ──────────────────────────────────────────────────────

  private buildVolcanicForges(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 28; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.06) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Volcanic) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const stone = this.matCache.getLambert(0x3a1a08, { map: texGen.getTexture('obsidian', 0x3a1a08).map })
      const darkStone = this.matCache.getLambert(0x1a0a04, { map: texGen.getTexture('darkStone', 0x1a0a04).map })
      const ember = new THREE.MeshBasicMaterial({ color: 0xff4400, map: texGen.getTexture('emberGlow', 0xff4400).map })
      // Platform
      const plat = new THREE.Mesh(new THREE.BoxGeometry(6, 1, 6), stone)
      plat.position.y = 0.5; g.add(plat)
      // Anvil
      const anvil = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1), darkStone)
      anvil.position.set(1, 1.6, 0); g.add(anvil)
      // Partial walls
      const wallA = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 5), stone)
      wallA.position.set(-2.7, 2.5, 0); g.add(wallA)
      const wallB = new THREE.Mesh(new THREE.BoxGeometry(5, 3, 0.6), stone)
      wallB.position.set(0, 2.5, -2.7); g.add(wallB)
      // Chimney remnant
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1.5), darkStone)
      chimney.position.set(-2.2, 3, -2.2); g.add(chimney)
      // Ember glow
      const emberMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 1.5), ember)
      emberMesh.position.set(-1, 1.1, 0.5); g.add(emberMesh)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 3, 3, h + 1)
    }
  }

  // ── Igloos ──────────────────────────────────────────────────────────────

  private buildIgloos(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 26; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Snow) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const ice = this.matCache.getLambert(0x9ca8c0, { map: texGen.getTexture('ice', 0x9ca8c0).map })
      const blueGray = this.matCache.getLambert(0x7888a0, { map: texGen.getTexture('ice', 0x7888a0).map })
      // Stacked shrinking rings to approximate dome
      const rings = [
        { w: 6, d: 6, h: 1.2, y: 0 },
        { w: 5.5, d: 5.5, h: 1.0, y: 1.2 },
        { w: 4.5, d: 4.5, h: 1.0, y: 2.2 },
        { w: 3.5, d: 3.5, h: 0.8, y: 3.2 },
        { w: 2.5, d: 2.5, h: 0.8, y: 4.0 },
        { w: 1.5, d: 1.5, h: 0.6, y: 4.8 },
      ]
      for (let i = 0; i < rings.length; i++) {
        const ring = rings[i]
        const ringMesh = new THREE.Mesh(new THREE.BoxGeometry(ring.w, ring.h, ring.d), i % 2 === 0 ? ice : blueGray)
        ringMesh.position.y = ring.y + ring.h / 2; g.add(ringMesh)
      }
      // Door gap — warm interior glow
      const iglooGlow = this.matCache.getLambert(0xffaa55, { emissive: 0xff7722, emissiveIntensity: 0.5, map: texGen.getTexture('beaconGlow', 0xffaa55).map })
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.8, 1), iglooGlow)
      door.position.set(0, 0.9, 3.2); g.add(door)
      // Interior floor
      const floor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 4), blueGray)
      floor.position.y = 0.08; g.add(floor)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 2, 2, h + 0.15)
      this.addWalkable(lx, lz, 0.75, 0.75, h + 5.4)
    }
  }

  // ── Snow Fort Walls ──────────────────────────────────────────────────────

  private buildSnowFortWalls(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 22; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.09) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Snow) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const stone = this.matCache.getLambert(0x7888a0, { map: texGen.getTexture('ice', 0x7888a0).map })
      const dark = this.matCache.getLambert(0x5a6878, { map: texGen.getTexture('ice', 0x5a6878).map })
      const ry = rng.range(0, Math.PI)
      // Wall
      const wall = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 1.5), stone)
      wall.position.y = 1.25; wall.rotation.y = ry; g.add(wall)
      // Crenellations
      for (let i = -1; i <= 1; i++) {
        const cren = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1, 1.6), dark)
        cren.position.set(Math.cos(ry) * i * 3, 3, Math.sin(ry) * i * 3)
        g.add(cren)
      }
      // Buttresses
      for (const side of [-4, 4]) {
        const but = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.8, 2), dark)
        but.position.set(Math.cos(ry) * side, 1.4, Math.sin(ry) * side); g.add(but)
      }
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 6, 6, h + 2.5)
    }
  }

  // ── Tundra Stone Circles ──────────────────────────────────────────────────

  private buildTundraStoneCircles(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 24; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.09) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Snow) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const gray = this.matCache.getLambert(0x606070, { map: texGen.getTexture('stone', 0x606070).map })
      const stoneCount = 5 + rng.int(0, 2)
      const radius = 5
      for (let i = 0; i < stoneCount; i++) {
        const angle = (i / stoneCount) * Math.PI * 2
        const sh = rng.range(2.5, 5)
        const sw = rng.range(0.8, 1.5)
        const stone = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sw * rng.range(0.6, 1)), gray)
        stone.position.set(Math.cos(angle) * radius, sh / 2, Math.sin(angle) * radius)
        stone.rotation.set(rng.range(-0.1, 0.1), rng.range(0, 0.5), rng.range(-0.1, 0.1))
        g.add(stone)
      }
      // Center altar slab
      const altar = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2), gray)
      altar.position.y = 0.25; g.add(altar)
      // Glowing rune on altar
      const runeGlow = new THREE.MeshBasicMaterial({ color: 0x44ccaa, map: texGen.getTexture('runeGlow', 0x44ccaa).map })
      const rune = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 1.2), runeGlow)
      rune.position.y = 0.53; g.add(rune)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 1, 1, h + 0.5)
    }
  }

  // ── Tundra Bone Racks ──────────────────────────────────────────────────

  private buildTundraBoneRacks(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 26; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Snow) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const wood = this.matCache.getLambert(0x4a3a28, { map: texGen.getTexture('wood', 0x4a3a28).map })
      const dried = this.matCache.getLambert(0x6a4430, { map: texGen.getTexture('wood', 0x6a4430).map })
      // X-frames
      for (const sx of [-1.5, 1.5]) {
        const legA = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.2), wood)
        legA.position.set(sx, 1.75, 0); legA.rotation.z = 0.15; g.add(legA)
        const legB = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.2), wood)
        legB.position.set(sx, 1.75, 0); legB.rotation.z = -0.15; g.add(legB)
      }
      // Drying bar
      const bar = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 0.2), wood)
      bar.position.y = 3.2; g.add(bar)
      // Hanging strips
      for (let i = 0; i < 3 + rng.int(0, 1); i++) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, rng.range(0.8, 1.5), 0.15), dried)
        strip.position.set(rng.range(-1.2, 1.2), 2.5, 0); g.add(strip)
      }
      // Ground platform
      const plat = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 2), wood)
      plat.position.y = 0.1; g.add(plat)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 1.75, 1, h + 0.2)
    }
  }

  // ── Swamp Huts ──────────────────────────────────────────────────────────

  private buildSwampHuts(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 26; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL - 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Swamp) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const darkWood = this.matCache.getLambert(0x3a2010, { map: texGen.getTexture('wood', 0x3a2010).map })
      const darker = this.matCache.getLambert(0x2a1a08, { map: texGen.getTexture('wood', 0x2a1a08).map })
      const moss = this.matCache.getLambert(0x1a2a08, { map: texGen.getTexture('moss', 0x1a2a08).map })
      const stiltH = 3
      // Stilts
      for (const [sx, sz] of [[-2, -1.5], [2, -1.5], [-2, 1.5], [2, 1.5]] as [number, number][]) {
        const stilt = new THREE.Mesh(new THREE.BoxGeometry(0.4, stiltH, 0.4), darkWood)
        stilt.position.set(sx, stiltH / 2, sz); g.add(stilt)
      }
      // Platform
      const plat = new THREE.Mesh(new THREE.BoxGeometry(5, 0.3, 4), darkWood)
      plat.position.y = stiltH; g.add(plat)
      // Back wall
      const backWall = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 0.3), darker)
      backWall.position.set(0, stiltH + 1.4, -1.85); g.add(backWall)
      // Side wall
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.5, 4), darker)
      sideWall.position.set(-2.35, stiltH + 1.4, 0); g.add(sideWall)
      // Sloped roof
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.2, 4.5), moss)
      roof.position.set(0, stiltH + 2.8, 0.2); roof.rotation.x = 0.15; g.add(roof)
      // Hanging lantern — green swamp glow
      const lanternMat = new THREE.MeshBasicMaterial({ color: 0x44ff88, map: texGen.getTexture('beaconGlow', 0x44ff88).map })
      const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), lanternMat)
      lantern.position.set(1.5, stiltH + 2.2, 1.5); g.add(lantern)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 2.5, 2, h + stiltH + 0.15)
    }
  }

  // ── Swamp Boardwalks ──────────────────────────────────────────────────

  private buildSwampBoardwalks(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 20; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.10) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Swamp) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const planks = this.matCache.getLambert(0x5a3210, { map: texGen.getTexture('wood', 0x5a3210).map })
      const posts = this.matCache.getLambert(0x3a2010, { map: texGen.getTexture('wood', 0x3a2010).map })
      const axis = rng.next() > 0.5 ? 'x' : 'z'
      const segCount = 6 + rng.int(0, 2)
      const segSpacing = 1.8
      const deckY = Math.max(h, WATER_LEVEL) + 0.3

      for (let i = 0; i < segCount; i++) {
        const off = (i - segCount / 2) * segSpacing
        const yVar = rng.range(-0.1, 0.1)
        const plank = new THREE.Mesh(new THREE.BoxGeometry(
          axis === 'x' ? 1.6 : 2.5,
          0.15,
          axis === 'z' ? 1.6 : 2.5,
        ), planks)
        if (axis === 'x') plank.position.set(off, deckY - h + yVar, 0)
        else plank.position.set(0, deckY - h + yVar, off)
        g.add(plank)
        // Walkable per plank
        if (axis === 'x') this.addWalkable(lx + off, lz, 0.8, 1.25, deckY + 0.08 + yVar)
        else this.addWalkable(lx, lz + off, 1.25, 0.8, deckY + 0.08 + yVar)
        // Support posts (every other)
        if (i % 2 === 0) {
          for (const side of [-1, 1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), posts)
            if (axis === 'x') post.position.set(off, deckY - h - 0.8, side * 1)
            else post.position.set(side * 1, deckY - h - 0.8, off)
            g.add(post)
          }
        }
      }
      this.group.add(g); this.extras.push(g)
    }
  }

  // ── Savanna Huts ──────────────────────────────────────────────────────

  private buildSavannaHuts(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 28; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.06) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Desert) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const mud = this.matCache.getLambert(0x6a4820, { map: texGen.getTexture('sand', 0x6a4820).map })
      const thatch = this.matCache.getLambert(0x3a2808, { map: texGen.getTexture('wood', 0x3a2808).map })
      // 4 walls
      for (const [ox, oz, w, d] of [[-2, 0, 0.5, 4.5], [2, 0, 0.5, 4.5], [0, -2, 4.5, 0.5], [0, 2, 4.5, 0.5]] as [number, number, number, number][]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2.5, d), mud)
        wall.position.set(ox, 1.25, oz); g.add(wall)
      }
      // Floor
      const floor = new THREE.Mesh(new THREE.BoxGeometry(4, 0.15, 4), mud)
      floor.position.y = 0.08; g.add(floor)
      // Pyramid roof (4 angled slabs)
      for (let i = 0; i < 4; i++) {
        const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 2.5), thatch)
        const angle = (i / 4) * Math.PI * 2
        roofSlab.position.set(Math.sin(angle) * 0.8, 3.0, Math.cos(angle) * 0.8)
        roofSlab.rotation.y = angle
        roofSlab.rotation.x = 0.4
        g.add(roofSlab)
      }
      // Door gap — warm interior firelight
      const doorGlow = this.matCache.getLambert(0xff8833, { emissive: 0xff6611, emissiveIntensity: 0.6, map: texGen.getTexture('emberGlow', 0xff8833).map })
      const doorGap = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 0.6), doorGlow)
      doorGap.position.set(0, 0.9, 2.2); g.add(doorGap)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 2, 2, h + 0.15)
    }
  }

  // ── Savanna Fences ──────────────────────────────────────────────────────

  private buildSavannaFences(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 16; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.12) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Desert) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const wood = this.matCache.getLambert(0x5a3210, { map: texGen.getTexture('wood', 0x5a3210).map })
      const axis = rng.next() > 0.5 ? 'x' : 'z'
      const postCount = 4 + rng.int(0, 2)
      const spacing = 2.5
      const totalLen = (postCount - 1) * spacing

      // Posts
      for (let i = 0; i < postCount; i++) {
        const off = i * spacing - totalLen / 2
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.8, 0.3), wood)
        if (axis === 'x') post.position.set(off, 0.9, 0)
        else post.position.set(0, 0.9, off)
        g.add(post)
      }
      // Rails
      for (const ry of [0.5, 1.3]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(
          axis === 'x' ? totalLen + 0.5 : 0.15,
          0.15,
          axis === 'z' ? totalLen + 0.5 : 0.15,
        ), wood)
        if (axis === 'x') rail.position.set(0, ry, 0)
        else rail.position.set(0, ry, 0)
        g.add(rail)
      }
      this.group.add(g); this.extras.push(g)
    }
  }

  // ── Crystal Arches ──────────────────────────────────────────────────────

  private buildCrystalArches(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 24; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Crystal) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const base = this.matCache.getLambert(0x2860a0, { map: texGen.getTexture('crystal', 0x2860a0).map })
      const light = this.matCache.getLambert(0x4080c0, { map: texGen.getTexture('crystal', 0x4080c0).map })
      const dark = this.matCache.getLambert(0x104060, { map: texGen.getTexture('crystal', 0x104060).map })
      // Pillars
      for (const sx of [-4, 4]) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6, 1.5), base)
        pillar.position.set(sx, 3, 0); g.add(pillar)
        // Facet caps
        const cap = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), light)
        cap.position.set(sx, 6.5, 0); cap.rotation.y = Math.PI / 4; g.add(cap)
      }
      // Bridge slab
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.8, 1.5), base)
      bridge.position.y = 6.4; g.add(bridge)
      // Crystal growths at bases — glowing
      const crystGlow = new THREE.MeshBasicMaterial({ color: 0x66aaff, map: texGen.getTexture('crystalGlow', 0x66aaff).map })
      for (const sx of [-4.5, 4.5]) {
        const shard = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.5, 0.6), crystGlow)
        shard.position.set(sx, 0.75, 0.8); shard.rotation.z = rng.range(-0.3, 0.3)
        g.add(shard)
      }
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 4, 0.75, h + 6.8)
    }
  }

  // ── Crystal Pedestals ──────────────────────────────────────────────────

  private buildCrystalPedestals(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 28; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.06) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Crystal) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const base = this.matCache.getLambert(0x2860a0, { map: texGen.getTexture('crystal', 0x2860a0).map })
      const highlight = this.matCache.getLambert(0x60b0e0, { map: texGen.getTexture('crystal', 0x60b0e0).map })
      // 3 tiers
      const tierData = [
        { w: 4, h: 1.2, y: 0 },
        { w: 3, h: 1.0, y: 1.2 },
        { w: 2, h: 0.8, y: 2.2 },
      ]
      for (const t of tierData) {
        const tier = new THREE.Mesh(new THREE.BoxGeometry(t.w, t.h, t.w), base)
        tier.position.y = t.y + t.h / 2; g.add(tier)
      }
      // Floating crystal (rotated 45 degrees) — glowing
      const crystalGlowMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, map: texGen.getTexture('crystalGlow', 0x88ccff).map })
      const crystal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.8, 1.2), crystalGlowMat)
      crystal.position.y = 4; crystal.rotation.y = Math.PI / 4; crystal.rotation.x = 0.2
      g.add(crystal)
      // Small base shards
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2
        const shard = new THREE.Mesh(new THREE.BoxGeometry(0.4, rng.range(0.8, 1.5), 0.4), base)
        shard.position.set(Math.cos(angle) * 2.5, shard.geometry.parameters.height / 2, Math.sin(angle) * 2.5)
        shard.rotation.z = rng.range(-0.2, 0.2); g.add(shard)
      }
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 1, 1, h + 3)
    }
  }

  // ── Ash Crypts ──────────────────────────────────────────────────────────

  private buildAshCrypts(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 24; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Volcanic) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const gray = this.matCache.getLambert(0x303030, { map: texGen.getTexture('ash', 0x303030).map })
      const darkGray = this.matCache.getLambert(0x1a1a1a, { map: texGen.getTexture('ash', 0x1a1a1a).map })
      // Foundation
      const found = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 6), gray)
      found.position.y = 0.25; g.add(found)
      // Corner pillars
      for (const [px, pz] of [[-3.5, -2.5], [3.5, -2.5], [-3.5, 2.5], [3.5, 2.5]] as [number, number][]) {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.8, 4, 0.8), darkGray)
        pil.position.set(px, 2.5, pz); g.add(pil)
      }
      // Partial roof (half collapsed)
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 6), gray)
      roof.position.set(-2, 4.5, 0); g.add(roof)
      // Rubble (collapsed side)
      for (let i = 0; i < 3; i++) {
        const rb = new THREE.Mesh(new THREE.BoxGeometry(rng.range(0.5, 1.5), rng.range(0.3, 0.8), rng.range(0.5, 1.5)), gray)
        rb.position.set(rng.range(1, 3.5), 0.5 + rng.range(0, 0.5), rng.range(-2, 2))
        rb.rotation.set(rng.range(-0.3, 0.3), rng.range(0, 1), rng.range(-0.3, 0.3)); g.add(rb)
      }
      // Entry gap
      const entry = new THREE.Mesh(new THREE.BoxGeometry(2, 2.5, 0.6), darkGray)
      entry.position.set(0, 1.75, 3); g.add(entry)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 4, 3, h + 0.5)
      this.addWalkable(lx - 2, lz, 2, 3, h + 4.7)
    }
  }

  // ── Ash Pyres ──────────────────────────────────────────────────────────

  private buildAshPyres(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 22; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.09) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Volcanic) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const stone = this.matCache.getLambert(0x303030, { map: texGen.getTexture('ash', 0x303030).map })
      const charred = this.matCache.getLambert(0x1a1a1a, { map: texGen.getTexture('ash', 0x1a1a1a).map })
      const embers = new THREE.MeshBasicMaterial({ color: 0xff2200, map: texGen.getTexture('emberGlow', 0xff2200).map })
      // Platform
      const plat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 4), stone)
      plat.position.y = 0.25; g.add(plat)
      // Crossed wood
      for (let i = 0; i < 4 + rng.int(0, 1); i++) {
        const log = new THREE.Mesh(new THREE.BoxGeometry(rng.range(2, 3.5), 0.3, 0.3), charred)
        log.position.set(rng.range(-1, 1), 0.7 + i * 0.2, rng.range(-0.5, 0.5))
        log.rotation.y = rng.range(-0.8, 0.8); g.add(log)
      }
      // Coal center
      const coal = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.2, 1.5), embers)
      coal.position.y = 0.6; g.add(coal)
      // Torch posts
      for (const sx of [-2.5, 2.5]) {
        const torch = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 0.2), charred)
        torch.position.set(sx, 1.25, 0); g.add(torch)
      }
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 2, 2, h + 0.5)
    }
  }

  // ── Mushroom Altars ──────────────────────────────────────────────────────

  private buildMushroomAltars(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 24; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.08) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Swamp) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const stem = this.matCache.getLambert(0x6090b0, { map: texGen.getTexture('mushroom', 0x6090b0).map })
      const cap = this.matCache.getLambert(0x7030a0, { map: texGen.getTexture('mushroom', 0x7030a0).map })
      const glow = new THREE.MeshBasicMaterial({ color: 0xff80ff, map: texGen.getTexture('mushroomGlow', 0xff80ff).map })
      // Central stump
      const stump = new THREE.Mesh(new THREE.BoxGeometry(3, 2, 3), stem)
      stump.position.y = 1; g.add(stump)
      // Mushroom ring
      const ringCount = 4 + rng.int(0, 2)
      const ringR = 4
      for (let i = 0; i < ringCount; i++) {
        const angle = (i / ringCount) * Math.PI * 2
        // Stem
        const ms = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.5, 0.4), stem)
        ms.position.set(Math.cos(angle) * ringR, 0.75, Math.sin(angle) * ringR); g.add(ms)
        // Cap plate
        const mc = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.3, 1.5), cap)
        mc.position.set(Math.cos(angle) * ringR, 1.65, Math.sin(angle) * ringR); g.add(mc)
      }
      // Glowing center
      const glowMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.15, 1), glow)
      glowMesh.position.y = 2.1; g.add(glowMesh)
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 1.5, 1.5, h + 2)
    }
  }

  // ── Mushroom Hollow Logs ──────────────────────────────────────────────

  private buildMushroomHollowLogs(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const step = 22; const cols = Math.floor(CHUNK_SIZE / step); const rows = cols
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (rng.next() > 0.09) continue
      const lx = (c + 0.5) * step + rng.range(-4, 4)
      const lz = (r + 0.5) * step + rng.range(-4, 4)
      const h = sampleHeight(this.heightGrid!, lx, lz)
      if (h < WATER_LEVEL + 1) continue
      const biome = biomeMap.getBiomeAt(this.cx * CHUNK_SIZE + lx, this.cz * CHUNK_SIZE + lz)
      if (biome !== BiomeType.Swamp) continue

      const g = new THREE.Group(); g.position.set(lx, h, lz)
      const logColor = this.matCache.getLambert(0x6090b0, { map: texGen.getTexture('mushroom', 0x6090b0).map })
      const interior = this.matCache.getLambert(0x405870, { map: texGen.getTexture('mushroom', 0x405870).map })
      const capColor = this.matCache.getLambert(0x7030a0, { map: texGen.getTexture('mushroom', 0x7030a0).map })
      const ry = rng.range(0, Math.PI)
      // Outer log
      const outer = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 3), logColor)
      outer.position.y = 1.5; outer.rotation.y = ry; g.add(outer)
      // Interior hollow
      const inner = new THREE.Mesh(new THREE.BoxGeometry(7, 2, 2), interior)
      inner.position.y = 1.3; inner.rotation.y = ry; g.add(inner)
      // Mushroom growths on top
      for (let i = 0; i < 3 + rng.int(0, 1); i++) {
        const mx = rng.range(-3, 3)
        const ms = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), logColor)
        ms.position.set(Math.cos(ry) * mx, 3.2, Math.sin(ry) * mx); g.add(ms)
        const mc = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 1.2), capColor)
        mc.position.set(Math.cos(ry) * mx, 3.7, Math.sin(ry) * mx); g.add(mc)
      }
      this.group.add(g); this.extras.push(g)
      this.addWalkable(lx, lz, 4, 1.5, h + 3)
    }
  }

  // ── Heaven floating cloud islands ─────────────────────────────────────────
  // These are separate geometry floating at HEAVEN_ALTITUDE — ground below is normal terrain

  private buildHeavenPillars(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const hc = biomeMap.getHeavenCenter()
    if (!hc) return

    const chunkWorldX = this.cx * CHUNK_SIZE
    const chunkWorldZ = this.cz * CHUNK_SIZE

    // Check if this chunk is inside the Heaven circle
    const chunkCenterX = chunkWorldX + CHUNK_SIZE / 2
    const chunkCenterZ = chunkWorldZ + CHUNK_SIZE / 2
    const dx = chunkCenterX - hc.x, dz = chunkCenterZ - hc.z
    if (dx * dx + dz * dz > 320 * 320) return  // outside Heaven + margin

    const FLOAT_Y = 100   // HEAVEN_ALTITUDE
    const cloudMat = this.matCache.getLambert(0xf0f0ff, { transparent: true, opacity: 0.85, map: texGen.getTexture('marble', 0xf0f0ff).map })
    const cloudTopMat = this.matCache.getLambert(0xfff8e8, { map: texGen.getTexture('marble', 0xfff8e8).map })
    const goldAccent = this.matCache.getLambert(0xdaa520, { map: texGen.getTexture('gold', 0xdaa520).map })

    const spacing = 16
    for (let lz = spacing / 2; lz < CHUNK_SIZE; lz += spacing) {
      for (let lx = spacing / 2; lx < CHUNK_SIZE; lx += spacing) {
        const wx = chunkWorldX + lx
        const wz = chunkWorldZ + lz
        const biome = biomeMap.getBiomeAt(wx, wz)
        if (biome !== BiomeType.Heaven) continue
        if (rng.next() > 0.50) continue

        // Distance from heaven center — islands sparser at edges
        const hdx = wx - hc.x, hdz = wz - hc.z
        const hDist = Math.sqrt(hdx * hdx + hdz * hdz)
        if (hDist > 290 && rng.next() > 0.3) continue

        const g = new THREE.Group()
        // Float above the ground — offset from chunk group position
        const groundH = sampleHeight(this.heightGrid, lx, lz)
        g.position.set(lx, FLOAT_Y, lz)

        // Cloud island platform — flat-ish top, rounded bottom
        const islandW = rng.range(6, 14)
        const islandD = rng.range(6, 14)
        const islandH = rng.range(2, 5)

        // Top slab (walkable)
        const top = new THREE.Mesh(new THREE.BoxGeometry(islandW, 1.5, islandD), cloudTopMat)
        top.position.set(0, 0, 0)
        g.add(top)

        // Underside — tapered cloud masses hanging below
        const underCount = 1 + rng.int(0, 3)
        for (let i = 0; i < underCount; i++) {
          const uw = rng.range(islandW * 0.3, islandW * 0.8)
          const uh = rng.range(2, islandH + 3)
          const ud = rng.range(islandD * 0.3, islandD * 0.8)
          const ox = rng.range(-islandW * 0.2, islandW * 0.2)
          const oz = rng.range(-islandD * 0.2, islandD * 0.2)
          const under = new THREE.Mesh(new THREE.BoxGeometry(uw, uh, ud), cloudMat)
          under.position.set(ox, -uh / 2 - 0.75, oz)
          g.add(under)
        }

        // Occasional pillar rising from island
        if (rng.next() > 0.65) {
          const pH = rng.range(4, 12)
          const pw = rng.range(1.5, 3)
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(pw, pH, pw), cloudTopMat)
          pillar.position.set(rng.range(-2, 2), pH / 2 + 0.75, rng.range(-2, 2))
          g.add(pillar)
        }

        // Occasional golden accent
        if (rng.next() > 0.8) {
          const accent = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2, 1.5), goldAccent)
          accent.position.set(0, 1.75, 0)
          g.add(accent)
        }

        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, islandW / 2, islandD / 2, FLOAT_Y + 0.75)
      }
    }
  }

  // ── Heaven golden arches (on floating islands) ──────────────────────────

  private buildHeavenArches(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const hc = biomeMap.getHeavenCenter()
    if (!hc) return

    const chunkWorldX = this.cx * CHUNK_SIZE
    const chunkWorldZ = this.cz * CHUNK_SIZE
    const ccx = chunkWorldX + CHUNK_SIZE / 2, ccz = chunkWorldZ + CHUNK_SIZE / 2
    const ddx = ccx - hc.x, ddz = ccz - hc.z
    if (ddx * ddx + ddz * ddz > 310 * 310) return

    const FLOAT_Y = 100
    const goldMat = this.matCache.getLambert(0xdaa520, { map: texGen.getTexture('gold', 0xdaa520).map })

    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 28) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 28) {
        if (rng.next() > 0.08) continue
        const wx = chunkWorldX + lx, wz = chunkWorldZ + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Heaven) continue

        const axis = rng.next() > 0.5 ? 'x' : 'z'
        const span = rng.range(8, 14)
        const archH = rng.range(6, 10)
        const thick = rng.range(1.5, 2.5)

        const g = new THREE.Group(); g.position.set(lx, FLOAT_Y + 1.5, lz)

        for (const side of [-span / 2, span / 2]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(thick, archH, thick), goldMat)
          axis === 'x' ? p.position.set(side, archH / 2, 0) : p.position.set(0, archH / 2, side)
          g.add(p)
        }

        const segs = 5
        for (let i = 0; i < segs; i++) {
          const t = (i + 0.5) / segs
          const angle = Math.PI * t
          const along = -span / 2 + span * t
          const ay = archH + Math.sin(angle) * archH * 0.4
          const segLen = span / segs + 0.2
          const aGeo = new THREE.BoxGeometry(
            axis === 'x' ? segLen : thick, thick, axis === 'z' ? segLen : thick
          )
          const block = new THREE.Mesh(aGeo, goldMat)
          axis === 'x' ? block.position.set(along, ay, 0) : block.position.set(0, ay, along)
          g.add(block)
        }

        this.group.add(g); this.extras.push(g)
        for (const side of [-span / 2, span / 2]) {
          const awx = axis === 'x' ? lx + side : lx
          const awz = axis === 'z' ? lz + side : lz
          this.addWalkable(awx, awz, thick / 2, thick / 2, FLOAT_Y + 1.5 + archH)
        }
      }
    }
  }

  // ── Heaven waterfalls (hang from floating islands) ──────────────────────

  private buildHeavenWaterfalls(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const hc = biomeMap.getHeavenCenter()
    if (!hc) return

    const chunkWorldX = this.cx * CHUNK_SIZE
    const chunkWorldZ = this.cz * CHUNK_SIZE
    const ccx = chunkWorldX + CHUNK_SIZE / 2, ccz = chunkWorldZ + CHUNK_SIZE / 2
    const ddx = ccx - hc.x, ddz = ccz - hc.z
    if (ddx * ddx + ddz * ddz > 320 * 320) return

    const FLOAT_Y = 100
    let count = 0
    const maxPerChunk = 3

    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 16) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 16) {
        if (count >= maxPerChunk) return
        const wx = chunkWorldX + lx, wz = chunkWorldZ + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Heaven) continue
        if (rng.next() > 0.12) continue

        // Waterfall hangs from floating island level down to near ground
        const groundH = sampleHeight(this.heightGrid, lx, lz)
        const fallTop = FLOAT_Y - 2  // just below island underside
        const fallBot = groundH + 3  // just above ground
        const fallHeight = fallTop - fallBot
        if (fallHeight < 30) continue  // not enough room

        const fallWidth = rng.range(2, 4)
        const geo = new THREE.PlaneGeometry(fallWidth, fallHeight, 1, 8)

        // Subtle vertex displacement for flowing look
        const posAttr = geo.attributes.position
        for (let i = 0; i < posAttr.count; i++) {
          const px = posAttr.getX(i)
          const py = posAttr.getY(i)
          posAttr.setX(i, px + Math.sin(py * 0.3 + i * 0.7) * 0.3)
        }
        posAttr.needsUpdate = true

        const mat = new THREE.MeshBasicMaterial({
          color: 0xaaddff,
          transparent: true,
          opacity: 0.5,
          side: THREE.DoubleSide,
          depthWrite: false,
        })

        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(lx, fallBot + fallHeight / 2, lz)
        mesh.rotation.y = rng.next() > 0.5 ? 0 : Math.PI / 2
        this.group.add(mesh)
        this.extras.push(mesh)
        count++
      }
    }
  }

  // ── Hell lava pools (obsidian platforms with lava surfaces) ─────────────

  private buildHellLavaPools(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const hc = biomeMap.getHellCenter()
    if (!hc) return

    const chunkWorldX = this.cx * CHUNK_SIZE
    const chunkWorldZ = this.cz * CHUNK_SIZE
    const ccx = chunkWorldX + CHUNK_SIZE / 2, ccz = chunkWorldZ + CHUNK_SIZE / 2
    const ddx = ccx - hc.x, ddz = ccz - hc.z
    if (ddx * ddx + ddz * ddz > 320 * 320) return

    const obsidianMat = this.matCache.getLambert(0x1a1a22, { map: texGen.getTexture('obsidian', 0x1a1a22).map })
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff3300, map: texGen.getTexture('lava', 0xff3300).map })

    const spacing = 16
    for (let lz = spacing / 2; lz < CHUNK_SIZE; lz += spacing) {
      for (let lx = spacing / 2; lx < CHUNK_SIZE; lx += spacing) {
        const wx = chunkWorldX + lx
        const wz = chunkWorldZ + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Hell) continue
        if (rng.next() > 0.50) continue

        // Sparser at edges
        const hdx = wx - hc.x, hdz = wz - hc.z
        const hDist = Math.sqrt(hdx * hdx + hdz * hdz)
        if (hDist > 290 && rng.next() > 0.3) continue

        const g = new THREE.Group()
        g.position.set(lx, HELL_DEPTH, lz)

        // Obsidian slab
        const slabW = rng.range(6, 14)
        const slabD = rng.range(6, 14)
        const slab = new THREE.Mesh(new THREE.BoxGeometry(slabW, 1.5, slabD), obsidianMat)
        slab.position.set(0, 0, 0)
        g.add(slab)

        // Lava surface on top
        const lava = new THREE.Mesh(new THREE.BoxGeometry(slabW * 0.8, 0.3, slabD * 0.8), lavaMat)
        lava.position.set(0, 0.9, 0)
        g.add(lava)

        // Occasional obsidian spire
        if (rng.next() > 0.5) {
          const spireH = rng.range(4, 10)
          const spireW = rng.range(1.5, 3)
          const spire = new THREE.Mesh(new THREE.BoxGeometry(spireW, spireH, spireW), obsidianMat)
          spire.position.set(rng.range(-2, 2), spireH / 2 + 0.75, rng.range(-2, 2))
          g.add(spire)
        }

        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, slabW / 2, slabD / 2, HELL_DEPTH + 0.75)
      }
    }
  }

  // ── Hell spires (bone-colored arch bridges) ───────────────────────────

  private buildHellSpires(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const hc = biomeMap.getHellCenter()
    if (!hc) return

    const chunkWorldX = this.cx * CHUNK_SIZE
    const chunkWorldZ = this.cz * CHUNK_SIZE
    const ccx = chunkWorldX + CHUNK_SIZE / 2, ccz = chunkWorldZ + CHUNK_SIZE / 2
    const ddx = ccx - hc.x, ddz = ccz - hc.z
    if (ddx * ddx + ddz * ddz > 310 * 310) return

    const boneMat = this.matCache.getLambert(0xddccaa, { map: texGen.getTexture('darkStone', 0xddccaa).map })

    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 28) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 28) {
        if (rng.next() > 0.08) continue
        const wx = chunkWorldX + lx, wz = chunkWorldZ + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Hell) continue

        const axis = rng.next() > 0.5 ? 'x' : 'z'
        const span = rng.range(8, 14)
        const archH = rng.range(6, 10)
        const thick = rng.range(1.5, 2.5)

        const g = new THREE.Group(); g.position.set(lx, HELL_DEPTH + 1.5, lz)

        for (const side of [-span / 2, span / 2]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(thick, archH, thick), boneMat)
          axis === 'x' ? p.position.set(side, archH / 2, 0) : p.position.set(0, archH / 2, side)
          g.add(p)
        }

        const segs = 5
        for (let i = 0; i < segs; i++) {
          const t = (i + 0.5) / segs
          const angle = Math.PI * t
          const along = -span / 2 + span * t
          const ay = archH + Math.sin(angle) * archH * 0.4
          const segLen = span / segs + 0.2
          const aGeo = new THREE.BoxGeometry(
            axis === 'x' ? segLen : thick, thick, axis === 'z' ? segLen : thick
          )
          const block = new THREE.Mesh(aGeo, boneMat)
          axis === 'x' ? block.position.set(along, ay, 0) : block.position.set(0, ay, along)
          g.add(block)
        }

        this.group.add(g); this.extras.push(g)
        for (const side of [-span / 2, span / 2]) {
          const awx = axis === 'x' ? lx + side : lx
          const awz = axis === 'z' ? lz + side : lz
          this.addWalkable(awx, awz, thick / 2, thick / 2, HELL_DEPTH + 1.5 + archH)
        }
      }
    }
  }

  // ── Hell lava falls (from ceiling down to hell floor) ──────────────────

  private buildHellLavaFalls(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const hc = biomeMap.getHellCenter()
    if (!hc) return

    const chunkWorldX = this.cx * CHUNK_SIZE
    const chunkWorldZ = this.cz * CHUNK_SIZE
    const ccx = chunkWorldX + CHUNK_SIZE / 2, ccz = chunkWorldZ + CHUNK_SIZE / 2
    const ddx = ccx - hc.x, ddz = ccz - hc.z
    if (ddx * ddx + ddz * ddz > 320 * 320) return

    let count = 0
    const maxPerChunk = 3

    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 16) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 16) {
        if (count >= maxPerChunk) return
        const wx = chunkWorldX + lx, wz = chunkWorldZ + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Hell) continue
        if (rng.next() > 0.12) continue

        const fallTop = -10  // ceiling level
        const fallBot = HELL_DEPTH + 2  // just above floor
        const fallHeight = fallTop - fallBot
        if (fallHeight < 20) continue

        const fallWidth = rng.range(2, 4)
        const geo = new THREE.PlaneGeometry(fallWidth, fallHeight, 1, 8)

        const posAttr = geo.attributes.position
        for (let i = 0; i < posAttr.count; i++) {
          const px = posAttr.getX(i)
          const py = posAttr.getY(i)
          posAttr.setX(i, px + Math.sin(py * 0.3 + i * 0.7) * 0.3)
        }
        posAttr.needsUpdate = true

        const mat = new THREE.MeshBasicMaterial({
          color: 0xff3300,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          depthWrite: false,
        })

        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(lx, fallBot + fallHeight / 2, lz)
        mesh.rotation.y = rng.next() > 0.5 ? 0 : Math.PI / 2
        this.group.add(mesh)
        this.extras.push(mesh)
        count++
      }
    }
  }

  // ── Merge static structures into fewer draw calls ─────────────────────────

  private mergeStructures() {
    if (this.extras.length === 0) return

    // Build set of explodable groups (these must stay separate for animation)
    const explodableSet = new Set<THREE.Object3D>(this.explodables.map(e => e.group))

    // Force matrix updates
    this.group.updateMatrixWorld(true)
    const chunkInverse = new THREE.Matrix4().copy(this.group.matrixWorld).invert()
    const relMatrix = new THREE.Matrix4()

    // Bucket geometries by material reference
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
    const keptExtras: THREE.Object3D[] = []
    const removedExtras: THREE.Object3D[] = []

    for (const obj of this.extras) {
      if (explodableSet.has(obj)) {
        keptExtras.push(obj)
        continue
      }

      let hasMeshes = false
      obj.traverse(child => {
        if (!(child instanceof THREE.Mesh)) return
        hasMeshes = true
        child.updateMatrixWorld(true)
        relMatrix.multiplyMatrices(chunkInverse, child.matrixWorld)
        const geoClone = child.geometry.clone()
        geoClone.applyMatrix4(relMatrix)

        const mat = child.material as THREE.Material
        let bucket = buckets.get(mat)
        if (!bucket) { bucket = []; buckets.set(mat, bucket) }
        bucket.push(geoClone)
      })

      if (hasMeshes) {
        removedExtras.push(obj)
      } else {
        keptExtras.push(obj)
      }
    }

    // Merge each bucket and create a single mesh
    for (const [mat, geos] of buckets) {
      if (geos.length === 0) continue
      const merged = mergeGeometries(geos, false)
      if (merged) {
        const mesh = new THREE.Mesh(merged, mat)
        this.group.add(mesh)
        this.mergedMeshes.push(mesh)
      }
      // Dispose temporary cloned geometries
      for (const g of geos) g.dispose()
    }

    // Remove original structure groups from scene (geometries were cloned so dispose originals)
    for (const obj of removedExtras) {
      this.group.remove(obj)
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      })
    }

    this.extras = keptExtras
  }

  // ── Sprites ───────────────────────────────────────────────────────────────

  private placeSprites(rng: SeededRandom, biomeMap: BiomeMap, atlas: SpriteAtlas, lightPool: PointLightPool) {
    const worldX = this.cx * CHUNK_SIZE
    const worldZ = this.cz * CHUNK_SIZE
    const { gridStep, spawnDensity, positionJitter, globalScaleMultiplier, heightOffset } = SPRITE_CONFIG
    const cols = Math.floor(CHUNK_SIZE / gridStep)
    const rows = Math.floor(CHUNK_SIZE / gridStep)

    // Collect sprites by texture key for batching (Phase 2)
    const billboardGroups = new Map<THREE.CanvasTexture, { x: number; y: number; z: number; scale: number }[]>()
    const decalGroups = new Map<THREE.CanvasTexture, { x: number; y: number; z: number; scale: number }[]>()

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
        const seed = Math.abs(Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453) % 10000
        const entry   = { x: lx, y: height + heightOffset, z: lz, scale, seed }

        if (chosen.isBillboard) {
          let arr = billboardGroups.get(tex)
          if (!arr) { arr = []; billboardGroups.set(tex, arr) }
          arr.push(entry)
        } else {
          let arr = decalGroups.get(tex)
          if (!arr) { arr = []; decalGroups.set(tex, arr) }
          arr.push(entry)
        }

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

    // Create instanced batches
    for (const [tex, sprites] of billboardGroups) {
      const batch = new BillboardBatch(tex, sprites, true)
      this.group.add(batch.mesh)
      this.billboardBatches.push(batch)
    }
    for (const [tex, sprites] of decalGroups) {
      const batch = new BillboardBatch(tex, sprites, false)
      this.group.add(batch.mesh)
      this.decalBatches.push(batch)
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

  update(delta: number, cameraX?: number, cameraZ?: number) {
    this.time += delta
    // Update animated water shader
    if (this.waterMaterial) {
      this.waterMaterial.uniforms.time.value = this.time
    }

    // Per-category distance culling for sprites and particles
    if (cameraX !== undefined && cameraZ !== undefined) {
      const chunkWorldX = this.cx * CHUNK_SIZE + CHUNK_SIZE * 0.5
      const chunkWorldZ = this.cz * CHUNK_SIZE + CHUNK_SIZE * 0.5
      const dx = cameraX - chunkWorldX
      const dz = cameraZ - chunkWorldZ
      const distSq = dx * dx + dz * dz

      const spriteVis = distSq < RENDER_CONFIG.drawSprites ** 2
      for (const batch of this.billboardBatches) batch.mesh.visible = spriteVis
      for (const batch of this.decalBatches) batch.mesh.visible = spriteVis

      const particleVis = distSq < RENDER_CONFIG.drawParticles ** 2
      for (const ps of this.particleSystems) ps.points.visible = particleVis
    }

    for (const ps of this.particleSystems) ps.update(delta, this.time)
    for (const ex of this.explodables) ex.update(delta, this.rngForExplode)

    // Tick lava rock sinking animation
    if (this.lavaRocks.length > 0 && cameraX !== undefined && cameraZ !== undefined) {
      const playerLX = cameraX - this.cx * CHUNK_SIZE
      const playerLZ = cameraZ - this.cz * CHUNK_SIZE
      updateLavaRocks(this.lavaRocks, delta, playerLX, playerLZ)
    }

    // Billboard batches face camera (Phase 2)
    if (cameraX !== undefined && cameraZ !== undefined && this.billboardBatches.length > 0) {
      // Convert camera world pos to chunk-local
      const localCamX = cameraX - this.cx * CHUNK_SIZE
      const localCamZ = cameraZ - this.cz * CHUNK_SIZE
      const chunkCenterX = CHUNK_SIZE * 0.5
      const chunkCenterZ = CHUNK_SIZE * 0.5

      // Skip billboard updates for distant chunks (they barely rotate)
      const dxC = localCamX - chunkCenterX
      const dzC = localCamZ - chunkCenterZ
      if (dxC * dxC + dzC * dzC < (CHUNK_SIZE * 3) * (CHUNK_SIZE * 3)) {
        for (const batch of this.billboardBatches) {
          batch.updateBillboard(localCamX, localCamZ, chunkCenterX, chunkCenterZ)
        }
      }
    }
  }

  // ── Alpine: Snow-capped boulder clusters ─────────────────────────────────
  private buildAlpineRocks(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const spacing = 18
    const rockMat = this.matCache.getLambert(0x778899, { map: texGen.getTexture('slate', 0x778899).map })
    const snowMat = this.matCache.getLambert(0xe8e8f0, { map: texGen.getTexture('ice', 0xe8e8f0).map })
    for (let lz = spacing / 2; lz < CHUNK_SIZE; lz += spacing) {
      for (let lx = spacing / 2; lx < CHUNK_SIZE; lx += spacing) {
        if (rng.next() > 0.35) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Snow) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const bw = rng.range(2, 5), bh = rng.range(4, 14)
        const rock = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bw * rng.range(0.7, 1.3)), rockMat)
        rock.position.set(0, bh / 2, 0); rock.rotation.y = rng.range(0, Math.PI * 2); g.add(rock)
        const snow = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.1, 1, bw * 1.1), snowMat)
        snow.position.set(0, bh + 0.5, 0); g.add(snow)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, bw * 0.5, bw * 0.5, h + bh + 1)
      }
    }
  }

  private buildAlpineCabins(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const woodMat = this.matCache.getLambert(0x5a3a18, { map: texGen.getTexture('wood', 0x5a3a18).map })
    const roofMat = this.matCache.getLambert(0x444444, { map: texGen.getTexture('slate', 0x444444).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 32) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 32) {
        if (rng.next() > 0.08) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Snow) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const cabin = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 6), woodMat)
        cabin.position.set(0, 2.5, 0); g.add(cabin)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(9, 2, 7), roofMat)
        roof.position.set(0, 6, 0); g.add(roof)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, 4, 3, h + 5)
      }
    }
  }

  private buildCliffLedges(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const slateMat = this.matCache.getLambert(0x667788, { map: texGen.getTexture('slate', 0x667788).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 16) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 16) {
        if (rng.next() > 0.30) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Snow) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const ledgeW = rng.range(5, 12), ledgeD = rng.range(3, 7)
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(ledgeW, 1.5, ledgeD), slateMat)
        const offsetY = rng.range(2, 8)
        ledge.position.set(0, offsetY, 0); g.add(ledge)
        const support = new THREE.Mesh(new THREE.BoxGeometry(2, offsetY, 2), slateMat)
        support.position.set(0, offsetY / 2, -ledgeD / 2 + 1); g.add(support)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, ledgeW / 2, ledgeD / 2, h + offsetY + 0.75)
      }
    }
  }

  private buildCliffNests(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const woodMat = this.matCache.getLambert(0x5a4020, { map: texGen.getTexture('wood', 0x5a4020).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 30) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 30) {
        if (rng.next() > 0.06) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Snow) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 2) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const nestR = rng.range(3, 6)
        const nest = new THREE.Mesh(new THREE.BoxGeometry(nestR * 2, 1.5, nestR * 2), woodMat)
        nest.position.set(0, 0.75, 0); g.add(nest)
        for (let a = 0; a < 8; a++) {
          const angle = a * Math.PI / 4
          const stick = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), woodMat)
          stick.position.set(Math.cos(angle) * nestR, 2.25, Math.sin(angle) * nestR); g.add(stick)
        }
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, nestR, nestR, h + 1.5)
      }
    }
  }

  private buildFloatingRocks(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const rockMat = this.matCache.getLambert(0x889988, { map: texGen.getTexture('stone', 0x889988).map })
    const mossMat = this.matCache.getLambert(0x446644, { map: texGen.getTexture('moss', 0x446644).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 18) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 18) {
        if (rng.next() > 0.25) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Heaven) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        const floatY = h + rng.range(10, 35)
        const g = new THREE.Group(); g.position.set(lx, floatY, lz)
        const rw = rng.range(4, 10), rh = rng.range(3, 8), rd = rng.range(4, 10)
        const rock = new THREE.Mesh(new THREE.BoxGeometry(rw, rh, rd), rockMat)
        rock.position.set(0, 0, 0); g.add(rock)
        const top = new THREE.Mesh(new THREE.BoxGeometry(rw * 0.9, 0.5, rd * 0.9), mossMat)
        top.position.set(0, rh / 2 + 0.25, 0); g.add(top)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, rw / 2, rd / 2, floatY + rh / 2 + 0.5)
      }
    }
  }

  private buildSkyBridges(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const stoneMat = this.matCache.getLambert(0x778877, { map: texGen.getTexture('stone', 0x778877).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 28) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 28) {
        if (rng.next() > 0.06) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Heaven) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        const bridgeY = h + rng.range(12, 25)
        const g = new THREE.Group(); g.position.set(lx, bridgeY, lz)
        const span = rng.range(12, 22)
        const bridge = new THREE.Mesh(new THREE.BoxGeometry(span, 1, 3), stoneMat)
        bridge.position.set(0, 0, 0); g.add(bridge)
        for (const side of [-span / 2, span / 2]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2), stoneMat)
          pillar.position.set(side, -3, 0); g.add(pillar)
        }
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, span / 2, 1.5, bridgeY + 0.5)
      }
    }
  }

  private buildJungleCanopy(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const woodMat = this.matCache.getLambert(0x3a2810, { map: texGen.getTexture('wood', 0x3a2810).map })
    const leafMat = this.matCache.getLambert(0x226622, { map: texGen.getTexture('vine', 0x226622).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 16) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 16) {
        if (rng.next() > 0.20) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Jungle) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const trunkH = rng.range(8, 18)
        const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.5, trunkH, 1.5), woodMat)
        trunk.position.set(0, trunkH / 2, 0); g.add(trunk)
        const platW = rng.range(5, 10)
        const plat = new THREE.Mesh(new THREE.BoxGeometry(platW, 0.8, platW), woodMat)
        plat.position.set(0, trunkH, 0); g.add(plat)
        const canopy = new THREE.Mesh(new THREE.BoxGeometry(platW * 1.5, 3, platW * 1.5), leafMat)
        canopy.position.set(0, trunkH + 2.5, 0); g.add(canopy)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, platW / 2, platW / 2, h + trunkH + 0.4)
      }
    }
  }

  private buildJungleRuins(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const stoneMat = this.matCache.getLambert(0x3a3a2a, { map: texGen.getTexture('moss', 0x3a3a2a).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 30) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 30) {
        if (rng.next() > 0.08) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Jungle) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        for (let i = 0; i < 3; i++) {
          const wh = rng.range(3, 8), ww = rng.range(4, 10)
          const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, wh, 1.5), stoneMat)
          wall.position.set(rng.range(-5, 5), wh / 2, rng.range(-5, 5))
          wall.rotation.y = rng.range(0, Math.PI * 2); g.add(wall)
        }
        const slab = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), stoneMat)
        slab.position.set(0, 0.5, 0); g.add(slab)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, 5, 5, h + 1)
      }
    }
  }

  private buildMesaPillars(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const sandMat = this.matCache.getLambert(0xb86840, { map: texGen.getTexture('sandstone', 0xb86840).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 16) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 16) {
        if (rng.next() > 0.28) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Mesa) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const pw = rng.range(2, 5), ph = rng.range(8, 25)
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pw * rng.range(0.8, 1.2)), sandMat)
        pillar.position.set(0, ph / 2, 0); g.add(pillar)
        const cap = new THREE.Mesh(new THREE.BoxGeometry(pw * 1.5, 1.5, pw * 1.5), sandMat)
        cap.position.set(0, ph + 0.75, 0); g.add(cap)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, pw * 0.75, pw * 0.75, h + ph + 1.5)
      }
    }
  }

  private buildMesaDwellings(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const adobeMat = this.matCache.getLambert(0xb86840, { map: texGen.getTexture('adobe', 0xb86840).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 30) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 30) {
        if (rng.next() > 0.07) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Mesa) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const bw = rng.range(6, 10), bh = rng.range(4, 7), bd = rng.range(5, 8)
        const dwelling = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), adobeMat)
        dwelling.position.set(0, bh / 2, 0); g.add(dwelling)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(bw + 1, 0.8, bd + 1), adobeMat)
        roof.position.set(0, bh + 0.4, 0); g.add(roof)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, bw / 2, bd / 2, h + bh + 0.8)
      }
    }
  }

  private buildCoralFormations(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const colors = [0xff6688, 0xff9944, 0xaa44cc, 0x44ccaa, 0xff88bb]
    for (let lz = 8; lz < CHUNK_SIZE - 8; lz += 14) {
      for (let lx = 8; lx < CHUNK_SIZE - 8; lx += 14) {
        if (rng.next() > 0.40) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.CoralReef) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const count = rng.int(2, 5)
        for (let i = 0; i < count; i++) {
          const col = colors[rng.int(0, colors.length - 1)]
          const mat = this.matCache.getLambert(col, { map: texGen.getTexture('coral', col).map })
          const cw = rng.range(1, 3), ch = rng.range(2, 6)
          const coral = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cw), mat)
          const cx2 = rng.range(-3, 3), cz2 = rng.range(-3, 3)
          coral.position.set(cx2, ch / 2, cz2); g.add(coral)
        }
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, 3.5, 3.5, h + 3)
      }
    }
  }

  private buildReefCaves(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const coralMat = this.matCache.getLambert(0xff6688, { map: texGen.getTexture('coral', 0xff6688).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 28) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 28) {
        if (rng.next() > 0.06) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.CoralReef) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const span = rng.range(8, 14), archH = rng.range(4, 8)
        for (const side of [-span / 2, span / 2]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(2, archH, 2), coralMat)
          p.position.set(side, archH / 2, 0); g.add(p)
        }
        const archTop = new THREE.Mesh(new THREE.BoxGeometry(span + 2, 2, 3), coralMat)
        archTop.position.set(0, archH + 1, 0); g.add(archTop)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, span / 2, 1.5, h + archH + 2)
      }
    }
  }

  private buildBogMounds(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const mossMat = this.matCache.getLambert(0x334422, { map: texGen.getTexture('moss', 0x334422).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 16) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 16) {
        if (rng.next() > 0.30) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Swamp) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const mw = rng.range(4, 8), mh = rng.range(2, 5)
        const mound = new THREE.Mesh(new THREE.BoxGeometry(mw, mh, mw * rng.range(0.8, 1.2)), mossMat)
        mound.position.set(0, mh / 2, 0); g.add(mound)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, mw / 2, mw / 2, h + mh)
      }
    }
  }

  private buildBogBridges(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const woodMat = this.matCache.getLambert(0x3a2810, { map: texGen.getTexture('wood', 0x3a2810).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 30) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 30) {
        if (rng.next() > 0.08) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Swamp) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        const g = new THREE.Group(); g.position.set(lx, h + 0.5, lz)
        const bridgeLen = rng.range(10, 20)
        const deck = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, bridgeLen), woodMat)
        deck.position.set(0, 0, 0); g.add(deck)
        for (let i = 0; i < 3; i++) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2, 0.4), woodMat)
          post.position.set(0, -1, -bridgeLen / 2 + i * bridgeLen / 2); g.add(post)
        }
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, 1.5, bridgeLen / 2, h + 0.65)
      }
    }
  }

  private buildBadlandsHoodoos(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const sandMat = this.matCache.getLambert(0xaa6633, { map: texGen.getTexture('sandstone', 0xaa6633).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 14) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 14) {
        if (rng.next() > 0.32) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Mesa) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const pw = rng.range(1.5, 3), ph = rng.range(8, 22)
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pw), sandMat)
        pillar.position.set(0, ph / 2, 0)
        pillar.rotation.set(rng.range(-0.05, 0.05), 0, rng.range(-0.05, 0.05)); g.add(pillar)
        const cap = new THREE.Mesh(new THREE.BoxGeometry(pw * 2, 2, pw * 2), sandMat)
        cap.position.set(0, ph + 1, 0); g.add(cap)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, pw, pw, h + ph + 2)
      }
    }
  }

  private buildBadlandsArches(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const sandMat = this.matCache.getLambert(0x884422, { map: texGen.getTexture('sandstone', 0x884422).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 30) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 30) {
        if (rng.next() > 0.06) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Mesa) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const span = rng.range(10, 18), archH = rng.range(6, 12)
        for (const side of [-span / 2, span / 2]) {
          const p = new THREE.Mesh(new THREE.BoxGeometry(3, archH, 3), sandMat)
          p.position.set(side, archH / 2, 0); g.add(p)
        }
        const segs = 5
        for (let i = 0; i < segs; i++) {
          const t = (i + 0.5) / segs
          const angle = Math.PI * t
          const along = -span / 2 + span * t
          const ay = archH + Math.sin(angle) * archH * 0.3
          const seg = new THREE.Mesh(new THREE.BoxGeometry(span / segs + 0.3, 2.5, 3), sandMat)
          seg.position.set(along, ay, 0); g.add(seg)
        }
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, span / 2, 1.5, h + archH + archH * 0.3 + 1.25)
      }
    }
  }

  private buildTaigaLogs(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const woodMat = this.matCache.getLambert(0x4a3018, { map: texGen.getTexture('wood', 0x4a3018).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 16) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 16) {
        if (rng.next() > 0.22) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Snow) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const logLen = rng.range(6, 16), logR = rng.range(0.5, 1.5)
        const log = new THREE.Mesh(new THREE.BoxGeometry(logR * 2, logR * 2, logLen), woodMat)
        log.position.set(0, logR, 0)
        log.rotation.y = rng.range(0, Math.PI * 2); g.add(log)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, logR, logLen / 2, h + logR * 2)
      }
    }
  }

  private buildTaigaCamps(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const woodMat = this.matCache.getLambert(0x5a3a18, { map: texGen.getTexture('wood', 0x5a3a18).map })
    const clothMat = this.matCache.getLambert(0x887766)
    const stoneMat = this.matCache.getLambert(0x555555, { map: texGen.getTexture('stone', 0x555555).map })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 32) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 32) {
        if (rng.next() > 0.06) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Snow) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const tentW = 5, tentH = 4
        const tentL = new THREE.Mesh(new THREE.BoxGeometry(tentW / 2, 0.3, 6), clothMat)
        tentL.position.set(-tentW / 4, tentH / 2, 0); tentL.rotation.z = 0.5; g.add(tentL)
        const tentR = new THREE.Mesh(new THREE.BoxGeometry(tentW / 2, 0.3, 6), clothMat)
        tentR.position.set(tentW / 4, tentH / 2, 0); tentR.rotation.z = -0.5; g.add(tentR)
        const ring = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2), stoneMat)
        ring.position.set(5, 0.25, 0); g.add(ring)
        const log1 = new THREE.Mesh(new THREE.BoxGeometry(3, 0.6, 0.6), woodMat)
        log1.position.set(5, 0.3, 2.5); g.add(log1)
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, 6, 4, h + 0.5)
      }
    }
  }

  private buildOasisPalms(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const trunkMat = this.matCache.getLambert(0x8a6830, { map: texGen.getTexture('wood', 0x8a6830).map })
    const leafMat = this.matCache.getLambert(0x338822, { map: texGen.getTexture('vine', 0x338822).map })
    for (let lz = 10; lz < CHUNK_SIZE - 10; lz += 14) {
      for (let lx = 10; lx < CHUNK_SIZE - 10; lx += 14) {
        if (rng.next() > 0.25) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Desert) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        const count = rng.int(2, 4)
        for (let i = 0; i < count; i++) {
          const th = rng.range(6, 14)
          const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.8, th, 0.8), trunkMat)
          const ox = rng.range(-3, 3), oz = rng.range(-3, 3)
          trunk.position.set(ox, th / 2, oz); g.add(trunk)
          const canopy = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 4), leafMat)
          canopy.position.set(ox, th + 0.75, oz); g.add(canopy)
        }
        this.group.add(g); this.extras.push(g)
      }
    }
  }

  private buildOasisWells(rng: SeededRandom, biomeMap: BiomeMap) {
    if (!this.heightGrid) return
    const stoneMat2 = this.matCache.getLambert(0xc8a060, { map: texGen.getTexture('sandstone', 0xc8a060).map })
    const waterMat = this.matCache.getLambert(0x4488aa, { transparent: true, opacity: 0.7 })
    for (let lz = 16; lz < CHUNK_SIZE - 16; lz += 32) {
      for (let lx = 16; lx < CHUNK_SIZE - 16; lx += 32) {
        if (rng.next() > 0.06) continue
        const wx = this.cx * CHUNK_SIZE + lx, wz = this.cz * CHUNK_SIZE + lz
        if (biomeMap.getBiomeAt(wx, wz) !== BiomeType.Desert) continue
        const h = sampleHeight(this.heightGrid, lx, lz)
        if (h < WATER_LEVEL + 1) continue
        const g = new THREE.Group(); g.position.set(lx, h, lz)
        for (const [dx, dz, w, d] of [[0, -2, 4, 0.5], [0, 2, 4, 0.5], [-2, 0, 0.5, 4], [2, 0, 0.5, 4]] as [number,number,number,number][]) {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), stoneMat2)
          wall.position.set(dx, 1, dz); g.add(wall)
        }
        const water = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 3.5), waterMat)
        water.position.set(0, 0.5, 0); g.add(water)
        const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.5, 5), stoneMat2)
        roof.position.set(0, 5.25, 0); g.add(roof)
        for (const [sx, sz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]] as [number,number][]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), stoneMat2)
          post.position.set(sx, 3, sz); g.add(post)
        }
        this.group.add(g); this.extras.push(g)
        this.addWalkable(lx, lz, 2.5, 2.5, h + 2)
      }
    }
  }

  dispose(scene: THREE.Scene, lightPool: PointLightPool) {
    scene.remove(this.group)
    if (this.terrainMesh) {
      this.terrainMesh.geometry.dispose()
      ;(this.terrainMesh.material as THREE.Material).dispose()
    }
    // Dispose remaining structure extras (geometry only — materials are cached)
    for (const obj of this.extras) {
      obj.traverse(child => {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
      })
    }
    // Dispose merged structure meshes (geometry only — materials are cached)
    for (const mesh of this.mergedMeshes) mesh.geometry.dispose()
    // Dispose billboard batches (Phase 2)
    for (const batch of this.billboardBatches) batch.dispose()
    for (const batch of this.decalBatches) batch.dispose()
    for (const ps of this.particleSystems) ps.dispose()
    for (const light of this.pointLights) lightPool.release(light)
    this.billboardBatches = []; this.decalBatches = []
    this.extras = []; this.mergedMeshes = []
    this.particleSystems = []; this.pointLights = []
    this.walkableSurfaces = []; this.explodables = []
    this.heightGrid = null
  }
}
