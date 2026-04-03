# The Living Field Guide — Game Loop Design Spec

## Overview

A naturalist-ecologist game loop built on top of the existing creature DNA, terrain generation, and behavior systems. The player is a wildlife photographer and ecologist who documents creatures through photography, fills a field guide, unlocks ecological knowledge, and uses that knowledge to influence ecosystems — producing new mutations and behaviors to discover and photograph.

**Core fantasy:** You are a naturalist exploring an alien world. Your camera is your primary tool. Every creature is worth documenting. Your understanding of the ecosystem gives you the power to shape it.

**Core loop:** Photograph creatures → Fill field guide → Unlock ecological knowledge → Place environmental items to influence ecosystems → New mutations/behaviors emerge → Photograph those → Repeat

---

## 1. Camera System

### Entering Camera Mode

- **Toggle key:** `C` (or configurable)
- **Viewfinder overlay:** Slight zoom (1.5x), subtle vignette border, film-grain filter to contrast with normal view
- **Movement:** Player speed reduced to creep (~3 units/s) while in camera mode
- **Exit:** Press same key or right-click

### Taking a Photo

- **Capture:** Left-click while in camera mode
- **Feedback:** Brief shutter animation (screen flash + procedural shutter sound), photo freezes for ~1 second
- **Detection:** Raycast from camera center, detect creatures within a cone (similar to existing combat hit detection but wider, ~30 degrees). All creatures in the cone are "in frame."

### Photo Evaluation

Each photo is immediately scored and a result card is shown:

- **Creature name** (or "Unknown Variant" if first sighting of this variant)
- **Behavior captured** (current creature state)
- **Rarity tier** (Common / Uncommon / Rare / Legendary)
- **"NEW" badge** if first photo of this variant
- **Star rating** (1-5 stars)

### Scoring Formula

```
baseScore = creatureRarityScore (0-100)
behaviorMultiplier = lookup from behavior table
firstDiscoveryMultiplier = 2.0 if new variant, 1.0 otherwise
finalScore = baseScore * behaviorMultiplier * firstDiscoveryMultiplier
stars = map finalScore to 1-5 range
```

**Behavior multipliers:**
| Behavior | Multiplier |
|----------|------------|
| idle, wander | x1.0 |
| eating, drinking | x1.2 |
| herding, seek_mate | x1.5 |
| hunting, fleeing, chase | x1.8 |
| breeding, courtship | x2.0 |
| reverence | x2.5 |
| resonating | x3.0 |

### Photo Storage

- Photos stored as metadata only (creature variant ID, behavior, score, biome, timestamp). No actual screenshots — the field guide reconstructs the visual from DNA data.
- Keep best photo per species variant (highest score).
- Total photo count tracked for stats.

---

## 2. Creature Variant & Rarity System

### Variant ID

Creatures are grouped into "variants" for field guide purposes using a quantized DNA fingerprint:

```
variantID = hash(
  bodyPlan,
  sizeBucket(size),        // S (<0.33), M (0.33-0.66), L (>0.66)
  appendageFlags(wings, tail, horns, claws, mandibles, fins, antennae),  // 7-bit binary
  colorFamily(bodyColor),  // 8 hue buckets (45-degree segments)
  legCountBucket(legCount) // 0, 2, 4, 6+
)
```

Two creatures with the same variant ID are "the same species" in the field guide. This creates a large but finite variant space — enough for hundreds of discoverable species without being infinite.

### Rarity Calculation

Rarity measures how far a creature's DNA has drifted from the nearest preset:

```
rarityScore = weightedDistance(creatureDNA, nearestPresetDNA)
```

**Gene weights (higher = more visually distinct = more rare impact):**
- Appendage presence: weight 3.0
- Body proportions (length, width, height): weight 2.0
- Limb count/length: weight 2.0
- Color deviation: weight 1.5
- Eye/head size: weight 1.0
- Behavioral genes (speed, aggression): weight 0.5

**Rarity tiers:**
| Tier | Distance | Spawn Frequency |
|------|----------|-----------------|
| Common | 0-10% | ~60% of population |
| Uncommon | 10-25% | ~25% of population |
| Rare | 25-50% | ~12% of population |
| Legendary | 50%+ or cross-body-plan | ~3% of population |

