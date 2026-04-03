# Naturalist Game Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a camera/photography system, field guide, creature variant/rarity system, and ecological tools that form the core naturalist game loop.

**Architecture:** Six new files (camera, field guide, variant system, ecological tools, photo scoring, tool placement) plus modifications to existing creature DNA, breeding, creature manager, input, engine, world state, journal, companion, and HUD systems. Each new system is a standalone class instantiated and updated in Engine.ts.

**Tech Stack:** TypeScript, Three.js (raycasting, scene objects), HTML/CSS DOM overlays, localStorage persistence.

**Spec:** `docs/superpowers/specs/2026-04-03-naturalist-gameloop-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/creatures/CreatureVariant.ts` | Variant ID hashing, rarity score calculation from DNA |
| `src/camera/CameraSystem.ts` | Camera mode toggle, viewfinder overlay, photo capture, creature detection |
| `src/camera/PhotoScoring.ts` | Photo evaluation: rarity + behavior multiplier + first discovery bonus |
| `src/fieldguide/FieldGuide.ts` | Field guide data: species pages, knowledge tiers, discovery tracking, persistence |
| `src/fieldguide/FieldGuideOverlay.ts` | Field guide UI: tabbed body-plan view, species pages, photo display |
| `src/ecology/EcologyTools.ts` | Ecological tool definitions, placement, persistence, creature influence logic |

### Modified Files
| File | Changes |
|------|---------|
| `src/creatures/CreatureDNA.ts` | Export `NUMERIC_GENE_KEYS` constant for variant hashing |
| `src/creatures/DNABreeding.ts` | Accept optional `mutationRateMultiplier` parameter in `breedDNA()` |
| `src/creatures/CreatureManager.ts` | Query nearby ecology tools during breeding, expose `spawnBaby` catalyst check |
| `src/engine/InputManager.ts` | Add `cameraToggleQueued` (KeyX) and `toolMenuQueued` (KeyB) bindings |
| `src/engine/Engine.ts` | Instantiate and update CameraSystem, FieldGuide, EcologyTools |
| `src/systems/WorldState.ts` | Add `fieldGuideData` and `ecologyTools` to save/load |
| `src/player/CompanionSystem.ts` | Add `highlightRare` fox affinity, `signalBehavior` bird affinity |
| `src/ui/HUD.ts` | Add camera mode crosshair, photo result card display |

---

### Task 1: Creature Variant ID and Rarity System

**Files:**
- Create: `src/creatures/CreatureVariant.ts`
- Modify: `src/creatures/CreatureDNA.ts`

- [ ] **Step 1: Create CreatureVariant.ts with variant ID and rarity**

```typescript
// src/creatures/CreatureVariant.ts
import { CreatureDNA, BodyPlan } from './CreatureDNA'
import { DNA_PRESETS } from './DNAPresets'

/** 8 hue buckets (45-degree segments) from RGB */
function colorFamily(rgb: [number, number, number]): number {
  const [r, g, b] = rgb
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  if (max - min < 0.05) return 0 // achromatic
  let h = 0
  if (max === r) h = ((g - b) / (max - min)) % 6
  else if (max === g) h = (b - r) / (max - min) + 2
  else h = (r - g) / (max - min) + 4
  h = ((h * 60) + 360) % 360
  return Math.floor(h / 45)
}

/** Quantize size gene into S/M/L bucket */
function sizeBucket(size: number): number {
  if (size < 0.33) return 0
  if (size < 0.66) return 1
  return 2
}

/** Quantize leg count gene into bucket */
function legCountBucket(legCount: number): number {
  const count = Math.round(legCount * 8)
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  return 3
}

/** 7-bit appendage flags */
function appendageFlags(dna: CreatureDNA): number {
  let flags = 0
  if (dna.hasWings > 0.5) flags |= 1
  if (dna.hasTail > 0.5) flags |= 2
  if (dna.hasHorns > 0.5) flags |= 4
  if (dna.hasClaws > 0.5) flags |= 8
  if (dna.hasMandibles > 0.5) flags |= 16
  if (dna.hasFins > 0.5) flags |= 32
  if (dna.hasAntennae > 0.5) flags |= 64
  return flags
}

/** Simple string hash to number */
function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return h >>> 0
}

/**
 * Compute a stable variant ID from DNA.
 * Two creatures with the same variant ID are the "same species" in the field guide.
 */
export function getVariantId(dna: CreatureDNA): string {
  const parts = [
    dna.bodyPlan,
    sizeBucket(dna.size),
    appendageFlags(dna),
    colorFamily(dna.bodyColor),
    legCountBucket(dna.legCount),
  ]
  return `v_${hashString(parts.join('_'))}`
}

/** Gene weights for rarity distance calculation */
const GENE_WEIGHTS: Record<string, number> = {
  hasWings: 3, hasTail: 3, hasHorns: 3, hasClaws: 3,
  hasMandibles: 3, hasFins: 3, hasAntennae: 3,
  bodyLength: 2, bodyWidth: 2, bodyHeight: 2,
  legCount: 2, legLength: 2, legThickness: 2,
  headSize: 1, neckLength: 1, eyeSize: 1, eyeCount: 1,
  wingSpan: 1, tailLength: 1, hornSize: 1, clawSize: 1, finSize: 1,
  speed: 0.5, aggression: 0.5, size: 0.5,
}

const RARITY_GENES = Object.keys(GENE_WEIGHTS)

/**
 * Calculate how far a creature's DNA has drifted from the nearest preset.
 * Returns 0-1 normalized rarity score.
 */
export function calculateRarityScore(dna: CreatureDNA): number {
  let minDist = Infinity

  for (const preset of DNA_PRESETS) {
    let dist = 0
    let totalWeight = 0

    for (const gene of RARITY_GENES) {
      const weight = GENE_WEIGHTS[gene]
      const a = (dna as any)[gene] as number
      const b = (preset as any)[gene] as number
      if (typeof a !== 'number' || typeof b !== 'number') continue
      dist += Math.abs(a - b) * weight
      totalWeight += weight
    }

    const normalized = totalWeight > 0 ? dist / totalWeight : 0
    if (normalized < minDist) minDist = normalized
  }

  return Math.min(1, minDist)
}

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'legendary'

/** Map rarity score to tier */
export function getRarityTier(score: number): RarityTier {
  if (score < 0.10) return 'common'
  if (score < 0.25) return 'uncommon'
  if (score < 0.50) return 'rare'
  return 'legendary'
}

/** Color for rarity tier (used in UI) */
export function getRarityColor(tier: RarityTier): string {
  switch (tier) {
    case 'common': return '#a0a0a0'
    case 'uncommon': return '#4fc34f'
    case 'rare': return '#4fa8c3'
    case 'legendary': return '#c3a04f'
  }
}
```

- [ ] **Step 2: Export DNA_PRESETS array from DNAPresets.ts**

Add to `src/creatures/DNAPresets.ts` after the individual preset definitions (around line 230, before `BIOME_DNA_TABLE`):

