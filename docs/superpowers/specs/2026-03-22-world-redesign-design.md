# World Redesign: Connected Systems, Mystery Narrative & Visual Polish

**Date:** 2026-03-22
**Status:** Draft
**Project:** Retro Procedural Engine (claudemobile)

## Overview

A comprehensive redesign of the procedural world engine, transforming it from a collection of independent systems into a cohesive cozy-exploration + mystery-unraveling experience. The player explores a beautiful, strange world and gradually discovers that a fallen civilization's experiments have destabilized the planetary harmonic balance. Creatures, weather, and the environment itself are clues to understanding and restoring the world.

**Target platform:** Desktop browser (Chrome/Firefox on a decent laptop)
**Core experience:** Cozy exploration + mystery unraveling (Journey meets Outer Wilds)
**Progression model:** Knowledge-gated -- the world is open from the start, but understanding what to do IS the progression

## 1. Biome Consolidation (22 → 11)

### Rationale
22 biomes spread content too thin. Consolidating to 11 allows each biome to be deep, distinct, and narratively meaningful.

### The 11 Biomes

| # | Biome | Identity | Mystery Role | Absorbs From |
|---|-------|----------|-------------|-------------|
| 1 | **Forest** | Starting home. Familiar, safe, lush. | Tutorial ground. First lore fragments. Creatures behave "normally" -- baseline for noticing anomalies elsewhere. | -- |
| 2 | **Desert** | Vast, exposed, ancient. Buried structures. | The civilization's heartland. Most ruins, deepest lore. Sand reveals and conceals. | Savanna, Oasis |
| 3 | **Swamp** | Murky, unsettling, overgrown. | Corruption epicenter. Destabilization most visible. Creatures behave erratically. | Bog, Mushroom (as sub-region) |
| 4 | **Snow** | Frozen, preserved, quiet. | Time capsule. Things preserved in ice. Creatures here remember the old world. | Alpine, Cliffs, Tundra, Taiga |
| 5 | **Volcanic** | Dangerous, dramatic, molten. | The engine room. The civilization's power source. | Ash Wastes |
| 6 | **Crystal Caverns** | Otherworldly, glowing, resonant. | The communication network. Crystals carry signals. | -- |
| 7 | **Jungle** | Dense, vertical, alive. | Overgrown civilization. Nature reclaiming technology. | -- |
| 8 | **Mesa** | Stark, layered, exposed geology. | The archive. Geological strata tell the story. | Badlands |
| 9 | **Coral Coast** | Coastal, tidal, vibrant. | The civilization's port/trade hub. Tidal cycles reveal secrets. | Coral Reef |
| 10 | **Heaven (Skylands)** | Floating, ethereal, serene. | The civilization's greatest achievement, now crumbling. | Floating Islands |
| 11 | **Hell (Depths)** | Dark, oppressive, unstable. | The failed experiment. Source of destabilization. Final zone. | -- |

### Implementation Details
- Remove 11 biome definition files, merge unique features into parent biomes
- Increase BiomeMap seed spacing from 180 to ~280 units (larger territories)
- Update Voronoi generation to produce fewer, bigger cells
- Migrate unique terrain features (mushroom formations, oasis pools, etc.) into parent biomes as sub-regions
- Hero biome for proving all systems: **Forest**

## 2. Visual System Overhaul

### Global Base (Subtle Retro)
- **Scanlines:** Reduce intensity by ~60% from current
- **Film grain:** Reduce by ~40%
- **Vignette:** Keep as-is (soft)
- **Barrel distortion:** Remove entirely
- **Pixelation:** Keep 640x480 internal resolution (performance strategy)

### Per-Biome Visual Identity

Each biome defines its own visual parameters:

**Color Grading (per biome):**
- Forest: warm greens/golds
- Desert: hot amber/ochre
- Swamp: desaturated sickly yellow-green
- Snow: cool blue-white, high brightness
- Volcanic: high contrast, orange/black
- Crystal: cool blues, high saturation
- Jungle: saturated deep greens, humidity haze
- Mesa: terracotta/burnt orange
- Coral Coast: turquoise/coral warm
- Heaven: soft white/gold bloom
- Hell: deep red/black, crushed shadows

**Fog System (per biome):**
- Each biome defines: fog near distance, fog far distance, fog color, fog density curve
- Forest: gentle golden haze
- Desert: heat shimmer at distance
- Swamp: thick low-lying white fog
- Volcanic: dark ash fog, close
- Crystal: minimal fog (glow provides depth)
- Snow: white-out at distance
- Jungle: green-tinted humidity
- Mesa: dust haze
- Coral Coast: sea spray mist
- Heaven: ethereal white wisps
- Hell: oppressive dark red

**Ambient Light Color (per biome):**
- Tints all lighting. Crystal: faint blue from below. Hell: deep red. Heaven: soft white bloom.

