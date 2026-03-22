# Layer 3: Mystery Narrative — Resonance Builders, Rituals, Lore

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer in the mystery narrative: Resonance Sites with unique rituals per biome, lore stone content telling the Builders' story, NPC dialogue fragments, world response to site activation, and the endgame chord completion.

**Architecture:** Each Resonance Site has a RitualSystem that tracks observation progress and detects activation conditions. Lore stones contain narrative fragments. NPCs provide contextual hints. WorldState tracks activation and drives world response (visual/audio improvements per activated biome). The journal auto-logs observations.

**Tech Stack:** TypeScript, Three.js, Web Audio API

**Spec:** `docs/superpowers/specs/2026-03-22-world-redesign-design.md` (Section 5: The Mystery)

**Prerequisite:** Layer 2 must be complete.

---

## File Structure

### Files to Create
- `src/systems/RitualSystem.ts` — Manages ritual state, detection, activation for all biomes
- `src/systems/RitualData.ts` — Per-biome ritual definitions (conditions, patterns, observation requirements)
- `src/systems/ResonanceSite.ts` — Visual/audio representation of a Resonance Site (mesh, glow, harmonic tone)
- `src/lore/LoreContent.ts` — All lore stone text content organized by biome and discovery order
- `src/lore/NarrativeProgression.ts` — Tracks overall story progression, triggers hypothesis generation
- `src/audio/HarmonicTone.ts` — Persistent harmonic tones for activated sites, building the world chord

### Files to Modify
- `src/landmarks/LandmarkManager.ts` — Attach ResonanceSite to each primary landmark
- `src/journal/LoreStone.ts` — Update to use LoreContent, support night-only and proximity-gated stones
- `src/journal/JournalData.ts` — Replace generic entries with narrative-driven content
- `src/journal/JournalSystem.ts` — Auto-log creature behaviors, weather events near sites as "observations"
- `src/npcs/NPCData.ts` — Rewrite dialogue for mystery narrative (cryptic, poetic, referencing other biomes)
- `src/npcs/NPCManager.ts` — Support time-conditional and progression-conditional dialogue
- `src/systems/WorldState.ts` — Add ritual tracking, activation events, world response modifiers
- `src/systems/BiomeTransition.ts` — Apply world response (visual improvement for activated biomes)
- `src/audio/AudioSystem.ts` — Integrate harmonic tone system
- `src/engine/Engine.ts` — Wire RitualSystem into update loop

---

## Task 1: Resonance Site Visuals & Audio

**Files:**
- Create: `src/systems/ResonanceSite.ts`
- Create: `src/audio/HarmonicTone.ts`
- Modify: `src/landmarks/LandmarkManager.ts`

- [ ] **Step 1: Create ResonanceSite class**

A visual/audio marker at each primary landmark that represents the harmonic center:

```typescript
export class ResonanceSite {
  biome: BiomeType;
  position: THREE.Vector3;
  activated: boolean = false;
  mesh: THREE.Group;          // visual representation
  harmonicTone: HarmonicTone;

  constructor(biome: BiomeType, position: THREE.Vector3) { ... }

  // Visual: a subtle glowing ring/circle on the ground at the landmark center
  // When not activated: faint, pulsing glow (biome color, low opacity)
  // When activated: bright, steady glow + visible harmonic particles rising
  createMesh(): THREE.Group { ... }

  update(dt: number, playerDistance: number): void {
    // Pulse glow when not activated
    // Emit particles when activated
    // Audio: proximity-based harmonic tone volume
  }

  activate(): void {
    this.activated = true;
    // Bright flash, particle burst, harmonic tone locks in
  }
}
```

- [ ] **Step 2: Create HarmonicTone audio system**

Each biome has a unique musical note that plays as a persistent quiet tone when the site is activated:

```typescript
// Per-biome harmonic frequencies (building a chord)
Forest: C4 (261.6 Hz)
Desert: D4 (293.7 Hz)
Swamp: Eb4 (311.1 Hz)
Snow: F4 (349.2 Hz)
Volcanic: G4 (392.0 Hz)
Crystal: A4 (440.0 Hz)
Jungle: Bb4 (466.2 Hz)
Mesa: B4 (493.9 Hz)
CoralReef: C5 (523.3 Hz)
Heaven: E5 (659.3 Hz)
Hell: (dissonant — tritone from root, resolved when activated)
```

