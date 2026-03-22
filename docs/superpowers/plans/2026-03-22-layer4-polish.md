# Layer 4: Polish — Journal Redesign, HUD, Audio Tuning, Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final polish pass: redesign journal as a mystery board with three tabs, minimal HUD with compass and companion indicator, tune audio balance, craft the first 30 minutes onboarding experience, and build The Chord progress screen.

**Architecture:** Journal overlay is rebuilt as a tabbed UI (World Map, Observations, The Chord). HUD is minimal HTML overlay. Audio gains are balanced across all layers. Onboarding uses subtle environmental cues to guide without explicit tutorials.

**Tech Stack:** TypeScript, HTML/CSS (overlay UI), Web Audio API, Three.js

**Spec:** `docs/superpowers/specs/2026-03-22-world-redesign-design.md` (Section 6: UI & Journal)

**Prerequisite:** Layer 3 must be complete.

---

## File Structure

### Files to Create
- `src/ui/HUD.ts` — Minimal HUD overlay (health, compass, companion indicator, interaction prompt)
- `src/ui/CompassWidget.ts` — Top-center compass with subtle site pull
- `src/ui/CompanionIndicator.ts` — Small companion species + mood icon
- `src/journal/JournalMap.ts` — World Map tab: hand-drawn style biome map
- `src/journal/JournalObservations.ts` — Observations tab: per-biome grouped entries
- `src/journal/JournalChord.ts` — The Chord tab: activated harmonics visualization
- `src/systems/OnboardingSystem.ts` — Subtle first-30-minutes guidance

### Files to Modify
- `src/journal/JournalOverlay.ts` — Complete rewrite as tabbed mystery board
- `src/journal/JournalSystem.ts` — Feed data to new journal tabs
- `src/audio/AudioSystem.ts` — Master gain balancing, layer mixing
- `src/engine/Engine.ts` — Wire HUD and onboarding
- `src/postprocessing/DamagePass.ts` — Health vignette only when damaged (fade after 5s)

---

## Task 1: Minimal HUD

**Files:**
- Create: `src/ui/HUD.ts`
- Create: `src/ui/CompassWidget.ts`
- Create: `src/ui/CompanionIndicator.ts`
- Modify: `src/engine/Engine.ts`

- [ ] **Step 1: Create HUD container**

Minimal HTML overlay with CSS. No background, no borders — just floating elements:

```typescript
export class HUD {
  private container: HTMLDivElement;
  private healthBar: HTMLDivElement;     // bottom-center, only visible when damaged
  private compass: CompassWidget;        // top-center
  private companion: CompanionIndicator; // bottom-left
  private interactionPrompt: HTMLDivElement; // center, small "E" icon

  update(playerState, worldState, nearInteractable): void { ... }
}
```

- [ ] **Step 2: Create CompassWidget**

Top-center of screen. Shows N/S/E/W letters rotating with camera direction. When within 200 units of an undiscovered Resonance Site, a faint dot appears on the compass in that direction (not a waypoint — just "something interesting is that way").

Style: thin line with letter markers. Minimal. Semi-transparent.

- [ ] **Step 3: Create CompanionIndicator**

Bottom-left. Shows:
- Small colored circle matching companion species color
- Species initial letter (D for deer, F for fox, etc.)
- Mood ring: green = normal, yellow = alert, blue = resonating, red = distressed
- Only visible when companion is bonded

- [ ] **Step 4: Health bar behavior**

Health bar only appears when player takes damage. Shows for 5 seconds then fades out over 1 second. If health is full, never shows.

- [ ] **Step 5: Interaction prompt**

Small "E" text/icon appears when player is within interaction range of: NPC, lore stone, resonance site. Positioned at screen center-bottom.

- [ ] **Step 6: Wire into Engine**

Create HUD in Engine, call `hud.update()` each frame with relevant state.

- [ ] **Step 7: Verify HUD**

