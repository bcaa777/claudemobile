# Creature DNA System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-species creature system with a DNA genome that controls morphology, appearance, and behavior, with 20 initial presets and breeding/crossover.

**Architecture:** `CreatureDNA` is a structured object with named gene fields. `dnaToStats()` maps genes to gameplay values (speed, hunger, role, etc.). `breedDNA()` produces offspring DNA via per-gene crossover with mutation. 20 preset DNA objects serve as initial species. Creatures carry their DNA and derive stats from it instead of looking up the static `SPECIES` table. Existing rendering via `CreatureMesh` is preserved through a temporary `dnaToSpeciesId()` bridge.

**Tech Stack:** TypeScript, Three.js (existing)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/creatures/CreatureDNA.ts` | DNA interface, BodyPlan type, DerivedStats, `dnaToStats()`, `dnaToSpeciesId()`, gene constants |
| Create | `src/creatures/DNAPresets.ts` | 20 preset DNA objects, `BIOME_DNA_TABLE` mapping |
| Create | `src/creatures/DNABreeding.ts` | `breedDNA()`, `mutateDNA()`, crossover logic |
| Modify | `src/creatures/Creature.ts` | Add `dna` field, add `stats` field |
| Modify | `src/creatures/CreatureManager.ts` | Spawn from DNA presets, breed with DNA crossover, read stats from creature instead of SPECIES |

---

### Task 1: Create CreatureDNA interface and dnaToStats

**Files:**
- Create: `src/creatures/CreatureDNA.ts`

- [ ] **Step 1: Create the DNA types and stats mapping**

Create `src/creatures/CreatureDNA.ts`:

```typescript
import { BiomeType } from '../biomes/types'
import type { SpeciesId } from './Species'

// ─── Body plan ──────────────────────────────────────────────────────────────

export type BodyPlan = 'quadruped' | 'insectoid' | 'avian' | 'aquatic' | 'serpentine'

// ─── DNA interface ──────────────────────────────────────────────────────────

export interface CreatureDNA {
  bodyPlan: BodyPlan

  // Morphology (0-1 normalized)
  bodyLength: number
  bodyWidth: number
  bodyHeight: number
  headSize: number
  neckLength: number

  // Limbs
  legCount: number        // continuous 0-1, quantized via quantizeLegCount()
  legLength: number
  legThickness: number

  // Appendages (>0.5 = present)
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
  accentColor: [number, number, number]
  eyeSize: number
  eyeCount: number  // continuous 0-1, quantized via quantizeEyeCount()

  // Behavior
  speed: number
  aggression: number
  size: number
}

// ─── Derived stats (replaces SpeciesDef for gameplay) ───────────────────────

export interface DerivedStats {
  mobility: 'ground' | 'air' | 'water'
  role: 'herbivore' | 'predator'
  maxSpeed: number
  fleeSpeed: number
  attackDamage: number
  attackRange: number
  sightRange: number
  adultScale: number
  babyScale: number
  maxHunger: number
  maxThirst: number
  maxAge: number
  maxEnergy: number
  bodyW: number
  bodyH: number
  bodyD: number
  bodyColor: number   // THREE.js hex
  headColor: number
  legColor: number
}

// ─── Quantization helpers ───────────────────────────────────────────────────

export function quantizeLegCount(gene: number): number {
  if (gene < 0.1) return 0
  if (gene < 0.3) return 2
  if (gene < 0.6) return 4
  if (gene < 0.8) return 6
  return 8
}

export function quantizeEyeCount(gene: number): number {
  if (gene < 0.3) return 2
  if (gene < 0.6) return 4
  if (gene < 0.8) return 6
  return 8
}

// ─── Color conversion ───────────────────────────────────────────────────────

function rgbToHex(r: number, g: number, b: number): number {
  return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255))
}

function shiftColor(r: number, g: number, b: number, amount: number): number {
  return rgbToHex(
    Math.max(0, Math.min(1, r + amount)),
    Math.max(0, Math.min(1, g + amount)),
    Math.max(0, Math.min(1, b + amount)),
  )
}

// ─── DNA → Stats ────────────────────────────────────────────────────────────

export function dnaToStats(dna: CreatureDNA): DerivedStats {
  const mobility: 'ground' | 'air' | 'water' =
    dna.bodyPlan === 'aquatic' ? 'water' :
    dna.bodyPlan === 'avian' ? 'air' : 'ground'

  const role: 'herbivore' | 'predator' = dna.aggression > 0.5 ? 'predator' : 'herbivore'
  const maxSpeed = 2 + dna.speed * 10
  const adultScale = 0.4 + dna.size * 2.6

  const [br, bg, bb] = dna.bodyColor
  const [ar, ag, ab] = dna.accentColor

  return {
    mobility,
    role,
    maxSpeed,
    fleeSpeed: maxSpeed * 1.8,
    attackDamage: role === 'predator' ? dna.aggression * 20 : 0,
    attackRange: role === 'predator' ? 1.5 + dna.aggression : 0,
    sightRange: 5 + dna.aggression * 15,
    adultScale,
    babyScale: adultScale * 0.4,
    maxHunger: 120 + dna.size * 360,
    maxThirst: mobility === 'water' ? 0 : 90 + dna.size * 270,
    maxAge: 300 + dna.size * 600,
    maxEnergy: 100,
    bodyW: 0.2 + dna.bodyWidth * 1.5,
    bodyH: 0.2 + dna.bodyHeight * 1.5,
    bodyD: 0.2 + dna.bodyLength * 1.5,
    bodyColor: rgbToHex(br, bg, bb),
    headColor: rgbToHex(ar, ag, ab),
    legColor: shiftColor(br, bg, bb, -0.1),
  }
}

