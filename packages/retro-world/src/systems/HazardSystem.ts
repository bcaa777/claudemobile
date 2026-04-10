import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { PlayerState } from '../player/PlayerState'
import { WATER_LEVEL } from '../world/TerrainGenerator'
import { WorldState } from './WorldState'

// ---------------------------------------------------------------------------
// Seeded deterministic pseudo-random (simple mulberry32 / LCG)
// ---------------------------------------------------------------------------
function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

// ---------------------------------------------------------------------------
// Pattern generators — return a list of {position, radius} points for a
// given site position and seed.  All positions are in world-space XZ; Y is
// left at the site's Y so callers can offset if needed.
// ---------------------------------------------------------------------------

/** Toxic gas in Swamp: 3-4 lines of vents radiating toward the Swamp resonance site */
function generateSwampGasVents(
  sitePos: THREE.Vector3,
  seed: number,
): Array<{ position: THREE.Vector3; radius: number }> {
  const rand = seededRandom(seed)
  const points: Array<{ position: THREE.Vector3; radius: number }> = []
  const lineCount = 3 + Math.floor(rand() * 2) // 3 or 4 lines
  const spacing = 15
  const stepsPerLine = 4

  for (let l = 0; l < lineCount; l++) {
    // Each line starts at a random angle from the site and radiates outward
    const angle = rand() * Math.PI * 2
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)

    for (let s = 1; s <= stepsPerLine; s++) {
      const dist = spacing * s
      points.push({
        position: new THREE.Vector3(
          sitePos.x + dx * dist,
          sitePos.y,
          sitePos.z + dz * dist,
        ),
        radius: 6 + rand() * 4,
      })
    }
  }

  return points
}

/** Lava in Volcanic: lines of lava damage zones converging on ObsidianCitadel */
function generateVolcanicLavaPaths(
  sitePos: THREE.Vector3,
  seed: number,
): Array<{ position: THREE.Vector3; radius: number }> {
  const rand = seededRandom(seed)
  const points: Array<{ position: THREE.Vector3; radius: number }> = []
  const pathCount = 3 + Math.floor(rand() * 2) // 3 or 4 paths
  const spacing = 18
  const stepsPerPath = 4

  for (let p = 0; p < pathCount; p++) {
    const angle = rand() * Math.PI * 2
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)

    for (let s = 1; s <= stepsPerPath; s++) {
      const dist = spacing * s
      points.push({
        position: new THREE.Vector3(
          sitePos.x + dx * dist,
          sitePos.y,
          sitePos.z + dz * dist,
        ),
        radius: 8 + rand() * 5,
      })
    }
  }

  return points
}

/** Crystal shards in Crystal: lines radiating from CrystalCathedral (communication network) */
function generateCrystalShardLines(
  sitePos: THREE.Vector3,
  seed: number,
): Array<{ position: THREE.Vector3; radius: number }> {
  const rand = seededRandom(seed)
  const points: Array<{ position: THREE.Vector3; radius: number }> = []
  // More lines — 5-6 to suggest a radial network
  const lineCount = 5 + Math.floor(rand() * 2)
  const spacing = 12
  const stepsPerLine = 5

  for (let l = 0; l < lineCount; l++) {
    const angle = (l / lineCount) * Math.PI * 2 + rand() * 0.3 // evenly spaced + slight jitter
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)

    for (let s = 1; s <= stepsPerLine; s++) {
      const dist = spacing * s
      points.push({
        position: new THREE.Vector3(
          sitePos.x + dx * dist,
          sitePos.y,
          sitePos.z + dz * dist,
        ),
        radius: 4 + rand() * 3,
      })
    }
  }

  return points
}

/** Ice patches in Snow: clusters near IcePalace, denser closer to the site */
function generateIcePatches(
  sitePos: THREE.Vector3,
  seed: number,
): Array<{ position: THREE.Vector3; radius: number }> {
  const rand = seededRandom(seed)
  const points: Array<{ position: THREE.Vector3; radius: number }> = []
  // Three concentric rings — inner (dense), mid, outer
  const rings = [
    { count: 5, maxDist: 20, radiusMin: 6, radiusMax: 10 },
    { count: 7, maxDist: 45, radiusMin: 4, radiusMax: 8 },
    { count: 9, maxDist: 80, radiusMin: 3, radiusMax: 6 },
  ]

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = rand() * Math.PI * 2
      const dist = ring.maxDist * (0.4 + rand() * 0.6)
      points.push({
        position: new THREE.Vector3(
          sitePos.x + Math.cos(angle) * dist,
          sitePos.y,
          sitePos.z + Math.sin(angle) * dist,
        ),
        radius: ring.radiusMin + rand() * (ring.radiusMax - ring.radiusMin),
      })
    }
  }

  return points
}

// ---------------------------------------------------------------------------
// Seed derivation from a site position (deterministic, position-based)
// ---------------------------------------------------------------------------
function sitePositionSeed(pos: THREE.Vector3): number {
  // Combine x/z into a 32-bit integer seed
  const ix = Math.floor(pos.x) & 0xffff
  const iz = Math.floor(pos.z) & 0xffff
  return (ix << 16) | iz
}

// ---------------------------------------------------------------------------
// HazardSystem
// ---------------------------------------------------------------------------

export class HazardSystem {
  private damageCooldown = 0

  /** Whether hazard zone patterns have been registered for this WorldState instance */
  private patternsRegistered = false

