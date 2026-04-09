# Autoshooter Game Design — v2.0

## Overview

A roguelike autoshooter built on the v2.0 procedural world engine. Players launch expeditions from a castle hub into procedurally generated biomes, fighting DNA-driven mutant creatures through wave-based combat. The world follows a three-act narrative arc: peaceful surface → corruption → underground descent → restoration.

**Engine dependency:** This game consumes the engine defined in `2026-04-09-engine-refactor-design.md`. It lives in `packages/crawler-world/`.

## Narrative Arc

### Act 1 — Surface (Biomes 1-4)
The world is lush but hostile. Creatures are aggressive mutants roaming the biomes. The player fights through Forest, Desert, Swamp, and Snow, cleansing each by defeating the biome boss. The castle hub grows with each cleansed biome — new NPCs arrive, new shops open.

### Act 2 — Corruption (Biomes 5-8)
A corruption event triggers after cleansing 4 biomes. Previously visited biomes twist visually — darker skies, corrupted terrain colors, mutated vegetation. New biomes unlock (Volcanic, Crystal, Jungle, Mesa) with harder enemy variants. Enemies mutate faster, DNA produces more extreme specimens.

### Act 3 — Underground (Biomes 9-11+)
Subterranean biomes open beneath the corrupted surface — caverns, lava tunnels, crystal depths. These are the hardest zones with the most extreme mutations. A final boss encounter in the deepest underground biome restores the world. Corrupted biomes revert to their original appearance. Endgame unlocks for replayability.

---

## Core Gameplay Loop

### Expedition Flow

1. **Castle hub** — Talk to NPCs, buy upgrades, choose companion, select biome from world map
2. **Biome entry** — Procedurally generated terrain loads for chosen biome. Player spawns at entry point.
3. **Wave combat** — Enemies spawn in waves with escalating difficulty. Waves last ~120 seconds each. DNA mutations compound between waves.
4. **Level up** — Earn XP from kills. On level-up, choose 1 of 3 upgrades (weapon unlock, weapon level-up, stat boost). Can reroll for gold.
5. **Biome boss** — After surviving enough waves, the biome boss spawns. Defeat it to "cleanse" the biome.
6. **Extraction** — After boss kill (or death), return to hub with earned currency and progression.
7. **Hub growth** — Cleansed biomes unlock new hub NPCs and shops. Spend currency on permanent upgrades.
8. **Push deeper** — Select a harder biome from the map and repeat.

### Death & Failure

- Death ends the expedition. Player keeps earned meta-currency (gold) but loses in-run weapon levels and upgrades.
- Cleansed biomes stay cleansed. Boss progress is permanent.
- Optional: "retreat" button to extract mid-run with partial rewards (forfeits boss attempt).

---

## Combat System

### Auto-Shooting (Hybrid Model)

- **Primary weapon** — Follows player's camera aim direction. Auto-fires at the nearest enemy within an aim cone. Player controls where to focus fire.
- **Secondary/passive weapons** — Auto-target the nearest or best enemy independently. Orbitals rotate around player. Auras damage nearby enemies. Totems deploy at fixed positions.
- **Camera perspective** — Switchable at any time: first-person, third-person over-shoulder, third-person high angle, top-down. Each perspective works with the hybrid aiming model.

### Terrain-Aware Weapons

Weapons designed around the 3D procedural world — terrain is a combat mechanic, not just scenery.

**Weapon categories (inspired by Crawler, redesigned for 3D):**

| Category | Examples | Terrain Interaction |
|----------|----------|---------------------|
| Projectile | Bolt Caster, Tri-Shot | Projectiles follow terrain contour or arc over hills |
| Area | Shockwave, Ground Slam | Damage propagates along terrain surface, stopped by cliffs |
| Environmental | Avalanche, Lava Eruption, Flood | Triggers biome-specific terrain hazards |
| Gravity | Cliff Push, Vortex Pull | Knockback enemies off edges, pull into ravines |
| Chain | Lightning Arc, Vine Snare | Chains between enemies at different elevations |
| Orbital | Shield Ring, Blade Orbit | Rotates around player at terrain height |
| Deployable | Turret, Mine Field, Totem | Placed on terrain surface, respects elevation |
| Companion-synced | Pack Strike, Coordinated Volley | Companion and player combine attacks |

### Weapon Progression (adapted from Crawler)

- **Unlock** — New weapons appear as level-up choices during runs
- **Level up** — Same weapon offered again increases its level (damage, rate, range scale up)
- **Evolution** — At level 5, weapons can evolve into a stronger variant if a meta-requirement is met (e.g. Bolt Caster + speed upgrade = Railgun)
- **Fusion** — Two max-level weapons combine into a unique fusion weapon (e.g. Lightning Arc + Avalanche = Storm Collapse)

