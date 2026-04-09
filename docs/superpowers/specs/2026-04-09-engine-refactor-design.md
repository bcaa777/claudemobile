# Engine Refactor Design — v2.0

## Overview

Incrementally extract a modular, ECS-based procedural world engine from the current v1.0 "Retro World" codebase. The engine becomes a reusable foundation for multiple games — starting with the existing v1.0 game (which validates the migration) and then a new roguelike autoshooter.

**Approach:** Incremental migration (Approach B). The current v1.0 game stays running at every step. Systems are extracted one at a time into a shared engine package. Each migration phase is validated by confirming v1.0 still builds and plays identically.

## Goals

- Clean ECS architecture using bitECS
- Modular systems that games opt into (terrain, entities, weapons are all optional)
- Configurable rendering with swappable visual themes (retro PS1 is one preset)
- Flexible camera system (first-person, third-person, top-down, isometric)
- Procedural world identity preserved (terrain, biomes, creatures) but fully parameterized
- Engine supports the v1.0 exploration game and a new roguelike autoshooter equally

## Non-Goals

- Not building a general-purpose game engine (stays focused on procedural 3D worlds)
- Not rewriting Three.js abstractions — thin wrapper only
- Not adding multiplayer to the engine (game-level concern, Crawler has its own)
- Not changing v1.0's gameplay — it should play identically after migration

---

## Architecture

### Package Structure

```
claudemobile/
  packages/
    engine/              <- Core engine
      core/              <- ECS setup (bitECS), system runner, event bus
      renderer/          <- Three.js wrapper, post-processing themes, camera rigs
      terrain/           <- Procedural terrain generation, chunk streaming
      entities/          <- Entity factory, DNA system, creature mesh builder
      physics/           <- Collision, spatial hash grid, raycasting
      audio/             <- Audio system, spatial audio, music manager
      input/             <- Input manager (keyboard, mouse, gamepad)
      ui/                <- HUD framework, overlay system
    retro-world/         <- v1.0 game (consumes engine)
    crawler-world/       <- v2.0 autoshooter (consumes engine, later)
  src/                   <- Current v1.0 code (migrates into packages/ over time)
```

Monorepo with pnpm workspaces (pnpm for faster installs and strict dependency isolation). Engine and games are separate packages.

### ECS Core (bitECS)

**Why bitECS:** Fast (ArrayBuffer-backed), zero dependencies, TypeScript-friendly, designed for games with thousands of entities.

**Components (pure data, no methods):**

| Component | Fields |
|-----------|--------|
| Position | x, y, z |
| Velocity | x, y, z |
| Health | current, max |
| DNA | bodyLength, limbCount, aggression, speed, colorR, colorG, colorB, ... (~30 params) |
| Renderable | meshId, visible, scale |
| AIState | behavior, target, timer |
| CameraTarget | mode, distance, height, fov |
| Weapon | type, cooldown, damage, range, level |
| Biome | type, chunkX, chunkZ |

**System execution order (per frame):**

1. InputSystem — Poll keyboard/mouse/gamepad, write to player entity
2. AISystem — Update creature/enemy behaviors
3. WeaponSystem — Auto-fire, cooldowns, projectile spawning
4. PhysicsSystem — Velocity integration, collision detection (spatial hash)
5. TerrainSystem — Chunk loading/unloading based on camera position
6. BiomeSystem — Biome transitions, weather, atmosphere
7. HealthSystem — Damage processing, death, spawning
8. DNASystem — Mutation, breeding, variant generation
9. AudioSystem — Spatial audio updates, music transitions
10. RenderSystem — Sync ECS state to Three.js scene graph, post-processing

Games register which systems they need. Not all systems are required.

**Event bus for cross-system communication:**
- Systems never call each other directly
- Events: `EntityDied`, `BiomeEntered`, `WaveStarted`, `DamageDealt`, etc.
- Systems subscribe to events they care about

**Game loop:**
- Fixed-timestep physics (60Hz), render at screen refresh rate
- Engine provides the loop; games register systems into it

---

## Renderer & Theme System

### Camera Rigs

```
CameraRig (base interface)
  FirstPersonRig    — Pointer lock, current v1.0 behavior
  ThirdPersonRig    — Over-shoulder, configurable distance/height/offset
  TopDownRig        — Fixed angle from above, zoom control
  IsometricRig      — Angled orthographic-style view
  CinematicRig      — Cutscene waypoint lerping
```

Switchable at runtime via component change on camera entity. Each rig handles its own input independently.

### Theme System

Themes are JSON-serializable post-processing pipeline configs:

```typescript
interface Theme {
  name: string
  internalResolution: [number, number]
  passes: Array<{
    type: string  // "pixelate" | "colorGrade" | "godRays" | "crt" | "chromaticAberration" | ...
    params: Record<string, number | boolean>
  }>
}
```

Built-in themes:
- `retro-ps1` — Current v1.0 look (pixelation, CRT, scanlines, chromatic aberration)
- `clean-modern` — No post-processing, full resolution
- `cel-shaded` — Outline pass, flat colors

Games define their own themes or override per-biome.

### Mesh Registry