**Particle Atmosphere (per biome):**
- 100-200 instanced billboard quads per biome
- Forest: dust motes, pollen
- Desert: sand particles
- Swamp: fireflies (night), spores
- Snow: gentle constant flakes
- Volcanic: embers, ash
- Crystal: floating light specks
- Jungle: rain drops, insects
- Mesa: dust devils
- Coral Coast: sea spray, sand
- Heaven: light motes ascending
- Hell: ash, ember, smoke wisps

**Time-of-Day Personality (per biome):**
- Each biome has different "best" times: Forest golden hour, Desert at sunset, Swamp is terrifying at night, Crystal is always glowing

### New Visual Effects
- **God rays:** Screen-space radial blur from sun position (~1ms cost)
- **Distance haze:** Separate from fog, color-matched per biome
- **Ground fog layer:** Transparent plane per chunk, noise-driven alpha (Swamp, Forest at dawn)
- **Heat distortion:** UV offset shader for Desert/Volcanic (reuse underwater pass logic)

### Biome Transition System
- Smoothly interpolate ALL visual parameters over ~5 seconds when crossing boundaries
- Parameters: fog, particles, ambient light, color grade, post-processing weights
- Should feel like walking into a different painting

## 3. Audio Redesign

All audio remains procedural (no audio files). Three simultaneous layers.

### Layer 1: Ambient Atmosphere (Always Present)

Each biome gets a unique soundscape from 3-4 procedural generators:

| Biome | Base Drone | Texture Layer | Detail Layer | Occasional |
|-------|-----------|--------------|-------------|-----------|
| Forest | Warm low hum | Wind through canopy | Bird calls, twig snaps | Distant waterfall |
| Desert | Deep resonant void | Sand whisper/wind | Insect buzz | Distant rumble |
| Swamp | Murky low throb | Bubbling, dripping | Frog chorus, squelch | Splash, groan |
| Snow | White noise wind | Ice creak | Silence gaps (!) | Crack, avalanche rumble |
| Volcanic | Rumbling bass | Hiss, vent steam | Rock crumble | Eruption boom |
| Crystal | Pure sine harmonics | Resonant shimmer | Chime cascades | Harmonic sweep |
| Jungle | Dense layered hum | Rain drip, rustle | Monkey calls, insects | Thunder |
| Mesa | Hollow wind | Echo on all sounds | Rock fall | Canyon moan |
| Coral Coast | Wave rhythm | Underwater gurgle | Seabird cries | Shell wind chime |
| Heaven | Ethereal choir pad | Wind harp | Bell tones | Silence swells |
| Hell | Distorted bass growl | Metal stress | Whispers | Impact/collapse |

**Key principle:** Silence is a tool. Snow has quiet moments. When creatures go silent near mystery sites, the absence of the creature layer is felt because ambient continues.

### Layer 2: Adaptive Music
- Music fades in and out based on context, not constant
- **Exploration melody:** Simple, sparse motif per biome. Piano-like for Forest, plucked strings for Desert
- **Mystery proximity:** Harmonic undertone builds near ancient sites. Dissonant intervals that resolve on discovery
- **Danger/weather:** Percussion layers during storms or predator encounters
- **Discovery moment:** Brief melodic flourish on finding lore or completing rituals
- **Silence:** Music absent 30-40% of the time. Atmosphere carries those moments.

### Layer 3: Creature Audio as Mystery Mechanic
- **Normal behavior:** Characteristic calls per species. Player learns baseline.
- **Near ancient sites:** Pitch shifts, calls become rhythmic/patterned, almost musical. Herbivores hum in unison. Predators go quiet.
- **Destabilization zones:** Creature sounds distort. Calls overlap wrong. Timing breaks down.
- **Ritual resonance:** During activation, nearby creatures harmonize with site frequency. Ecosystem sings together.
- **Species-specific clues:** Foxes whimper near corruption. Birds circle above hidden entrances.

### Audio Budget
- Web Audio API handles layering well -- 3-4 oscillator groups per ambient layer
- Spatial panning already exists, add frequency modulation near sites
- Music: simple sequencer, negligible CPU vs rendering
- Reuse/modulate AudioNodes rather than create/destroy

## 4. Connected Systems -- The Ecology Web

### Core Principle
Every system reads from and writes to shared WorldState. Nothing exists in isolation.

### Weather ↔ Creatures
- Rain: herbivores seek shelter, predators hunt more aggressively
- Blizzards: all creatures hunker down. Moving creature in blizzard = mystery clue
- Sandstorms: push creatures toward oases. Follow migration to find water
- Clear nights: creatures gather in open areas. Some species nocturnal only