Play the game. Verify:
- Compass rotates with camera
- Health only shows on damage
- Companion indicator shows when bonded
- "E" prompt near NPCs/lore stones
- Nothing clutters the view during normal exploration

- [ ] **Step 8: Commit**

```bash
git add src/ui/ src/engine/Engine.ts
git commit -m "feat: minimal HUD — compass, companion indicator, contextual health and interaction prompt"
```

---

## Task 2: Journal Redesign — Tabbed Mystery Board

**Files:**
- Modify: `src/journal/JournalOverlay.ts` (complete rewrite)
- Create: `src/journal/JournalMap.ts`
- Create: `src/journal/JournalObservations.ts`
- Create: `src/journal/JournalChord.ts`

- [ ] **Step 1: Rewrite JournalOverlay as tabbed UI**

Full-screen overlay (J key toggle). Three tabs at top:
- "Map" | "Observations" | "The Chord"

Style: parchment/leather texture feel (CSS only, no images). Dark background, warm text colors. Feels like an explorer's notebook.

Tab switching: click or 1/2/3 keys while journal is open.

- [ ] **Step 2: Create JournalMap tab**

A stylized top-down map of the world:
- Canvas-based rendering (2D context, not Three.js)
- Biome regions drawn as colored shapes (approximate Voronoi cells)
- Only discovered biomes are colored (undiscovered are grey/fog)
- Activated sites shown as glowing icons
- Player position: small marker
- Campfire positions: fire icons
- NPC positions: small dot markers (only if met)
- Not a GPS — no coordinates, no precise paths. A traveler's sketch.

- [ ] **Step 3: Create JournalObservations tab**

Per-biome observation pages:
- Left sidebar: list of biomes (only discovered ones)
- Main area: selected biome's observations
  - Lore fragments found (in order, with "???" for missing)
  - Auto-logged creature behaviors
  - Auto-logged weather events
  - NPC quotes collected
  - **Hypothesis** (if generated) shown in italics at bottom
- Biomes with completed rituals get a subtle glow in the sidebar

- [ ] **Step 4: Create JournalChord tab**

Unlocks after first ritual completion. Shows:
- 11 circles arranged in an arc (like a musical staff)
- Each circle = one biome
- Activated: filled with biome color, label shows biome name, gently pulses
- Not activated: empty circle, "???" label
- When tab is opened: each activated tone plays sequentially, building the chord
- Shows globalHarmony percentage

- [ ] **Step 5: Wire JournalSystem to feed data**

JournalSystem already tracks discoveries. Connect it to the new tab components:
- JournalMap reads biome discovery state + positions
- JournalObservations reads lore, auto-logged observations, hypotheses
- JournalChord reads activatedSites from WorldState

- [ ] **Step 6: Verify journal**

Open journal in each tab. Verify:
- Map shows discovered biomes
- Observations are grouped and readable
- Chord tab plays tones (after activating a site)
- Tab switching is responsive

- [ ] **Step 7: Commit**

```bash
git add src/journal/
git commit -m "feat: journal redesign — tabbed mystery board with world map, observations, and chord tabs"
```

---

## Task 3: Audio Balance & Polish

**Files:**
- Modify: `src/audio/AudioSystem.ts`
- Modify: `src/audio/AmbienceSound.ts`
- Modify: `src/audio/BiomeMusic.ts`
- Modify: `src/audio/CreatureSound.ts`
- Modify: `src/audio/HarmonicTone.ts`

- [ ] **Step 1: Define audio layer gain hierarchy**

Master volume structure:
```
Master gain: 1.0
├── Ambience: 0.6 (always present, foundation)
│   ├── Drone: 0.3
│   ├── Texture: 0.25
│   ├── Detail: 0.2
│   └── Occasional: 0.15
├── Music: 0.35 (fades in/out)
├── Creatures: 0.4 (spatial, distance-attenuated)
├── SFX: 0.5 (footsteps, interactions, weather)
├── Harmonic tones: 0.15 (very quiet, ambient)
└── UI: 0.6 (chimes, prompts)
```

