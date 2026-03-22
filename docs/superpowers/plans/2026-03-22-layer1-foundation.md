# Layer 1: Foundation — Biome Consolidation, Visual Overhaul, Audio Atmosphere

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 22 biomes to 11, overhaul visual pipeline for per-biome identity with subtle retro base, and establish layered ambient audio per biome.

**Architecture:** Biome definitions are merged (unique features from absorbed biomes folded into parents), BiomeMap generates fewer/larger Voronoi cells, post-processing pipeline is simplified (remove barrel distortion, reduce scanlines/grain) and extended with per-biome fog/particles/color grading. Audio system gets per-biome ambient soundscape layers.

**Tech Stack:** TypeScript, Three.js, WebGL shaders (GLSL), Web Audio API, Simplex Noise

**Spec:** `docs/superpowers/specs/2026-03-22-world-redesign-design.md`

**No test framework exists** — this is a real-time WebGL game. Verification is visual/auditory. Each task includes manual verification steps instead of automated tests.

---

## File Structure

### Files to Remove (11 absorbed biome definitions)
- `src/biomes/definitions/alpine.ts`
- `src/biomes/definitions/cliffs.ts`
- `src/biomes/definitions/tundra.ts`
- `src/biomes/definitions/taiga.ts`
- `src/biomes/definitions/savanna.ts`
- `src/biomes/definitions/oasis.ts`
- `src/biomes/definitions/mushroom.ts`
- `src/biomes/definitions/bog.ts`
- `src/biomes/definitions/ashwastes.ts`
- `src/biomes/definitions/badlands.ts`
- `src/biomes/definitions/floatingIslands.ts`

### Files to Modify (biome consolidation)
- `src/biomes/types.ts` — Remove 11 enum values, keep 11
- `src/biomes/BiomeRegistry.ts` — Remove 11 imports/registrations
- `src/biomes/definitions/snow.ts` — Absorb Alpine, Cliffs, Tundra, Taiga features
- `src/biomes/definitions/desert.ts` — Absorb Savanna, Oasis features
- `src/biomes/definitions/swamp.ts` — Absorb Bog, Mushroom features
- `src/biomes/definitions/volcanic.ts` — Absorb Ash Wastes features
- `src/biomes/definitions/mesa.ts` — Absorb Badlands features
- `src/biomes/definitions/heaven.ts` — Absorb Floating Islands features
- `src/world/BiomeMap.ts` — Update BIOME_TYPES array, increase seed spacing to 280
- `src/creatures/CreatureManager.ts` — Consolidate spawn tables (remove 11 biome entries, merge creatures into parents)
- `src/systems/WeatherSystem.ts` — Remove 11 weather mappings, merge into parents
- `src/systems/HazardSystem.ts` — Remove references to absorbed biomes
- `src/landmarks/LandmarkManager.ts` — Reassign absorbed landmarks to parent biomes or remove
- `src/systems/BiomeTransition.ts` — Works on BiomeType, no structural change needed (just fewer types)
- `src/audio/BiomeMusic.ts` — Remove absorbed biome music entries, merge into parents
- `src/audio/EnvironmentReverb.ts` — Remove absorbed biome reverb entries
- `src/audio/FootstepSound.ts` — Remove absorbed biome footstep entries
- `src/journal/JournalData.ts` — Update biome references
- `src/npcs/NPCData.ts` — Update NPC location biome references
- `src/config.ts` — Update BIOME_CONFIG.seedSpacing from 180 to 280

### Files to Modify (visual overhaul)
- `src/postprocessing/CRTPass.ts` — Reduce scanline intensity, remove barrel distortion
- `src/postprocessing/RetroPass.ts` — Reduce grain strength
- `src/postprocessing/ColorGradePass.ts` — Add per-biome color grading uniforms
- `src/engine/Renderer.ts` — Add new passes to pipeline (GodRayPass, GroundFogPass)
- `src/systems/BiomeTransition.ts` — Extend to interpolate all visual parameters (fog, particles, ambient light, post-processing)
- `src/config.ts` — Update POST_CONFIG defaults (reduce scanlines, grain; remove barrel distortion)