Engine maintains a registry of mesh generators. Games register their types. RenderSystem syncs ECS entities to Three.js objects via meshId lookup.

---

## Terrain & World System

### Chunk Streaming (configurable)

```typescript
interface TerrainConfig {
  chunkSize: number       // default 64
  viewRadius: number      // default 2
  maxChunksPerFrame: number // default 2
  quadResolution: number  // default 32
  waterLevel: number      // default 3.0
}
```

Same multi-layer noise system from v1.0 (continental, domain, height, rivers, terracing) but fully parameterized per-game.

### Biome System as Data

```typescript
interface BiomeDefinition {
  name: string
  terrain: { heightScale: number, heightFrequency: number, terraceStrength: number }
  colors: { fog: Color, sky: Color[], ambient: Color, ground: Color[] }
  sprites: Array<{ type: string, density: number }>
  weather: { type: string, density: number }
  music: { key: string, layers: string[] }
}
```

v1.0's 11 biomes ship as a preset pack. Games can reuse, modify, or define new biomes.

### Engine vs Game Responsibilities

| Engine provides | Games define |
|---|---|
| Chunk streaming & LOD | BiomeRegistry (which biomes exist) |
| Noise generation pipeline | Terrain params per biome |
| Sprite billboard batching | Sprite atlas & types |
| Water material & shader | Water level, colors |
| Road/path generation | Road network layout rules |

---

## Entity & DNA System

### Entity Factory

Engine provides base entity archetypes that games compose:

```typescript
createCreature(world, {
  position: { x, y, z },
  dna: generateDNA(species, rarity, mutationRate),
  ai: { behavior: "wander", aggression: 0.3 },
  health: { current: 100, max: 100 }
})
```

### DNA System

- DNA is a flat bitECS component with ~30 numeric parameters
- `generateDNA(species, rarity, mutationRate)` produces unique creatures
- Mutation: child DNA = parent DNA + random deltas scaled by mutationRate
- Rarity tiers affect mutation range: Common (tight), Rare (wider), Epic (wild), Legendary (extreme)
- DNA drives both visuals (mesh generation) and stats (speed, health, damage, size)

### How DNA works per game

| | v1.0 Retro World | Autoshooter |
|---|---|---|
| Creatures | Passive wildlife + some enemies | All enemies, hostility scales with depth |
| Breeding | Natural (mate-seeking AI) | Wave escalation triggers mutation |
| DNA diversity | Visual variety | Gameplay variety — each run's enemies feel different |
| Death | Despawn/respawn cycle | Drop XP/gold, trigger next spawn |

### Spatial Management

Spatial hash grid (ported from Crawler, already optimized for 1000+ entities):
- Queries: entities within radius, nearest enemy in cone, entities in chunk
- Used by: AI targeting, weapon auto-aim, pickup magnetism, collision

---

## Migration Strategy

Each phase keeps v1.0 building and playing identically. Fix before moving on.

### Phase 1: Scaffolding
- Set up monorepo with workspaces (packages/engine, packages/retro-world)
- Install bitECS, configure shared TypeScript
- Current src/ stays untouched

### Phase 2: Extract Core
- Move InputManager, AudioSystem, event bus into packages/engine/core
- Wire v1.0 to import from engine package
- v1.0 still runs, just imports moved

### Phase 3: Extract Renderer
- Move Renderer, post-processing passes, camera into packages/engine/renderer
- Introduce CameraRig abstraction — FirstPersonController becomes FirstPersonRig
- Introduce Theme system — current post-processing becomes retro-ps1 theme

### Phase 4: Extract Terrain & Biomes
- Move TerrainGenerator, Chunk, BiomeMap into packages/engine/terrain
- Parameterize biome definitions as BiomeDefinition data objects
- v1.0's 11 biomes become a preset pack in packages/retro-world/biomes/

### Phase 5: Extract Entity System
- Introduce bitECS world alongside current class-based entities
- Migrate creatures first: CreatureManager to ECS entities with DNA, AI, Health, Renderable
- Migrate NPCs, enemies, projectiles
- Retire old class-based code once ECS equivalents validated
- Spatial hash grid moves to packages/engine/physics

### Phase 6: Extract Game-Specific Systems
- Stays in packages/retro-world/: companion, field guide, journal, lore, rituals, rune challenges, v1.0 combat
- Everything else is in engine

### After Phase 6
Engine is clean. packages/crawler-world/ can begin — the autoshooter game, which gets its own design spec.

---

## Dependencies

- **bitECS** (latest v0.3.x) — ECS library
- **Three.js** r165 — Rendering (already present)
- **simplex-noise** v4 — Terrain generation (already present)
- **pnpm** — Workspace management (new tooling requirement)
- No other new runtime dependencies

## Success Criteria

1. v1.0 game plays identically after full migration (same visuals, same gameplay)
2. Engine package has zero game-specific code
3. A minimal "hello world" game can be created using just the engine (spawn terrain, place entity, render)
4. All systems are opt-in — a game using only the renderer and terrain works without importing entity/weapon systems
5. Camera rigs are switchable at runtime
6. At least 2 themes work (retro-ps1, clean-modern)