### Creatures ↔ Creatures (Ecosystem)
- Visible food chain: herbivores graze → predators stalk → scavengers wait
- Territorial behavior: wolf packs claim areas, other predators avoid
- Herd behavior: herbivores group, move together, flee together
- Population effects: predator absence → herbivore overpopulation → less vegetation

### Creatures ↔ Ancient Sites
**Core mystery mechanic:**
- Within ~30 units of ruin/ritual site, creature behavior changes
- Herbivores face site, stop grazing, stand still (reverent)
- Predators won't hunt near sites (truce zone)
- Species "attuned" to specific biome sites (deer→Forest, camel→Desert)
- Attuned creatures glow faintly near their site, move in ritual patterns
- Following a creature's path around a site reveals hidden lore stones

### Weather ↔ Ancient Sites
- Rain fills channels showing water paths in ruins
- Sandstorm uncovers buried walls
- Lightning strikes same spots near sites -- not random
- Fog parts in corridors around swamp sites -- showing paths
- Snow melts in patterns around tundra sites -- revealing symbols

### Day/Night ↔ Everything
- Dawn/dusk are "thin" times -- mystery effects intensify
- Some lore stones only glow at night
- Certain ritual behaviors only at specific times
- NPC dialogue changes by time of day

### Companion ↔ Mystery
Companion species have mystery-solving affinities:
- **Fox:** Senses lore stones at greater range, ears perk toward hidden ones
- **Deer:** Resonates near Forest/Snow sites, walks ritual paths
- **Bird:** Spots hidden symbols from above, circles over buried secrets
- **Goat:** Reaches elevated mystery spots (jump bonus), stamps near hidden ground items
- Companion reactions become the player's "detector"

### Hazards ↔ Mystery
Environmental hazards are clues:
- Toxic gas follows ancient pipe networks underground
- Lava flows trace civilization power conduits
- Crystal shards grow along communication network lines
- Ice patches form over preserved artifacts below

## 5. The Mystery -- Narrative & Progression

### The Lore: The Resonance Builders

An ancient civilization discovered the world's biomes aren't natural -- they're *frequencies*. Each biome is a node in a planetary harmonic system. Together the biomes form a chord that keeps the world stable.

The Builders learned to tap these frequencies. They built **Resonance Sites** at each biome's harmonic center. They could amplify biomes, communicate through Crystal networks, ascend to the Skylands by riding harmonics upward.

**The Fall:** They pushed too hard, trying to create a new frequency -- a new biome. The experiment cracked the harmonic balance. The Depths (Hell) is that failed biome -- a dissonant frequency bleeding into the others. Creatures feel it. Weather distorts around it. Most Builders perished; some ascended to Heaven.

**The Present:** The world is going out of tune. Each Resonance Site can be re-harmonized through a ritual, but the player must understand that biome's frequency first. Creatures are the key -- they naturally resonate with their home biome.

### Progression Phases

**Phase 1 -- Oblivious Exploration (30-60 min)**
- Free exploration, enjoying the world
- Notices creatures act weird near ruins
- Finds lore stones with cryptic fragments about "the hum" and "the chord"
- Journal auto-collects observations

**Phase 2 -- Pattern Recognition**
- Connecting dots: creatures face ruins, weather hits the same spots
- NPCs (2-3 per biome) provide fragments: "The deer used to sing here"
- Journal groups related discoveries, forms biome headers
- First ritual becomes solvable

**Phase 3 -- Active Investigation**
- Seeks each biome's ritual requirements
- Each ritual needs: observation + creature + condition + action
- Activating a site improves that biome visibly (colors, creature health, weather)
- Reveals a fragment of the "world chord" -- a persistent musical tone

**Phase 4 -- The Full Picture**
- Understands the Depths is the source
- Final ritual requires harmonics from multiple activated biomes
- Resolution: completing the chord -- a harmonic climax, not a boss fight

### Ritual Design (Per Biome)

Pattern: **observe → understand → arrange → activate**

| Biome | Observe | Creature | Condition | Action |
|-------|---------|----------|-----------|--------|
| Forest | Deer circle a grove at dusk | Deer | Dusk, clear | Stand at grove center while deer complete circle |
| Desert | Camels kneel facing buried monument at dawn | Camel | Dawn, post-sandstorm | Uncover sand-buried markers |
| Swamp | Frogs croak in rhythm near ziggurat | Toad | Night, during fog | Follow fog corridors to center |
| Snow | Mammoths gather at frozen lake, breath creates patterns | Mammoth | Midnight, clear sky | Walk breath-pattern path on ice |
| Volcanic | Wurms surface along lava channels in sequence | -- (too dangerous) | Eruption calm | Follow wurm path between vents |
| Crystal | All creatures nearby hum in harmony | Any | Any | Find the silent crystal, touch it |
| Jungle | Birds reveal canopy pattern from above | Bird | Rain | Climb to canopy platform |
| Mesa | Fossils in cliff layers glow at sunset | Goat (reaches ledges) | Sunset | Touch fossils bottom to top |
| Coral Coast | Fish swirl in tidal pools forming symbol | -- (aquatic) | Low tide | Walk symbol path exposed by tide |
| Heaven | Skywhales sing the original chord | Bird (flies up) | Always (fading) | Reach central platform, listen |
| Depths | Everything is dissonant, distorted | All harmonics | 8+ sites activated | Carry chord to center, stand still |