```typescript
/** All preset DNA values for rarity distance calculation */
export const DNA_PRESETS: CreatureDNA[] = [
  PRESET_ELK, PRESET_WOLF, PRESET_BEAR, PRESET_FOX, PRESET_RABBIT, PRESET_MAMMOTH,
  PRESET_BEETLE, PRESET_SPIDER, PRESET_MANTIS, PRESET_ANT, PRESET_CENTIPEDE,
  PRESET_EAGLE, PRESET_SONGBIRD, PRESET_PARROT, PRESET_BAT,
  PRESET_SHARK, PRESET_GOLDFISH, PRESET_EEL,
  PRESET_SNAKE, PRESET_WYRM,
]
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors related to CreatureVariant.ts or DNAPresets.ts

- [ ] **Step 4: Manual smoke test**

Add temporary debug log in `CreatureManager.spawnForChunk` after creature creation to verify variant IDs and rarity:
```typescript
// TEMPORARY — remove after verification
import { getVariantId, calculateRarityScore, getRarityTier } from './CreatureVariant'
// Inside spawn loop after creature.dna is set:
if (creature.dna) {
  const vid = getVariantId(creature.dna)
  const score = calculateRarityScore(creature.dna)
  console.log(`Spawn: ${creature.species} variant=${vid} rarity=${getRarityTier(score)} (${score.toFixed(3)})`)
}
```

Run `npm run dev`, load the game, verify console shows variant IDs and rarity tiers. Most should be common, some uncommon. Remove the temp debug code after verification.

- [ ] **Step 5: Commit**

```bash
git add src/creatures/CreatureVariant.ts src/creatures/DNAPresets.ts
git commit -m "feat(creatures): add variant ID and rarity system for DNA"
```

---

### Task 2: Mutation Rate Modifier in Breeding

**Files:**
- Modify: `src/creatures/DNABreeding.ts`

- [ ] **Step 1: Add mutationRateMultiplier parameter to breedDNA**

In `src/creatures/DNABreeding.ts`, change the `breedDNA` signature and mutation application:

```typescript
// Change line ~114 from:
export function breedDNA(parentA: CreatureDNA, parentB: CreatureDNA): CreatureDNA | null {
// To:
export function breedDNA(parentA: CreatureDNA, parentB: CreatureDNA, mutationRateMultiplier = 1.0): CreatureDNA | null {
```

Then inside `breedDNA`, where mutations are applied to numeric genes (the loop over `NUMERIC_GENES`), change the mutation chance check from:

```typescript
if (Math.random() < MUTATION_CHANCE) {
```

To:

```typescript
if (Math.random() < MUTATION_CHANCE * mutationRateMultiplier) {
```

And where `MUTATION_RANGE` is used in `mutateGene`, pass the multiplier through. The simplest approach: scale the range too. Change the `mutateGene` call inside the breeding loop from:

```typescript
value = mutateGene(value)
```

To:

```typescript
value = mutateGene(value, mutationRateMultiplier)
```

And update the `mutateGene` function signature:

```typescript
// Change from:
function mutateGene(value: number): number {
  if (Math.random() < RADICAL_CHANCE) return Math.random()
  const offset = (Math.random() * 2 - 1) * MUTATION_RANGE
// To:
function mutateGene(value: number, rateMultiplier = 1.0): number {
  if (Math.random() < RADICAL_CHANCE * rateMultiplier) return Math.random()
  const offset = (Math.random() * 2 - 1) * MUTATION_RANGE * Math.min(rateMultiplier, 2.0)
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors. Existing callers pass no third arg so default `1.0` applies.

- [ ] **Step 3: Commit**

```bash
git add src/creatures/DNABreeding.ts
git commit -m "feat(breeding): add mutationRateMultiplier parameter to breedDNA"
```

---

### Task 3: Input Bindings for Camera and Tool Menu

**Files:**
- Modify: `src/engine/InputManager.ts`

- [ ] **Step 1: Add camera and tool menu input bindings**

In `src/engine/InputManager.ts`, add two new queued flags alongside the existing ones (around line 21):

```typescript
private cameraToggleQueued = false
private toolMenuQueued = false
```

In the `keydown` handler block (around line 51), add:

```typescript
if (e.code === 'KeyX') this.cameraToggleQueued = true
if (e.code === 'KeyB') this.toolMenuQueued = true
```

Add consume methods alongside the existing pattern (after line ~180):

```typescript
consumeCameraToggle(): boolean {
  const v = this.cameraToggleQueued
  this.cameraToggleQueued = false
  return v
}

consumeToolMenu(): boolean {
  const v = this.toolMenuQueued
  this.toolMenuQueued = false
  return v
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/InputManager.ts
git commit -m "feat(input): add KeyX camera toggle and KeyB tool menu bindings"
```

---

### Task 4: Photo Scoring System

**Files:**
- Create: `src/camera/PhotoScoring.ts`

- [ ] **Step 1: Create PhotoScoring.ts**

```typescript
// src/camera/PhotoScoring.ts
import { CreatureState } from '../creatures/Creature'
import { calculateRarityScore, getRarityTier, RarityTier } from '../creatures/CreatureVariant'
import { CreatureDNA } from '../creatures/CreatureDNA'

/** Behavior multipliers for photo scoring */
const BEHAVIOR_MULTIPLIERS: Partial<Record<CreatureState, number>> = {
  idle: 1.0,
  wander: 1.0,
  eating: 1.2,
  drinking: 1.2,
  sleep: 1.2,
  sheltering: 1.2,
  seek_food: 1.0,
  seek_water: 1.0,
  flee: 1.8,
  hunt: 1.8,
  chase: 1.8,
  attack: 1.8,
  seek_mate: 1.5,
  courtship: 2.0,
  mating: 2.0,
  reverence: 2.5,
  resonating: 3.0,
  migrating: 1.5,
  dead: 0.5,
}

export interface PhotoResult {
  variantId: string
  species: string
  behavior: CreatureState
  rarityTier: RarityTier
  rarityScore: number
  behaviorMultiplier: number
  isNewDiscovery: boolean
  finalScore: number
  stars: number
}

/**
 * Evaluate a photo of a creature.
 * @param dna - The creature's DNA
 * @param variantId - Pre-computed variant ID
 * @param species - Species display name
 * @param behavior - Current creature state at time of photo
 * @param isNew - Whether this variant is new to the field guide
 */
export function scorePhoto(
  dna: CreatureDNA,
  variantId: string,
  species: string,
  behavior: CreatureState,
  isNew: boolean,
): PhotoResult {
  const rarityScore = calculateRarityScore(dna)
  const rarityTier = getRarityTier(rarityScore)

  const baseScore = rarityScore * 100
  const behaviorMult = BEHAVIOR_MULTIPLIERS[behavior] ?? 1.0
  const discoveryMult = isNew ? 2.0 : 1.0

  const finalScore = baseScore * behaviorMult * discoveryMult
  const stars = scoreToStars(finalScore)

  return {
    variantId,
    species,
    behavior,
    rarityTier,
    rarityScore,
    behaviorMultiplier: behaviorMult,
    isNewDiscovery: isNew,
    finalScore,
    stars,
  }
}

function scoreToStars(score: number): number {
  if (score >= 80) return 5
  if (score >= 50) return 4
  if (score >= 25) return 3
  if (score >= 10) return 2
  return 1
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/camera/PhotoScoring.ts
git commit -m "feat(camera): add photo scoring system with rarity and behavior multipliers"
```

---

### Task 5: Field Guide Data System

**Files:**
- Create: `src/fieldguide/FieldGuide.ts`

- [ ] **Step 1: Create FieldGuide.ts**

```typescript
// src/fieldguide/FieldGuide.ts
import { CreatureDNA, BodyPlan } from '../creatures/CreatureDNA'
import { CreatureState } from '../creatures/Creature'
import { RarityTier } from '../creatures/CreatureVariant'
import { BiomeType } from '../biomes/types'

export type KnowledgeTier = 0 | 1 | 2 | 3 | 4
// 0=unknown, 1=silhouette, 2=documented, 3=studied, 4=mastered

const COMMON_BEHAVIORS: Set<CreatureState> = new Set([
  'idle', 'wander', 'eating', 'drinking', 'flee', 'sleep', 'sheltering',
])

const RARE_BEHAVIORS: Set<CreatureState> = new Set([
  'reverence', 'resonating', 'courtship', 'mating', 'hunt',
])

const STORAGE_KEY = 'field_guide'

export interface SpeciesEntry {
  variantId: string
  bodyPlan: BodyPlan
  species: string                  // display name from dnaToSpeciesId
  rarityTier: RarityTier
  biomeFound: BiomeType
  dnaSnapshot: CreatureDNA         // stored for reconstructing visuals
  firstSeen: number                // timestamp
  behaviorsPhotographed: Set<CreatureState>
  bestScore: number
  bestBehavior: CreatureState
  tier: KnowledgeTier
}

export class FieldGuide {
  readonly entries: Map<string, SpeciesEntry> = new Map() // keyed by variantId
  private silhouettes: Set<string> = new Set()            // variantIds seen but not photographed

  constructor() {
    this.load()
  }

  /** Player spotted a creature — register silhouette if unknown */
  registerSighting(variantId: string, dna: CreatureDNA, species: string, biome: BiomeType): boolean {
    if (this.entries.has(variantId) || this.silhouettes.has(variantId)) return false
    this.silhouettes.add(variantId)
    // Create tier-1 entry
    this.entries.set(variantId, {
      variantId,
      bodyPlan: dna.bodyPlan,
      species,
      rarityTier: 'common', // updated on first photo
      biomeFound: biome,
      dnaSnapshot: { ...dna, bodyColor: [...dna.bodyColor] as [number, number, number], accentColor: [...dna.accentColor] as [number, number, number] },
      firstSeen: Date.now(),
      behaviorsPhotographed: new Set(),
      bestScore: 0,
      bestBehavior: 'idle',
      tier: 1,
    })
    this.save()
    return true
  }

  /** Record a photo — returns true if this is a new variant for the guide */
  recordPhoto(
    variantId: string,
    dna: CreatureDNA,
    species: string,
    behavior: CreatureState,
    score: number,
    rarityTier: RarityTier,
    biome: BiomeType,
  ): boolean {
    let entry = this.entries.get(variantId)
    const isNew = !entry || entry.tier < 2

    if (!entry) {
      // First time seeing AND photographing
      entry = {
        variantId,
        bodyPlan: dna.bodyPlan,
        species,
        rarityTier,
        biomeFound: biome,
        dnaSnapshot: { ...dna, bodyColor: [...dna.bodyColor] as [number, number, number], accentColor: [...dna.accentColor] as [number, number, number] },
        firstSeen: Date.now(),
        behaviorsPhotographed: new Set(),
        bestScore: 0,
        bestBehavior: 'idle',
        tier: 2,
      }
      this.entries.set(variantId, entry)
    }

    // Update rarity (first photo sets accurate rarity)
    entry.rarityTier = rarityTier

    // Record behavior
    entry.behaviorsPhotographed.add(behavior)

    // Update best photo
    if (score > entry.bestScore) {
      entry.bestScore = score
      entry.bestBehavior = behavior
    }

    // Ensure minimum tier 2
    if (entry.tier < 2) entry.tier = 2

    // Check tier upgrades
    this.recalculateTier(entry)
    this.save()
    return isNew
  }

  private recalculateTier(entry: SpeciesEntry): void {
    const behaviors = entry.behaviorsPhotographed
    if (entry.tier < 2) return // need at least one photo

    // Tier 3: 3+ different behaviors photographed
    let commonCount = 0
    for (const b of behaviors) {
      if (COMMON_BEHAVIORS.has(b)) commonCount++
    }
    if (commonCount >= 3 && entry.tier < 3) {
      entry.tier = 3
    }

    // Tier 4: tier 3 + at least 1 rare behavior
    if (entry.tier >= 3) {
      let hasRare = false
      for (const b of behaviors) {
        if (RARE_BEHAVIORS.has(b)) { hasRare = true; break }
      }
      if (hasRare) entry.tier = 4
    }
  }

  /** Check if a variant has been photographed (tier >= 2) */
  isPhotographed(variantId: string): boolean {
    const entry = this.entries.get(variantId)
    return !!entry && entry.tier >= 2
  }

  /** Check if a species is mastered (tier 4) */
  isMastered(variantId: string): boolean {
    const entry = this.entries.get(variantId)
    return !!entry && entry.tier >= 4
  }

  /** Get count of entries per body plan */
  getCountByBodyPlan(): Record<BodyPlan, number> {
    const counts: Record<BodyPlan, number> = {
      quadruped: 0, insectoid: 0, avian: 0, aquatic: 0, serpentine: 0,
    }
    for (const entry of this.entries.values()) {
      if (entry.tier >= 2) counts[entry.bodyPlan]++
    }
    return counts
  }

  /** Get all entries for a body plan, sorted by rarity */
  getEntriesForBodyPlan(plan: BodyPlan): SpeciesEntry[] {
    const result: SpeciesEntry[] = []
    for (const entry of this.entries.values()) {
      if (entry.bodyPlan === plan) result.push(entry)
    }
    return result.sort((a, b) => b.bestScore - a.bestScore)
  }

  /** Get total mastered count (for ritual integration) */
  getMasteredCount(): number {
    let count = 0
    for (const entry of this.entries.values()) {
      if (entry.tier >= 4) count++
    }
    return count
  }

  /** Get mastered count for entries found in a specific biome */
  getMasteredCountForBiome(biome: BiomeType): number {
    let count = 0
    for (const entry of this.entries.values()) {
      if (entry.tier >= 4 && entry.biomeFound === biome) count++
    }
    return count
  }

  /** Get total photographed count */
  getPhotographedCount(): number {
    let count = 0
    for (const entry of this.entries.values()) {
      if (entry.tier >= 2) count++
    }
    return count
  }

  private save(): void {
    try {
      const data: any[] = []
      for (const entry of this.entries.values()) {
        data.push({
          ...entry,
          behaviorsPhotographed: [...entry.behaviorsPhotographed],
        })
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        entries: data,
        silhouettes: [...this.silhouettes],
      }))
    } catch { /* ignore */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed.silhouettes) {
        for (const s of parsed.silhouettes) this.silhouettes.add(s)
      }
      if (parsed.entries) {
        for (const e of parsed.entries) {
          e.behaviorsPhotographed = new Set(e.behaviorsPhotographed)
          this.entries.set(e.variantId, e)
        }
      }
    } catch { /* ignore */ }
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/fieldguide/FieldGuide.ts
git commit -m "feat(fieldguide): add field guide data system with knowledge tiers"
```

---

### Task 6: Camera System

**Files:**
- Create: `src/camera/CameraSystem.ts`
- Modify: `src/ui/HUD.ts`

- [ ] **Step 1: Create CameraSystem.ts**

```typescript
// src/camera/CameraSystem.ts
import * as THREE from 'three'
import { Creature } from '../creatures/Creature'
import { CreatureManager } from '../creatures/CreatureManager'
import { InputManager } from '../engine/InputManager'
import { FieldGuide } from '../fieldguide/FieldGuide'
import { getVariantId, calculateRarityScore, getRarityTier } from '../creatures/CreatureVariant'
import { scorePhoto, PhotoResult } from './PhotoScoring'
import { dnaToSpeciesId } from '../creatures/CreatureDNA'
import { BiomeType } from '../biomes/types'

const CAMERA_SPEED_MULTIPLIER = 0.375   // 3/8 of walk speed
const DETECTION_RANGE = 50               // max photo range in units
const DETECTION_CONE = 0.5236            // 30 degrees in radians
const PHOTO_COOLDOWN = 0.5               // seconds between photos
const RESULT_DISPLAY_TIME = 3.0          // seconds to show result card
const SIGHTING_RANGE = 20                // auto-register silhouette range

export class CameraSystem {
  active = false
  private cooldown = 0
  private resultTimer = 0
  lastResult: PhotoResult | null = null

  private camera: THREE.Camera
  private creatureManager: CreatureManager
  private input: InputManager
  private fieldGuide: FieldGuide
  private currentBiome: BiomeType = BiomeType.Forest

  // DOM overlay
  private viewfinder: HTMLDivElement
  private resultCard: HTMLDivElement

  // Reusable vectors
  private _tmpFwd = new THREE.Vector3()
  private _tmpDir = new THREE.Vector3()

  constructor(
    camera: THREE.Camera,
    creatureManager: CreatureManager,
    input: InputManager,
    fieldGuide: FieldGuide,
  ) {
    this.camera = camera
    this.creatureManager = creatureManager
    this.input = input
    this.fieldGuide = fieldGuide

    // Viewfinder overlay
    this.viewfinder = document.createElement('div')
    this.viewfinder.style.cssText = `
      position:fixed; inset:0; z-index:50; pointer-events:none; display:none;
      border:3px solid rgba(255,255,255,0.3); margin:40px;
      box-shadow:inset 0 0 80px rgba(0,0,0,0.5);
    `
    // Crosshair
    const cross = document.createElement('div')
    cross.style.cssText = `
      position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      width:24px; height:24px; border:1px solid rgba(255,255,255,0.6); border-radius:50%;
    `
    const dot = document.createElement('div')
    dot.style.cssText = `
      position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
      width:4px; height:4px; background:rgba(255,255,255,0.8); border-radius:50%;
    `
    cross.appendChild(dot)
    this.viewfinder.appendChild(cross)

    // Zoom hint
    const hint = document.createElement('div')
    hint.style.cssText = `
      position:absolute; bottom:12px; right:16px; color:rgba(255,255,255,0.5);
      font:10px monospace; text-transform:uppercase; letter-spacing:1px;
    `
    hint.textContent = 'camera mode [X]'
    this.viewfinder.appendChild(hint)

    document.getElementById('app')?.appendChild(this.viewfinder)

    // Result card
    this.resultCard = document.createElement('div')
    this.resultCard.style.cssText = `
      position:fixed; top:20%; left:50%; transform:translateX(-50%); z-index:55;
      background:rgba(10,10,15,0.9); border:1px solid #d4a574; padding:12px 20px;
      font:12px monospace; color:#d4a574; display:none; text-align:center;
      min-width:200px;
    `
    document.getElementById('app')?.appendChild(this.resultCard)
  }

  setBiome(biome: BiomeType): void {
    this.currentBiome = biome
  }

  update(delta: number, playerPos: THREE.Vector3): void {
    // Toggle camera mode
    if (this.input.consumeCameraToggle()) {
      this.active = !this.active
      this.viewfinder.style.display = this.active ? 'block' : 'none'
      if (!this.active) {
        this.resultCard.style.display = 'none'
        this.resultTimer = 0
      }
    }

    if (!this.active) return

    // Cooldown
    if (this.cooldown > 0) this.cooldown -= delta

    // Result card timer
    if (this.resultTimer > 0) {
      this.resultTimer -= delta
      if (this.resultTimer <= 0) {
        this.resultCard.style.display = 'none'
      }
    }

    // Auto-register silhouettes for nearby creatures
    this.registerNearbySightings(playerPos)

    // Take photo on click
    if (this.input.consumeAttack() && this.cooldown <= 0) {
      this.takePhoto(playerPos)
      this.cooldown = PHOTO_COOLDOWN
    }
  }

  private registerNearbySightings(playerPos: THREE.Vector3): void {
    for (const creature of this.creatureManager.creatures.values()) {
      if (!creature.dna || creature.isEnemy || creature.state === 'dead') continue
      const dist = creature.position.distanceTo(playerPos)
      if (dist > SIGHTING_RANGE) continue

      const variantId = getVariantId(creature.dna)
      this.fieldGuide.registerSighting(
        variantId, creature.dna, creature.species, this.currentBiome,
      )
    }
  }

  private takePhoto(playerPos: THREE.Vector3): void {
    this.camera.getWorldDirection(this._tmpFwd)

    // Find best creature in frame
    let bestCreature: Creature | null = null
    let bestDist = Infinity

    for (const creature of this.creatureManager.creatures.values()) {
      if (!creature.dna || creature.isEnemy || creature.state === 'dead') continue

      this._tmpDir.subVectors(creature.position, playerPos)
      const dist = this._tmpDir.length()
      if (dist > DETECTION_RANGE || dist < 0.5) continue

      this._tmpDir.divideScalar(dist)
      const dot = this._tmpFwd.dot(this._tmpDir)
      const angle = Math.acos(Math.min(1, Math.max(-1, dot)))
      if (angle > DETECTION_CONE) continue

      if (dist < bestDist) {
        bestDist = dist
        bestCreature = creature
      }
    }

    if (!bestCreature || !bestCreature.dna) {
      this.showResult(null)
      return
    }

    const dna = bestCreature.dna
    const variantId = getVariantId(dna)
    const species = bestCreature.species
    const isNew = !this.fieldGuide.isPhotographed(variantId)
    const result = scorePhoto(dna, variantId, species, bestCreature.state, isNew)

    // Record in field guide
    this.fieldGuide.recordPhoto(
      variantId, dna, species, bestCreature.state,
      result.finalScore, result.rarityTier, this.currentBiome,
    )

    this.lastResult = result
    this.showResult(result)
  }

  private showResult(result: PhotoResult | null): void {
    if (!result) {
      this.resultCard.innerHTML = `<div style="color:#666">No creature in frame</div>`
      this.resultCard.style.display = 'block'
      this.resultTimer = 1.0
      return
    }

    const rarityColor = getRarityColorCSS(result.rarityTier)
    const stars = '\u2605'.repeat(result.stars) + '\u2606'.repeat(5 - result.stars)
    const newBadge = result.isNewDiscovery ? `<span style="color:#4fc34f;margin-left:8px">NEW!</span>` : ''

    this.resultCard.innerHTML = `
      <div style="font-size:14px;margin-bottom:4px">${result.species}${newBadge}</div>
      <div style="color:${rarityColor};font-size:10px;text-transform:uppercase;letter-spacing:1px">${result.rarityTier}</div>
      <div style="margin:6px 0;font-size:10px;color:#888">${formatBehavior(result.behavior)} (x${result.behaviorMultiplier.toFixed(1)})</div>
      <div style="font-size:16px;color:#d4a574;letter-spacing:2px">${stars}</div>
    `
    this.resultCard.style.display = 'block'
    this.resultTimer = RESULT_DISPLAY_TIME
  }

  /** Speed multiplier when camera mode is active (slows player) */
  getSpeedMultiplier(): number {
    return this.active ? CAMERA_SPEED_MULTIPLIER : 1.0
  }

  dispose(): void {
    this.viewfinder.remove()
    this.resultCard.remove()
  }
}

function getRarityColorCSS(tier: string): string {
  switch (tier) {
    case 'common': return '#a0a0a0'
    case 'uncommon': return '#4fc34f'
    case 'rare': return '#4fa8c3'
    case 'legendary': return '#c3a04f'
    default: return '#a0a0a0'
  }
}

function formatBehavior(state: string): string {
  return state.replace(/_/g, ' ')
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/camera/CameraSystem.ts
git commit -m "feat(camera): add camera mode with viewfinder, photo capture, and result cards"
```

---

### Task 7: Ecological Tools System

**Files:**
- Create: `src/ecology/EcologyTools.ts`

- [ ] **Step 1: Create EcologyTools.ts**

```typescript
// src/ecology/EcologyTools.ts
import * as THREE from 'three'
import { InputManager } from '../engine/InputManager'
import { FieldGuide } from '../fieldguide/FieldGuide'
import { BiomeType } from '../biomes/types'

export type ToolType = 'food' | 'nest' | 'water' | 'predator_scent' | 'fire_pit' | 'resonance_amp' | 'biome_essence'

export type ToolCategory = 'attractor' | 'repeller' | 'catalyst'

export interface PlacedTool {
  id: string
  type: ToolType
  category: ToolCategory
  position: THREE.Vector3
  radius: number            // effect radius in units
  biomeEssence?: BiomeType  // for biome_essence type only
  placedAt: number          // timestamp
}

interface ToolDef {
  type: ToolType
  category: ToolCategory
  label: string
  radius: number
  color: number             // mesh color
  maxCount: number          // max active of this category
}

const TOOL_DEFS: Record<ToolType, ToolDef> = {
  food:           { type: 'food',           category: 'attractor', label: 'Food Source',       radius: 20, color: 0x8bc34a, maxCount: 5 },
  nest:           { type: 'nest',           category: 'attractor', label: 'Nesting Site',      radius: 15, color: 0x795548, maxCount: 5 },
  water:          { type: 'water',          category: 'attractor', label: 'Water Feature',     radius: 20, color: 0x42a5f5, maxCount: 5 },
  predator_scent: { type: 'predator_scent', category: 'repeller',  label: 'Predator Scent',    radius: 25, color: 0xf44336, maxCount: 3 },
  fire_pit:       { type: 'fire_pit',       category: 'repeller',  label: 'Fire Pit',          radius: 20, color: 0xff9800, maxCount: 3 },
  resonance_amp:  { type: 'resonance_amp',  category: 'catalyst',  label: 'Resonance Amplifier', radius: 30, color: 0x9c27b0, maxCount: 2 },
  biome_essence:  { type: 'biome_essence',  category: 'catalyst',  label: 'Biome Essence',     radius: 25, color: 0x00bcd4, maxCount: 2 },
}

const MAX_ATTRACTORS = 5
const MAX_REPELLERS = 3
const MAX_CATALYSTS = 2
const STORAGE_KEY = 'ecology_tools'

export class EcologyTools {
  readonly placed: Map<string, PlacedTool> = new Map()
  private meshes: Map<string, THREE.Mesh> = new Map()
  private scene: THREE.Scene
  private input: InputManager
  private fieldGuide: FieldGuide
  private nextId = 0

  // Biome essence inventory: collected passively, max 3 per biome
  readonly essenceInventory: Map<BiomeType, number> = new Map()
  private essenceTimers: Map<BiomeType, number> = new Map()
  private readonly ESSENCE_INTERVAL = 300 // 5 minutes in seconds

  // Radial menu state
  menuOpen = false
  private menuEl: HTMLDivElement
  private selectedIndex = 0

  constructor(scene: THREE.Scene, input: InputManager, fieldGuide: FieldGuide) {
    this.scene = scene
    this.input = input
    this.fieldGuide = fieldGuide
    this.load()

    // Radial menu overlay
    this.menuEl = document.createElement('div')
    this.menuEl.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      z-index:60; display:none;
      background:rgba(10,10,15,0.92); border:1px solid #d4a574;
      padding:8px; font:11px monospace; color:#d4a574;
    `
    document.getElementById('app')?.appendChild(this.menuEl)
  }

  /** Call each frame to accumulate biome essence */
  accumulateEssence(delta: number, currentBiome: BiomeType): void {
    const timer = (this.essenceTimers.get(currentBiome) ?? 0) + delta
    if (timer >= this.ESSENCE_INTERVAL) {
      const current = this.essenceInventory.get(currentBiome) ?? 0
      if (current < 3) {
        this.essenceInventory.set(currentBiome, current + 1)
        this.essenceTimers.set(currentBiome, 0)
        this.save()
      }
    } else {
      this.essenceTimers.set(currentBiome, timer)
    }
  }

  update(delta: number, playerPos: THREE.Vector3, currentBiome: BiomeType): void {
    this.accumulateEssence(delta, currentBiome)

    if (this.input.consumeToolMenu()) {
      this.menuOpen = !this.menuOpen
      this.menuEl.style.display = this.menuOpen ? 'block' : 'none'
      if (this.menuOpen) this.renderMenu(playerPos)
    }

    if (!this.menuOpen) return

    // Number keys 1-7 to select tool, Escape to close
    for (let i = 0; i < 7; i++) {
      if (this.input.isDown(`Digit${i + 1}`)) {
        this.tryPlace(i, playerPos, currentBiome)
        this.menuOpen = false
        this.menuEl.style.display = 'none'
        break
      }
    }
  }

  private getAvailableTools(): ToolType[] {
    // Only show tools the player has earned through mastery
    const available: ToolType[] = []
    const hasMastery = this.fieldGuide.getMasteredCount() > 0

    // Basic tools unlock with first mastery
    if (hasMastery) {
      available.push('food', 'nest', 'water', 'predator_scent', 'fire_pit')
    }

    // Catalysts unlock with 3+ masteries
    if (this.fieldGuide.getMasteredCount() >= 3) {
      available.push('resonance_amp')
    }

    // Biome essence available if player has any in inventory
    for (const [, count] of this.essenceInventory) {
      if (count > 0) {
        available.push('biome_essence')
        break
      }
    }

    return available
  }

  private renderMenu(playerPos: THREE.Vector3): void {
    const tools = this.getAvailableTools()
    if (tools.length === 0) {
      this.menuEl.innerHTML = `<div style="color:#666;padding:8px">No tools unlocked yet.<br>Master species in your Field Guide to unlock tools.</div>`
      return
    }

    const counts = this.getCategoryCounts()
    let html = '<div style="margin-bottom:6px;color:#888;font-size:10px">ECOLOGICAL TOOLS</div>'

    tools.forEach((type, i) => {
      const def = TOOL_DEFS[type]
      const catCount = counts[def.category]
      const maxForCat = def.category === 'attractor' ? MAX_ATTRACTORS
        : def.category === 'repeller' ? MAX_REPELLERS : MAX_CATALYSTS
      const full = catCount >= maxForCat
      const style = full ? 'color:#666' : 'color:#d4a574'

      html += `<div style="${style};padding:2px 4px">[${i + 1}] ${def.label}${full ? ' (FULL)' : ''}</div>`
    })

    html += '<div style="color:#555;margin-top:6px;font-size:9px">Press number to place at your feet</div>'
    this.menuEl.innerHTML = html
  }

  private tryPlace(index: number, playerPos: THREE.Vector3, currentBiome: BiomeType): void {
    const tools = this.getAvailableTools()
    if (index >= tools.length) return

    const type = tools[index]
    const def = TOOL_DEFS[type]
    const counts = this.getCategoryCounts()
    const maxForCat = def.category === 'attractor' ? MAX_ATTRACTORS
      : def.category === 'repeller' ? MAX_REPELLERS : MAX_CATALYSTS

    if (counts[def.category] >= maxForCat) return

    // Consume biome essence from inventory if applicable
    if (type === 'biome_essence') {
      const essenceCount = this.essenceInventory.get(currentBiome) ?? 0
      if (essenceCount <= 0) return
      this.essenceInventory.set(currentBiome, essenceCount - 1)
    }

    const id = `tool_${this.nextId++}`
    const tool: PlacedTool = {
      id,
      type,
      category: def.category,
      position: playerPos.clone(),
      radius: def.radius,
      biomeEssence: type === 'biome_essence' ? currentBiome : undefined,
      placedAt: Date.now(),
    }

    this.placed.set(id, tool)
    this.createMesh(tool)
    this.save()
  }

  private createMesh(tool: PlacedTool): void {
    const def = TOOL_DEFS[tool.type]
    const geo = new THREE.BoxGeometry(0.4, 0.6, 0.4)
    const mat = new THREE.MeshBasicMaterial({ color: def.color })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(tool.position)
    mesh.position.y += 0.3
    this.scene.add(mesh)
    this.meshes.set(tool.id, mesh)
  }

  /** Pick up (remove) the nearest tool within 3 units */
  pickupNearest(playerPos: THREE.Vector3): boolean {
    let nearestId: string | null = null
    let nearestDist = 9 // 3^2
    for (const [id, tool] of this.placed) {
      const d2 = tool.position.distanceToSquared(playerPos)
      if (d2 < nearestDist) {
        nearestDist = d2
        nearestId = id
      }
    }
    if (!nearestId) return false
    this.removeTool(nearestId)
    return true
  }

  private removeTool(id: string): void {
    this.placed.delete(id)
    const mesh = this.meshes.get(id)
    if (mesh) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.MeshBasicMaterial).dispose()
      this.meshes.delete(id)
    }
    this.save()
  }

  /** Query: get mutation rate multiplier at a position based on nearby catalysts */
  getMutationMultiplierAt(pos: THREE.Vector3): number {
    let mult = 1.0
    for (const tool of this.placed.values()) {
      if (tool.category !== 'catalyst') continue
      const dist = tool.position.distanceTo(pos)
      if (dist > tool.radius) continue

      if (tool.type === 'resonance_amp') {
        mult += 0.5 // +50% mutation rate
      } else if (tool.type === 'biome_essence') {
        mult += 0.25 // +25% mutation rate
      }
    }
    return mult
  }

  /** Query: is a position within range of an attractor of a given type? */
  hasAttractorNear(pos: THREE.Vector3, type?: ToolType): THREE.Vector3 | null {
    for (const tool of this.placed.values()) {
      if (tool.category !== 'attractor') continue
      if (type && tool.type !== type) continue
      const dist = tool.position.distanceTo(pos)
      if (dist <= tool.radius) return tool.position
    }
    return null
  }

  /** Query: is a position within range of a repeller? */
  hasRepellerNear(pos: THREE.Vector3): THREE.Vector3 | null {
    for (const tool of this.placed.values()) {
      if (tool.category !== 'repeller') continue
      const dist = tool.position.distanceTo(pos)
      if (dist <= tool.radius) return tool.position
    }
    return null
  }

  private getCategoryCounts(): Record<ToolCategory, number> {
    const counts: Record<ToolCategory, number> = { attractor: 0, repeller: 0, catalyst: 0 }
    for (const tool of this.placed.values()) {
      counts[tool.category]++
    }
    return counts
  }

  /** Restore meshes after reload (call after constructor + load) */
  restoreMeshes(): void {
    for (const tool of this.placed.values()) {
      if (!this.meshes.has(tool.id)) {
        this.createMesh(tool)
      }
    }
  }

  private save(): void {
    try {
      const tools: any[] = []
      for (const t of this.placed.values()) {
        tools.push({
          ...t,
          position: { x: t.position.x, y: t.position.y, z: t.position.z },
        })
      }
      const essence: [number, number][] = []
      for (const [b, c] of this.essenceInventory) {
        essence.push([b, c])
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tools, essence, nextId: this.nextId }))
    } catch { /* ignore */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed.nextId) this.nextId = parsed.nextId
      if (parsed.essence) {
        for (const [b, c] of parsed.essence) {
          this.essenceInventory.set(b, c)
        }
      }
      if (parsed.tools) {
        for (const t of parsed.tools) {
          t.position = new THREE.Vector3(t.position.x, t.position.y, t.position.z)
          this.placed.set(t.id, t)
        }
      }
    } catch { /* ignore */ }
  }

  dispose(): void {
    this.menuEl.remove()
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.MeshBasicMaterial).dispose()
    }
    this.meshes.clear()
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/ecology/EcologyTools.ts
git commit -m "feat(ecology): add ecological tools system with placement, persistence, and queries"
```

---

### Task 8: Integrate CreatureManager with Ecology Tools

**Files:**
- Modify: `src/creatures/CreatureManager.ts`

- [ ] **Step 1: Add ecology tools reference and use in breeding**

In `src/creatures/CreatureManager.ts`:

Add import at the top:
```typescript
import { EcologyTools } from '../ecology/EcologyTools'
```

Add field to the class (around line 40):
```typescript
ecologyTools: EcologyTools | null = null
```

In the `spawnBaby` method (around line 795), where `breedDNA(parentA.dna, parentB.dna)` is called, change to:

```typescript
const mutMult = this.ecologyTools?.getMutationMultiplierAt(midpoint) ?? 1.0
const babyDNA = breedDNA(parentA.dna!, parentB.dna!, mutMult)
```

(The `midpoint` variable already exists in `spawnBaby` — it's the position where the baby is spawned.)

- [ ] **Step 2: Add attractor/repeller influence to creature wander behavior**

In the `tickStateMachine` method, in the `wander` state handling (where a creature is idle/wandering and picking new targets), add attractor influence. Find the section where `goWander(c)` is called for idle→wander transition and add before it:

```typescript
// Check for nearby ecological attractors
if (this.ecologyTools) {
  const attractorPos = this.ecologyTools.hasAttractorNear(c.position)
  if (attractorPos && Math.random() < 0.4) {
    c.targetPos = attractorPos.clone()
    c.targetPos.x += (Math.random() - 0.5) * 4
    c.targetPos.z += (Math.random() - 0.5) * 4
    c.state = 'wander'
    c.stateTimer = 60 + Math.random() * 60
    return
  }
  // Check for repellers
  const repellerPos = this.ecologyTools.hasRepellerNear(c.position)
  if (repellerPos) {
    this.steerAwayFrom(c, repellerPos, stats.maxSpeed)
    c.state = 'flee'
    c.stateTimer = 30
    return
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/creatures/CreatureManager.ts
git commit -m "feat(creatures): integrate ecology tools for mutation multiplier and wander influence"
```

---

### Task 9: Field Guide Overlay UI

**Files:**
- Create: `src/fieldguide/FieldGuideOverlay.ts`

- [ ] **Step 1: Create FieldGuideOverlay.ts**

```typescript
// src/fieldguide/FieldGuideOverlay.ts
import { FieldGuide, SpeciesEntry, KnowledgeTier } from './FieldGuide'
import { BodyPlan } from '../creatures/CreatureDNA'
import { getRarityColor } from '../creatures/CreatureVariant'

const BODY_PLAN_TABS: BodyPlan[] = ['quadruped', 'insectoid', 'avian', 'aquatic', 'serpentine']
const TAB_LABELS: Record<BodyPlan, string> = {
  quadruped: 'Quadrupeds',
  insectoid: 'Insectoids',
  avian: 'Avians',
  aquatic: 'Aquatic',
  serpentine: 'Serpentine',
}
const TIER_LABELS: Record<KnowledgeTier, string> = {
  0: '???',
  1: 'Silhouette',
  2: 'Documented',
  3: 'Studied',
  4: 'Mastered',
}

const BG = 'rgba(10,10,15,0.94)'
const TEXT = '#d4a574'
const DIM = '#666'

export class FieldGuideOverlay {
  private container: HTMLDivElement
  private fieldGuide: FieldGuide
  private visible = false
  private activeTab: BodyPlan = 'quadruped'
  private scrollOffset = 0

  constructor(fieldGuide: FieldGuide) {
    this.fieldGuide = fieldGuide

    this.container = document.createElement('div')
    this.container.style.cssText = `
      position:fixed; inset:0; z-index:200; display:none;
      background:${BG}; font-family:monospace; color:${TEXT};
    `

    document.getElementById('app')?.appendChild(this.container)

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN') {
        this.visible = !this.visible
        this.container.style.display = this.visible ? 'block' : 'none'
        if (this.visible) this.render()
      }
      if (!this.visible) return
      if (e.code === 'ArrowRight' || e.code === 'Tab') {
        e.preventDefault()
        const idx = BODY_PLAN_TABS.indexOf(this.activeTab)
        this.activeTab = BODY_PLAN_TABS[(idx + 1) % BODY_PLAN_TABS.length]
        this.scrollOffset = 0
        this.render()
      }
      if (e.code === 'ArrowLeft') {
        const idx = BODY_PLAN_TABS.indexOf(this.activeTab)
        this.activeTab = BODY_PLAN_TABS[(idx - 1 + BODY_PLAN_TABS.length) % BODY_PLAN_TABS.length]
        this.scrollOffset = 0
        this.render()
      }
      if (e.code === 'ArrowDown') {
        this.scrollOffset += 40
        this.render()
      }
      if (e.code === 'ArrowUp') {
        this.scrollOffset = Math.max(0, this.scrollOffset - 40)
        this.render()
      }
    })
  }

  isOpen(): boolean { return this.visible }

  private render(): void {
    const counts = this.fieldGuide.getCountByBodyPlan()

    // Tab bar
    let html = `<div style="display:flex;border-bottom:1px solid #333;padding:8px 16px">`
    for (const plan of BODY_PLAN_TABS) {
      const isActive = plan === this.activeTab
      const color = isActive ? TEXT : DIM
      const border = isActive ? `border-bottom:2px solid ${TEXT}` : ''
      html += `<div style="padding:4px 12px;color:${color};${border};font-size:11px;text-transform:uppercase;letter-spacing:1px">${TAB_LABELS[plan]} (${counts[plan]})</div>`
    }
    html += `</div>`

    // Title
    html += `<div style="padding:8px 16px;font-size:10px;color:#888">FIELD GUIDE &mdash; Press [N] to close &mdash; Arrow keys to navigate</div>`

    // Species list
    const entries = this.fieldGuide.getEntriesForBodyPlan(this.activeTab)
    html += `<div style="padding:0 16px;max-height:calc(100vh - 80px);overflow:hidden">`

    if (entries.length === 0) {
      html += `<div style="color:${DIM};padding:20px 0;text-align:center">No ${TAB_LABELS[this.activeTab].toLowerCase()} discovered yet.</div>`
    }

    for (const entry of entries) {
      html += this.renderEntry(entry)
    }

    html += `</div>`
    this.container.innerHTML = html
  }

  private renderEntry(entry: SpeciesEntry): string {
    const rarityColor = getRarityColor(entry.rarityTier)
    const tierLabel = TIER_LABELS[entry.tier]

    if (entry.tier <= 1) {
      // Silhouette only
      return `
        <div style="border:1px solid #222;padding:8px;margin:4px 0;opacity:0.5">
          <span style="font-size:12px;color:#555">??? &mdash; ${entry.bodyPlan}</span>
          <span style="float:right;font-size:9px;color:#444">${tierLabel}</span>
        </div>
      `
    }

    const stars = '\u2605'.repeat(Math.min(5, Math.ceil(entry.bestScore / 20))) + '\u2606'.repeat(Math.max(0, 5 - Math.ceil(entry.bestScore / 20)))
    const behaviors = [...entry.behaviorsPhotographed].map(b => b.replace(/_/g, ' ')).join(', ')

    let details = ''
    if (entry.tier >= 3) {
      details += `<div style="font-size:9px;color:#888;margin-top:2px">Behaviors: ${behaviors}</div>`
    }
    if (entry.tier >= 4) {
      details += `<div style="font-size:9px;color:#9c27b0;margin-top:2px">ECOLOGICAL TOOLS UNLOCKED</div>`
    }

    return `
      <div style="border:1px solid #333;padding:8px;margin:4px 0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:12px">${entry.species}</span>
          <span style="font-size:9px;color:${rarityColor};text-transform:uppercase;letter-spacing:1px">${entry.rarityTier}</span>
        </div>
        <div style="font-size:10px;color:#888;margin-top:2px">
          ${tierLabel} &mdash; ${stars}
        </div>
        ${details}
      </div>
    `
  }

  dispose(): void {
    this.container.remove()
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/fieldguide/FieldGuideOverlay.ts
git commit -m "feat(fieldguide): add field guide overlay UI with tabbed species view"
```

---

### Task 10: Wire Everything into Engine.ts

**Files:**
- Modify: `src/engine/Engine.ts`
- Modify: `src/player/FirstPersonController.ts`

- [ ] **Step 1: Add imports to Engine.ts**

At the top of `src/engine/Engine.ts`, add:

```typescript
import { FieldGuide } from '../fieldguide/FieldGuide'
import { FieldGuideOverlay } from '../fieldguide/FieldGuideOverlay'
import { CameraSystem } from '../camera/CameraSystem'
import { EcologyTools } from '../ecology/EcologyTools'
```

- [ ] **Step 2: Add fields to Engine class**

In the Engine class field declarations (around lines 54-139), add:

```typescript
private fieldGuide: FieldGuide
private fieldGuideOverlay: FieldGuideOverlay
private cameraSystem: CameraSystem
private ecologyTools: EcologyTools
```

- [ ] **Step 3: Instantiate in constructor**

In the constructor, after the existing system instantiations (after `this.creatureManager` and `this.scene` are created), add:

```typescript
this.fieldGuide = new FieldGuide()
this.fieldGuideOverlay = new FieldGuideOverlay(this.fieldGuide)
this.cameraSystem = new CameraSystem(this.camera, this.creatureManager, this.input, this.fieldGuide)
this.ecologyTools = new EcologyTools(this.scene, this.input, this.fieldGuide)
this.ecologyTools.restoreMeshes()
this.creatureManager.ecologyTools = this.ecologyTools
```

- [ ] **Step 4: Add update calls in the main loop**

In the `loop()` method, add the update calls. Place them after the CreatureManager update (line ~690) and before the CombatSystem update (line ~693):

```typescript
// Camera system (after creature manager, before combat — camera consumes attack input)
this.cameraSystem.setBiome(this.worldState.playerBiome)
this.cameraSystem.update(delta, camPos)

// Ecology tools
this.ecologyTools.update(delta, camPos, this.worldState.playerBiome)
```

- [ ] **Step 5: Apply camera speed multiplier to player controller**

In `src/engine/Engine.ts` at line 842, the existing line is:

```typescript
this.controller.speedMultiplier *= this.companionSystem.getSpeedMultiplier()
```

Change it to:

```typescript
this.controller.speedMultiplier *= this.companionSystem.getSpeedMultiplier() * this.cameraSystem.getSpeedMultiplier()
```

- [ ] **Step 6: Prevent combat attack while in camera mode**

In the engine loop, where `this.combatSystem.update(...)` is called, wrap it to skip combat when camera is active:

```typescript
if (!this.cameraSystem.active) {
  this.combatSystem.update(delta, this.input, camPos, this.elapsedTime)
}
```

This ensures left-click takes photos in camera mode instead of attacking.

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 8: Manual integration test**

Run `npm run dev` and test:
1. Press `X` — viewfinder overlay appears, movement slows
2. Walk near creatures — they should auto-register as silhouettes
3. Left-click to take photo — result card shows with creature name, rarity, stars
4. Press `N` — field guide opens with species entries
5. Press `B` — tool menu opens (should show "no tools unlocked" until you master a species)
6. Press `X` again — exits camera mode, normal speed resumes
7. Combat should work normally when camera is off

- [ ] **Step 9: Commit**

```bash
git add src/engine/Engine.ts src/player/FirstPersonController.ts
git commit -m "feat(engine): wire camera, field guide, and ecology tools into main loop"
```

---

### Task 11: Companion Photography Affinities

**Files:**
- Modify: `src/player/CompanionSystem.ts`

- [ ] **Step 1: Add rare creature highlighting for fox companion**

In `src/player/CompanionSystem.ts`, add import at top:

```typescript
import { getVariantId, calculateRarityScore, getRarityTier } from '../creatures/CreatureVariant'
```

Add new affinity fields to the class (around line 58):

```typescript
foxHighlightCreatureId: string | null = null  // creature with rare+ rarity nearby
birdBehaviorSignalId: string | null = null    // creature in rare behavior nearby
```

In the `update()` method, in the fox affinity section (around lines 159-190), add after the existing fox logic:

```typescript
// Fox: highlight rare creatures within 30 units
this.foxHighlightCreatureId = null
if (this.companionSpecies === 'fox' || this.companionSpecies === 'deer') {
  for (const creature of creatures.values()) {
    if (!creature.dna || creature.isEnemy || creature.state === 'dead') continue
    const dist = creature.position.distanceTo(playerPos)
    if (dist > 30) continue
    const score = calculateRarityScore(creature.dna)
    if (getRarityTier(score) === 'rare' || getRarityTier(score) === 'legendary') {
      this.foxHighlightCreatureId = creature.id
      break
    }
  }
}
```

In the bird/parrot affinity section (around lines 206-221), add after existing logic:

```typescript
// Bird: signal when nearby creature is in a rare behavior (good photo opportunity)
this.birdBehaviorSignalId = null
if (this.companionSpecies === 'bird' || this.companionSpecies === 'parrot') {
  const rareBehaviors = new Set(['reverence', 'resonating', 'courtship', 'mating', 'hunt'])
  for (const creature of creatures.values()) {
    if (creature.isEnemy || creature.state === 'dead') continue
    const dist = creature.position.distanceTo(playerPos)
    if (dist > 40) continue
    if (rareBehaviors.has(creature.state)) {
      this.birdBehaviorSignalId = creature.id
      break
    }
  }
}
```

Update the mood calculation (around lines 237-246) to include the new signals:

```typescript
// Add to existing mood logic, before the final assignment:
if (this.foxHighlightCreatureId || this.birdBehaviorSignalId) {
  this.mood = this.mood === 'normal' ? 'alert' : this.mood
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/player/CompanionSystem.ts
git commit -m "feat(companion): add fox rare creature highlight and bird behavior signal affinities"
```

---

### Task 12: Photography XP Integration

**Files:**
- Modify: `src/systems/WorldState.ts`
- Modify: `src/camera/CameraSystem.ts`

- [ ] **Step 1: Add photography XP method to WorldState**

In `src/systems/WorldState.ts`, add a method to the class:

```typescript
addPhotoXP(rarityTier: string, isNewDiscovery: boolean, newTier: number): void {
  let xp = 0
  switch (rarityTier) {
    case 'common': xp = 5; break
    case 'uncommon': xp = 15; break
    case 'rare': xp = 30; break
    case 'legendary': xp = 50; break
  }
  if (isNewDiscovery) xp *= 2
  // Tier milestone bonuses
  if (newTier === 3) xp += 20  // studied
  if (newTier === 4) xp += 50  // mastered
  this.playerXP += xp
  this.saveToStorage()
}
```

- [ ] **Step 2: Call addPhotoXP from CameraSystem after photo capture**

In `src/camera/CameraSystem.ts`, add a `worldState` field:

```typescript
private worldState: WorldState | null = null
```

Add a setter method:
```typescript
setWorldState(ws: WorldState): void { this.worldState = ws }
```

Import WorldState:
```typescript
import { WorldState } from '../systems/WorldState'
```

In the `takePhoto()` method, after calling `this.fieldGuide.recordPhoto(...)`, add:

```typescript
// Award XP
const entry = this.fieldGuide.entries.get(variantId)
if (this.worldState && entry) {
  this.worldState.addPhotoXP(result.rarityTier, result.isNewDiscovery, entry.tier)
}
```

- [ ] **Step 3: Wire worldState in Engine.ts constructor**

After the camera system is created, add:
```typescript
this.cameraSystem.setWorldState(this.worldState)
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/systems/WorldState.ts src/camera/CameraSystem.ts src/engine/Engine.ts
git commit -m "feat(progression): add photography XP awards based on rarity and discovery"
```

---

### Task 13: HUD Camera Mode Indicator

**Files:**
- Modify: `src/ui/HUD.ts`

- [ ] **Step 1: Add camera mode indicator to HUD**

In `src/ui/HUD.ts`, add to `HUDUpdateParams` interface:

```typescript
cameraActive: boolean
fieldGuideCount: number
```

In the HUD constructor, create a camera indicator element (add after the other element creations):

```typescript
// Camera mode indicator (top-right)
this.cameraIndicator = document.createElement('div')
this.cameraIndicator.style.cssText = `
  position:absolute; top:8px; right:16px;
  font:10px monospace; color:#d4a574; text-transform:uppercase;
  letter-spacing:1px; opacity:0; transition:opacity 0.3s;
`
this.container.appendChild(this.cameraIndicator)
```

Add the field declaration:
```typescript
private cameraIndicator: HTMLDivElement
```

In the `update()` method, add:

```typescript
// Camera mode indicator
this.cameraIndicator.style.opacity = params.cameraActive ? '1' : '0'
this.cameraIndicator.textContent = params.cameraActive
  ? `CAMERA [X] | Guide: ${params.fieldGuideCount} species [N]`
  : ''
```

- [ ] **Step 2: Pass camera state from Engine.ts**

In Engine.ts, where `this.hud.update({...})` is called (around line 1017), add to the params object:

```typescript
cameraActive: this.cameraSystem.active,
fieldGuideCount: this.fieldGuide.getPhotographedCount(),
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/ui/HUD.ts src/engine/Engine.ts
git commit -m "feat(hud): add camera mode indicator with species count"
```

---

### Task 14: Full Integration Test and Polish

**Files:**
- No new files — verification pass

- [ ] **Step 1: Build check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 2: Dev server test**

Run: `npm run dev` and test the complete flow:

1. **Camera basics:** Press X to enter camera mode. Viewfinder shows. Movement slows. Press X to exit.
2. **Photo capture:** In camera mode, aim at a creature and click. Result card shows species, rarity, behavior, stars.
3. **Silhouette registration:** Walk near creatures without photographing — they should register in field guide as tier 1.
4. **Field guide:** Press N. See tabs by body plan. Photographed species show name, rarity, stars. Silhouettes show "???".
5. **Tier progression:** Photograph the same species doing 3+ different behaviors. Entry should reach tier 3 (Studied). Get a rare behavior photo to reach tier 4 (Mastered).
6. **Ecological tools:** After mastering a species, press B. Tool menu should show available tools. Press 1-5 to place. Small colored box appears at feet.
7. **Tool effects:** Place a food attractor. Over time, herbivores should wander toward it (check with camera).
8. **Mutation boost:** Place a resonance amplifier near a resonance site. Breeding nearby should produce higher-rarity offspring over time.
9. **Companion:** Bond with a fox. It should highlight rare creatures with its alert mood.
10. **XP:** Check that photography awards XP (visible in weapon tier progression).
11. **Persistence:** Reload page. Field guide entries, placed tools, and essence inventory should persist.

- [ ] **Step 3: Production build test**

Run: `npm run build`
Expected: Build completes without errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes for naturalist game loop"
```

(Only if fixes were needed.)