Implementation: sine oscillator with gentle envelope, very low volume (ambient). Volume increases slightly as player is in that biome. All activated tones play simultaneously = the world chord.

- [ ] **Step 3: Attach ResonanceSite to each primary landmark**

In LandmarkManager, after spawning each landmark, create a ResonanceSite at the landmark's center position. Add to scene and register in WorldState.

- [ ] **Step 4: Verify resonance sites**

Visit Forest landmark. Verify:
- Faint glowing ring on the ground
- Subtle pulsing
- Quiet tone audible when close

- [ ] **Step 5: Commit**

```bash
git add src/systems/ResonanceSite.ts src/audio/HarmonicTone.ts src/landmarks/LandmarkManager.ts
git commit -m "feat: resonance sites — visual glow rings and harmonic tones at each biome landmark"
```

---

## Task 2: Ritual System Core

**Files:**
- Create: `src/systems/RitualSystem.ts`
- Create: `src/systems/RitualData.ts`
- Modify: `src/systems/WorldState.ts`
- Modify: `src/engine/Engine.ts`

- [ ] **Step 1: Define RitualData for all 11 biomes**

```typescript
export interface RitualRequirement {
  biome: BiomeType;
  // What to observe before ritual becomes solvable
  observations: {
    creatureBehaviorNearSite: boolean;   // witnessed attuned creature at site
    weatherReveal: boolean;               // witnessed weather-site interaction
    loreFragmentsFound: number;           // minimum lore stones in this biome
  };
  // Conditions for activation
  activation: {
    timeOfDay?: 'dawn' | 'dusk' | 'night' | 'midnight' | 'any';
    weather?: string;                     // required weather type
    creaturePresent?: string;             // attuned species name must be near
    creatureState?: string;               // creature must be in this state
    playerAction: string;                 // what player does: 'stand_center', 'walk_path', 'interact', 'climb'
    playerRadius: number;                 // how close player must be to site center
  };
}

export const RITUAL_DATA: Record<BiomeType, RitualRequirement> = {
  [BiomeType.Forest]: {
    observations: { creatureBehaviorNearSite: true, weatherReveal: true, loreFragmentsFound: 3 },
    activation: {
      timeOfDay: 'dusk',
      weather: 'clear',
      creaturePresent: 'deer',
      creatureState: 'reverence',
      playerAction: 'stand_center',
      playerRadius: 3,
    }
  },
  // ... all 11 biomes
};
```

- [ ] **Step 2: Create RitualSystem**

Manages ritual state for all biomes:

```typescript
export class RitualSystem {
  private ritualProgress: Map<BiomeType, {
    observationsMet: { [key: string]: boolean };
    activationAttempted: boolean;
    completed: boolean;
  }>;

  update(dt: number, worldState: WorldState, creatures: CreatureManager): void {
    // For each biome's site within player range:
    // 1. Check if new observations are met (auto-track)
    // 2. If all observations met + activation conditions met → trigger activation
  }

  private checkActivationConditions(biome: BiomeType, worldState: WorldState, ...): boolean {
    // Check time, weather, creature state, player position
  }

  private activateSite(biome: BiomeType, site: ResonanceSite, worldState: WorldState): void {
    // Mark activated in WorldState
    // Trigger ResonanceSite.activate() (visual/audio burst)
    // Trigger world response
  }
}
```

- [ ] **Step 3: Add ritual tracking to WorldState**

```typescript
// In WorldState
ritualProgress: Map<BiomeType, RitualProgress>;
onSiteActivated: ((biome: BiomeType) => void)[];  // event listeners
```

- [ ] **Step 4: Wire into Engine.ts**

Add `ritualSystem.update()` to the engine loop after creature updates but before audio.

- [ ] **Step 5: Implement Forest ritual fully**

Forest ritual: player stands at grove center at dusk, clear weather, while deer are in reverence state circling. Test this end-to-end.

- [ ] **Step 6: Verify Forest ritual**