### World Response to Activation

Per site activated:
- **That biome:** Colors richer, creatures calmer, weather gentler, faint harmonic tone audible
- **Adjacent biomes:** Slight improvement bleeds over
- **The Depths:** Shrinks slightly, boundary pulls back
- **Global:** Sky fractionally brighter, new note joins ambient world-chord
- **Journal:** Updates with civilization story from that biome's perspective

## 6. UI & Journal Redesign

### Journal as Mystery Board

Three tabs:

1. **World Map** -- Stylized hand-drawn map. Discovered biomes fill in. Activated sites glow. Creature territories marked. Campfire positions shown. Not GPS -- a traveler's sketch.

2. **Observations** -- Grouped by biome. Each page shows:
   - Lore fragments (ordered, gaps visible for missing)
   - Witnessed creature behaviors near sites (auto-logged)
   - Weather patterns noticed
   - NPC quotes
   - When enough observations accumulate: a "hypothesis" hint toward the ritual

3. **The Chord** -- Unlocks after first ritual. Shows activated biome harmonics as visual/audio representations. Each note plays when tab opens. Empty slots for unactivated. This IS the progress screen.

### HUD (Minimal)
- **Health:** Only visible when damaged, fades after 5s
- **Compass:** Subtle top-center. Cardinal directions + faint pull toward nearest undiscovered site (not a waypoint)
- **Interaction prompt:** Small "E" icon near interactables
- **Companion indicator:** Tiny icon showing species + mood (normal / alert / resonating)
- **No minimap** in HUD -- journal map serves that role

### NPC Dialogue
- 2-3 NPCs per biome maximum
- No quest markers or exclamation points
- Short, poetic, cryptic dialogue
- Reference other biomes ("I've heard the desert hums at dawn")
- New lines unlock after player discoveries
- React to companion ("Ah, you travel with a fox. They know things.")

## 7. Technical Architecture

### WorldState (New Central System)
```typescript
interface WorldState {
  activatedSites: Set<BiomeId>
  globalHarmony: number          // 0-1, increases with activations
  biomeStability: Map<BiomeId, number>  // affected by Depths proximity
  creatureBehaviorModifiers: derived
  weatherModifiers: derived
  visualModifiers: derived
}
```
Every system reads from WorldState each frame. Activating a site updates WorldState; all systems naturally respond without hardcoded triggers.

### Creature System Updates
- Keep 500 population cap
- Add behavior layers: base AI (current) + site-awareness + ecology
- Extend spatial grid to index ancient sites and creatures by type
- New creature states: `reverence`, `migrating`, `resonating`
- Keep batch processing at 30/frame, prioritize nearby creatures

### Rendering Budget
- Internal resolution: 640x480 (unchanged)
- Per-biome post-processing: swap shader uniforms, not programs (cheap)
- God rays: ~1ms on integrated GPU
- Ground fog: single transparent plane per chunk
- Atmosphere particles: 100-200 instanced quads per biome
- Distance haze: fog color/density in existing shader

### Save System
- Expand localStorage approach
- Save: activated sites, journal entries, companion bond, campfire positions, NPC dialogue progress, discovered lore
- WorldState derived from saves (not saved directly) -- small, forward-compatible

## 8. Implementation Layers

### Layer 1: Foundation (Biomes + Visuals + Audio Base)
- Consolidate 22 → 11 biomes
- Visual overhaul (per-biome identity, reduced retro effects, new atmospheric effects)
- Audio atmosphere per biome
- Biome transition system upgrade

### Layer 2: Connected Systems
- Weather ↔ creature interactions
- Creature ↔ creature ecology
- Day/night effects on all systems
- Companion mystery affinities
- Hazard ↔ mystery connections
- WorldState system

### Layer 3: Mystery Narrative
- Resonance Sites per biome
- Ritual system (observe → understand → arrange → activate)
- Creature site-awareness behaviors
- Lore stone placement and content
- NPC dialogue writing
- World response to activation

### Layer 4: Polish
- Journal redesign (mystery board with 3 tabs)
- HUD refinement
- Audio clue tuning
- NPC dialogue polish
- Onboarding (first 30 minutes experience)
- The Chord progression screen
- Final ritual / endgame

**Hero biome (Forest) is fully realized during Layer 2-3 before expanding to all biomes.**