### Files to Create (visual overhaul)
- `src/postprocessing/GodRayPass.ts` — Screen-space radial blur from sun position
- `src/postprocessing/HeatDistortionPass.ts` — UV offset shader for Desert/Volcanic
- `src/systems/AtmosphereParticles.ts` — Per-biome floating particle system (dust, snow, embers, etc.)
- `src/systems/GroundFog.ts` — Low-lying fog plane per chunk

### Files to Modify (audio atmosphere)
- `src/audio/AudioSystem.ts` — Integrate new ambient layer system
- `src/audio/AmbienceSound.ts` — Complete rewrite for per-biome 3-4 layer soundscapes
- `src/audio/BiomeMusic.ts` — Restructure for adaptive fade-in/fade-out music

### Files to Create (audio)
- `src/audio/AmbienceData.ts` — Per-biome ambient soundscape definitions (drone, texture, detail, occasional layers)

---

## Task 1: Consolidate BiomeType Enum and Registry

**Files:**
- Modify: `src/biomes/types.ts`
- Modify: `src/biomes/BiomeRegistry.ts`
- Remove: 11 biome definition files listed above

- [ ] **Step 1: Update BiomeType enum in types.ts**

Remove these enum values: `Alpine`, `Cliffs`, `Tundra`, `Taiga`, `Savanna`, `Oasis`, `Mushroom`, `Bog`, `AshWastes`, `Badlands`, `FloatingIslands`. Renumber remaining 11 biomes sequentially 0-10:

```typescript
export enum BiomeType {
  Forest = 0,
  Desert = 1,
  Swamp = 2,
  Snow = 3,
  Volcanic = 4,
  Crystal = 5,
  Jungle = 6,
  Mesa = 7,
  CoralReef = 8,
  Heaven = 9,
  Hell = 10,
}
```

- [ ] **Step 2: Update BiomeRegistry.ts**

Remove imports for all 11 absorbed biome files. Remove their registrations from the biome map. Keep only 11 entries.

- [ ] **Step 3: Delete absorbed biome definition files**

Remove all 11 files listed in "Files to Remove" above.

- [ ] **Step 4: Fix all TypeScript compilation errors**