In Forest: wait for dusk, ensure deer are near temple, stand at center. Verify:
- System detects conditions met
- Site activates with visual flash and harmonic tone
- WorldState updates

- [ ] **Step 7: Commit**

```bash
git add src/systems/RitualSystem.ts src/systems/RitualData.ts src/systems/WorldState.ts src/engine/Engine.ts
git commit -m "feat: ritual system — observation tracking and activation detection for all biomes"
```

---

## Task 3: World Response to Activation

**Files:**
- Modify: `src/systems/BiomeTransition.ts`
- Modify: `src/systems/WorldState.ts`
- Modify: `src/audio/AudioSystem.ts`

- [ ] **Step 1: Visual improvement for activated biomes**

When a site is activated, that biome's visual identity shifts:
- Color saturation increases by 15%
- Fog pulls back (farDistance increases by 20%)
- Ambient light brightens by 10%
- Atmosphere particles become calmer (speed reduces by 30%)

Implement by having BiomeTransition check `worldState.activatedSites` and apply modifiers to the biome's visual identity before interpolation.

- [ ] **Step 2: Adjacent biome bleed**

Biomes adjacent to an activated biome get a smaller improvement (5% saturation, 5% brightness). Determine adjacency from BiomeMap Voronoi neighbors.

- [ ] **Step 3: Global improvements**

Each activation:
- Sky base brightness increases by `1/11 * 0.1` (so all 11 = 10% brighter sky)
- The harmonic tone for that biome joins the persistent world chord
- Weather in that biome becomes slightly more stable (fewer severe events)

- [ ] **Step 4: Hell/Depths shrinkage**

Each activation reduces Hell's radius by 15 units (from 300 down to minimum 135 at full activation). Update BiomeMap's HELL_RADIUS dynamically based on `activatedSites.size`.

- [ ] **Step 5: Verify world response**

Activate Forest site. Verify:
- Forest colors slightly richer
- Forest harmonic tone persists
- Sky marginally brighter
- Hell region slightly smaller (check debug map)

- [ ] **Step 6: Commit**

```bash
git add src/systems/BiomeTransition.ts src/systems/WorldState.ts src/audio/AudioSystem.ts src/world/BiomeMap.ts
git commit -m "feat: world response to activation — visual improvements, harmonic chord, Hell shrinkage"
```

---

## Task 4: Lore Stone Content & Narrative

**Files:**
- Create: `src/lore/LoreContent.ts`
- Modify: `src/journal/LoreStone.ts`
- Modify: `src/journal/JournalData.ts`

- [ ] **Step 1: Write lore content for all 11 biomes**

5-7 lore fragments per biome, telling the Resonance Builders' story from that biome's perspective. Total ~60-70 entries.

Each fragment is 2-3 sentences, cryptic but evocative:

```typescript
export const LORE_CONTENT: Record<BiomeType, LoreFragment[]> = {
  [BiomeType.Forest]: [
    { id: 'forest_1', text: "The first thing they heard was the hum beneath the roots. Not sound exactly — more like the memory of sound, felt in the bones.", order: 1 },
    { id: 'forest_2', text: "They called it the Green Frequency. Every leaf trembled at the same rate. The deer knew it before the Builders did.", order: 2 },
    { id: 'forest_3', text: "The grove was their first attempt. A ring of stones tuned to the forest's voice. When the deer circled at dusk, the stones sang back.", order: 3 },
    // ... 4-5 more per biome
  ],
  // ... all biomes
};
```

**Narrative arc across biomes:**
- Forest: Discovery of the frequencies
- Desert: The civilization grows, builds monuments
- Crystal: Communication network established
- Snow: Preservation of knowledge
- Jungle: Nature's power harnessed
- Mesa: Archives recording history
- Coral Coast: Trade and connection
- Volcanic: Tapping dangerous power
- Swamp: First signs of corruption
- Heaven: Ascension achieved
- Hell: The experiment that broke everything

- [ ] **Step 2: Update LoreStone to use LoreContent**

Replace generic lore entries with narrative content. Each lore stone in a biome pulls from that biome's fragment list in order of discovery.