Specific weapon definitions, evolution trees, and fusion recipes will be designed during implementation. The system architecture mirrors Crawler's weapon progression.

---

## Enemy System (DNA-Driven)

### DNA Mutation Mechanics

Every enemy is generated from the engine's DNA system. No two runs have identical enemy populations.

- **Base species** — Each biome has 3-4 base species (melee rushers, ranged shooters, flying, armored). Defined as DNA templates.
- **Wave mutation** — Between waves, surviving enemy DNA "breeds." Next wave spawns mutated offspring with shifted stats.
- **Mutation rate scales with depth** — Early biomes: subtle mutations (slightly faster, slightly tougher). Late biomes: extreme mutations (double size, split on death, projectile immunity).
- **Rarity tiers** — Common (90% of spawns), Rare (8%), Epic (1.8%), Legendary (0.2%). Higher rarity = wider mutation range = more unpredictable.

### Enemy Archetypes (per biome, 3-4 each)

| Archetype | Behavior | DNA-Variable Stats |
|-----------|----------|-------------------|
| Rusher | Charges at player, melee attack | Speed, size, health, damage |
| Shooter | Keeps distance, fires projectiles | Range, projectile speed, fire rate |
| Flyer | Hovers above terrain, dive attacks | Altitude, dive speed, aggression |
| Tank | Slow, high HP, area attacks | Health, size, armor, knockback resistance |
| Swarm | Small, weak, spawns in groups of 5-10 | Count, speed, coordination |
| Splitter | On death, splits into 2-3 smaller copies | Split count, child size ratio |

Archetypes are DNA templates. Mutations produce variants within each archetype. A "Rusher" in Forest is different from a "Rusher" in Volcanic — different base DNA, different mutation path.

### Biome Bosses

One unique boss per biome. Bosses are hand-designed (not pure DNA-generated) but use the DNA system for visual variety. Each boss has:
- Multiple attack phases
- Terrain-interaction mechanics (boss uses the biome environment)
- Guaranteed drops (meta-currency, companion unlock, hub NPC unlock)

Boss designs will be defined per-biome during implementation.

---

## Companion System

### Pre-Expedition Choice

Before launching an expedition, player chooses one companion from their unlocked roster. Companions are unlocked by cleansing biomes or defeating bosses.

### Combat Role

- Companion is an active fighter with its own auto-attack
- Each species has a combat specialization:

| Species | Role | Auto-Attack | Passive |
|---------|------|-------------|---------|
| Wolf | Aggressive melee | Charges nearest enemy, bite attack | +10% player damage in melee range |
| Deer | Defensive buffer | Antler charge, knocks enemies back | Damage reduction aura |
| Bird | Ranged harasser | Dive bombs distant enemies | Reveals enemy positions (minimap) |
| Fox | Utility/stealth | Quick strikes, dodges attacks | +pickup range, highlights rare drops |
| Bear | Tank | Heavy swipes, draws aggro | Absorbs hits meant for player |
| Dragon | Glass cannon | Fireball ranged attack | +area damage, low HP |

### Companion Leveling

- Companions earn XP during expeditions (shared from kills)
- Level up increases companion's stats (damage, health, attack speed)
- Companion level resets each run (in-run progression only)
- Meta-upgrade at hub: "Companion Trainer" NPC lets you permanently boost companion base stats

---

## Progression Systems

### In-Run Progression (resets each expedition)

Adapted from Crawler's proven system:

- **XP from kills** — Enemies drop XP orbs. Magnetism pulls them in.
- **Level-up screen** — Choose 1 of 3 random options:
  - Unlock new weapon
  - Level up existing weapon
  - Stat boost (damage, speed, health, pickup range)
- **Reroll** — Spend 10+ gold to reroll options (cost increases each reroll)
- **Weapon evolution** — Automatic at weapon level 5 if meta-requirement met
- **Weapon fusion** — Offered when two compatible max-level weapons are held
- **Gold drops** — Enemies drop gold (~20% of XP drop rate). Persists after run.

### Meta Progression (permanent, between runs)

- **Permanent upgrades** (purchased at hub shops with gold):
  - Damage: +5 per level
  - Health: +20 max HP per level
  - Speed: +10% move speed per level
  - Greed: +20% gold gain per level
  - Wisdom: +20% XP gain per level
  - Magnet: +1 pickup range per level
  - Armor: damage reduction per level

- **Hub growth** — Cleansing biomes unlocks:
  - Biome 1 cleansed: Weapon Smith (reforge weapons, choose starting weapon)
  - Biome 2 cleansed: Companion Trainer (permanent companion stat boosts)
  - Biome 4 cleansed: Mutation Lab (view enemy DNA data, craft resistances)
  - Biome 6 cleansed: Archivist (bestiary, run statistics, lore fragments)
  - Biome 8 cleansed: Portal Master (fast-travel between cleansed biomes)
  - All cleansed: Endgame vendor (prestige upgrades, cosmetics)