Run `npx tsc --noEmit` to find all references to removed BiomeType values. Every file referencing an absorbed biome type will need updating. Fix each one:
- `src/creatures/CreatureManager.ts` — merge spawn tables
- `src/systems/WeatherSystem.ts` — merge weather mappings
- `src/systems/HazardSystem.ts` — merge hazard mappings
- `src/landmarks/LandmarkManager.ts` — reassign landmarks
- `src/audio/BiomeMusic.ts` — merge music entries
- `src/audio/EnvironmentReverb.ts` — merge reverb entries
- `src/audio/FootstepSound.ts` — merge footstep entries
- `src/journal/JournalData.ts` — update biome name references
- `src/npcs/NPCData.ts` — update NPC location biomes
- `src/world/BiomeMap.ts` — update BIOME_TYPES array

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: consolidate 22 biomes to 11 — merge enum, registry, and all references"
```

---

## Task 2: Merge Absorbed Biome Features into Parent Definitions

**Files:**
- Modify: `src/biomes/definitions/snow.ts` (absorb Alpine, Cliffs, Tundra, Taiga)
- Modify: `src/biomes/definitions/desert.ts` (absorb Savanna, Oasis)
- Modify: `src/biomes/definitions/swamp.ts` (absorb Bog, Mushroom)
- Modify: `src/biomes/definitions/volcanic.ts` (absorb Ash Wastes)
- Modify: `src/biomes/definitions/mesa.ts` (absorb Badlands)
- Modify: `src/biomes/definitions/heaven.ts` (absorb Floating Islands)

Before starting, read each absorbed biome's definition file from git history to identify unique features worth preserving.

- [ ] **Step 1: Enrich snow.ts with absorbed features**

Merge into Snow biome definition:
- From Alpine: goat spawning, steep terrain, monastery structures
- From Cliffs: cliff fortress structures, vertical terrain features, eagle spawning
- From Tundra: flat frozen barrens, mammoth spawning, extreme cold
- From Taiga: conifer forests, wolf packs, taiga longhouse structure

Update Snow's creature spawning list to include all species from absorbed biomes. Increase terrain variety (heightScale range) to encompass the range of all 5 source biomes.

- [ ] **Step 2: Enrich desert.ts with absorbed features**

Merge into Desert:
- From Savanna: open grasslands sub-region, lion spawning, obelisk structure
- From Oasis: water features, palm vegetation, minaret structure

- [ ] **Step 3: Enrich swamp.ts with absorbed features**

Merge into Swamp:
- From Bog: deeper water, bog shrine structure, toxic gas density
- From Mushroom: giant mushroom formations, mycelium cathedral, spore particles

- [ ] **Step 4: Enrich volcanic.ts with absorbed features**

Merge into Volcanic:
- From Ash Wastes: ash colosseum structure, wider ash particle coverage, wurm spawning area

- [ ] **Step 5: Enrich mesa.ts with absorbed features**

Merge into Mesa:
- From Badlands: eroded terrain, monolith structure, extreme heat

- [ ] **Step 6: Enrich heaven.ts with absorbed features**

Merge into Heaven:
- From Floating Islands: sky temple structure, floating platform generation, wind updrafts

- [ ] **Step 7: Verify the game runs**

Run: `npx vite dev` and explore all 11 biomes. Verify:
- Each biome has terrain variety
- Creatures spawn in each biome
- Landmarks appear
- No console errors

- [ ] **Step 8: Commit**

```bash
git add src/biomes/definitions/
git commit -m "feat: enrich remaining 11 biomes with features from absorbed biomes"
```

---

## Task 3: Update BiomeMap for Larger Biome Territories

**Files:**
- Modify: `src/config.ts`
- Modify: `src/world/BiomeMap.ts`

- [ ] **Step 1: Update seed spacing in config.ts**

Change `BIOME_CONFIG.seedSpacing` from `180` to `280`.

- [ ] **Step 2: Update BIOME_TYPES array in BiomeMap.ts**

Replace the BIOME_TYPES array with only the 11 remaining biome types. Remove any references to absorbed types.

- [ ] **Step 3: Adjust Voronoi generation if needed**

With fewer biomes and larger spacing, verify the Voronoi seed count still produces good coverage. The seed generation loop may need adjustment to ensure all 9 non-special biomes appear (Heaven/Hell are special regions).

- [ ] **Step 4: Verify world generation**

Run the game and fly around. Verify:
- All 11 biomes appear in the world
- Biomes are larger than before
- Transitions between biomes are smooth
- Heaven and Hell special regions still work
- No empty/unassigned regions

- [ ] **Step 5: Commit**

```bash
git add src/config.ts src/world/BiomeMap.ts
git commit -m "feat: increase biome territory size — seedSpacing 180→280 for 11 consolidated biomes"
```

---

## Task 4: Consolidate Landmark Assignments

**Files:**
- Modify: `src/landmarks/LandmarkManager.ts`

- [ ] **Step 1: Map absorbed landmarks to parent biomes**

Landmarks from absorbed biomes need reassignment:
- AncestorField (Savanna) → Desert
- SavannaObelisk (Savanna) → Desert (keep as sub-landmark or merge)
- MyceliumCathedral (Mushroom) → Swamp
- AshColosseum (AshWastes) → Volcanic
- AlpineMonastery (Alpine) → Snow
- CliffFortress (Cliffs) → Snow
- SkyTemple (FloatingIslands) → Heaven
- BogShrine (Bog) → Swamp
- BadlandsMonolith (Badlands) → Mesa
- TaigaLonghouse (Taiga) → Snow
- OasisMinaret (Oasis) → Desert

Decision: Each biome should have ONE primary landmark (the Resonance Site for the mystery). Keep the most impressive landmark per biome, demote others to secondary structures embedded in terrain generation.

Primary landmarks (11):
- Forest → DruidRingTemple
- Desert → GreatPyramid
- Swamp → SwampZiggurat
- Snow → IcePalace
- Volcanic → ObsidianCitadel
- Crystal → CrystalCathedral
- Jungle → JunglePyramid
- Mesa → MesaCitadel
- CoralReef → CoralPalace
- Heaven → CloudTemple
- Hell → InfernalCitadel

- [ ] **Step 2: Update LandmarkManager to only spawn primary landmarks**

Remove or comment out spawning of secondary landmarks. Each biome gets exactly one landmark at its Voronoi seed center.

- [ ] **Step 3: Update crystal spawning**

Keep 3 crystals per primary landmark. Remove crystal spawning from demoted landmarks.

- [ ] **Step 4: Verify landmarks appear correctly**

Run the game, use debug map to verify one landmark per biome in correct positions.

- [ ] **Step 5: Commit**

```bash
git add src/landmarks/
git commit -m "refactor: consolidate landmarks — one primary per biome, reassign from absorbed biomes"
```

---

## Task 5: Reduce Retro Post-Processing Effects

**Files:**
- Modify: `src/config.ts` (POST_CONFIG)
- Modify: `src/postprocessing/CRTPass.ts`
- Modify: `src/postprocessing/RetroPass.ts`

- [ ] **Step 1: Update POST_CONFIG defaults in config.ts**

```typescript
// Before:
scanlineIntensity: 0.12,
grainStrength: 0.06,
vignetteStrength: 0.35,

