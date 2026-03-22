# Layer 2: Connected Systems — Ecology Web & WorldState

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect all game systems through a shared WorldState so creatures, weather, biomes, and hazards interact meaningfully. Creatures respond to weather and ancient sites. Weather reveals secrets. The companion becomes a mystery-solving tool.

**Architecture:** A new central WorldState object is read by all systems each frame. Creature AI gets new behavior layers (site-awareness, ecology). Weather and hazard systems write to and read from WorldState. BiomeTransition feeds visual state. Hero biome (Forest) is fully realized first.

**Tech Stack:** TypeScript, Three.js

**Spec:** `docs/superpowers/specs/2026-03-22-world-redesign-design.md` (Section 4: Connected Systems)

**Prerequisite:** Layer 1 must be complete.

---

## File Structure

### Files to Create
- `src/systems/WorldState.ts` — Central shared state object
- `src/creatures/SiteAwareness.ts` — Creature behavior layer for ancient site proximity
- `src/creatures/EcologyBehavior.ts` — Creature-creature ecology interactions (herding, food chain, territory)
- `src/creatures/WeatherResponse.ts` — Creature responses to weather conditions

### Files to Modify
- `src/creatures/Creature.ts` — Add new states: `reverence`, `migrating`, `resonating`, `sheltering`
- `src/creatures/CreatureManager.ts` — Integrate new behavior layers, pass WorldState
- `src/systems/WeatherSystem.ts` — Write weather state to WorldState, add site-weather interactions
- `src/systems/HazardSystem.ts` — Expose hazard positions as mystery clues
- `src/systems/BiomeTransition.ts` — Write current biome visual state to WorldState
- `src/player/CompanionSystem.ts` — Add mystery-solving affinities per species
- `src/engine/Engine.ts` — Create and wire WorldState through all systems
- `src/landmarks/LandmarkManager.ts` — Expose landmark positions to WorldState for creature site-awareness

---

## Task 1: Create WorldState System

**Files:**
- Create: `src/systems/WorldState.ts`
- Modify: `src/engine/Engine.ts`

- [ ] **Step 1: Define WorldState interface and class**

```typescript
import { BiomeType } from '../biomes/types';
import * as THREE from 'three';

export interface ResonanceSite {
  biome: BiomeType;
  position: THREE.Vector3;
  activated: boolean;
}

export class WorldState {
  // Progression
  activatedSites: Set<BiomeType> = new Set();
  globalHarmony: number = 0;  // 0-1, activatedSites.size / 11

  // Per-biome stability (1 = stable, 0 = fully destabilized)
  biomeStability: Map<BiomeType, number> = new Map();

  // Resonance site positions (populated by LandmarkManager)
  resonanceSites: Map<BiomeType, ResonanceSite> = new Map();

  // Current weather (written by WeatherSystem)
  currentWeather: string = 'clear';
  weatherSeverity: number = 0; // 0-1

  // Time (written by DayNightCycle)
  timeOfDay: number = 0.5; // 0-1
  isDawn: boolean = false;   // thin time
  isDusk: boolean = false;   // thin time

  // Player state
  playerPosition: THREE.Vector3 = new THREE.Vector3();
  playerBiome: BiomeType = BiomeType.Forest;
  isInCombat: boolean = false;

  // Companion
  companionSpecies: string | null = null;

  // Derived modifiers (recalculated each frame)
  creatureAggressionModifier: number = 1.0;
  weatherIntensityModifier: number = 1.0;

  update(): void {
    this.globalHarmony = this.activatedSites.size / 11;
    // Biome stability: farther from Hell = more stable, activation improves it
    // Derived modifiers computed from above
  }

  // Persistence
  save(): string { ... }
  load(data: string): void { ... }
}
```

- [ ] **Step 2: Instantiate WorldState in Engine.ts**

Create WorldState in Engine constructor. Pass reference to all systems that need it. Call `worldState.update()` at the start of each frame.

- [ ] **Step 3: Wire LandmarkManager to populate resonance site positions**

After landmarks are spawned, register their positions in WorldState.resonanceSites.

- [ ] **Step 4: Wire DayNightCycle to write time state**

