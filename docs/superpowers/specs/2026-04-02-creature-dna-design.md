# Creature DNA System — Sub-project 1: Data Model, Presets, Breeding

## Summary

Replace the fixed-species creature system with a DNA-based genome that defines creature morphology, appearance, and behavior. This sub-project covers the data model, 20 initial preset genomes, and breeding/crossover logic. Visual mesh generation (sub-project 2) and full integration (sub-project 3) follow separately.

## Scope

- `CreatureDNA` interface with structured named fields
- Gene-to-gameplay-stats mapping (`dnaToStats()`)
- 20 preset DNA objects across 5 body plans
- Breeding: same-body crossover, cross-body hybrid inheritance, mutation
- Wire DNA into `Creature` class and `CreatureManager` spawning/breeding

Out of scope: procedural mesh generation from DNA (sub-project 2), removing old `Species.ts` / `CreatureMesh.ts` (sub-project 3).

## DNA Interface

```typescript
type BodyPlan = 'quadruped' | 'insectoid' | 'avian' | 'aquatic' | 'serpentine'

interface CreatureDNA {
  bodyPlan: BodyPlan

  // Morphology (0-1 normalized)
  bodyLength: number
  bodyWidth: number
  bodyHeight: number
  headSize: number
  neckLength: number

  // Limbs
  legCount: number        // continuous 0-1, quantized to 0/2/4/6/8
  legLength: number
  legThickness: number

  // Appendages (presence threshold: >0.5 = present)
  hasWings: number
  wingSpan: number
  hasTail: number
  tailLength: number
  hasHorns: number
  hornSize: number
  hasClaws: number
  clawSize: number
  hasMandibles: number
  hasFins: number
  finSize: number
  hasAntennae: number

  // Appearance
  bodyColor: [number, number, number]   // RGB 0-1
  accentColor: [number, number, number] // RGB 0-1
  eyeSize: number
  eyeCount: number                      // continuous, quantized to 2/4/6/8

  // Behavior
  speed: number
  aggression: number    // 0 = herbivore, 1 = apex predator
  size: number          // overall scale multiplier
}
```

All numeric genes are 0-1 normalized unless noted. Mapping to world units happens in `dnaToStats()`.

## Gene-to-Stats Mapping

`dnaToStats(dna: CreatureDNA)` returns a `DerivedStats` object used by the AI and lifecycle systems:

| Gene | Derived Stat | Mapping |
|------|-------------|---------|
| `speed` | `maxSpeed` | `2 + speed * 10` (2-12) |
| `speed` | `fleeSpeed` | `maxSpeed * 1.8` |
| `aggression` | `role` | `> 0.5` = predator, else herbivore |
| `aggression` | `attackDamage` | predators: `aggression * 20`, herbivores: 0 |
| `aggression` | `attackRange` | predators: `1.5 + aggression`, herbivores: 0 |
| `aggression` | `sightRange` | `5 + aggression * 15` (5-20) |
| `size` | `adultScale` | `0.4 + size * 2.6` (0.4-3.0) |
| `size` | `babyScale` | `adultScale * 0.4` |
| `bodyPlan` | `mobility` | aquatic=water, avian=air, others=ground |
| `size` | `maxHunger` | `120 + size * 360` (120-480) |
| `size` | `maxThirst` | `90 + size * 270` (90-360), 0 for aquatic |
| `size` | `maxAge` | `300 + size * 600` (300-900) |
| `size` | `maxEnergy` | 100 (flat) |
| `bodyLength, bodyWidth, bodyHeight` | `bodyW, bodyH, bodyD` | Scaled by `adultScale`: `0.2 + gene * 1.5` each |

## Preset DNA Objects

20 presets distributed across body plans:

### Quadrupeds (6)
| Name | Key traits |
|------|-----------|
| Elk | Large, long legs, horns, fast, herbivore |
| Wolf | Medium, high aggression, pack predator |
| Bear | Large body, thick legs, moderate aggression |
| Fox | Small, fast, low aggression |
| Rabbit | Tiny, very fast flee, herbivore |
| Mammoth | Very large, thick everything, horns, slow |