// After:
scanlineIntensity: 0.05,   // ~60% reduction
grainStrength: 0.035,       // ~40% reduction
vignetteStrength: 0.35,     // keep
barrelDistortion: 0,        // remove barrel distortion (add if not present, set to 0)
```

- [ ] **Step 2: Update CRTPass.ts to respect barrelDistortion=0**

If the CRT shader has hardcoded barrel distortion, make it conditional on the config value. When `barrelDistortion` is 0, skip the distortion calculation in the fragment shader.

- [ ] **Step 3: Verify visual changes**

Run the game. Verify:
- Scanlines are faint but visible
- Grain is subtle
- No barrel distortion (screen edges are straight)
- Vignette is unchanged
- Overall feel is "subtle retro" not "CRT emulator"

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/postprocessing/CRTPass.ts src/postprocessing/RetroPass.ts
git commit -m "style: reduce retro post-processing — softer scanlines, less grain, no barrel distortion"
```

---

## Task 6: Per-Biome Color Grading Enhancement

**Files:**
- Modify: `src/postprocessing/ColorGradePass.ts`
- Modify: `src/biomes/types.ts` (add visual config to BiomeConfig interface)
- Modify: All 11 biome definitions (add visual identity parameters)
- Modify: `src/systems/BiomeTransition.ts` (interpolate visual params)

- [ ] **Step 1: Extend BiomeConfig interface in types.ts**

Add a `visualIdentity` section to the BiomeConfig interface:

```typescript
visualIdentity: {
  colorGrade: {
    tint: [number, number, number];      // RGB 0-1, multiplied with scene color
    contrast: number;                     // 0.8-1.3
    saturation: number;                   // 0.5-1.5
  };
  fog: {
    nearDistance: number;                  // where fog starts
    farDistance: number;                   // where fog is fully opaque
    color: [number, number, number];      // RGB 0-1
    density: number;                      // 0-1
  };
  ambientLight: {
    color: [number, number, number];      // RGB 0-1
    intensity: number;                    // 0-2
  };
  atmosphere: {
    particleType: 'dust' | 'snow' | 'embers' | 'spores' | 'fireflies' | 'motes' | 'sand' | 'rain' | 'ash' | 'spray' | 'smoke' | 'none';
    particleCount: number;                // 50-300
    particleColor: [number, number, number];
    particleSize: number;
    particleSpeed: number;
  };
};
```

- [ ] **Step 2: Define visual identity for each of the 11 biomes**

Add `visualIdentity` to each biome definition file. Use the color palettes from the spec:
- Forest: warm greens/golds, gentle golden haze, dust motes
- Desert: hot amber/ochre, heat shimmer, sand particles
- Swamp: sickly yellow-green, thick low white fog, fireflies at night / spores
- Snow: cool blue-white, white-out distance fog, gentle constant flakes
- Volcanic: high contrast orange/black, dark ash fog, embers
- Crystal: cool blues high saturation, minimal fog, floating light specks
- Jungle: saturated deep greens, green humidity haze, rain drops
- Mesa: terracotta/burnt orange, dust haze, dust
- Coral Coast: turquoise/coral, sea spray mist, sea spray
- Heaven: soft white/gold bloom, ethereal wisps, ascending motes
- Hell: deep red/black, oppressive dark red fog, ash/smoke