Each frame, write `timeOfDay`, `isDawn` (0.23-0.27), `isDusk` (0.73-0.77) to WorldState.

- [ ] **Step 5: Wire BiomeTransition to write current biome**

Write `playerBiome` to WorldState each frame.

- [ ] **Step 6: Commit**

```bash
git add src/systems/WorldState.ts src/engine/Engine.ts
git commit -m "feat: WorldState central system — shared state for all game systems"
```

---

## Task 2: Creature Weather Response

**Files:**
- Create: `src/creatures/WeatherResponse.ts`
- Modify: `src/creatures/Creature.ts` (add `sheltering` and `migrating` states)
- Modify: `src/creatures/CreatureManager.ts` (integrate weather response)

- [ ] **Step 1: Add new creature states**

Add to the state type union in Creature.ts: `'sheltering'`, `'migrating'`

- [ ] **Step 2: Create WeatherResponse behavior layer**

```typescript
// Called each frame for creatures being updated
export function applyWeatherResponse(
  creature: Creature,
  weather: string,
  weatherSeverity: number,
  nearbyLandmarks: THREE.Vector3[],  // potential shelter
  nearbyWater: THREE.Vector3[],       // oases for migration
): void {
  // Rain: herbivores seek shelter (landmark or tree positions)
  // Blizzard: all creatures enter sheltering state (hunker animation)
  // Sandstorm: herbivores migrate toward water/oasis
  // Clear night: nocturnal creatures activate, diurnal sleep
}
```

Rules:
- Rain + herbivore → move toward nearest landmark/structure (shelter)
- Rain + predator → increase hunt range by 1.5x (prey is distracted)
- Blizzard/heavy storm → all creatures enter `sheltering` (stop moving, hunker down)
- Sandstorm → herbivores move toward nearest oasis/water source
- Clear night → nocturnal predators more active, diurnal herbivores sleep

- [ ] **Step 3: Integrate into CreatureManager update loop**

Before normal state machine update, run `applyWeatherResponse()` which can override the creature's current state.

- [ ] **Step 4: Wire weather data from WorldState**

CreatureManager reads `currentWeather` and `weatherSeverity` from WorldState.

- [ ] **Step 5: Verify in Forest biome**

Trigger rain via debug panel. Verify:
- Herbivores move toward structures/trees
- Predators seem more active
- During blizzard (visit Snow), all creatures hunker down

- [ ] **Step 6: Commit**

```bash
git add src/creatures/WeatherResponse.ts src/creatures/Creature.ts src/creatures/CreatureManager.ts
git commit -m "feat: creature weather response — shelter seeking, migration, storm hunkering"
```

---

## Task 3: Creature Ecology Behavior

**Files:**
- Create: `src/creatures/EcologyBehavior.ts`
- Modify: `src/creatures/CreatureManager.ts`

- [ ] **Step 1: Create EcologyBehavior system**

Handles creature-creature interactions:

**Herding:** Herbivores within 20 units of same species align velocities (flocking). Groups of 3+ move together.

**Food chain visibility:** When a predator is hunting, nearby herbivores of the prey species flee. Scavenger species (crows, foxes) move toward dead creatures.

**Territorial behavior:** Wolf packs (3+ wolves in 30 units) establish territory. Other predators avoid the area. Mark territory center based on pack centroid.

**Population effects:** Track herbivore count per chunk. If significantly above average (>2x), reduce vegetation sprite density in that chunk (overgrazing visual).

- [ ] **Step 2: Integrate into CreatureManager**

Run ecology behavior after weather response but before normal state machine. Ecology can suggest state changes (flee, move-toward) that the state machine respects.

- [ ] **Step 3: Verify ecology**

In Forest, watch:
- Deer group up and move together
- Wolves trigger deer to flee
- Wolves stay near their territory

- [ ] **Step 4: Commit**

```bash
git add src/creatures/EcologyBehavior.ts src/creatures/CreatureManager.ts
git commit -m "feat: creature ecology — herding, food chain, territorial behavior"
```

---

## Task 4: Creature Site Awareness

**Files:**
- Create: `src/creatures/SiteAwareness.ts`
- Modify: `src/creatures/Creature.ts` (add `reverence` and `resonating` states)
- Modify: `src/creatures/CreatureManager.ts`