### World Map

- Visual map in hub showing all biomes with difficulty ratings
- Cleansed biomes shown as restored. Corrupted biomes shown as twisted.
- Player selects destination before each expedition
- Adjacent biomes unlock when a neighbor is cleansed. Adjacency follows a branching tree: Forest is the root, branching to Desert and Swamp. Each of those branches further. Player always has 2-3 biomes available to choose from, never forced into a single path.

---

## Castle Hub

### Growing Hub Design

The castle starts as ruins — a few walls, one NPC (the expedition launcher). As biomes are cleansed, the hub physically rebuilds:

- **0 biomes cleansed:** Ruined courtyard. One NPC. Basic upgrade shop.
- **1-2 cleansed:** Walls rebuild. Weapon Smith arrives. Training dummy for weapon testing.
- **3-4 cleansed:** Tower rebuilds. Companion Trainer moves in. Companion pen visible.
- **5-6 cleansed:** Great hall opens. Mutation Lab. Map room with world map.
- **7-8 cleansed:** Full castle restored. Archivist library. Portal room.
- **All cleansed:** Castle at full glory. Endgame vendor. Cosmetic banners for completed biomes.

### Hub NPCs

All NPCs use the engine's dialogue system. Conversations are functional (shop UI, upgrade selection) not narrative-heavy.

| NPC | Unlocked | Function |
|-----|----------|----------|
| Commander | Start | Launch expeditions, world map |
| Merchant | Start | Buy permanent stat upgrades with gold |
| Weapon Smith | Biome 1 | Reforge weapons, choose starting weapon for runs |
| Companion Trainer | Biome 2 | Permanent companion stat boosts |
| Mutation Lab Tech | Biome 4 | View enemy DNA data, craft damage resistances |
| Archivist | Biome 6 | Bestiary, run statistics |
| Portal Master | Biome 8 | Fast-travel to cleansed biomes |
| Endgame Vendor | All | Prestige upgrades, cosmetics |

---

## Systems Ported from Crawler

The following Crawler systems are ported and adapted for the 3D engine:

| Crawler System | Adaptation |
|---|---|
| Wave spawning with timeline | Waves spawn from biome edges, scale with biome difficulty |
| XP/leveling with upgrade screen | Same UI flow, adapted for 3D HUD overlay |
| Meta progression (permanent shop) | Hub NPCs replace Crawler's shop screen |
| Bullet pooling (200 projectiles) | Scaled up, integrated with engine's ECS entity pool |
| Spatial hash grid | Moved into engine's physics package |
| Weapon cooldown/firing system | Adapted for WeaponSystem ECS, terrain-aware firing |
| Instanced enemy rendering | Uses engine's RenderSystem with instanced meshes |
| Difficulty scaling over time | Mapped to wave count + biome depth |

## Systems from Engine

| Engine System | Usage |
|---|---|
| Procedural terrain + biomes | Each expedition generates unique terrain for chosen biome |
| DNA creature system | Drives all enemy generation, mutation, visual variety |
| Companion system | Combat companion with auto-attack |
| Castle structures | Hub physically grows using castle mesh generation |
| NPC dialogue | Hub NPC interactions |
| Camera rigs | Switchable perspective during combat |
| Theme system | Visual style per biome, corruption visual overlay in Act 2 |
| Audio system | Biome music, combat intensity scaling, spatial enemy sounds |

---

## Technical Notes

### Performance Targets

- 60 FPS with 200+ enemies on screen
- Bullet pool: 500 projectiles (scaled from Crawler's 200)
- Spatial hash grid: 5-unit cells (same as Crawler)
- Instanced rendering for all standard enemies
- Boss entities use individual meshes

### Persistence

- **localStorage** for: meta-upgrades, cleansed biomes, hub state, companion roster, unlocked weapons
- **No server required** — fully client-side (Crawler's multiplayer is a separate concern, not ported)

### Run Timing

- Each expedition: 10-20 minutes target
- Waves: ~120 seconds each, 5-8 waves per biome expedition
- Boss phase: 2-3 minutes
- Full game completion (all biomes): ~15-25 hours across many expeditions

---

## Success Criteria

1. A complete expedition loop works: hub → biome select → wave combat → level up → boss → hub return
2. DNA mutation produces visually and mechanically distinct enemies across runs
3. Weapon terrain interactions feel meaningful (not just cosmetic)
4. Hub visibly grows as biomes are cleansed
5. All 4 camera perspectives work in combat
6. Companion actively participates in combat with species-appropriate behavior
7. Meta progression creates meaningful power growth between expeditions
8. 60 FPS maintained with 200+ enemies on screen