- [ ] **Step 3: Update ColorGradePass to accept per-biome uniforms**

Add uniforms for `tintColor`, `biomeContrast`, `biomeSaturation` to the color grade shader. Apply them as multipliers on top of the existing color grading.

- [ ] **Step 4: Update BiomeTransition.ts to interpolate visual parameters**

Extend the biome transition system to smoothly interpolate ALL `visualIdentity` parameters between biomes over ~5 seconds. Store current interpolated values that other systems can read.

- [ ] **Step 5: Wire up color grade uniforms in the render loop**

In `Engine.ts` or `Renderer.ts`, read the current interpolated color grade from BiomeTransition and set uniforms on ColorGradePass each frame.

- [ ] **Step 6: Verify per-biome color grading**

Run the game, visit 3-4 different biomes. Verify:
- Each biome has a distinct color feel
- Transitions between biomes are smooth (no popping)
- No biome looks washed out or oversaturated

- [ ] **Step 7: Commit**

```bash
git add src/biomes/ src/postprocessing/ColorGradePass.ts src/systems/BiomeTransition.ts src/engine/
git commit -m "feat: per-biome visual identity — color grading, fog, ambient light definitions"
```

---

## Task 7: Per-Biome Fog System

**Files:**
- Modify: `src/engine/Renderer.ts` (update fog each frame from biome transition)
- Modify: `src/systems/BiomeTransition.ts` (expose interpolated fog params)
- Modify: `src/engine/Engine.ts` (wire up fog updates)

- [ ] **Step 1: Update fog application in the render loop**

Currently fog is likely set globally. Change it to read from BiomeTransition's interpolated fog values each frame:
- `scene.fog.near` = interpolated fogNearDistance
- `scene.fog.far` = interpolated fogFarDistance
- `scene.fog.color` = interpolated fogColor

- [ ] **Step 2: Handle weather fog overrides**

Weather system already overrides fog. Make weather fog compose with biome fog (weather fog takes the closer/denser of the two, and blends weather fog color with biome fog color).

- [ ] **Step 3: Verify fog per biome**

Visit Desert (distant heat haze), Swamp (thick close fog), Snow (white-out). Verify distinct fog feels. Trigger weather and verify fog still works.

- [ ] **Step 4: Commit**

```bash
git add src/engine/ src/systems/BiomeTransition.ts
git commit -m "feat: per-biome fog system with weather overlay composition"
```

---

## Task 8: Atmosphere Particle System

**Files:**
- Create: `src/systems/AtmosphereParticles.ts`
- Modify: `src/engine/Engine.ts` (add to update loop)

- [ ] **Step 1: Create AtmosphereParticles system**

A particle system that renders 100-200 instanced billboard quads around the player. Reads `particleType`, `particleCount`, `particleColor`, `particleSize`, `particleSpeed` from the current biome's interpolated `visualIdentity.atmosphere`.

Implementation:
- Use THREE.InstancedMesh with a small quad geometry and billboard material (always face camera)
- Particles spawn in a box around the player (±30 units horizontal, 0-20 units vertical)
- Movement depends on type: dust drifts lazily, snow falls, embers rise, rain falls fast
- Recycle particles that leave the box (wrap around)
- On biome transition: lerp particle count, color, and speed over 5 seconds. Crossfade by spawning new type while old type fades out.

- [ ] **Step 2: Add to Engine update loop**

Call `atmosphereParticles.update(dt, playerPosition, currentBiomeVisual)` in the engine loop after biome transition update.

- [ ] **Step 3: Verify particles per biome**

Visit Forest (dust motes), Snow (snowflakes), Volcanic (embers). Verify:
- Particles visible and match biome
- Smooth crossfade during transition
- No performance impact (check FPS counter)

- [ ] **Step 4: Commit**

