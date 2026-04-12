---
name: Crawler Game Context
description: The crawler-world autoshooter game is a port of Echoes of the Veil (Code/Crawler), currently bare-bones, needs visual richness and content
type: project
---

The primary active project is `packages/crawler-world/` — an autoshooter roguelike built on the shared engine.

**Source material:** `/Users/michalplodek/Documents/Code/Crawler/` ("Echoes of the Veil") — a browser-based roguelike survivor with rich visuals, 26+ weapons, detailed environments, post-processing bloom, level editor, sprite system.

**Current state (alpha):** The crawler-world port has solid architecture (ECS, modular systems, hub + expedition flow, wave combat, boss system, companions, corruption) but is visually bare — basic geometry NPCs, plain terrain chunks, minimal environmental detail, thin weapon roster (10 base weapons), basic audio (oscillator tones).

**What the engine already provides but isn't fully used:** Post-processing pipeline (pixelate, color grading, god rays, CRT, heat distortion, damage pass, retro pass, underwater pass), renderer with EffectComposer, terrain system with biome types, sprite/billboard batch system.

**Key gaps to release quality:**
1. Hub scene is bare (2 torches, geometry NPCs, no ground/walls/decorations)
2. Combat environments lack vegetation, rocks, structures, props
3. Only 10/26+ weapons ported
4. No bloom/glow on projectiles/pickups
5. Enemy meshes are simple colored geometry (need variety, size scaling, biome coloring)
6. Audio is oscillator tones only (no spatial audio, no layered music)
7. Boss encounters are skeletal (no phase mechanics, no arena features)

**Why:** User spent ~6 hours building this game in previous sessions. An engine refactor accidentally deleted it; restored from git. User wants it brought to release quality, not more refactoring.