### Insectoids (5)
| Name | Key traits |
|------|-----------|
| Beetle | Small, thick body, mandibles, 6 legs, slow |
| Spider | Medium, 8 long thin legs, high aggression |
| Mantis | Tall, claws, 6 legs, predator |
| Ant | Tiny, 6 legs, antennae, herbivore |
| Centipede | Long body, 8 legs, low and wide |

### Avians (4)
| Name | Key traits |
|------|-----------|
| Eagle | Large wingspan, talons, predator |
| Songbird | Small, colorful accent, herbivore |
| Parrot | Medium, bright colors, long tail |
| Bat | Dark colors, wide wings, small body |

### Aquatic (3)
| Name | Key traits |
|------|-----------|
| Shark | Large, fins, high aggression |
| Goldfish | Small, colorful, large fins, herbivore |
| Eel | Serpentine-like, long body, small fins |

### Serpentine (2)
| Name | Key traits |
|------|-----------|
| Snake | Long, thin, moderate aggression |
| Wyrm | Very large, thick, high aggression, horns |

Each preset is a complete `CreatureDNA` object with all fields set to produce the described creature.

## Breeding

### Same Body Plan (common)

When both parents share a body plan:
1. Baby inherits the shared `bodyPlan`
2. For each numeric gene: randomly pick parent A or B's value (50/50)
3. Apply mutation: 3% chance per gene of random offset (uniform +-0.1, clamped to 0-1)
4. Color genes: interpolate between parents with random blend factor (0.3-0.7), then mutate

### Cross Body Plan (rare)

When parents have different body plans:
- **Chance**: 15% of breeding attempts between different body plans succeed (85% fail silently — creatures just don't mate)
- Baby inherits one parent's `bodyPlan` (random pick)
- Morphology and behavior genes: crossover same as same-body (50/50 per gene)
- Appendage presence genes from the non-chosen parent bleed in at 30-50% strength: `babyGene = chosenParentGene * 0.6 + otherParentGene * 0.4`
- This produces e.g., a quadruped with partial wing genes, or an avian with mandible genes

### Mutation

- 3% per gene per breeding event
- Offset: uniform random in [-0.1, +0.1]
- Clamped to [0, 1]
- Color channels mutate independently
- `bodyPlan` never mutates (only changes via cross-body breeding)

## Integration with Existing System

### Creature.ts

Add field:
```typescript
dna: CreatureDNA
```

### CreatureManager.ts — Spawning

Replace `BIOME_SPAWN_TABLE` lookups with DNA preset selection:
- Each biome maps to a weighted list of preset names
- On spawn, pick a preset, clone its DNA, apply light random variation (+-0.05 per gene)
- Create creature with that DNA, derive stats via `dnaToStats()`

### CreatureManager.ts — Breeding

Replace `spawnBaby()`:
- Instead of `new Creature(parentA.species, ...)`, call `breedDNA(parentA.dna, parentB.dna)` to produce baby DNA
- Create baby from the bred DNA
- Cross-body check: if parents have different body plans, 15% success rate

### Backward Compatibility

During sub-project 1, creatures still render using the existing `CreatureMesh` system. A temporary `dnaToSpeciesId()` function maps the DNA's body plan + traits to the closest existing `SpeciesId` for rendering. This gets removed in sub-project 2.

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/creatures/CreatureDNA.ts` | `CreatureDNA` interface, `BodyPlan` type, `DerivedStats` interface, `dnaToStats()`, `dnaToSpeciesId()` (temp), gene range constants |
| Create | `src/creatures/DNAPresets.ts` | 20 preset `CreatureDNA` objects, biome-to-preset mapping |
| Create | `src/creatures/DNABreeding.ts` | `breedDNA(a, b)`, `mutateDNA(dna)`, crossover logic |
| Modify | `src/creatures/Creature.ts` | Add `dna: CreatureDNA` field, accept DNA in constructor |
| Modify | `src/creatures/CreatureManager.ts` | Spawn from presets, breed with `breedDNA()`, derive stats from DNA |