  update(
    delta: number,
    playerX: number, playerY: number, playerZ: number,
    biome: BiomeType,
    dayFactor: number,
    playerState: PlayerState,
    time: number,
    terrainHeight: number | null,
    worldState?: WorldState,
  ) {
    this.damageCooldown = Math.max(0, this.damageCooldown - delta)

    const canDamage = this.damageCooldown <= 0

    // Lava pools — Volcanic/Hell biomes, player near lava surface
    if ((biome === BiomeType.Volcanic || biome === BiomeType.Hell) && playerY < WATER_LEVEL + 0.5) {
      if (canDamage) {
        playerState.takeDamage(8 * delta * 2, time) // 8 dmg/s applied via delta
        this.damageCooldown = 0.1
      }
    }

    // Quicksand — Desert, low altitude near terrain (absorbed: Bog → Swamp handled via toxic gas)
    if (biome === BiomeType.Desert && terrainHeight !== null) {
      const aboveTerrain = playerY - 1.8 - terrainHeight // approximate feet position
      if (aboveTerrain < 1.0 && terrainHeight < WATER_LEVEL + 2) {
        playerState.speedMultiplier *= 0.3
      }
    }

    // Ice patches — Snow (absorbed: Alpine, Tundra → Snow)
    // (Friction is handled by checking getIceFriction() in the controller)

    // Toxic gas — Swamp, low areas (absorbed: Bog → Swamp)
    if (biome === BiomeType.Swamp && playerY < WATER_LEVEL + 3.5) {
      if (canDamage) {
        playerState.takeDamage(3 * delta * 2, time)
        this.damageCooldown = 0.1
      }
    }

    // Thorny vines — Jungle
    if (biome === BiomeType.Jungle && terrainHeight !== null) {
      const aboveTerrain = playerY - 1.8 - terrainHeight
      if (aboveTerrain < 2.0) {
        if (canDamage) {
          playerState.takeDamage(2 * delta * 2, time)
          this.damageCooldown = 0.1
        }
        playerState.speedMultiplier *= 0.6
      }
    }

    // Scorching heat — Mesa, daytime only (absorbed: Badlands → Mesa)
    if (biome === BiomeType.Mesa && dayFactor > 0.5) {
      if (canDamage) {
        playerState.takeDamage(1 * delta * 2, time)
        this.damageCooldown = 0.1
      }
    }

    // Crystal shards — Crystal biome, minor contact damage
    if (biome === BiomeType.Crystal && terrainHeight !== null) {
      const aboveTerrain = playerY - 1.8 - terrainHeight
      if (aboveTerrain < 1.5) {
        if (canDamage) {
          playerState.takeDamage(0.5 * delta * 2, time)
          this.damageCooldown = 0.3
        }
      }
    }

    // Register hazard zone patterns in WorldState (once per worldState instance,
    // or whenever resonance sites change after the first registration attempt).
    if (worldState) {
      this.refreshHazardZones(worldState)
    }
  }

  /**
   * Populate worldState.hazardZones with deterministic pattern points derived
   * from resonance site positions. Called from update(); repopulates on the
   * first call and whenever the resonance site count changes (e.g. new sites
   * registered by LandmarkManager).
   */
  private lastSiteCount = -1

  private refreshHazardZones(worldState: WorldState): void {
    const siteCount = worldState.resonanceSites.size
    if (siteCount === this.lastSiteCount) return // nothing changed
    this.lastSiteCount = siteCount

    // Clear and regenerate
    worldState.hazardZones = []

    const swampSite = worldState.resonanceSites.get(BiomeType.Swamp)
    if (swampSite) {
      const seed = sitePositionSeed(swampSite.position)
      const vents = generateSwampGasVents(swampSite.position, seed)
      for (const v of vents) {
        worldState.hazardZones.push({
          type: 'toxic_gas',
          position: v.position,
          radius: v.radius,
          biome: BiomeType.Swamp,
        })
      }
    }

    const volcanicSite = worldState.resonanceSites.get(BiomeType.Volcanic)
    if (volcanicSite) {
      const seed = sitePositionSeed(volcanicSite.position)
      const paths = generateVolcanicLavaPaths(volcanicSite.position, seed)
      for (const p of paths) {
        worldState.hazardZones.push({
          type: 'lava',
          position: p.position,
          radius: p.radius,
          biome: BiomeType.Volcanic,
        })
      }
    }

    const crystalSite = worldState.resonanceSites.get(BiomeType.Crystal)
    if (crystalSite) {
      const seed = sitePositionSeed(crystalSite.position)
      const shards = generateCrystalShardLines(crystalSite.position, seed)
      for (const s of shards) {
        worldState.hazardZones.push({
          type: 'crystal_shards',
          position: s.position,
          radius: s.radius,
          biome: BiomeType.Crystal,
        })
      }
    }

    const snowSite = worldState.resonanceSites.get(BiomeType.Snow)
    if (snowSite) {
      const seed = sitePositionSeed(snowSite.position)
      const patches = generateIcePatches(snowSite.position, seed)
      for (const p of patches) {
        worldState.hazardZones.push({
          type: 'ice',
          position: p.position,
          radius: p.radius,
          biome: BiomeType.Snow,
        })
      }
    }
  }

  getIceFriction(biome: BiomeType): number {
    if (biome === BiomeType.Snow) {
      return 0.15
    }
    return 1.0
  }
}