- [ ] **Step 3: Add night-only lore stones**

Mark ~30% of lore stones as `nightOnly: true`. These use a different glow color (silver/white instead of gold) and only render between 19:00-05:00 game time.

- [ ] **Step 4: Update JournalData with narrative entries**

Replace generic biome/creature entries with entries that reference the narrative. When the player finds a lore stone, the journal adds both the fragment text AND an observation note.

- [ ] **Step 5: Verify lore in Forest**

Find 3 lore stones in Forest. Verify:
- Text tells a coherent story fragment
- Journal records each discovery
- Night-only stones invisible during day

- [ ] **Step 6: Commit**

```bash
git add src/lore/LoreContent.ts src/journal/LoreStone.ts src/journal/JournalData.ts
git commit -m "feat: narrative lore content — 60+ fragments across 11 biomes telling the Builders' story"
```

---

## Task 5: NPC Dialogue Rewrite

**Files:**
- Modify: `src/npcs/NPCData.ts`
- Modify: `src/npcs/NPCManager.ts`
- Modify: `src/npcs/DialogueSystem.ts`

- [ ] **Step 1: Reduce to 2-3 NPCs per biome**

Current system has 7 NPCs at multiple locations. Restructure:
- Keep 7 NPCs but give each a home biome (primary location) plus 1-2 secondary locations
- Each biome should have 2-3 NPCs accessible

- [ ] **Step 2: Rewrite dialogue for mystery narrative**

Each NPC has:
- **Introduction lines:** Short, establishing character ("I've been listening to the stones for longer than I care to remember.")
- **Biome-specific hints:** Reference local mystery elements ("The deer here know something. Watch them at dusk.")
- **Cross-biome references:** Point to other biomes ("I've heard the desert hums at dawn. Never been brave enough to check.")
- **Progression-gated lines:** New dialogue unlocks after player makes discoveries (found X lore stones, witnessed creature behavior, activated a site)
- **Time-conditional lines:** Some dialogue only at night ("They speak louder after dark. The stones, I mean.")

All dialogue should be short (1-2 sentences), poetic, and never explicitly tell the player what to do.

- [ ] **Step 3: Update DialogueSystem for conditional dialogue**

Add condition checking to dialogue selection:
```typescript
interface DialogueLine {
  text: string;
  conditions?: {
    minLoreFound?: number;
    sitesActivated?: BiomeType[];
    timeOfDay?: 'day' | 'night' | 'dawn' | 'dusk';
    companionSpecies?: string;
    biomeVisited?: BiomeType[];
  };
}
```

- [ ] **Step 4: Add companion reactions**

When player has a companion and talks to an NPC, NPC has a companion-specific line:
- "Ah, you travel with a fox. They know things we've forgotten."
- "A deer companion. The grove remembers its kind."

- [ ] **Step 5: Verify NPC dialogue**

Talk to NPCs in Forest at different times and progression states. Verify:
- Dialogue is cryptic and atmospheric
- New lines appear after finding lore stones
- Companion-specific lines trigger
- Night dialogue differs from day

- [ ] **Step 6: Commit**

```bash
git add src/npcs/NPCData.ts src/npcs/NPCManager.ts src/npcs/DialogueSystem.ts
git commit -m "feat: narrative NPC dialogue — cryptic hints, progression-gated, time-conditional, companion-reactive"
```

---

## Task 6: Narrative Progression & Hypothesis System

**Files:**
- Create: `src/lore/NarrativeProgression.ts`
- Modify: `src/journal/JournalSystem.ts`

- [ ] **Step 1: Create NarrativeProgression tracker**

Tracks overall mystery progress and generates hypotheses:

```typescript
export class NarrativeProgression {
  // Per-biome observation tracking
  private observations: Map<BiomeType, {
    loreFound: number;
    creatureBehaviorWitnessed: boolean;
    weatherRevealWitnessed: boolean;
    npcSpokenTo: boolean;
    ritualCompleted: boolean;
  }>;

  // When enough observations in a biome, generate a hypothesis
  getHypothesis(biome: BiomeType): string | null {
    const obs = this.observations.get(biome);
    if (!obs || obs.loreFound < 2) return null;

    if (obs.creatureBehaviorWitnessed && !obs.ritualCompleted) {
      return HYPOTHESES[biome]; // e.g., "The deer seem drawn to the grove at dusk..."
    }
    return null;
  }

  getPhase(): 1 | 2 | 3 | 4 {
    // Phase 1: < 3 total observations
    // Phase 2: 3+ observations, < 1 ritual
    // Phase 3: 1+ rituals completed
    // Phase 4: 8+ rituals completed
  }
}
```