- [ ] **Step 2: Implement distance-based creature audio**

Creature sounds should attenuate with distance:
- Full volume within 10 units
- Linear falloff to silence at 60 units
- Spatial panning based on creature position relative to player

- [ ] **Step 3: Music context sensitivity tuning**

Fine-tune when music plays vs silence:
- Combat: music fades out, SFX dominates
- Exploration: music comes and goes (30-40% silence)
- Near sites: mystery undertone replaces normal biome music
- During rituals: music builds to activation moment

- [ ] **Step 4: Cross-biome audio transition smoothness**

Verify that biome audio transitions sound good:
- Ambience crossfades over 3 seconds (no overlap harshness)
- Music finishes current phrase before transitioning (don't cut mid-note)
- Creature sounds are spatial (no sudden change, just different creatures in different areas)

- [ ] **Step 5: Verify audio experience**

Play for 5 minutes across 2-3 biomes. Listen for:
- No audio clipping
- No competing loudness between layers
- Silence feels intentional, not broken
- Mystery sites have audible atmosphere shift
- Music feels organic, not mechanical

- [ ] **Step 6: Commit**

```bash
git add src/audio/
git commit -m "feat: audio balance — gain hierarchy, distance attenuation, context-sensitive mixing"
```

---

## Task 4: Onboarding — First 30 Minutes

**Files:**
- Create: `src/systems/OnboardingSystem.ts`
- Modify: `src/engine/Engine.ts`

- [ ] **Step 1: Create OnboardingSystem**

Subtle environmental guidance — no explicit tutorials. Tracks what the player has done and gently directs attention:

**Minutes 0-5: Arrival**
- Player spawns at castle in Forest
- No HUD elements shown yet (clean first impression)
- Ambient forest sounds and gentle music establish mood
- A deer is placed within visible range, acting normally

**Minutes 5-10: First discovery**
- After 30 seconds of walking, compass fades in
- A lore stone is placed conspicuously on the path from castle
- Finding it triggers journal hint: subtle "J" prompt appears once
- Nearby NPC (within view of castle) has first dialogue

**Minutes 10-20: Noticing patterns**
- Compass gently points toward DruidRingTemple
- As player approaches temple area, deer behavior changes (site awareness)
- First weather event triggered (rain, to show creature shelter behavior + water channels)
- Companion opportunity: a fox near the temple path

**Minutes 20-30: First mystery awareness**
- If player has seen creature behavior + found 2 lore stones + talked to NPC: hypothesis appears in journal
- Dusk approaches (time acceleration if player has been exploring actively)
- Deer ritual behavior visible at dusk if player is near temple

Implementation: state machine tracking player milestones (first walk, first lore stone, first NPC, first site visit, first weather event). Soft triggers, never forced.

- [ ] **Step 2: Place onboarding elements**

Ensure Forest biome has:
- Lore stone on castle exit path (always present, not random)
- NPC within 50 units of castle
- Fox near the path to temple
- Deer near temple area

These are seeded positions, not random spawns.

- [ ] **Step 3: Implement gentle time nudges**

If player has explored for 15+ minutes and hasn't seen dusk yet, slightly accelerate time to bring dusk sooner. Never dramatically — just 1.5x speed.

- [ ] **Step 4: Verify first 30 minutes**

Start fresh (clear localStorage). Play the first 30 minutes. Verify:
- Natural discovery flow
- No tutorial popups or explicit instructions
- Player naturally encounters: lore stone, NPC, creature behavior, weather
- By 30 minutes, enough observation for hypothesis to form
- Nothing feels forced

- [ ] **Step 5: Commit**

```bash
git add src/systems/OnboardingSystem.ts src/engine/Engine.ts
git commit -m "feat: onboarding system — subtle environmental guidance for first 30 minutes"
```

---

## Task 5: Discovery Moment Audio & Visual Polish

**Files:**
- Modify: `src/audio/ChimeSound.ts`
- Modify: `src/journal/LoreStone.ts`
- Modify: `src/systems/RitualSystem.ts`

- [ ] **Step 1: Lore stone discovery moment**

When player picks up a lore stone:
- Brief melodic flourish (ascending 3-note chime in biome's key)
- Particles burst from stone position (biome-colored)
- Text appears floating above the stone position for 3 seconds (the fragment text)
- Journal auto-opens briefly to show the new entry (1.5 seconds, then closes)

- [ ] **Step 2: Ritual activation moment**

When a ritual succeeds:
- 5-second cinematic moment:
  - Camera locks (no player input)
  - Harmonic tone crescendos
  - Visual effect per biome (from Layer 3 Task 7)
  - Biome-wide color/light shift as the improvement takes effect
  - "The [BiomeName] resonates once more." text appears
- Camera returns to player control
- Journal auto-opens to Chord tab briefly

- [ ] **Step 3: NPC meeting moment**

First time meeting an NPC:
- Gentle chime (lower, warmer than lore stone)
- NPC beacon pulses once
- NPC name appears briefly above their head

- [ ] **Step 4: Verify discovery moments**

Trigger each moment. Verify:
- Audio is satisfying but not intrusive
- Visual effects are brief and beautiful
- Nothing blocks gameplay for too long
- Ritual activation feels like the biggest moment (most dramatic)

- [ ] **Step 5: Commit**

```bash
git add src/audio/ChimeSound.ts src/journal/LoreStone.ts src/systems/RitualSystem.ts
git commit -m "feat: discovery moment polish — lore chimes, ritual cinematics, NPC introductions"
```

---

## Task 6: Final Integration & Full Playthrough

**Files:**
- Modify: `src/engine/Engine.ts` (final update loop verification)
- Modify: `src/debug/DebugPanel.ts` (add all new system controls)

- [ ] **Step 1: Update debug panel with all new controls**

Add to debug panel:
- Ritual progress per biome (display only)
- Force activate site (button per biome)
- Reset all progression (button)
- Audio layer toggles (ambience, music, creatures, SFX, harmonic)
- Narrative phase display
- WorldState inspector (globalHarmony, biomeStability)
- Onboarding state display

- [ ] **Step 2: Full fresh playthrough**

Clear all localStorage. Play from spawn through:
1. Onboarding (first 30 min)
2. First ritual completion (Forest)
3. Visit 3+ biomes, notice differences
4. Complete a second ritual
5. Verify save/load (refresh browser mid-play)

Check for:
- No crashes or console errors
- Consistent >30 FPS
- Audio doesn't clip or conflict
- Visual transitions are smooth
- Story makes sense from lore stones
- Journal is useful as a mystery board
- HUD is minimal and helpful
- The world feels alive and connected

- [ ] **Step 3: Performance audit**

Profile with Chrome DevTools:
- GPU frame time < 16ms (60 FPS target) or < 33ms (30 FPS minimum)
- No memory leaks (heap stable over 10 minutes)
- Audio node count stable (not growing)
- Draw calls reasonable (< 200)

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "feat: Layer 4 complete — polish pass with journal, HUD, audio balance, onboarding, discovery moments"
```

---

## Layer 4 Completion Checklist

All four layers complete. Final verification:
- [ ] Journal has 3 tabs: Map, Observations, The Chord
- [ ] World map shows discovered biomes and activated sites
- [ ] Observations grouped by biome with hypotheses
- [ ] The Chord plays activated harmonics
- [ ] HUD is minimal: compass, companion, contextual health/interaction
- [ ] Audio layers are balanced (ambience > music > creatures > harmonic)
- [ ] First 30 minutes guide player naturally without tutorials
- [ ] Discovery moments feel satisfying (lore, rituals, NPCs)
- [ ] Full game loop works: explore → observe → understand → activate → progress
- [ ] Save/load preserves all progression
- [ ] >30 FPS on target hardware
- [ ] No console errors in clean playthrough