```bash
git add src/systems/AtmosphereParticles.ts src/engine/Engine.ts
git commit -m "feat: per-biome atmosphere particles — dust, snow, embers, spores, etc."
```

---

## Task 9: Ground Fog Effect

**Files:**
- Create: `src/systems/GroundFog.ts`
- Modify: `src/engine/Engine.ts` (add to update loop)

- [ ] **Step 1: Create GroundFog system**

A low-lying fog plane rendered per chunk. Most visible in Swamp and Forest at dawn.

Implementation:
- Single large transparent PlaneGeometry at water level + 1 unit
- Custom ShaderMaterial: alpha driven by simplex noise (scrolling UV), fades at edges
- Alpha multiplied by biome's fog density and time-of-day factor (denser at dawn/dusk)
- Follows player horizontally, stays at fixed Y level
- Only renders when biome fog density > 0.3 (skip for Desert, Crystal, etc.)

- [ ] **Step 2: Wire into Engine**

Add ground fog update in engine loop. Pass player position and current biome visual params.

- [ ] **Step 3: Verify ground fog**

Visit Swamp and Forest. Set time to dawn via debug panel. Verify:
- Fog layer visible hugging the ground
- Swamp is thick, Forest is gentle
- Fades in/out with biome transition
- Desert/Crystal have no ground fog

- [ ] **Step 4: Commit**

```bash
git add src/systems/GroundFog.ts src/engine/Engine.ts
git commit -m "feat: ground fog layer — biome-specific low-lying fog with time-of-day modulation"
```

---

## Task 10: God Ray Effect

**Files:**
- Create: `src/postprocessing/GodRayPass.ts`
- Modify: `src/engine/Renderer.ts` (add to pipeline)

- [ ] **Step 1: Create GodRayPass**

Screen-space radial blur from sun position. Cheap implementation:

- ShaderPass that takes the sun's screen-space position as a uniform
- Fragment shader: sample along ray from pixel to sun position (6-8 samples), accumulate brightness
- Multiply by exposure and per-biome intensity (strong in Forest/Heaven, zero in Hell/Crystal caves)
- Additive blend with scene

- [ ] **Step 2: Add to Renderer pipeline**

Insert GodRayPass after ColorGradePass, before CRTPass. Pass sun screen position from DayNightCycle each frame.

- [ ] **Step 3: Add per-biome god ray intensity**

Add `godRayIntensity: number` (0-1) to the `visualIdentity` interface. Set per biome:
- Forest: 0.8, Desert: 0.6, Swamp: 0.3, Snow: 0.5, Volcanic: 0.2, Crystal: 0, Jungle: 0.4, Mesa: 0.7, Coral: 0.5, Heaven: 1.0, Hell: 0

- [ ] **Step 4: Verify god rays**

Set time to sunrise/sunset via debug panel. Visit Forest. Verify:
- Light shafts visible streaming from sun direction
- Intensity varies by biome
- Performance: should add <2ms to frame time

- [ ] **Step 5: Commit**

```bash
git add src/postprocessing/GodRayPass.ts src/engine/Renderer.ts src/biomes/
git commit -m "feat: screen-space god rays with per-biome intensity"
```

---

## Task 11: Heat Distortion Effect

**Files:**
- Create: `src/postprocessing/HeatDistortionPass.ts`
- Modify: `src/engine/Renderer.ts` (add to pipeline)

- [ ] **Step 1: Create HeatDistortionPass**

Reuse logic pattern from UnderwaterPass but with different parameters:
- UV offset driven by scrolling noise (heat shimmer)
- Stronger at bottom of screen (ground level)
- Intensity uniform controlled by biome (Desert: 0.6, Volcanic: 0.8, others: 0)
- Only active during daytime (multiply by dayFactor)

- [ ] **Step 2: Add to pipeline**

Insert after GodRayPass, before CRTPass.

- [ ] **Step 3: Verify heat distortion**

Visit Desert during daytime. Verify:
- Subtle shimmer visible near horizon/ground
- Not active at night
- Not active in Forest/Snow/etc.

- [ ] **Step 4: Commit**

