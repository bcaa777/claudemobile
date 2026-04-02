# Creature DNA Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `SPECIES` table dependencies from behavior/system files so all creature stats come from DNA, and clean up dead legacy spawn code.

**Architecture:** A shared `getCreatureStats()` free function in `CreatureDNA.ts` provides the DNA-or-fallback lookup. Each consumer file replaces `SPECIES[c.species]` with this helper. Legacy `BIOME_SPAWN_TABLE` and fallback spawn path are removed. Pack behavior and site attunement use DNA genes instead of hardcoded species sets.

**Tech Stack:** TypeScript (existing)

---

## File Structure

| Action | File | Change |
|--------|------|--------|
| Modify | `src/creatures/CreatureDNA.ts` | Add `getCreatureStats()` free function |
| Modify | `src/creatures/CreatureManager.ts` | Remove BIOME_SPAWN_TABLE, legacy spawn, use getCreatureStats |
| Modify | `src/creatures/EcologyBehavior.ts` | Use getCreatureStats, DNA-based pack detection |
| Modify | `src/creatures/WeatherResponse.ts` | Use getCreatureStats |
| Modify | `src/creatures/SiteAwareness.ts` | Use getCreatureStats, DNA-based attunement |
| Modify | `src/journal/JournalData.ts` | Use DNA_PRESETS instead of ALL_SPECIES |
| Modify | `src/journal/JournalSystem.ts` | Use getCreatureStats |

---

### Task 1: Add getCreatureStats helper to CreatureDNA

**Files:**
- Modify: `src/creatures/CreatureDNA.ts`

- [ ] **Step 1: Add the helper function**

At the bottom of `src/creatures/CreatureDNA.ts`, before the closing of the file, add:

```typescript
import { SPECIES } from './Species'

// Re-export for consumers that need the fallback type
export type { SpeciesDef } from './Species'

/**
 * Get stats for a creature — from DNA if available, else legacy SPECIES lookup.
 * Use this instead of SPECIES[c.species] everywhere.
 */
export function getCreatureStats(c: { stats: DerivedStats | null; species: string }): DerivedStats {
  if (c.stats) return c.stats
  // Legacy fallback: build DerivedStats from SPECIES table
  const sp = SPECIES[c.species as keyof typeof SPECIES]
  if (!sp) return c.stats!  // should never happen
  return {
    mobility: sp.mobility,
    role: sp.role,
    maxSpeed: sp.maxSpeed,
    fleeSpeed: sp.fleeSpeed,
    attackDamage: sp.attackDamage,
    attackRange: sp.attackRange,
    sightRange: sp.sightRange,
    adultScale: sp.adultScale,
    babyScale: sp.babyScale,
    maxHunger: sp.maxHunger,
    maxThirst: sp.maxThirst,
    maxAge: sp.maxAge,
    maxEnergy: sp.maxEnergy,
    bodyW: sp.bodyW,
    bodyH: sp.bodyH,
    bodyD: sp.bodyD,
    bodyColor: sp.bodyColor,
    headColor: sp.headColor,
    legColor: sp.legColor,
    isGiant: sp.isGiant ?? false,
  }
}
```

Note: The `SPECIES` import may already exist at the top. If not, add it. Check if there's already an `import type { SpeciesId } from './Species'` — if so, change it to `import { SPECIES, type SpeciesId } from './Species'`.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/creatures/CreatureDNA.ts
git commit -m "feat(dna): add getCreatureStats shared helper for DNA-or-legacy stat lookup"
```

---

### Task 2: Clean up CreatureManager — remove legacy spawn path

**Files:**
- Modify: `src/creatures/CreatureManager.ts`

- [ ] **Step 1: Import getCreatureStats and remove private getStats**

Add import at top:
```typescript
import { getCreatureStats } from './CreatureDNA'
```

Find and remove the private `getStats` method (around line 71-75):
```typescript
  /** Get stats for a creature — from DNA if available, else legacy SPECIES lookup */
  private getStats(c: Creature) {
    if (c.stats) return c.stats
    return SPECIES[c.species]
  }