- [ ] **Step 2: Auto-log observations in JournalSystem**

Extend JournalSystem to detect and log:
- "Witnessed deer standing still near the grove, facing the stones" (creature behavior near site)
- "Rain revealed carved channels in the ground near the temple" (weather reveal)
- "Found lore stone: [fragment text]" (lore discovery)

These auto-logged observations feed NarrativeProgression.

- [ ] **Step 3: Hypothesis display in journal**

When a hypothesis is generated for a biome, show it in the journal's observation page for that biome as an italicized "hypothesis" entry. This nudges the player toward the ritual without explicit instructions.

- [ ] **Step 4: Verify progression tracking**

Play Forest for 10 minutes: find 2 lore stones, watch deer at temple, see rain reveal. Verify:
- All observations auto-logged in journal
- Hypothesis appears: "The deer seem drawn to the grove at dusk..."
- Narrative phase advances from 1 to 2

- [ ] **Step 5: Commit**

```bash
git add src/lore/NarrativeProgression.ts src/journal/JournalSystem.ts
git commit -m "feat: narrative progression — auto-logged observations, hypothesis generation, phase tracking"
```

---

## Task 7: Implement All 11 Biome Rituals

**Files:**
- Modify: `src/systems/RitualData.ts` (complete all definitions)
- Modify: `src/systems/RitualSystem.ts` (biome-specific activation logic)

- [ ] **Step 1: Define remaining 10 ritual requirements**

Complete RitualData for all biomes beyond Forest (already done in Task 2):

| Biome | Time | Weather | Creature | Player Action |
|-------|------|---------|----------|--------------|
| Desert | Dawn | Post-sandstorm (clear after sand) | Camel kneeling | Stand among revealed markers |
| Swamp | Night | Fog | Toads croaking rhythmically | Walk fog corridor to center |
| Snow | Midnight | Clear sky | Mammoths gathered | Walk breath-pattern on ice |
| Volcanic | Any | Calm (no eruption) | Wurms surfacing in sequence | Follow wurm path between vents |
| Crystal | Any | Any | Any creature humming | Touch the silent (non-glowing) crystal |
| Jungle | Any | Rain | Birds showing canopy pattern | Reach canopy platform |
| Mesa | Sunset | Any | Goat on ledges | Touch glowing fossils bottom to top |
| Coral Coast | Any | Low tide (new condition) | Fish swirling (ambient) | Walk exposed tidal symbol |
| Heaven | Any | Any | Skywhales singing | Reach central platform |
| Hell | Any | Any | Requires 8+ sites activated | Stand still at center with chord |

- [ ] **Step 2: Implement biome-specific activation detection**

Some rituals need custom detection:
- Desert: check if sandstorm recently ended (within 60s) and weather is now clear
- Swamp: detect player walking along fog corridor (series of waypoints)
- Snow: detect player walking a specific path on frozen lake
- Volcanic: detect player following wurm path (visited vents in sequence)
- Mesa: detect player touching fossils in bottom-to-top order (interact with objects at increasing Y)
- Coral Coast: new tidal system (6-minute tide cycle, low tide exposes paths)
- Heaven: detect player at highest platform point

- [ ] **Step 3: Add per-biome activation visual effects**

Each activation has a unique visual moment:
- Forest: golden light burst, leaves swirl upward
- Desert: sand rises then settles revealing the full monument
- Swamp: fog clears in an expanding circle
- Snow: ice cracks in a beautiful pattern, light shines through
- Volcanic: lava channels glow bright then cool to crystal
- Crystal: all crystals pulse in unison, light wave radiates
- Jungle: canopy parts, sunlight floods down
- Mesa: cliff layers illuminate bottom to top
- Coral Coast: tidal pools glow, water turns luminous
- Heaven: clouds part, pure light descends
- Hell: dissonance resolves to harmony, darkness lifts