- [ ] **Step 1: Add reverence and resonating states to Creature.ts**

Add to state type union: `'reverence'`, `'resonating'`

- [ ] **Step 2: Create SiteAwareness behavior layer**

The core mystery mechanic. When creatures are within ~30 units of a Resonance Site:

**All creatures:**
- Predators stop hunting (truce zone)
- No creature attacks player near sites

**Herbivores:**
- Enter `reverence` state: face the site, stop grazing, stand still
- Move slowly in deliberate patterns (not random wander)

**Attuned creatures** (species matched to biome):
- Glow faintly (add emissive to mesh material)
- Move in ritual patterns around the site (circular, spiral, or figure-eight paths depending on biome)
- Pattern becomes more defined as globalHarmony increases

**Attuned species mapping:**
- Forest: Deer
- Desert: Camel
- Swamp: Toad
- Snow: Mammoth
- Volcanic: Wurm (not a companion but still performs)
- Crystal: Any creature
- Jungle: Bird/Parrot
- Mesa: Goat
- Coral Coast: (fish, not a creature in current system — skip for now)
- Heaven: Skywhale
- Hell: (none — too chaotic)

- [ ] **Step 3: Implement ritual path walking**

When an attuned creature is near its site, it walks a specific path:
- Forest: circular orbit around grove center (radius 8 units)
- Desert: approach and kneel facing monument
- Other biomes: similar unique patterns

The path is deterministic from the site position (not random). Players can observe and learn the pattern.

- [ ] **Step 4: Add faint glow to attuned creatures**

When attuned creature is near its site, set mesh material emissive to a faint biome-colored glow. Intensity pulses gently (sine wave, 0.5 Hz).

- [ ] **Step 5: Integrate into CreatureManager**

Site awareness runs as highest priority behavior layer — overrides weather response and ecology when creature is within site radius.

- [ ] **Step 6: Verify in Forest**

Go to Forest landmark (DruidRingTemple). Verify:
- Nearby deer face the site and stand still
- Deer glow faintly when close
- Deer walk in a circular pattern
- Wolves near the site stop hunting
- Effect only happens within ~30 units

- [ ] **Step 7: Commit**

```bash
git add src/creatures/SiteAwareness.ts src/creatures/Creature.ts src/creatures/CreatureManager.ts
git commit -m "feat: creature site awareness — reverence, attuned glowing, ritual path walking"
```

---

## Task 5: Weather-Site Interactions

**Files:**
- Modify: `src/systems/WeatherSystem.ts`

- [ ] **Step 1: Add site-weather reveal mechanics**

When specific weather occurs near a Resonance Site, trigger visual reveals:

- **Rain near any site:** Water fills carved channels in the ground near the landmark. Implement as additional transparent blue planes that appear at specific offsets from landmark position during rain.
- **Sandstorm in Desert:** Buried wall segments become visible (dust clears revealing structures). Toggle visibility of hidden landmark sub-meshes.
- **Lightning near sites:** Lightning strikes the same 2-3 positions near the site (not random). Use existing lightning flash if available, or create brief bright point lights.
- **Fog in Swamp:** Fog parts in corridors leading to site center. Reduce ground fog density in specific directions from the site.
- **Snow near Snow site:** Snow melts in symbol patterns. Reduce snow particle density in specific areas forming a pattern.

- [ ] **Step 2: Track reveals in WorldState**

Add `weatherReveals: Map<BiomeType, Set<string>>` to WorldState. Track which weather reveals the player has witnessed (for journal).

- [ ] **Step 3: Verify weather-site interaction**

In Forest, trigger rain. Verify water channels appear near DruidRingTemple. In Desert, trigger sandstorm. Verify buried walls appear.

- [ ] **Step 4: Commit**

```bash
git add src/systems/WeatherSystem.ts src/systems/WorldState.ts
git commit -m "feat: weather-site interactions — rain channels, sandstorm reveals, lightning patterns"
```

---

## Task 6: Companion Mystery Affinities

**Files:**
- Modify: `src/player/CompanionSystem.ts`

- [ ] **Step 1: Add mystery affinities to companion bonuses**