```bash
git add src/postprocessing/HeatDistortionPass.ts src/engine/Renderer.ts
git commit -m "feat: heat distortion effect for Desert and Volcanic biomes"
```

---

## Task 12: Enhanced Biome Transition System

**Files:**
- Modify: `src/systems/BiomeTransition.ts`

- [ ] **Step 1: Extend BiomeTransition to interpolate all visual parameters**

Current transition blends fog and sky colors. Extend to interpolate the full `visualIdentity` object:
- Color grade (tint, contrast, saturation)
- Fog (near, far, color, density)
- Ambient light (color, intensity)
- Atmosphere particles (type crossfade, count, color, size, speed)
- God ray intensity
- Heat distortion intensity
- Ground fog density

Use lerp for numbers, color lerp for RGB values. Transition duration: ~5 seconds (current TRANSITION_SPEED of 1.5 should work).

- [ ] **Step 2: Expose interpolated values as public getters**

Other systems (Renderer, AtmosphereParticles, GroundFog) read from BiomeTransition. Expose clean getters:
- `getCurrentVisual(): InterpolatedVisualIdentity`

- [ ] **Step 3: Verify smooth transitions**

Walk between Forest↔Desert, Swamp↔Snow. Verify:
- All visual parameters blend smoothly
- No popping in color, fog, particles, god rays
- Transition feels like "walking into a different painting"

- [ ] **Step 4: Commit**

```bash
git add src/systems/BiomeTransition.ts
git commit -m "feat: full visual parameter interpolation during biome transitions"
```

---

## Task 13: Per-Biome Ambient Soundscape

**Files:**
- Create: `src/audio/AmbienceData.ts`
- Modify: `src/audio/AmbienceSound.ts`
- Modify: `src/audio/AudioSystem.ts`

- [ ] **Step 1: Create AmbienceData.ts with per-biome definitions**

Define the 4-layer soundscape per biome as data:

```typescript
export interface AmbienceLayer {
  type: 'drone' | 'texture' | 'detail' | 'occasional';
  waveform: OscillatorType;        // 'sine', 'sawtooth', 'square', 'triangle'
  baseFrequency: number;            // Hz
  frequencyRange: number;           // random variation range
  filterType: BiquadFilterType;     // 'lowpass', 'bandpass', 'highpass'
  filterFrequency: number;          // Hz
  gain: number;                     // 0-1
  modulationRate?: number;          // LFO Hz for texture/movement
  modulationDepth?: number;         // LFO depth
  burstInterval?: number;           // seconds between bursts (for 'occasional' type)
  burstDuration?: number;           // seconds per burst
}

export interface BiomeAmbience {
  layers: AmbienceLayer[];
}

export const BIOME_AMBIENCE: Record<BiomeType, BiomeAmbience> = { ... };
```

Define layers for all 11 biomes per the spec's audio table.

- [ ] **Step 2: Rewrite AmbienceSound.ts for layered playback**

Replace current implementation with a system that:
- Maintains 4 AudioNode chains per layer (oscillator → filter → gain → master)
- On biome change: crossfade layers over 3 seconds (fade old out, new in)
- 'occasional' layers trigger randomly at their burstInterval
- 'detail' layers have subtle random pitch variation
- All gains are low (ambient, not dominant)

- [ ] **Step 3: Update AudioSystem.ts to pass biome info**

Ensure AmbienceSound receives current biome type from BiomeTransition on each update.

- [ ] **Step 4: Verify ambient audio**

Visit Forest, Desert, Swamp with sound on. Verify:
- Each biome has a distinct ambient soundscape
- Layers are audible but not overwhelming
- Transitions between biomes crossfade smoothly
- No audio clipping or distortion

- [ ] **Step 5: Commit**

```bash
git add src/audio/AmbienceData.ts src/audio/AmbienceSound.ts src/audio/AudioSystem.ts
git commit -m "feat: per-biome ambient soundscapes — 4-layer procedural audio per biome"
```

---

## Task 14: Adaptive Music System

**Files:**
- Modify: `src/audio/BiomeMusic.ts`

- [ ] **Step 1: Restructure BiomeMusic for fade-in/fade-out**

