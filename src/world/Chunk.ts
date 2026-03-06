import * as THREE from 'three'
import { generateHeightmap, sampleHeight, CHUNK_SIZE, CHUNK_SEGMENTS } from './TerrainGenerator'
import { BiomeMap } from './BiomeMap'
import { getBiome } from '../biomes/BiomeRegistry'
import { BiomeType, SpriteCategory } from '../biomes/types'
import { SpriteAtlas, VARIANTS } from '../sprites/SpriteAtlas'
import { createBillboard, createGroundDecal } from '../sprites/BillboardSprite'
import { ParticleSystem } from '../sprites/ParticleSystem'
import { PointLightPool } from '../lighting/PointLightPool'
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'

export class Chunk {
  public cx: number
  public cz: number
  public group: THREE.Group
  public heightGrid: Float32Array | null = null

  private terrainMesh: THREE.Mesh | null = null
  private sprites: THREE.Object3D[] = []
  private particleSystems: ParticleSystem[] = []
  private pointLights: THREE.PointLight[] = []
  private time = 0

  constructor(
    cx: number,
    cz: number,
    scene: THREE.Scene,
    biomeMap: BiomeMap,
    atlas: SpriteAtlas,
    lightPool: PointLightPool
  ) {
    this.cx = cx
    this.cz = cz
    this.group = new THREE.Group()
    this.group.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE)
    scene.add(this.group)

    this.build(biomeMap, atlas, lightPool)
  }

  private build(biomeMap: BiomeMap, atlas: SpriteAtlas, lightPool: PointLightPool) {
    const { positions, normals, colors, indices, heightGrid } = generateHeightmap(
      this.cx, this.cz, biomeMap
    )
    this.heightGrid = heightGrid

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('normal',   new THREE.BufferAttribute(normals, 3))
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3))
    geo.setIndex(new THREE.BufferAttribute(indices, 1))

    // PS1 vertex snapping via custom ShaderMaterial
    const mat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      fog: true,
    })

    this.terrainMesh = new THREE.Mesh(geo, mat)
    this.terrainMesh.receiveShadow = false
    this.group.add(this.terrainMesh)

    this.placeSprites(biomeMap, atlas, lightPool)
  }

  private placeSprites(biomeMap: BiomeMap, atlas: SpriteAtlas, lightPool: PointLightPool) {
    const rng = new SeededRandom(chunkSeed(this.cx, this.cz))
    const worldX = this.cx * CHUNK_SIZE
    const worldZ = this.cz * CHUNK_SIZE

    // Poisson-disk-ish placement: simple grid jitter
    const gridStep = 6
    const cols = Math.floor(CHUNK_SIZE / gridStep)
    const rows = Math.floor(CHUNK_SIZE / gridStep)

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rng.next() > 0.45) continue  // ~45% density

        const lx = c * gridStep + rng.range(0, gridStep * 0.9)
        const lz = r * gridStep + rng.range(0, gridStep * 0.9)
        const wx = worldX + lx
        const wz = worldZ + lz

        const biome = biomeMap.getBiomeAt(wx, wz)
        const config = getBiome(biome)

        // Weighted random sprite type
        const totalWeight = config.spriteTypes.reduce((s, t) => s + t.weight, 0)
        let roll = rng.range(0, totalWeight)
        let chosen = config.spriteTypes[0]
        for (const st of config.spriteTypes) {
          roll -= st.weight
          if (roll <= 0) { chosen = st; break }
        }

        const height = this.heightGrid
          ? sampleHeight(this.heightGrid, lx, lz)
          : 0

        const scale = rng.range(chosen.minScale, chosen.maxScale)
        const variant = rng.int(0, VARIANTS - 1)
        const tex = atlas.getTexture(biome, chosen.category as SpriteCategory, variant)
        const pos = new THREE.Vector3(lx, height, lz)

        let obj: THREE.Object3D
        if (chosen.isBillboard) {
          obj = createBillboard(tex, scale, pos)
        } else {
          obj = createGroundDecal(tex, scale, pos)
        }

        this.group.add(obj)
        this.sprites.push(obj)

        // Point light near lava/fire structures in volcanic biome
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

    // Particle system for the chunk center
    const config = getBiome(biomeMap.getBiomeAt(
      worldX + CHUNK_SIZE/2,
      worldZ + CHUNK_SIZE/2
    ))
    if (config.particleType) {
      const centerHeight = this.heightGrid
        ? sampleHeight(this.heightGrid, CHUNK_SIZE/2, CHUNK_SIZE/2)
        : 0
      const ps = new ParticleSystem(
        config.particleType,
        config.particleCount,
        config.particleColor,
        new THREE.Vector3(worldX + CHUNK_SIZE/2, centerHeight, worldZ + CHUNK_SIZE/2),
        CHUNK_SIZE * 0.6,
        new SeededRandom(chunkSeed(this.cx, this.cz, 1))
      )
      // Particles are in world space, add directly to scene root offset
      ps.points.position.set(-this.group.position.x, 0, -this.group.position.z)
      // Actually add to group but subtract chunk offset so they stay in world space
      ps.points.position.set(CHUNK_SIZE/2, 0, CHUNK_SIZE/2)
      this.group.add(ps.points)
      this.particleSystems.push(ps)
    }
  }

  getHeightAt(lx: number, lz: number): number {
    if (!this.heightGrid) return 0
    return sampleHeight(this.heightGrid, lx, lz)
  }

  update(delta: number) {
    this.time += delta
    for (const ps of this.particleSystems) {
      ps.update(delta, this.time)
    }
  }

  dispose(scene: THREE.Scene, lightPool: PointLightPool) {
    scene.remove(this.group)
    if (this.terrainMesh) {
      this.terrainMesh.geometry.dispose()
      ;(this.terrainMesh.material as THREE.Material).dispose()
    }
    for (const obj of this.sprites) {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
      }
    }
    for (const ps of this.particleSystems) ps.dispose()
    for (const light of this.pointLights) lightPool.release(light)
    this.sprites = []
    this.particleSystems = []
    this.pointLights = []
    this.heightGrid = null
  }
}