- [ ] **Step 4: Test 3 biome rituals end-to-end**

Verify Forest, Desert, and Crystal rituals work fully (these cover different mechanics: time-gated, weather-gated, and always-available).

- [ ] **Step 5: Commit**

```bash
git add src/systems/RitualData.ts src/systems/RitualSystem.ts
git commit -m "feat: all 11 biome rituals — unique conditions, detection logic, and activation effects"
```

---

## Task 8: Endgame — The Chord Completion

**Files:**
- Modify: `src/systems/RitualSystem.ts`
- Modify: `src/audio/HarmonicTone.ts`
- Modify: `src/systems/WorldState.ts`

- [ ] **Step 1: Hell/Depths endgame condition**

When 8+ sites are activated:
- Hell biome begins to change visually (dark red lightens to purple)
- The dissonance in Hell's audio becomes less harsh
- Creatures in Hell calm slightly
- The center of Hell gains a visible resonance site (was invisible before)

- [ ] **Step 2: Final ritual**

Player enters Hell center with 8+ harmonics active. Stands still for 10 seconds at the site. During those 10 seconds:
- Each activated harmonic tone crescendos one by one
- The chord builds up
- Hell's visual distortion reduces with each note
- On completion: bright flash, Hell's dissonance resolves, final harmonic joins

- [ ] **Step 3: Post-completion world state**

After completing the chord:
- All biomes reach maximum visual beauty
- Weather patterns normalize globally
- Creatures everywhere are calmer
- A new persistent ambient sound: the complete chord, barely audible, underlying everything
- Hell transforms into a new, peaceful biome (the frequency the Builders tried to create — now harmonized)

- [ ] **Step 4: Verify endgame**

Use debug/save manipulation to set 8 sites activated. Enter Hell. Complete the final ritual. Verify the full sequence plays out.

- [ ] **Step 5: Commit**

```bash
git add src/systems/RitualSystem.ts src/audio/HarmonicTone.ts src/systems/WorldState.ts
git commit -m "feat: endgame chord completion — Hell ritual, harmonic crescendo, world transformation"
```

---

## Task 9: Save/Load Progression

**Files:**
- Modify: `src/systems/WorldState.ts`

- [ ] **Step 1: Implement save/load for all progression state**

Save to localStorage:
```typescript
{
  activatedSites: number[];        // BiomeType values
  loreFound: Record<string, boolean>;  // lore fragment IDs
  npcDialogueProgress: Record<string, number>;
  ritualObservations: Record<number, object>;
  companionBond: { species: string; biome: number } | null;
  campfirePositions: [number, number, number][];
  journalEntries: string[];
}
```

- [ ] **Step 2: Load on game start**

In Engine initialization, load saved state into WorldState. All systems that read WorldState will automatically reflect saved progress.

- [ ] **Step 3: Verify persistence**

Activate Forest site. Refresh browser. Verify:
- Forest site is still activated (visual + audio)
- Lore stones already found are marked
- Journal retains entries
- World response (brighter Forest) persists

- [ ] **Step 4: Commit**

```bash
git add src/systems/WorldState.ts
git commit -m "feat: save/load mystery progression — activated sites, lore, dialogue, observations"
```

---

## Layer 3 Completion Checklist

Before moving to Layer 4, verify:
- [ ] Resonance Sites visible at all 11 landmarks (glow, pulse, harmonic tone)
- [ ] Ritual system tracks observations and detects activation conditions
- [ ] Forest ritual works end-to-end (observe → understand → arrange → activate)
- [ ] All 11 rituals defined with unique conditions
- [ ] World visibly responds to activation (colors, weather, fog, chord)
- [ ] 60+ lore fragments across 11 biomes tell a coherent story
- [ ] NPCs provide cryptic hints, react to progression and companions
- [ ] Narrative progression generates hypotheses in journal
- [ ] Hell shrinks with activations, endgame ritual works
- [ ] All progression saves and loads correctly
- [ ] >30 FPS maintained