### Rarity in the Wild

- Normal breeding: mostly Common, occasional Uncommon
- Breeding near resonance sites: increased mutation rate → more Uncommon/Rare
- Catalyzed resonance sites (player tool): Rare/Legendary possible
- Cross-biome edge zones: unusual species combos
- Healthy diverse populations: bigger breeding pool → more variance

---

## 3. Field Guide

### Structure

Replaces/extends the existing journal system. Organized by **body plan** (5 tabs: Quadruped, Insectoid, Avian, Aquatic, Serpentine), then by species variant within each.

### Species Page — 4 Knowledge Tiers

**Tier 1 — Silhouette:**
- Trigger: Creature spotted (entered player view at close range)
- Shows: Dark silhouette outline, "???" for all stats, biome where first seen
- Unlocks: Nothing — just awareness

**Tier 2 — Documented:**
- Trigger: First photo taken of this variant
- Shows: Name, body plan, base appearance (reconstructed from DNA), biome, rarity tier
- Displays: Your photo (best score)
- Unlocks: Creature appears on the world map

**Tier 3 — Studied:**
- Trigger: Photos of 3+ different behaviors captured
- Shows: Behavioral notes ("hunts in packs," "herds near water," "reveres resonance sites"), diet preference, preferred biome conditions, active hours
- Displays: Your best photos per behavior
- Unlocks: Companion can detect this species at greater range

**Tier 4 — Mastered:**
- Trigger: All common behaviors photographed + at least 1 rare behavior (ritual, resonating, or breeding)
- Common behaviors (any 3 required for Tier 3): idle, wander, eating, drinking, flee, sleep, sheltering
- Rare behaviors (any 1 required for Tier 4): reverence, resonating, courtship/mating, hunting (predators only), herding (social species only)
- Shows: Full ecological profile — what attracts it, what repels it, what conditions influence its offspring
- Displays: Best photo collection for this species
- Unlocks: **Ecological tools for this species**

### Cover Page Stats