Extend the existing companion bonus system with mystery-solving behaviors:

**Fox companion:**
- Existing: lore glow bonus
- New: ears perk (rotate mesh slightly) when facing direction of nearest undiscovered lore stone within 50 units
- New: whimpers (audio cue) when near destabilization zone (low biomeStability)

**Deer companion:**
- Existing: crystal trail
- New: when within 40 units of Forest or Snow Resonance Site, enters reverence state and begins walking the ritual path (same as wild attuned deer). This shows the player the path directly.

**Bird companion:**
- Existing: predator warning
- New: circles above (rises 10 units and orbits) when directly above a hidden lore stone or buried secret
- New: faces and chirps toward nearest Resonance Site when player is in the right biome

**Goat companion:**
- Existing: jump bonus
- New: stamps foot (brief animation) when standing on ground directly above a hidden item or buried artifact

- [ ] **Step 2: Read WorldState for site/lore positions**

Companion system reads resonanceSites and lore stone positions from WorldState to determine when to trigger affinity behaviors.

- [ ] **Step 3: Add companion mood indicator**

Extend companion state with mood: `normal`, `alert`, `resonating`, `distressed`. Mood drives the HUD companion indicator and affects companion mesh appearance (slight color shift).

- [ ] **Step 4: Verify companion affinities**

Adopt a deer in Forest. Walk near DruidRingTemple. Verify:
- Deer breaks from following and walks ritual path
- Returns to following when player moves away

- [ ] **Step 5: Commit**

```bash
git add src/player/CompanionSystem.ts
git commit -m "feat: companion mystery affinities — fox sensing, deer ritual paths, bird circling, goat stamping"
```

---

## Task 7: Hazard-as-Clue System

**Files:**
- Modify: `src/systems/HazardSystem.ts`
- Modify: `src/systems/WorldState.ts`

- [ ] **Step 1: Expose hazard positions as world data**

HazardSystem currently just applies damage. Extend it to also register hazard zone positions and types in WorldState:

```typescript
// In WorldState
hazardZones: Array<{
  type: string;        // 'lava', 'toxic_gas', 'crystal_shards', 'ice'
  position: THREE.Vector3;
  radius: number;
  biome: BiomeType;
}>;
```

- [ ] **Step 2: Add hazard-follows-pattern logic**

For specific hazard types, make their positions trace meaningful patterns:
- Toxic gas in Swamp: follows straight lines (ancient pipe network). Gas vents are spaced 15 units apart in lines pointing toward the Resonance Site.
- Lava in Volcanic: flows trace paths converging on ObsidianCitadel (power conduits).
- Crystal shards in Crystal: grow in lines radiating from CrystalCathedral (communication network).
- Ice patches in Snow: form over specific spots near IcePalace (preserved artifacts below).

These patterns are generated deterministically from the site position and a seed.

- [ ] **Step 3: Verify hazard patterns**

Visit Swamp. Observe toxic gas vents. Verify they form lines pointing toward the ziggurat. Use fly mode to see the pattern from above.

- [ ] **Step 4: Commit**

```bash
git add src/systems/HazardSystem.ts src/systems/WorldState.ts
git commit -m "feat: hazards as mystery clues — gas pipes, lava conduits, crystal networks, ice markers"
```

---

## Task 8: Day/Night Mystery Effects

**Files:**
- Modify: `src/engine/Engine.ts`
- Modify: `src/systems/WorldState.ts`

- [ ] **Step 1: Implement "thin times" at dawn and dusk**

When `isDawn` or `isDusk` is true in WorldState:
- Creature site-awareness effects intensify (glow brighter, patterns more visible)
- Lore stones that are normally invisible become faintly visible
- Ambient audio shifts slightly (minor key undertone)
- God ray intensity increases by 50%

- [ ] **Step 2: Night-only lore stones**

Add a `nightOnly: boolean` property to some lore stones. These are invisible during day, glow at night. Approximately 30% of lore stones should be night-only.

- [ ] **Step 3: Time-dependent NPC dialogue**

Add `timeCondition?: 'day' | 'night' | 'dawn' | 'dusk'` to NPC dialogue entries. Some dialogue lines only available at certain times. NPCs share secrets at night they won't say during the day.