```

Then find-and-replace all `this.getStats(` with `getCreatureStats(` throughout the file.

- [ ] **Step 2: Remove BIOME_SPAWN_TABLE and legacy spawn fallback**

Delete the entire `BIOME_SPAWN_TABLE` constant (lines 32-48, the `const BIOME_SPAWN_TABLE: Partial<Record<BiomeType, SpeciesId[]>> = { ... }` block).

In `spawnForChunk`, delete the legacy fallback section (everything after the `return` at line 134, starting with `// Legacy fallback for biomes not in BIOME_DNA_TABLE` through the end of the method). The DNA path already covers all biomes via `BIOME_DNA_TABLE`.

- [ ] **Step 3: Clean up imports**

Check if `SPECIES` is still used directly in the file (it may still be needed for `spawnEnemy`). If `spawnEnemy` uses `SPECIES[speciesId]`, keep the import. Otherwise remove it.

Remove `SpeciesId` from the import if no longer used as a type annotation. Keep it if `spawnEnemy` still references it.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/creatures/CreatureManager.ts
git commit -m "feat(dna): remove BIOME_SPAWN_TABLE and legacy spawn fallback from CreatureManager"
```

---

### Task 3: Migrate EcologyBehavior to DNA stats

**Files:**
- Modify: `src/creatures/EcologyBehavior.ts`

- [ ] **Step 1: Replace imports and pack detection**

Replace the import:
```typescript
import { SPECIES, SpeciesId } from './Species'
```
with:
```typescript
import { getCreatureStats } from './CreatureDNA'
```

Replace the hardcoded pack species set:
```typescript
const PACK_SPECIES = new Set<SpeciesId>(['wolf', 'hellhound'])
```
with a function:
```typescript
function isPackCreature(c: Creature): boolean {
  return c.dna ? (c.dna.aggression > 0.7 && c.dna.bodyPlan === 'quadruped') : (c.species === 'wolf' || c.species === 'hellhound')
}
```

- [ ] **Step 2: Replace all SPECIES lookups**

In `computeTerritories` (around line 59): replace `PACK_SPECIES.has(c.species)` with `isPackCreature(c)`.

In `applyEcologyBehavior` (around line 116): replace `const sp = SPECIES[creature.species]` with `const sp = getCreatureStats(creature)`.

In the territorial check (around line 129): replace `!PACK_SPECIES.has(creature.species)` with `!isPackCreature(creature)`.

In `applyFoodChainFlee` (around line 141): replace `const sp = SPECIES[creature.species]` with `const sp = getCreatureStats(creature)`.

In the predator query filter (around line 148): replace `SPECIES[other.species].role === 'predator'` with `getCreatureStats(other).role === 'predator'`.

In `applyHerding` (line 177): the filter `other.species === creature.species` checks for same-species herding. For DNA creatures, replace with a body-plan check so similar creatures herd together:
```typescript
other !== creature &&
(creature.dna ? other.dna?.bodyPlan === creature.dna.bodyPlan : other.species === creature.species) &&
other.state !== 'dead'
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/creatures/EcologyBehavior.ts
git commit -m "feat(dna): migrate EcologyBehavior to DNA stats with DNA-based pack detection"
```

---

### Task 4: Migrate WeatherResponse to DNA stats

**Files:**
- Modify: `src/creatures/WeatherResponse.ts`

- [ ] **Step 1: Replace import and SPECIES lookup**

Replace:
```typescript
import { SPECIES } from './Species'
```
with:
```typescript
import { getCreatureStats } from './CreatureDNA'
```

Replace the SPECIES lookup (line 24):
```typescript
const sp = SPECIES[creature.species]
```
with:
```typescript
const sp = getCreatureStats(creature)
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/creatures/WeatherResponse.ts
git commit -m "feat(dna): migrate WeatherResponse to DNA stats via getCreatureStats"
```

---

### Task 5: Migrate SiteAwareness to DNA-based attunement

**Files:**
- Modify: `src/creatures/SiteAwareness.ts`

- [ ] **Step 1: Replace imports**

Replace:
```typescript
import { SPECIES, SpeciesId } from './Species'
```
with:
```typescript
import { getCreatureStats } from './CreatureDNA'
import type { BodyPlan } from './CreatureDNA'
```

- [ ] **Step 2: Replace ATTUNED_SPECIES with DNA-based check**

Replace the `ATTUNED_SPECIES` constant and `isAttuned` function with a DNA-based version. The idea: in Crystal biome any creature is attuned; in other biomes, attunement is based on body plan matching the biome's character:

```typescript
const BIOME_ATTUNED_PLANS: Partial<Record<BiomeType, Set<BodyPlan>>> = {
  [BiomeType.Forest]:   new Set(['quadruped']),
  [BiomeType.Desert]:   new Set(['quadruped', 'serpentine']),
  [BiomeType.Swamp]:    new Set(['insectoid', 'aquatic']),
  [BiomeType.Snow]:     new Set(['quadruped']),
  [BiomeType.Volcanic]: new Set(['serpentine']),
  [BiomeType.Crystal]:  null as any,  // any creature
  [BiomeType.Jungle]:   new Set(['avian', 'insectoid']),
  [BiomeType.Mesa]:     new Set(['quadruped']),
  [BiomeType.Heaven]:   new Set(['avian']),
}

function isAttuned(creature: Creature, biome: BiomeType): boolean {
  const plans = BIOME_ATTUNED_PLANS[biome]
  if (plans === undefined) return false
  if (plans === null) return true  // Crystal: any creature
  if (creature.dna) return plans.has(creature.dna.bodyPlan)
  // Legacy fallback by species name
  return creature.species === 'deer' || creature.species === 'camel' || creature.species === 'toad'
}
```

- [ ] **Step 3: Update isAttuned call site**

The function signature changed from `isAttuned(species, biome)` to `isAttuned(creature, biome)`. Find all call sites (in `applySiteAwareness`) and pass the creature object instead of `creature.species`.

Also replace any `const sp = SPECIES[creature.species]` with `const sp = getCreatureStats(creature)`.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/creatures/SiteAwareness.ts
git commit -m "feat(dna): migrate SiteAwareness to DNA-based body plan attunement"
```

---

### Task 6: Migrate JournalData and JournalSystem

**Files:**
- Modify: `src/journal/JournalData.ts`
- Modify: `src/journal/JournalSystem.ts`

- [ ] **Step 1: Update JournalData.ts**

Replace the import:
```typescript
import { SpeciesId, ALL_SPECIES, SPECIES } from '../creatures/Species'
```
with:
```typescript
import { DNA_PRESETS } from '../creatures/DNAPresets'
```

Replace the `JOURNAL_SPECIES` line:
```typescript
const JOURNAL_SPECIES: SpeciesId[] = ALL_SPECIES.filter(s => !SPECIES[s].isGiant)
```
with:
```typescript
const JOURNAL_SPECIES: string[] = Object.keys(DNA_PRESETS)
```

Update any type annotations that use `SpeciesId` to use `string` instead. The `CREATURE_NAMES` record type should change from `Record<string, string>` (already is) — no change needed there. But add entries for the new DNA preset names that aren't in the old list:

Add these entries to `CREATURE_NAMES`:
```typescript
  elk: 'Elk', beetle: 'Beetle', spider: 'Spider', mantis: 'Mantis',
  ant: 'Ant', centipede: 'Centipede', songbird: 'Songbird',
  shark: 'Shark', goldfish: 'Goldfish', eel: 'Eel',
  snake: 'Snake', wyrm: 'Wyrm',
```

- [ ] **Step 2: Update JournalSystem.ts**

Replace import:
```typescript
import { SPECIES } from '../creatures/Species'
```
with:
```typescript
import { getCreatureStats } from '../creatures/CreatureDNA'
```

Replace the SPECIES lookup (around line 57):
```typescript
const sp = SPECIES[c.species]
if (sp.isGiant) continue
```
with:
```typescript
const sp = getCreatureStats(c)
if (sp.isGiant) continue
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/journal/JournalData.ts src/journal/JournalSystem.ts
git commit -m "feat(dna): migrate journal system to DNA presets and getCreatureStats"
```