- Variants discovered / per body plan (total is hidden — you never know the ceiling)
- Completion percentage per biome (based on what you've found, not what exists)
- Total unique behaviors captured
- Highest-scored photo

---

## 4. Ecological Tools

### Unlock Mechanism

Mastering a species in the field guide reveals its ecological profile, which translates into placeable environmental items. You don't unlock generic tools — you unlock species-specific knowledge that informs tool crafting.

### Tool Categories

#### Attractors
Items that draw creatures to an area.

- **Food sources** — Species-appropriate bait. Herbivore berries, meat caches for predators, nectar pools for insectoids, fish for aquatic. Each species profile tells you what works.
- **Nesting sites** — Encourage creatures to stay and breed. Brush piles for small quadrupeds, elevated perches for avians, burrow markers for serpentines, hive structures for insectoids.
- **Water features** — Small pools that create gathering points. Universal attractor, stronger for aquatic/amphibious creatures.

#### Repellers
Items that push creatures away from an area.

- **Predator scent markers** — Scare prey species away. Useful for protecting a breeding population.
- **Fire pits** — Keep most creatures at distance. Creates safe zones or exclusion corridors.

#### Catalysts
Special items that influence mutation and breeding.

- **Resonance amplifiers** — Placeable only near existing resonance sites (within 15 units). Increases mutation rate for all breeding within a 30-unit radius. The primary way to push toward rare/legendary creatures.
- **Biome essence** — Collected passively as you spend time in each biome (1 essence per 5 minutes spent in a biome, max 3 stored per biome type). Place it to subtly shift environmental conditions in a small area — desert essence near a forest might produce heat-adapted forest creatures. Influences mutation *direction*, not just rate.

### Placement Rules

- **Radial menu:** Hold a key (e.g., `T` for tools) to open radial selection, pick item, click to place at feet.
- **Placement limits:** 5 attractors, 3 repellers, 2 catalysts active at a time. Can pick up and relocate.
- **Persistence:** Placed items save to localStorage alongside existing world state.
- **Visibility:** Items rendered as small procedural objects in the world (berry pile, fire pit, glowing crystal, etc.)

### Ecosystem Response

- **Not instant.** Creatures respond gradually over 2-3 day/night cycles.
- **Attractors:** Creatures within awareness range (~30 units) add the attractor as a wander target. Over time, population density shifts toward attractors.
- **Repellers:** Creatures within range avoid the area. Predator scent triggers flee behavior in prey species.
- **Catalysts:** Breeding events within catalyst radius apply a mutation rate bonus. Resonance amplifier: +50% mutation magnitude. Biome essence: biases mutation direction toward that biome's preferred traits.
- **Cascading effects:** More prey in an area attracts predators naturally (existing ecology behavior). Predator pressure causes prey to flee, potentially to your other setups. Population shifts change breeding pool. These cascades happen through existing systems — no new simulation needed.

---

## 5. Core Loop Integration

### Minute-to-Minute

Walking through a biome, camera ready. Spot creatures, photograph them. Hunt for interesting behaviors and rare variants. Follow creatures to catch them doing something unusual. Every chunk is a potential discovery.

### Hour-to-Hour

Multiple species documented in a biome. Mastered a few — now placing attractors near a resonance site to concentrate breeding. Head to a new biome to explore. Return later to check results, photograph new offspring variants.

### Session-to-Session

Multiple biomes with nurtured ecosystems producing increasingly unique populations. Catalyst placement creating mutation hotspots. Field guide filling with rare and legendary variants. Each session offers both new biomes to explore and established ecosystems to check on.

### Harmony System Integration

Documenting creatures IS the observation phase of the existing ritual system. A biome where you've mastered most species and nurtured a healthy ecosystem naturally triggers ritual activation conditions — the creatures are present, behaving correctly, because the player made it happen. The camera replaces passive ritual observation with active engagement. Harmony progression becomes a consequence of good ecology, not a separate objective.

### Companion Integration

Companions gain photography/ecology-relevant affinities:
- **Fox:** Highlights rare creatures with a glow so you don't miss them
- **Bird/Parrot:** Circles above creatures in rare behaviors — timing cue for photos
- **Deer:** Shows trails toward biomes with undiscovered variants
- **Goat:** Reveals good catalyst placement spots near resonance sites
- **Rabbit:** Speed bonus helps chase/follow creatures for action shots

### XP Shift

Photography contributes XP alongside (or replacing) combat kills:
- Documenting a new variant: XP based on rarity tier
- Reaching a new knowledge tier: bonus XP
- Mastering a species: large XP reward
- XP still feeds into attunement tiers (which now also benefit ecological tool effectiveness)

---

## 6. Scope & System Changes

### New Systems to Build
1. Camera mode (viewfinder overlay, photo capture, scoring engine, result card UI)
2. Variant ID system (DNA fingerprinting function, rarity score calculation)
3. Field guide UI (species pages, 4 tiers, photo display, completion stats)
4. Ecological tools (item definitions, radial placement menu, world persistence)
5. Creature response to placed items (attraction/repulsion radius checks)
6. Mutation rate modifiers (catalyst proximity influence on breeding)

### Existing Systems to Extend
- **CreatureDNA** — add `calculateRarityScore()`, `getVariantID()`
- **DNABreeding** — mutation rate modifier parameter from nearby catalysts
- **CreatureManager** — wander target influenced by nearby attractors/repellers
- **Journal system** — refactor into field guide structure with tiers
- **CompanionSystem** — new affinities for photography/ecology
- **RitualSystem** — tie activation to field guide mastery thresholds
- **WorldState** — track placed tools, per-biome discovery stats
- **HUD** — camera mode overlay, photo result card

### Systems Unchanged
- Terrain generation, biomes, chunks
- Creature behavior layers (ecology, site awareness, weather response)
- Combat and traversal mechanics
- Audio system
- Rendering and post-processing
- NPC/dialogue, lore stones
- Day/night cycle, weather system

### De-emphasized
- Combat becomes secondary — still present for dangerous biomes (Volcanic, Hell, enemies) but not the main engagement loop
- XP source shifts from primarily combat to primarily photography
