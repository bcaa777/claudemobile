// ─── SAVED CONFIG ─────────────────────────────────────────────────────────────
export const LS_CONFIG_KEY = 'engine_debug_cfg'

export function loadSavedConfig(): void {
  try {
    const raw = localStorage.getItem(LS_CONFIG_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as Record<string, Record<string, unknown>>
    function applyTo(cfg: Record<string, unknown>, src: Record<string, unknown>) {
      for (const key of Object.keys(cfg)) {
        if (key in src && (typeof src[key] === 'number' || typeof src[key] === 'boolean')) {
          cfg[key] = src[key]
        }
      }
    }
    if (saved.player)   applyTo(PLAYER_CONFIG   as unknown as Record<string, unknown>, saved.player)
    if (saved.post)     applyTo(POST_CONFIG     as unknown as Record<string, unknown>, saved.post)
    if (saved.sprites)  applyTo(SPRITE_CONFIG   as unknown as Record<string, unknown>, saved.sprites)
    if (saved.world)    applyTo(WORLD_CONFIG    as unknown as Record<string, unknown>, saved.world)
    if (saved.time)     applyTo(TIME_CONFIG     as unknown as Record<string, unknown>, saved.time)
    if (saved.biome)    applyTo(BIOME_CONFIG    as unknown as Record<string, unknown>, saved.biome)
    if (saved.creature) applyTo(CREATURE_CONFIG as unknown as Record<string, unknown>, saved.creature)
  } catch { /* ignore */ }
}

// ─── PLAYER ──────────────────────────────────────────────────────────────────
export const PLAYER_CONFIG = {
  moveSpeed:        8,    // units/s walking
  sprintSpeed:      18,   // units/s sprinting (hold Shift)
  jumpSpeed:        32,   // initial vertical velocity on jump (Space) — ~18 unit jump height
  gravity:          28,   // downward acceleration (units/s²)
  mouseSensitivity: 0.002,
}

// ─── WORLD GENERATION ────────────────────────────────────────────────────────
export const WORLD_CONFIG = {
  seed:          42,      // changes the entire biome layout
  viewRadius:    2,       // chunks loaded in each direction (2 = 5×5 grid)
                          // higher = more terrain visible, heavier CPU
}

// ─── TERRAIN ─────────────────────────────────────────────────────────────────
// These live in src/world/TerrainGenerator.ts but are explained here:
//   CHUNK_SIZE     = 64   world units per chunk
//   CHUNK_SEGMENTS = 32   quad resolution per chunk (higher = more detail)
//
// Per-biome overrides (src/biomes/definitions/*.ts):
//   heightScale     – max terrain height in world units
//   heightFrequency – noise zoom (lower = larger hills, higher = jagged)

// ─── DAY / NIGHT ─────────────────────────────────────────────────────────────
export const TIME_CONFIG = {
  dayDuration: 600,       // seconds for a full day (edit in DayNightCycle.ts)
  startTime:   0.4,       // 0 = midnight, 0.25 = sunrise, 0.5 = sunset, 0.75 = night
}

// ─── TERRAIN GENERATION ──────────────────────────────────────────────────────
export const TERRAIN_CONFIG = {
  waterLevel:         3.0,   // Y of the water surface (rivers / lakes)

  // Domain-based terrain character — low-freq noise decides plains/hills/mountains
  domainFrequency:    0.0018, // how quickly terrain character changes (lower = larger regions)
  plainsThreshold:    0.28,  // domain < this → flat plains / valleys
  mountainThreshold:  0.52,  // domain > this → ridge mountains; between = hills
  domainWarpStrength: 40,    // coord warp amount — higher = more twisted, organic shapes

  // Rivers
  enableRivers:       true,
  riverWidth:         0.07,  // 0–1: smaller = narrower rivers
  riverCarveDepth:    3.5,   // how many units below waterLevel river beds sit

  // Terracing — creates cliff steps; per-biome strength controlled in biome definitions
  terraceStep:        4.5,   // world-unit height of each terrace ledge

  // Procedural structures spawned in Chunk
  enableRockFormations: true,
  rockDensity:          0.45, // 0–1 chance per candidate spot
  enableCaveArches:     true,
  archDensity:          0.18, // 0–1 chance when a steep cliff is nearby
  enableBridges:        true,
  enableMountainBridges: true,
  enableRoads:          true,
  enableGiantTrees:     true,
  enableMegaStructures: true,
  enableChapels:        true,
  enableCemeteries:     true,
  enableSwampPiers:     true,
  enableForestRuins:    true,
  enableForestWells:    true,
  enableDesertRuinedWalls: true,
  enableDesertTents:    true,
  enableVolcanicVents:  true,
  enableVolcanicForges: true,
  enableIgloos:         true,
  enableSnowFortWalls:  true,
  enableTundraStoneCircles: true,
  enableTundraBoneRacks: true,
  enableSwampHuts:      true,
  enableSwampBoardwalks: true,
  enableSavannaHuts:    true,
  enableSavannaFences:  true,
  enableCrystalArches:  true,
  enableCrystalPedestals: true,
  enableAshCrypts:      true,
  enableAshPyres:       true,
  enableMushroomAltars: true,
  enableMushroomHollowLogs: true,
  enableHeavenPillars: true,
  enableHeavenArches: true,
  enableHeavenWaterfalls: true,
  enableHellLavaPools: true,
  enableHellSpires: true,
  enableHellLavaFalls: true,
}

// ─── CREATURES ───────────────────────────────────────────────────────────────
export const CREATURE_CONFIG = {
  spawnMultiplier: 0.8,  // scale creature count per chunk (0 = no animals, 3 = very dense)
  aggroRange:      1.0,  // multiplier on predator sight/attack range
  speedMultiplier: 1.0,  // multiplier on all creature movement speeds
}

// ─── BIOME MAP ────────────────────────────────────────────────────────────────
export const BIOME_CONFIG = {
  seedSpacing: 180,       // distance between biome centres (higher = larger biomes)
}

// ─── SPRITE SPAWNING ─────────────────────────────────────────────────────────
export const SPRITE_CONFIG = {
  // Placement grid
  gridStep:          2.0,  // world units between candidate spawn points
                           //   lower = denser grid (more sprites possible)
                           //   higher = sparser grid (fewer, more spread out)
  spawnDensity:      0.60, // 0.0–1.0 — fraction of grid cells that actually spawn
                           //   0.0 = nothing, 1.0 = every cell fills
  positionJitter:    0.9,  // 0.0–1.0 — how randomly a sprite is offset within its cell
                           //   0.0 = perfectly grid-aligned, 1.0 = fully random within cell

  // Scale
  globalScaleMultiplier: 1.0,  // multiplied on top of every sprite's min/max scale
                               //   0.5 = half size everything, 2.0 = double

  // Height placement
  heightOffset:      0.0,  // extra world units added to every sprite's Y position
                           //   useful if sprites appear to float or sink into ground

  // Texture variants
  variants:          4,    // how many pre-generated texture variants per sprite type
                           //   more = more visual diversity, slightly more memory

  // Color variance
  colorVariance:     0.08, // 0.0–1.0 — random per-channel palette shift per variant
                           //   0.0 = all variants same color, 0.3+ = wildly varied

  // Sprite texture resolution
  spriteResolution:  64,   // canvas pixels per sprite (power of 2 recommended)
                           //   32 = blockier / more PS1, 128 = more detail
}

// ─── POST-PROCESSING ─────────────────────────────────────────────────────────
export const POST_CONFIG = {
  pixelWidth:        640, // internal render resolution width  (lower = chunkier pixels)
  pixelHeight:       480, // internal render resolution height
  contrast:          1.0, // 1.0 = neutral, >1 crushes shadows, <1 lifts blacks
  saturation:        0.80,
  chromaStrength:    0.004, // chromatic aberration radius
  grainStrength:     0.06,  // film grain intensity
  scanlineIntensity: 0.12,  // CRT scanline darkness
  vignetteStrength:  0.35,  // CRT edge darkening
  barrelStrength:    0.06,  // CRT lens warp
}
