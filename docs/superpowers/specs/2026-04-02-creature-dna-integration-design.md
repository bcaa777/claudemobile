# Creature DNA Integration — Sub-project 3: Remove SPECIES Table Dependencies

## Summary

Cut the remaining wires between the creature subsystems and the `SPECIES` lookup table. DNA creatures already have `creature.stats` (DerivedStats) populated from sub-project 1, and DNA-driven meshes from sub-project 2. This sub-project makes all stat-consuming files use `creature.stats` instead of `SPECIES[creature.species]`, removes dead legacy spawn code, and cleans up imports.

## Scope

- Add shared `getCreatureStats(creature)` helper to `CreatureDNA.ts`
- Migrate 6 behavior/system files from `SPECIES` lookups to stats helper
- Remove `BIOME_SPAWN_TABLE` and legacy spawn fallback from `CreatureManager.ts`
- Update journal system to work with DNA presets instead of `ALL_SPECIES`
- Clean up remaining `SPECIES` imports from files that no longer need them

Out of scope: removing `Species.ts` entirely (still used by enemy system and flavor systems like sounds/companions), changing the enemy (Hollow) system.

## What Stays

- `creature.species` field — display label, set via `dnaToSpeciesId()`
- `Species.ts` — kept, imported only by flavor systems (CreatureSound, CompanionSystem, CompanionIndicator) and enemy system
- `dnaToSpeciesId()` — permanent bridge
- Enemy (Hollow) spawning and rendering — untouched

## Shared Stats Helper

Add to `CreatureDNA.ts`:

```typescript
export function getCreatureStats(c: { stats: DerivedStats | null; species: SpeciesId }): DerivedStats | SpeciesDef {
  return c.stats ?? SPECIES[c.species]
}
```

This replaces the private `CreatureManager.getStats()` method. Any file can import it.

## File Changes

### CreatureDNA.ts
- Add `getCreatureStats()` free function
- Import `SPECIES` (needed for legacy fallback)

### CreatureManager.ts
- Remove `BIOME_SPAWN_TABLE` constant (dead code — DNA path via `BIOME_DNA_TABLE` covers all biomes)
- Remove legacy spawn fallback in `spawnForChunk` (the `else` branch after DNA spawning)
- Replace private `getStats()` method with imported `getCreatureStats()`
- Remove `SPECIES` import if no longer needed directly

### EcologyBehavior.ts
- Replace all `SPECIES[creature.species]` with `getCreatureStats(creature)`
- Replace hardcoded `PACK_SPECIES` set (`wolf`, `hellhound`) with DNA-derived condition: `creature.dna?.aggression > 0.7 && creature.dna?.bodyPlan === 'quadruped'` — any aggressive quadruped can form packs
- Remove `SPECIES` import

### WeatherResponse.ts
- Replace `SPECIES[creature.species]` with `getCreatureStats(creature)`
- Remove `SPECIES` import

### SiteAwareness.ts
- Replace `ATTUNED_SPECIES` biome→species mapping with DNA-based check: a creature is attuned to a biome if it was spawned there (can derive from biome at creature position) or if its DNA preset is associated with that biome
- Replace `SPECIES[creature.species]` stat lookups with `getCreatureStats(creature)`
- Remove `SPECIES` import

### JournalData.ts
- Replace `ALL_SPECIES.filter(s => !SPECIES[s].isGiant)` with DNA preset names from `DNA_PRESETS`
- Remove `SPECIES` and `ALL_SPECIES` imports
- Import `DNA_PRESETS` from `DNAPresets.ts`

### JournalSystem.ts
- Replace `SPECIES[c.species].isGiant` with `getCreatureStats(c).isGiant`
- Remove `SPECIES` import

### CreatureMesh.ts
- The DNA path already handles all DNA creatures (buildGeometry + buildSimple + animation)
- Remove remaining `SPECIES` fallback in companion collar and glow sections (replace with `getCreatureStats`)
- Keep `SPECIES` import only for the legacy giant builder methods (titan/skywhale/wurm/infernal) which are still used for non-DNA giants if any exist

## File Structure

| Action | File | Change |
|--------|------|--------|
| Modify | `src/creatures/CreatureDNA.ts` | Add `getCreatureStats()` |
| Modify | `src/creatures/CreatureManager.ts` | Remove BIOME_SPAWN_TABLE, legacy spawn, use getCreatureStats |
| Modify | `src/creatures/EcologyBehavior.ts` | Use getCreatureStats, DNA-based pack detection |
| Modify | `src/creatures/WeatherResponse.ts` | Use getCreatureStats |
| Modify | `src/creatures/SiteAwareness.ts` | Use getCreatureStats, DNA-based attunement |
| Modify | `src/journal/JournalData.ts` | Use DNA_PRESETS instead of ALL_SPECIES |
| Modify | `src/journal/JournalSystem.ts` | Use getCreatureStats |
| Modify | `src/creatures/CreatureMesh.ts` | Use getCreatureStats for collar/glow |