Current system loops music per biome. Restructure so:
- Music is NOT constant — plays in phrases with silence gaps
- Each biome has a musical motif (scale, tempo, instrument timbre)
- Music fades in when player is walking peacefully (no combat, no weather danger)
- Music fades out during storms, combat, or when ambient atmosphere should dominate
- 30-40% of the time should be silence (atmosphere-only)

Implementation:
- State machine: `silent` → `fading_in` → `playing` → `fading_out` → `silent`
- Silent duration: 15-45 seconds (random)
- Playing duration: 20-40 seconds (random)
- Fade duration: 3 seconds
- Context signals: weather severity, creature proximity (hostile), player speed

- [ ] **Step 2: Define per-biome musical motifs**

Each biome gets: base note, scale (pentatonic for most), tempo, waveform timbre.
- Forest: C major pentatonic, 72 BPM, sine (piano-like)
- Desert: D minor pentatonic, 60 BPM, triangle (plucked string-like)
- Swamp: Bb minor, 50 BPM, filtered sawtooth (eerie)
- Snow: F major, 66 BPM, sine with reverb (ethereal)
- Volcanic: E minor, 80 BPM, square (harsh)
- Crystal: A major, 55 BPM, sine harmonics (bells)
- Jungle: G minor pentatonic, 90 BPM, triangle (rhythmic)
- Mesa: D dorian, 58 BPM, triangle (hollow)
- Coral Coast: C major, 70 BPM, sine (flowing)
- Heaven: F lydian, 48 BPM, sine choir (angelic)
- Hell: Tritone-based, 100 BPM, distorted square (menacing)

- [ ] **Step 3: Verify adaptive music**

Play for 2-3 minutes in Forest. Verify:
- Music fades in and out
- Periods of silence (atmosphere only)
- Music stops during combat/storms
- Different feel per biome

- [ ] **Step 4: Commit**

```bash
git add src/audio/BiomeMusic.ts
git commit -m "feat: adaptive music system — per-biome motifs with contextual fade-in/out and silence gaps"
```

---

## Task 15: Final Layer 1 Integration & Polish

**Files:**
- Modify: `src/engine/Engine.ts` (verify all new systems in update loop)
- Modify: `src/debug/DebugPanel.ts` (add controls for new visual parameters)

- [ ] **Step 1: Verify engine update loop order**

Ensure all new systems are called in correct order:
1. Biome transition (updates interpolated visual values)
2. Weather system
3. Fog system (reads from both biome transition and weather)
4. Ground fog update
5. Atmosphere particles update
6. God ray sun position update
7. Audio systems (ambience, music)

- [ ] **Step 2: Add debug panel controls**

Add sliders/toggles to debug panel for:
- God ray intensity override
- Atmosphere particle count
- Ground fog density
- Heat distortion intensity
- Music volume
- Ambient volume
- Force biome (dropdown to test each biome's visual identity)

- [ ] **Step 3: Full playthrough verification**

Visit all 11 biomes. For each verify:
- Distinct visual identity (color, fog, particles)
- Distinct audio (ambient layers + music motif)
- Smooth transitions between adjacent biomes
- Weather integrates with biome visuals
- Performance is acceptable (>30 FPS on the target laptop)

- [ ] **Step 4: Commit**

```bash
git add src/engine/Engine.ts src/debug/DebugPanel.ts
git commit -m "feat: Layer 1 complete — integrated visual and audio systems with debug controls"
```

---

## Layer 1 Completion Checklist

Before moving to Layer 2, verify:
- [ ] 11 biomes only, all working
- [ ] Each biome has distinct visual identity (color grade, fog, particles, ambient light)
- [ ] Subtle retro base (faint scanlines, grain, vignette, no barrel distortion)
- [ ] God rays in appropriate biomes
- [ ] Heat distortion in Desert/Volcanic
- [ ] Ground fog in Swamp/Forest
- [ ] Per-biome ambient soundscapes (4 layers each)
- [ ] Adaptive music with silence gaps
- [ ] Smooth 5-second transitions between all biomes
- [ ] One primary landmark per biome
- [ ] No TypeScript errors
- [ ] >30 FPS performance target met