- [ ] **Step 4: Verify thin times**

Use debug panel to set time to dusk. Visit Forest landmark. Verify:
- Creature glows are brighter
- Additional lore stones visible
- God rays enhanced

- [ ] **Step 5: Commit**

```bash
git add src/engine/Engine.ts src/systems/WorldState.ts src/journal/LoreStone.ts src/npcs/NPCData.ts
git commit -m "feat: day/night mystery effects — thin times at dawn/dusk, night-only lore, timed NPC dialogue"
```

---

## Task 9: Creature Audio as Mystery Clue

**Files:**
- Modify: `src/audio/CreatureSound.ts`

- [ ] **Step 1: Normal baseline sounds**

Ensure each creature species has a characteristic call that plays periodically during normal behavior. Players learn what "normal" sounds like for each species.

- [ ] **Step 2: Site-proximity audio changes**

When creature is in `reverence` or `resonating` state (near a Resonance Site):
- Pitch shifts up slightly (multiply frequency by 1.15)
- Calls become rhythmic (regular intervals instead of random)
- Herbivores in unison: synchronize call timing when multiple are near site
- Predators go silent (stop all calls)

- [ ] **Step 3: Destabilization zone audio**

When creature is in a low-stability biome (biomeStability < 0.5):
- Calls have random pitch distortion (±20% frequency jitter)
- Timing becomes irregular (random delays)
- Overlapping calls from different species

- [ ] **Step 4: Verify creature audio clues**

Visit Forest landmark. Listen for:
- Deer calls becoming rhythmic near the site
- Wolves going quiet near the site
- Return to normal sounds when walking away

- [ ] **Step 5: Commit**

```bash
git add src/audio/CreatureSound.ts
git commit -m "feat: creature audio as mystery clues — rhythmic near sites, distorted in unstable zones"
```

---

## Task 10: Integration & Forest Hero Biome Verification

**Files:**
- Modify: `src/engine/Engine.ts`

- [ ] **Step 1: Verify all systems read from WorldState**

Ensure update loop passes WorldState to:
- CreatureManager (weather response, ecology, site awareness)
- WeatherSystem (site interactions)
- HazardSystem (pattern generation)
- CompanionSystem (mystery affinities)
- AudioSystem / CreatureSound (site proximity audio)

- [ ] **Step 2: Full Forest biome verification**

Play the Forest biome for 10+ minutes. Verify the full experience:
- Deer herd together (ecology)
- Wolves hunt deer, establish territory (ecology)
- During rain: deer seek shelter, wolves hunt more (weather response)
- Near DruidRingTemple: deer face site, glow, walk in circle (site awareness)
- Wolves stop hunting near temple (truce zone)
- Rain near temple: water channels appear (weather-site)
- Dawn/dusk: enhanced glow, more lore stones visible (thin times)
- With deer companion: deer walks ritual path (companion affinity)
- With fox companion: ears point toward lore stones (companion affinity)
- Creature sounds become rhythmic near temple (audio clues)
- Toxic gas (if any) follows patterns (hazard clues)
- All transitions smooth, no jarring changes

- [ ] **Step 3: Performance check**

Verify >30 FPS with all systems active in Forest. Profile if needed.

- [ ] **Step 4: Commit**

```bash
git add src/engine/Engine.ts
git commit -m "feat: Layer 2 complete — connected systems verified in Forest hero biome"
```

---

## Layer 2 Completion Checklist

Before moving to Layer 3, verify:
- [ ] WorldState exists and all systems read/write to it
- [ ] Creatures respond to weather (shelter, migration, hunkering)
- [ ] Creatures exhibit ecology (herding, food chain, territory)
- [ ] Creatures respond to Resonance Sites (reverence, glowing, ritual paths)
- [ ] Weather reveals secrets at sites
- [ ] Companion has mystery-solving affinities
- [ ] Hazards trace meaningful patterns
- [ ] Dawn/dusk are "thin times" with enhanced mystery effects
- [ ] Creature audio changes near sites
- [ ] Forest hero biome fully demonstrates all connected systems
- [ ] >30 FPS performance target maintained