// ─── Temporary: map DNA to closest legacy SpeciesId for rendering ───────────

export function dnaToSpeciesId(dna: CreatureDNA): SpeciesId {
  const isPredator = dna.aggression > 0.5
  const isLarge = dna.size > 0.7

  switch (dna.bodyPlan) {
    case 'quadruped':
      if (isLarge && isPredator) return 'bear'
      if (isLarge) return 'deer'
      if (isPredator) return 'wolf'
      if (dna.size < 0.25) return 'rabbit'
      return 'fox'
    case 'insectoid':
      if (isPredator) return 'scorpion'
      if (dna.size < 0.3) return 'toad'
      return 'crab'
    case 'avian':
      if (isLarge) return 'eagle'
      if (isPredator) return 'bat'
      return 'bird'
    case 'aquatic':
      if (isPredator) return 'croc'
      return 'fish'
    case 'serpentine':
      if (isLarge) return 'dragon'
      return 'croc'
    default:
      return 'rabbit'
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/creatures/CreatureDNA.ts
git commit -m "feat(dna): add CreatureDNA interface, DerivedStats, dnaToStats, dnaToSpeciesId"
```

---

### Task 2: Create 20 DNA presets and biome mapping

**Files:**
- Create: `src/creatures/DNAPresets.ts`

- [ ] **Step 1: Create all 20 presets and biome table**

Create `src/creatures/DNAPresets.ts`:

```typescript
import { BiomeType } from '../biomes/types'
import type { CreatureDNA } from './CreatureDNA'

// ─── Helper ─────────────────────────────────────────────────────────────────

function dna(plan: CreatureDNA['bodyPlan'], overrides: Partial<CreatureDNA>): CreatureDNA {
  return {
    bodyPlan: plan,
    bodyLength: 0.5, bodyWidth: 0.5, bodyHeight: 0.5,
    headSize: 0.5, neckLength: 0.3,
    legCount: 0.5, legLength: 0.5, legThickness: 0.5,
    hasWings: 0, wingSpan: 0.5,
    hasTail: 0.3, tailLength: 0.5,
    hasHorns: 0, hornSize: 0.5,
    hasClaws: 0, clawSize: 0.5,
    hasMandibles: 0, hasFins: 0, finSize: 0.5, hasAntennae: 0,
    bodyColor: [0.5, 0.4, 0.3], accentColor: [0.6, 0.5, 0.4],
    eyeSize: 0.5, eyeCount: 0.2,
    speed: 0.5, aggression: 0.2, size: 0.5,
    ...overrides,
  }
}

// ─── Quadrupeds (6) ─────────────────────────────────────────────────────────

export const PRESET_ELK = dna('quadruped', {
  bodyLength: 0.8, bodyWidth: 0.5, bodyHeight: 0.6,
  headSize: 0.5, neckLength: 0.6,
  legCount: 0.5, legLength: 0.8, legThickness: 0.4,
  hasHorns: 0.9, hornSize: 0.8,
  hasTail: 0.6, tailLength: 0.3,
  bodyColor: [0.55, 0.35, 0.15], accentColor: [0.65, 0.45, 0.2],
  speed: 0.7, aggression: 0.1, size: 0.65,
})

export const PRESET_WOLF = dna('quadruped', {
  bodyLength: 0.6, bodyWidth: 0.4, bodyHeight: 0.45,
  headSize: 0.55, neckLength: 0.4,
  legCount: 0.5, legLength: 0.6, legThickness: 0.45,
  hasClaws: 0.7, clawSize: 0.4,
  hasTail: 0.8, tailLength: 0.6,
  bodyColor: [0.4, 0.4, 0.42], accentColor: [0.55, 0.55, 0.5],
  speed: 0.7, aggression: 0.75, size: 0.5,
})

export const PRESET_BEAR = dna('quadruped', {
  bodyLength: 0.8, bodyWidth: 0.7, bodyHeight: 0.7,
  headSize: 0.6, neckLength: 0.2,
  legCount: 0.5, legLength: 0.5, legThickness: 0.8,
  hasClaws: 0.8, clawSize: 0.6,
  hasTail: 0.6, tailLength: 0.15,
  bodyColor: [0.35, 0.22, 0.1], accentColor: [0.4, 0.28, 0.15],
  speed: 0.45, aggression: 0.65, size: 0.75,
})

export const PRESET_FOX = dna('quadruped', {
  bodyLength: 0.5, bodyWidth: 0.3, bodyHeight: 0.35,
  headSize: 0.5, neckLength: 0.3,
  legCount: 0.5, legLength: 0.55, legThickness: 0.3,
  hasTail: 0.9, tailLength: 0.8,
  bodyColor: [0.8, 0.45, 0.1], accentColor: [0.9, 0.85, 0.8],
  speed: 0.7, aggression: 0.3, size: 0.3,
})

export const PRESET_RABBIT = dna('quadruped', {
  bodyLength: 0.3, bodyWidth: 0.3, bodyHeight: 0.3,
  headSize: 0.6, neckLength: 0.1,
  legCount: 0.5, legLength: 0.4, legThickness: 0.3,
  hasTail: 0.6, tailLength: 0.1,
  bodyColor: [0.65, 0.6, 0.5], accentColor: [0.8, 0.75, 0.7],
  speed: 0.8, aggression: 0.05, size: 0.15,
})

export const PRESET_MAMMOTH = dna('quadruped', {
  bodyLength: 0.9, bodyWidth: 0.8, bodyHeight: 0.85,
  headSize: 0.7, neckLength: 0.2,
  legCount: 0.5, legLength: 0.6, legThickness: 0.9,
  hasHorns: 0.9, hornSize: 0.9,
  hasTail: 0.6, tailLength: 0.2,
  bodyColor: [0.4, 0.32, 0.25], accentColor: [0.5, 0.42, 0.35],
  speed: 0.25, aggression: 0.15, size: 0.9,
})

// ─── Insectoids (5) ─────────────────────────────────────────────────────────

export const PRESET_BEETLE = dna('insectoid', {
  bodyLength: 0.4, bodyWidth: 0.5, bodyHeight: 0.4,
  headSize: 0.4, neckLength: 0.05,
  legCount: 0.7, legLength: 0.3, legThickness: 0.5,
  hasMandibles: 0.8, hasClaws: 0.6, clawSize: 0.3,
  bodyColor: [0.15, 0.12, 0.08], accentColor: [0.2, 0.18, 0.1],
  eyeCount: 0.5,
  speed: 0.2, aggression: 0.2, size: 0.25,
})

export const PRESET_SPIDER = dna('insectoid', {
  bodyLength: 0.35, bodyWidth: 0.4, bodyHeight: 0.3,
  headSize: 0.45, neckLength: 0.05,
  legCount: 0.9, legLength: 0.8, legThickness: 0.2,
  hasClaws: 0.7, clawSize: 0.3,
  bodyColor: [0.2, 0.15, 0.1], accentColor: [0.7, 0.1, 0.05],
  eyeCount: 0.9,
  speed: 0.6, aggression: 0.7, size: 0.3,
})

export const PRESET_MANTIS = dna('insectoid', {
  bodyLength: 0.6, bodyWidth: 0.25, bodyHeight: 0.55,
  headSize: 0.5, neckLength: 0.3,
  legCount: 0.7, legLength: 0.7, legThickness: 0.2,
  hasClaws: 0.9, clawSize: 0.8,
  bodyColor: [0.2, 0.6, 0.15], accentColor: [0.3, 0.7, 0.2],
  eyeCount: 0.5,
  speed: 0.5, aggression: 0.8, size: 0.4,
})

export const PRESET_ANT = dna('insectoid', {
  bodyLength: 0.3, bodyWidth: 0.2, bodyHeight: 0.2,
  headSize: 0.5, neckLength: 0.15,
  legCount: 0.7, legLength: 0.4, legThickness: 0.25,
  hasMandibles: 0.7, hasAntennae: 0.9,
  bodyColor: [0.15, 0.08, 0.02], accentColor: [0.2, 0.12, 0.05],
  eyeCount: 0.3,
  speed: 0.4, aggression: 0.1, size: 0.1,
})

export const PRESET_CENTIPEDE = dna('insectoid', {
  bodyLength: 0.9, bodyWidth: 0.25, bodyHeight: 0.15,
  headSize: 0.35, neckLength: 0.05,
  legCount: 0.9, legLength: 0.3, legThickness: 0.2,
  hasMandibles: 0.6, hasAntennae: 0.7,
  bodyColor: [0.5, 0.25, 0.08], accentColor: [0.6, 0.35, 0.1],
  eyeCount: 0.3,
  speed: 0.5, aggression: 0.4, size: 0.3,
})

// ─── Avians (4) ─────────────────────────────────────────────────────────────

export const PRESET_EAGLE = dna('avian', {
  bodyLength: 0.5, bodyWidth: 0.4, bodyHeight: 0.4,
  headSize: 0.5, neckLength: 0.3,
  legCount: 0.3, legLength: 0.4, legThickness: 0.3,
  hasWings: 0.95, wingSpan: 0.9,
  hasClaws: 0.8, clawSize: 0.6,
  hasTail: 0.7, tailLength: 0.5,
  bodyColor: [0.35, 0.25, 0.12], accentColor: [0.9, 0.88, 0.8],
  speed: 0.8, aggression: 0.7, size: 0.5,
})

export const PRESET_SONGBIRD = dna('avian', {
  bodyLength: 0.25, bodyWidth: 0.25, bodyHeight: 0.25,
  headSize: 0.55, neckLength: 0.15,
  legCount: 0.3, legLength: 0.35, legThickness: 0.2,
  hasWings: 0.9, wingSpan: 0.5,
  hasTail: 0.7, tailLength: 0.4,
  bodyColor: [0.3, 0.5, 0.7], accentColor: [0.9, 0.8, 0.2],
  speed: 0.7, aggression: 0.05, size: 0.12,
})

export const PRESET_PARROT = dna('avian', {
  bodyLength: 0.35, bodyWidth: 0.3, bodyHeight: 0.3,
  headSize: 0.55, neckLength: 0.15,
  legCount: 0.3, legLength: 0.3, legThickness: 0.25,
  hasWings: 0.9, wingSpan: 0.65,
  hasTail: 0.85, tailLength: 0.8,
  bodyColor: [0.1, 0.7, 0.2], accentColor: [0.9, 0.15, 0.1],
  speed: 0.6, aggression: 0.1, size: 0.2,
})

export const PRESET_BAT = dna('avian', {
  bodyLength: 0.25, bodyWidth: 0.2, bodyHeight: 0.2,
  headSize: 0.5, neckLength: 0.1,
  legCount: 0.3, legLength: 0.2, legThickness: 0.2,
  hasWings: 0.95, wingSpan: 0.85,
  hasTail: 0.3, tailLength: 0.15,
  bodyColor: [0.15, 0.12, 0.1], accentColor: [0.2, 0.15, 0.12],
  eyeSize: 0.7,
  speed: 0.6, aggression: 0.3, size: 0.15,
})

// ─── Aquatic (3) ────────────────────────────────────────────────────────────

export const PRESET_SHARK = dna('aquatic', {
  bodyLength: 0.8, bodyWidth: 0.4, bodyHeight: 0.35,
  headSize: 0.5, neckLength: 0.0,
  legCount: 0.0,
  hasFins: 0.95, finSize: 0.8,
  hasTail: 0.9, tailLength: 0.6,
  bodyColor: [0.35, 0.38, 0.42], accentColor: [0.7, 0.72, 0.75],
  speed: 0.8, aggression: 0.85, size: 0.65,
})

export const PRESET_GOLDFISH = dna('aquatic', {
  bodyLength: 0.3, bodyWidth: 0.35, bodyHeight: 0.35,
  headSize: 0.55, neckLength: 0.0,
  legCount: 0.0,
  hasFins: 0.9, finSize: 0.7,
  hasTail: 0.85, tailLength: 0.5,
  bodyColor: [0.95, 0.6, 0.1], accentColor: [1.0, 0.85, 0.3],
  eyeSize: 0.7,
  speed: 0.35, aggression: 0.05, size: 0.15,
})

export const PRESET_EEL = dna('aquatic', {
  bodyLength: 0.95, bodyWidth: 0.15, bodyHeight: 0.15,
  headSize: 0.35, neckLength: 0.0,
  legCount: 0.0,
  hasFins: 0.6, finSize: 0.3,
  hasTail: 0.7, tailLength: 0.3,
  bodyColor: [0.2, 0.25, 0.18], accentColor: [0.3, 0.35, 0.25],
  speed: 0.5, aggression: 0.4, size: 0.35,
})

// ─── Serpentine (2) ─────────────────────────────────────────────────────────

export const PRESET_SNAKE = dna('serpentine', {
  bodyLength: 0.8, bodyWidth: 0.15, bodyHeight: 0.12,
  headSize: 0.4, neckLength: 0.15,
  legCount: 0.0,
  hasTail: 0.7, tailLength: 0.6,
  bodyColor: [0.3, 0.45, 0.15], accentColor: [0.5, 0.6, 0.2],
  speed: 0.5, aggression: 0.55, size: 0.25,
})

export const PRESET_WYRM = dna('serpentine', {
  bodyLength: 0.95, bodyWidth: 0.5, bodyHeight: 0.45,
  headSize: 0.6, neckLength: 0.3,
  legCount: 0.0,
  hasHorns: 0.85, hornSize: 0.7,
  hasTail: 0.8, tailLength: 0.7,
  bodyColor: [0.25, 0.1, 0.08], accentColor: [0.6, 0.2, 0.05],
  eyeSize: 0.7,
  speed: 0.35, aggression: 0.8, size: 0.85,
})

// ─── All presets by name ────────────────────────────────────────────────────

export const DNA_PRESETS: Record<string, CreatureDNA> = {
  elk: PRESET_ELK, wolf: PRESET_WOLF, bear: PRESET_BEAR,
  fox: PRESET_FOX, rabbit: PRESET_RABBIT, mammoth: PRESET_MAMMOTH,
  beetle: PRESET_BEETLE, spider: PRESET_SPIDER, mantis: PRESET_MANTIS,
  ant: PRESET_ANT, centipede: PRESET_CENTIPEDE,
  eagle: PRESET_EAGLE, songbird: PRESET_SONGBIRD, parrot: PRESET_PARROT, bat: PRESET_BAT,
  shark: PRESET_SHARK, goldfish: PRESET_GOLDFISH, eel: PRESET_EEL,
  snake: PRESET_SNAKE, wyrm: PRESET_WYRM,
}

// ─── Biome → preset name list (weighted by repetition) ─────────────────────

export const BIOME_DNA_TABLE: Partial<Record<BiomeType, string[]>> = {
  [BiomeType.Forest]:    ['rabbit', 'rabbit', 'elk', 'elk', 'songbird', 'wolf', 'bear', 'fox', 'beetle', 'ant'],
  [BiomeType.Desert]:    ['fox', 'fox', 'rabbit', 'scorpion_like', 'eagle', 'snake', 'ant', 'centipede'],
  [BiomeType.Swamp]:     ['rabbit', 'elk', 'songbird', 'goldfish', 'goldfish', 'centipede', 'beetle', 'bat', 'snake', 'eel'],
  [BiomeType.Snow]:      ['rabbit', 'elk', 'songbird', 'wolf', 'mammoth', 'bear', 'fox', 'eagle', 'bat'],
  [BiomeType.Volcanic]:  ['wyrm', 'bat', 'spider', 'snake'],
  [BiomeType.Crystal]:   ['songbird', 'elk', 'eagle', 'parrot'],
  [BiomeType.Jungle]:    ['parrot', 'parrot', 'mantis', 'spider', 'fox', 'centipede', 'ant'],
  [BiomeType.Mesa]:      ['eagle', 'spider', 'snake', 'fox'],
  [BiomeType.CoralReef]: ['goldfish', 'goldfish', 'eel', 'shark', 'beetle'],
  [BiomeType.Heaven]:    ['songbird', 'songbird', 'songbird', 'elk', 'eagle', 'bat', 'parrot'],
  [BiomeType.Hell]:      ['wyrm', 'spider', 'bat', 'snake', 'centipede'],
}

// Fix: 'scorpion_like' → use spider preset (closest match)
// The lookup falls back to a random preset if name not found in DNA_PRESETS.

/**
 * Get a DNA preset by name. Returns a deep clone with slight random variation.
 */
export function getPresetDNA(name: string, rng: { next(): number }): CreatureDNA {
  const base = DNA_PRESETS[name] ?? DNA_PRESETS['rabbit']
  // Deep clone
  const clone: CreatureDNA = {
    ...base,
    bodyColor: [...base.bodyColor] as [number, number, number],
    accentColor: [...base.accentColor] as [number, number, number],
  }
  // Apply light random variation (+-0.05 per numeric gene)
  const vary = (v: number) => Math.max(0, Math.min(1, v + (rng.next() - 0.5) * 0.1))
  clone.bodyLength = vary(clone.bodyLength)
  clone.bodyWidth = vary(clone.bodyWidth)
  clone.bodyHeight = vary(clone.bodyHeight)
  clone.headSize = vary(clone.headSize)
  clone.legLength = vary(clone.legLength)
  clone.legThickness = vary(clone.legThickness)
  clone.speed = vary(clone.speed)
  clone.size = vary(clone.size)
  clone.bodyColor[0] = vary(clone.bodyColor[0])
  clone.bodyColor[1] = vary(clone.bodyColor[1])
  clone.bodyColor[2] = vary(clone.bodyColor[2])
  clone.accentColor[0] = vary(clone.accentColor[0])
  clone.accentColor[1] = vary(clone.accentColor[1])
  clone.accentColor[2] = vary(clone.accentColor[2])
  return clone
}
```

- [ ] **Step 2: Fix the scorpion_like reference**

Replace `'scorpion_like'` in the Desert biome entry with `'spider'` (closest insectoid predator):

The code above already notes this. In the `BIOME_DNA_TABLE`, change:
```typescript
[BiomeType.Desert]: ['fox', 'fox', 'rabbit', 'spider', 'eagle', 'snake', 'ant', 'centipede'],
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/creatures/DNAPresets.ts
git commit -m "feat(dna): add 20 DNA presets and biome-to-preset mapping"
```

---

### Task 3: Create DNABreeding crossover and mutation

**Files:**
- Create: `src/creatures/DNABreeding.ts`

- [ ] **Step 1: Create breeding and mutation logic**

Create `src/creatures/DNABreeding.ts`:

```typescript
import type { CreatureDNA, BodyPlan } from './CreatureDNA'

const MUTATION_CHANCE = 0.03
const MUTATION_RANGE = 0.1
const CROSS_BODY_SUCCESS_RATE = 0.15
const CROSS_BODY_BLEED = 0.4  // how much non-chosen parent's appendage genes bleed in

// ─── Gene keys for iteration ────────────────────────────────────────────────

const NUMERIC_GENES: (keyof CreatureDNA)[] = [
  'bodyLength', 'bodyWidth', 'bodyHeight', 'headSize', 'neckLength',
  'legCount', 'legLength', 'legThickness',
  'hasWings', 'wingSpan', 'hasTail', 'tailLength',
  'hasHorns', 'hornSize', 'hasClaws', 'clawSize',
  'hasMandibles', 'hasFins', 'finSize', 'hasAntennae',
  'eyeSize', 'eyeCount',
  'speed', 'aggression', 'size',
]

const APPENDAGE_GENES: (keyof CreatureDNA)[] = [
  'hasWings', 'wingSpan', 'hasTail', 'tailLength',
  'hasHorns', 'hornSize', 'hasClaws', 'clawSize',
  'hasMandibles', 'hasFins', 'finSize', 'hasAntennae',
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function mutateGene(value: number): number {
  if (Math.random() < MUTATION_CHANCE) {
    return clamp01(value + (Math.random() - 0.5) * 2 * MUTATION_RANGE)
  }
  return value
}

function blendColor(
  a: [number, number, number],
  b: [number, number, number],
): [number, number, number] {
  const t = 0.3 + Math.random() * 0.4  // blend factor 0.3-0.7
  return [
    clamp01(a[0] * t + b[0] * (1 - t) + (Math.random() < MUTATION_CHANCE ? (Math.random() - 0.5) * 0.2 : 0)),
    clamp01(a[1] * t + b[1] * (1 - t) + (Math.random() < MUTATION_CHANCE ? (Math.random() - 0.5) * 0.2 : 0)),
    clamp01(a[2] * t + b[2] * (1 - t) + (Math.random() < MUTATION_CHANCE ? (Math.random() - 0.5) * 0.2 : 0)),
  ]
}

// ─── Main breeding function ─────────────────────────────────────────────────

/**
 * Breed two creatures' DNA to produce offspring DNA.
 * Returns null if cross-body breeding fails (85% chance of failure).
 */
export function breedDNA(parentA: CreatureDNA, parentB: CreatureDNA): CreatureDNA | null {
  const sameBody = parentA.bodyPlan === parentB.bodyPlan

  // Cross-body breeding has a low success rate
  if (!sameBody && Math.random() > CROSS_BODY_SUCCESS_RATE) {
    return null
  }

  // Pick body plan
  let bodyPlan: BodyPlan
  if (sameBody) {
    bodyPlan = parentA.bodyPlan
  } else {
    bodyPlan = Math.random() < 0.5 ? parentA.bodyPlan : parentB.bodyPlan
  }

  const chosen = bodyPlan === parentA.bodyPlan ? parentA : parentB
  const other = bodyPlan === parentA.bodyPlan ? parentB : parentA

  // Build child DNA
  const child: CreatureDNA = {
    bodyPlan,
    bodyLength: 0, bodyWidth: 0, bodyHeight: 0,
    headSize: 0, neckLength: 0,
    legCount: 0, legLength: 0, legThickness: 0,
    hasWings: 0, wingSpan: 0, hasTail: 0, tailLength: 0,
    hasHorns: 0, hornSize: 0, hasClaws: 0, clawSize: 0,
    hasMandibles: 0, hasFins: 0, finSize: 0, hasAntennae: 0,
    bodyColor: [0, 0, 0], accentColor: [0, 0, 0],
    eyeSize: 0, eyeCount: 0,
    speed: 0, aggression: 0, size: 0,
  }

  // Crossover numeric genes
  for (const key of NUMERIC_GENES) {
    const aVal = parentA[key] as number
    const bVal = parentB[key] as number

    if (!sameBody && APPENDAGE_GENES.includes(key)) {
      // Cross-body: appendage genes bleed from other parent at reduced strength
      const chosenVal = chosen[key] as number
      const otherVal = other[key] as number
      ;(child as Record<string, unknown>)[key] = mutateGene(
        chosenVal * (1 - CROSS_BODY_BLEED) + otherVal * CROSS_BODY_BLEED
      )
    } else {
      // Same body or non-appendage: random pick from either parent
      const picked = Math.random() < 0.5 ? aVal : bVal
      ;(child as Record<string, unknown>)[key] = mutateGene(picked)
    }
  }

  // Colors: blend
  child.bodyColor = blendColor(parentA.bodyColor, parentB.bodyColor)
  child.accentColor = blendColor(parentA.accentColor, parentB.accentColor)

  return child
}

/**
 * Apply random mutation to an existing DNA (used for spawn variation).
 */
export function mutateDNA(dna: CreatureDNA): CreatureDNA {
  const clone: CreatureDNA = {
    ...dna,
    bodyColor: [...dna.bodyColor] as [number, number, number],
    accentColor: [...dna.accentColor] as [number, number, number],
  }
  for (const key of NUMERIC_GENES) {
    ;(clone as Record<string, unknown>)[key] = mutateGene(clone[key] as number)
  }
  return clone
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/creatures/DNABreeding.ts
git commit -m "feat(dna): add breedDNA crossover and mutateDNA with same-body and cross-body logic"
```

---

### Task 4: Add DNA and stats to Creature class

**Files:**
- Modify: `src/creatures/Creature.ts`

- [ ] **Step 1: Add DNA and stats imports and fields**

In `src/creatures/Creature.ts`, add imports at top:

```typescript
import type { CreatureDNA } from './CreatureDNA'
import type { DerivedStats } from './CreatureDNA'
```

Add two fields to the class (after line 39, after `glowColor`):

```typescript
dna: CreatureDNA | null = null
stats: DerivedStats | null = null
```

These are nullable so existing enemy spawning code (which doesn't use DNA) continues to work without changes.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/creatures/Creature.ts
git commit -m "feat(dna): add dna and stats fields to Creature class"
```

---

### Task 5: Integrate DNA spawning and breeding into CreatureManager

**Files:**
- Modify: `src/creatures/CreatureManager.ts`

This is the largest task — it replaces the spawning and breeding logic.

- [ ] **Step 1: Add DNA imports**

At the top of `src/creatures/CreatureManager.ts`, add:

```typescript
import { dnaToStats, dnaToSpeciesId } from './CreatureDNA'
import type { CreatureDNA } from './CreatureDNA'
import { BIOME_DNA_TABLE, getPresetDNA } from './DNAPresets'
import { breedDNA } from './DNABreeding'
```

- [ ] **Step 2: Add helper to get stats (DNA or legacy fallback)**

Add this helper method to the `CreatureManager` class (near the top, after the constructor):

```typescript
/** Get stats for a creature — from DNA if available, else legacy SPECIES lookup */
private getStats(c: Creature) {
  if (c.stats) return c.stats
  return SPECIES[c.species]
}
```

- [ ] **Step 3: Replace spawnForChunk to use DNA presets**

Replace the `spawnForChunk` method body. The new version picks from `BIOME_DNA_TABLE` instead of `BIOME_SPAWN_TABLE`, creates DNA-based creatures, but falls back to the old table for Hell biome (enemies use the old system):

```typescript
spawnForChunk(cx: number, cz: number, world: World): void {
  const key = `${cx},${cz}`
  if (this.initializedChunks.has(key)) return
  if (this.creatures.size >= MAX_POPULATION) return
  this.initializedChunks.add(key)

  const centerX = cx * CHUNK_SIZE + CHUNK_SIZE * 0.5
  const centerZ = cz * CHUNK_SIZE + CHUNK_SIZE * 0.5
  const biome = world.getBiomeAt(centerX, centerZ)

  const rng = new SeededRandom(chunkSeed(cx, cz, 42))

  // DNA-based spawning
  const dnaPresets = BIOME_DNA_TABLE[biome]
  if (dnaPresets && dnaPresets.length > 0) {
    for (const presetName of dnaPresets) {
      const count = Math.round(rng.int(14, 28) * CREATURE_CONFIG.spawnMultiplier)
      for (let i = 0; i < count; i++) {
        if (this.creatures.size >= MAX_POPULATION) return

        const wx = cx * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
        const wz = cz * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
        const h = world.getHeightAt(wx, wz)
        if (h === null) continue

        const creatureDna = getPresetDNA(presetName, rng)
        const stats = dnaToStats(creatureDna)
        const speciesId = dnaToSpeciesId(creatureDna)

        let spawnY: number
        if (stats.mobility === 'water') {
          if (h > WATER_LEVEL - 0.3) continue
          spawnY = WATER_LEVEL - 0.5
        } else if (stats.mobility === 'air') {
          if (h < WATER_LEVEL - 1) continue
          spawnY = h + rng.range(6, 15)
        } else {
          if (h < WATER_LEVEL) continue
          spawnY = h + stats.bodyH * stats.adultScale + 0.1
        }

        const creature = new Creature(speciesId, new THREE.Vector3(wx, spawnY, wz), stats.babyScale)
        creature.dna = creatureDna
        creature.stats = stats
        creature.scale = stats.adultScale
        creature.age = rng.range(30, stats.maxAge * 0.6)
        creature.reproductionCooldown = rng.range(0, 60)
        this.creatures.set(creature.id, creature)
      }
    }
    return
  }

  // Legacy fallback for biomes not in BIOME_DNA_TABLE (e.g. Hell with enemies)
  const candidates = BIOME_SPAWN_TABLE[biome] ?? []
  if (candidates.length === 0) return
  for (const speciesId of candidates) {
    const sp = SPECIES[speciesId]
    if (sp.isGiant) {
      if (rng.next() > 0.05) continue
    }
    const count = sp.isGiant ? 1 : Math.round(rng.int(14, 28) * CREATURE_CONFIG.spawnMultiplier)
    for (let i = 0; i < count; i++) {
      if (this.creatures.size >= MAX_POPULATION) return
      const wx = cx * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
      const wz = cz * CHUNK_SIZE + rng.range(4, CHUNK_SIZE - 4)
      const h = world.getHeightAt(wx, wz)
      if (h === null) continue
      let spawnY: number
      if (sp.mobility === 'water') {
        if (h > WATER_LEVEL - 0.3) continue
        spawnY = WATER_LEVEL - 0.5
      } else if (sp.mobility === 'air') {
        if (h < WATER_LEVEL - 1) continue
        spawnY = sp.isGiant ? h + rng.range(25, 50) : h + rng.range(6, 15)
      } else {
        if (h < WATER_LEVEL) continue
        spawnY = h + sp.bodyH * sp.adultScale + 0.1
      }
      const creature = new Creature(speciesId, new THREE.Vector3(wx, spawnY, wz), sp.babyScale)
      creature.scale = sp.adultScale
      creature.age = rng.range(30, sp.maxAge * 0.6)
      creature.reproductionCooldown = rng.range(0, 60)
      this.creatures.set(creature.id, creature)
    }
  }
}
```

- [ ] **Step 4: Replace spawnBaby to use DNA breeding**

Replace the `spawnBaby` method:

```typescript
private spawnBaby(parentA: Creature, parentB: Creature) {
  if (this.creatures.size >= MAX_POPULATION) return

  const mid = new THREE.Vector3(
    (parentA.position.x + parentB.position.x) * 0.5,
    (parentA.position.y + parentB.position.y) * 0.5,
    (parentA.position.z + parentB.position.z) * 0.5
  )

  // DNA breeding path
  if (parentA.dna && parentB.dna) {
    const childDna = breedDNA(parentA.dna, parentB.dna)
    if (!childDna) return  // cross-body breeding failed

    const stats = dnaToStats(childDna)
    const speciesId = dnaToSpeciesId(childDna)
    const baby = new Creature(speciesId, mid, stats.babyScale)
    baby.dna = childDna
    baby.stats = stats
    this.creatures.set(baby.id, baby)
  } else {
    // Legacy fallback
    const sp = SPECIES[parentA.species]
    const baby = new Creature(parentA.species, mid, sp.babyScale)
    this.creatures.set(baby.id, baby)
  }

  parentB.reproductionCooldown = 120
  parentB.state = 'idle'; parentB.stateTimer = 0; parentB.targetId = null
}
```

- [ ] **Step 5: Update findMate to allow cross-body mating**

Replace the `findMate` method to allow DNA creatures of different body plans to mate (rarely):

```typescript
private findMate(c: Creature): Creature | null {
  return this.grid.queryNearest(c.position, 30, (other) => {
    if (other === c) return false
    if (other.state !== 'seek_mate' && other.state !== 'idle' && other.state !== 'wander') return false
    if (other.reproductionCooldown > 0) return false

    // DNA creatures: same body plan always, different body plan occasionally
    if (c.dna && other.dna) {
      return c.dna.bodyPlan === other.dna.bodyPlan || true  // breedDNA handles the 15% chance
    }

    // Legacy: same species only
    return other.species === c.species
  })
}
```

- [ ] **Step 6: Update tickStats to use getStats helper**

In `tickStats`, replace the first line after the dead check:

Change `const sp = SPECIES[c.species]` to:
```typescript
const sp = this.getStats(c)
```

Do the same replacement in these methods (each has `const sp = SPECIES[c.species]`):
- `tickStateMachine` (line 376)
- `applyMovement` (line 610)
- `steerToTarget` / `startFlee` (line 679, 690)
- `findPrey` (line 758, and line 764 for `SPECIES[other.species].role`)
- The giant mesh check (line 182 `SPECIES[c.species]`)

For `findPrey` line 764, change:
```typescript
other !== c && SPECIES[other.species].role === 'herbivore' && other.state !== 'dead'
```
to:
```typescript
other !== c && this.getStats(other).role === 'herbivore' && other.state !== 'dead'
```

And line 700 (threat detection):
```typescript
other !== c && SPECIES[other.species].role === 'predator'
```
to:
```typescript
other !== c && this.getStats(other).role === 'predator'
```

And line 554:
```typescript
c.hunger = Math.max(0, c.hunger - SPECIES[c.species].maxHunger * 0.7)
```
to:
```typescript
c.hunger = Math.max(0, c.hunger - this.getStats(c).maxHunger * 0.7)
```

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/creatures/CreatureManager.ts
git commit -m "feat(dna): integrate DNA spawning, breeding, and stats into CreatureManager"
```
