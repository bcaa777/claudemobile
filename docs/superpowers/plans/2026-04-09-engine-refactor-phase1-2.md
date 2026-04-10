# Engine Refactor Phase 1-2: Scaffolding & Extract Core

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Set up the monorepo workspace structure and extract InputManager, AudioSystem, and an event bus into the engine package — while keeping v1.0 running identically.

**Architecture:** pnpm workspaces monorepo with three packages: `@engine/core` (engine), `@retro-world/game` (v1.0), and eventually `@crawler-world/game` (autoshooter). Phase 1 creates the scaffold. Phase 2 moves InputManager, AudioSystem, and a new EventBus into the engine, then rewires v1.0 imports.

**Tech Stack:** TypeScript, pnpm workspaces, Vite, Three.js, bitECS

**Spec:** `docs/superpowers/specs/2026-04-09-engine-refactor-design.md`

---

## File Structure

### Phase 1 — New files

```
pnpm-workspace.yaml
packages/
  engine/
    package.json
    tsconfig.json
    src/
      index.ts                    <- Engine barrel export
      core/
        index.ts                  <- Core barrel export
        EventBus.ts               <- Typed event bus for cross-system communication
        GameLoop.ts               <- Fixed-timestep game loop
        types.ts                  <- Shared engine types
  retro-world/
    package.json
    tsconfig.json
    vite.config.ts
    index.html                    <- Copied from root
```

### Phase 2 — Moved files

```
packages/
  engine/
    src/
      input/
        index.ts                  <- Input barrel export
        InputManager.ts           <- Moved from src/engine/InputManager.ts
      audio/
        index.ts                  <- Audio barrel export
        AudioSystem.ts            <- Moved from src/audio/AudioSystem.ts
        SpatialAudioHelper.ts     <- Moved from src/audio/SpatialAudioHelper.ts
  retro-world/
    src/                          <- src/ contents moved here (all game code)
```

### Phase 2 — Modified files

```
packages/retro-world/src/engine/Engine.ts   <- Import paths updated
packages/retro-world/src/main.ts            <- Same content, new location
```

---

## Phase 1: Scaffolding

### Task 1: Initialize pnpm workspace

**Files:**
- Create: `pnpm-workspace.yaml`
- Modify: `package.json` (root — convert to workspace root)

- [x] **Step 1: Install pnpm if not present**

Run: `corepack enable && corepack prepare pnpm@latest --activate`
Expected: pnpm available globally

- [x] **Step 2: Create workspace config**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
```

- [x] **Step 3: Update root package.json to workspace root**

Replace `package.json` with:
```json
{
  "name": "claudemobile",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @retro-world/game dev",
    "build": "pnpm --filter @retro-world/game build",
    "dev:engine": "pnpm --filter @engine/core build --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [x] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: initialize pnpm workspace"
```

---

### Task 2: Create engine package

**Files:**
- Create: `packages/engine/package.json`
- Create: `packages/engine/tsconfig.json`
- Create: `packages/engine/src/index.ts`
- Create: `packages/engine/src/core/index.ts`
- Create: `packages/engine/src/core/types.ts`

- [x] **Step 1: Create engine package.json**

Create `packages/engine/package.json`:
```json
{
  "name": "@engine/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "bitecs": "^0.3.40",
    "three": "^0.165.0",
    "simplex-noise": "^4.0.3"
  },
  "devDependencies": {
    "@types/three": "^0.165.0",
    "typescript": "^5.4.0"
  }
}
```

- [x] **Step 2: Create engine tsconfig.json**

Create `packages/engine/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "composite": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"]
}
```

- [x] **Step 3: Create shared types**

Create `packages/engine/src/core/types.ts`:
```typescript
/** Generic system interface — all engine systems implement this */
export interface System {
  update(delta: number, elapsed: number): void
  dispose?(): void
}

/** Engine configuration passed at initialization */
export interface EngineConfig {
  container: HTMLElement
  systems: System[]
}

/** Event handler type for the event bus */
export type EventHandler<T = unknown> = (data: T) => void
```

- [x] **Step 4: Create core barrel export**

Create `packages/engine/src/core/index.ts`:
```typescript
export { EventBus } from './EventBus'
export { GameLoop } from './GameLoop'
export type { System, EngineConfig, EventHandler } from './types'
```

Note: EventBus and GameLoop are created in Tasks 3 and 4. This file will error until then — that's fine.

- [x] **Step 5: Create engine barrel export**

Create `packages/engine/src/index.ts`:
```typescript
export * from './core'
```

- [x] **Step 6: Commit**

```bash
git add packages/engine/
git commit -m "chore: create engine package skeleton"
```

---

### Task 3: Implement EventBus

**Files:**
- Create: `packages/engine/src/core/EventBus.ts`

- [x] **Step 1: Implement typed event bus**

Create `packages/engine/src/core/EventBus.ts`:
```typescript
import type { EventHandler } from './types'

/**
 * Typed event bus for cross-system communication.
 * Systems subscribe to events by name. Any system can emit events.
 * Handlers are called synchronously in subscription order.
 */
export class EventBus {
  private handlers = new Map<string, Set<EventHandler<any>>>()

  /** Subscribe to an event. Returns an unsubscribe function. */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event)!.add(handler)
    return () => this.handlers.get(event)?.delete(handler)
  }

  /** Emit an event to all subscribers. */
  emit<T = unknown>(event: string, data: T): void {
    const set = this.handlers.get(event)
    if (set) {
      for (const handler of set) {
        handler(data)
      }
    }
  }

  /** Remove all handlers for an event, or all handlers if no event specified. */
  clear(event?: string): void {
    if (event) {
      this.handlers.delete(event)
    } else {
      this.handlers.clear()
    }
  }
}
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: No errors (GameLoop not yet created, but barrel import will be checked later)

- [x] **Step 3: Commit**

```bash
git add packages/engine/src/core/EventBus.ts
git commit -m "feat(engine): add typed EventBus for cross-system communication"
```

---

### Task 4: Implement GameLoop

**Files:**
- Create: `packages/engine/src/core/GameLoop.ts`

- [x] **Step 1: Implement fixed-timestep game loop**

Create `packages/engine/src/core/GameLoop.ts`:
```typescript
import type { System } from './types'

const FIXED_DT = 1 / 60 // 60 Hz physics step
const MAX_FRAME_DT = 0.1 // clamp to avoid spiral of death

/**
 * Fixed-timestep game loop.
 * Systems are updated at a fixed rate (60Hz). Rendering happens every frame.
 * Games register systems in execution order.
 */
export class GameLoop {
  private systems: System[] = []
  private running = false
  private lastTime = 0
  private accumulator = 0
  private elapsed = 0
  private frameId = 0

  /** Register a system. Systems update in registration order. */
  addSystem(system: System): void {
    this.systems.push(system)
  }

  /** Remove a system. */
  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system)
    if (idx !== -1) this.systems.splice(idx, 1)
  }

  /** Start the loop. */
  start(): void {
    if (this.running) return
    this.running = true
    this.lastTime = performance.now() / 1000
    this.accumulator = 0
    this.tick()
  }

  /** Stop the loop. */
  stop(): void {
    this.running = false
    if (this.frameId) cancelAnimationFrame(this.frameId)
  }

  /** Current elapsed time in seconds. */
  getElapsed(): number {
    return this.elapsed
  }

  private tick = (): void => {
    if (!this.running) return
    this.frameId = requestAnimationFrame(this.tick)

    const now = performance.now() / 1000
    let frameDt = now - this.lastTime
    this.lastTime = now

    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT

    this.accumulator += frameDt

    while (this.accumulator >= FIXED_DT) {
      for (const system of this.systems) {
        system.update(FIXED_DT, this.elapsed)
      }
      this.elapsed += FIXED_DT
      this.accumulator -= FIXED_DT
    }
  }

  /** Dispose all systems and stop the loop. */
  dispose(): void {
    this.stop()
    for (const system of this.systems) {
      system.dispose?.()
    }
    this.systems.length = 0
  }
}
```

- [x] **Step 2: Verify engine package compiles**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: No errors. All barrel exports resolve.

- [x] **Step 3: Commit**

```bash
git add packages/engine/src/core/GameLoop.ts
git commit -m "feat(engine): add fixed-timestep GameLoop"
```

---

### Task 5: Create retro-world package (v1.0 game)

**Files:**
- Create: `packages/retro-world/package.json`
- Create: `packages/retro-world/tsconfig.json`
- Create: `packages/retro-world/vite.config.ts`
- Create: `packages/retro-world/index.html`

- [x] **Step 1: Create retro-world package.json**

Create `packages/retro-world/package.json`:
```json
{
  "name": "@retro-world/game",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "start": "vite preview --host 0.0.0.0 --port ${PORT:-4173}"
  },
  "dependencies": {
    "@engine/core": "workspace:*",
    "three": "^0.165.0",
    "simplex-noise": "^4.0.3"
  },
  "devDependencies": {
    "@types/three": "^0.165.0",
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

- [x] **Step 2: Create retro-world tsconfig.json**

Create `packages/retro-world/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [
    { "path": "../engine" }
  ]
}
```

- [x] **Step 3: Create retro-world vite.config.ts**

Create `packages/retro-world/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
```

- [x] **Step 4: Copy index.html to retro-world**

Run: `cp index.html packages/retro-world/index.html`

Then update the script src in `packages/retro-world/index.html` to point to `src/main.ts` (verify the current `<script>` tag path and ensure it references `src/main.ts`).

- [x] **Step 5: Commit**

```bash
git add packages/retro-world/
git commit -m "chore: create retro-world game package"
```

---

### Task 6: Move v1.0 source into retro-world package

**Files:**
- Move: `src/` → `packages/retro-world/src/`
- Keep: root `src/` removed after move

- [x] **Step 1: Move source files**

Run:
```bash
cp -r src/ packages/retro-world/src/
```

- [x] **Step 2: Install workspace dependencies**

Run:
```bash
pnpm install
```

Expected: Workspace links `@engine/core` into retro-world's node_modules.

- [x] **Step 3: Verify retro-world builds and runs**

Run:
```bash
cd packages/retro-world && npx vite --port 3000
```

Open `http://localhost:3000` — v1.0 game should load and play identically (title screen → intro bridge → castle → explore). The game does not import from `@engine/core` yet — this step just verifies the move didn't break anything.

- [x] **Step 4: Update root dev script to use workspace**

Verify root `package.json` script works:
Run: `pnpm dev` (from project root)
Expected: Vite dev server starts for retro-world.

- [x] **Step 5: Remove old root src/ and config files**

Run:
```bash
rm -rf src/
rm -f vite.config.ts tsconfig.json
```

Move root-level HTML files that are game-specific:
```bash
mv index.html packages/retro-world/index.html 2>/dev/null || true
mv debug-viewer.html packages/retro-world/debug-viewer.html 2>/dev/null || true
mv entities.html packages/retro-world/entities.html 2>/dev/null || true
```

- [x] **Step 6: Verify retro-world still runs after cleanup**

Run: `pnpm dev`
Expected: Game loads and plays identically.

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move v1.0 source into retro-world package"
```

---

## Phase 2: Extract Core Systems

### Task 7: Move InputManager to engine

**Files:**
- Move: `packages/retro-world/src/engine/InputManager.ts` → `packages/engine/src/input/InputManager.ts`
- Create: `packages/engine/src/input/index.ts`
- Modify: `packages/engine/src/index.ts` (add input export)
- Modify: `packages/retro-world/src/engine/Engine.ts` (update import)

- [x] **Step 1: Copy InputManager to engine package**

Run:
```bash
mkdir -p packages/engine/src/input
cp packages/retro-world/src/engine/InputManager.ts packages/engine/src/input/InputManager.ts
```

- [x] **Step 2: Create input barrel export**

Create `packages/engine/src/input/index.ts`:
```typescript
export { InputManager } from './InputManager'
```

- [x] **Step 3: Update engine barrel export**

Update `packages/engine/src/index.ts`:
```typescript
export * from './core'
export * from './input'
```

- [x] **Step 4: Verify engine compiles**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: No errors.

- [x] **Step 5: Update Engine.ts import**

In `packages/retro-world/src/engine/Engine.ts`, change:
```typescript
import { InputManager } from './InputManager'
```
to:
```typescript
import { InputManager } from '@engine/core'
```

- [x] **Step 6: Remove old InputManager from retro-world**

Run: `rm packages/retro-world/src/engine/InputManager.ts`

- [x] **Step 7: Verify retro-world builds and runs**

Run: `pnpm dev`
Expected: Game loads and plays identically. Input (WASD, mouse, keyboard shortcuts) all work.

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(engine): extract InputManager to engine package"
```

---

### Task 8: Move AudioSystem to engine

**Files:**
- Move: `packages/retro-world/src/audio/AudioSystem.ts` → `packages/engine/src/audio/AudioSystem.ts`
- Move: `packages/retro-world/src/audio/SpatialAudioHelper.ts` → `packages/engine/src/audio/SpatialAudioHelper.ts`
- Create: `packages/engine/src/audio/index.ts`
- Modify: `packages/engine/src/index.ts` (add audio export)
- Modify: All files in retro-world that import from `../audio/AudioSystem` or `../audio/SpatialAudioHelper`

- [x] **Step 1: Copy audio files to engine package**

Run:
```bash
mkdir -p packages/engine/src/audio
cp packages/retro-world/src/audio/AudioSystem.ts packages/engine/src/audio/AudioSystem.ts
cp packages/retro-world/src/audio/SpatialAudioHelper.ts packages/engine/src/audio/SpatialAudioHelper.ts
```

- [x] **Step 2: Create audio barrel export**

Create `packages/engine/src/audio/index.ts`:
```typescript
export { AudioSystem } from './AudioSystem'
export { updateListener, createSpatialPanner } from './SpatialAudioHelper'
```

- [x] **Step 3: Update engine barrel export**

Update `packages/engine/src/index.ts`:
```typescript
export * from './core'
export * from './input'
export * from './audio'
```

- [x] **Step 4: Check and fix AudioSystem internal imports**

Run: `grep -n "from '\.\." packages/engine/src/audio/AudioSystem.ts`

This shows any relative imports reaching outside the audio directory. For each:
- **Config imports** (e.g. `from '../config'`): Replace with constructor parameters. Add an `AudioConfig` interface to `packages/engine/src/audio/AudioSystem.ts` and accept it in the constructor. In retro-world, pass the config values from the game's config.ts when instantiating AudioSystem.
- **Biome type imports** (e.g. `from '../biomes/types'`): If it's just a type/enum, copy the minimal type definition into `packages/engine/src/core/types.ts` and import from there. If it's a complex dependency, use `string` or `number` instead of the enum.
- **Other game imports**: These indicate AudioSystem is too coupled. Extract only the core audio functionality (context management, gain hierarchy, spatial audio) into the engine. Leave game-specific audio logic (biome music selection, creature sound mapping) in retro-world as a wrapper.

After fixing, verify no imports reach outside `packages/engine/src/`.

- [x] **Step 5: Verify engine compiles**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: No errors.

- [x] **Step 6: Update all retro-world imports**

Find all files importing AudioSystem or SpatialAudioHelper:
Run: `grep -rn "from.*audio/AudioSystem\|from.*audio/SpatialAudioHelper" packages/retro-world/src/`

Update each import to:
```typescript
import { AudioSystem } from '@engine/core'
// or
import { updateListener, createSpatialPanner } from '@engine/core'
```

- [x] **Step 7: Remove old audio files from retro-world**

Run:
```bash
rm packages/retro-world/src/audio/AudioSystem.ts
rm packages/retro-world/src/audio/SpatialAudioHelper.ts
```

Note: Other audio files (BiomeMusic.ts, CreatureSound.ts, etc.) stay in retro-world — they are game-specific audio subsystems that depend on the engine's AudioSystem.

- [x] **Step 8: Verify retro-world builds and runs**

Run: `pnpm dev`
Expected: Game loads. Audio works (biome music, sound effects, spatial audio). Test by walking around and listening for footsteps, biome music transitions, creature sounds.

- [x] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(engine): extract AudioSystem to engine package"
```

---

### Task 9: Wire EventBus into retro-world

**Files:**
- Modify: `packages/retro-world/src/engine/Engine.ts` (create EventBus, pass to systems)

- [x] **Step 1: Import and instantiate EventBus in Engine.ts**

In `packages/retro-world/src/engine/Engine.ts`, add import:
```typescript
import { InputManager, EventBus } from '@engine/core'
```

Add to class fields:
```typescript
private eventBus: EventBus
```

In the constructor, add near the top (after renderer/input creation):
```typescript
this.eventBus = new EventBus()
```

- [x] **Step 2: Add a test event to verify wiring**

In the Engine constructor, after creating the eventBus, add:
```typescript
this.eventBus.on('biomeChanged', (data: { biome: string }) => {
  console.log('[EventBus] Biome changed:', data.biome)
})
```

Then find where biome transitions are detected in the update loop (in Engine.ts, where `biome-hud` text is set) and add:
```typescript
this.eventBus.emit('biomeChanged', { biome: biomeName })
```

- [x] **Step 3: Verify EventBus fires**

Run: `pnpm dev`
Open browser console. Walk to a different biome. Expected: `[EventBus] Biome changed: Desert` (or whichever biome) appears in console.

- [x] **Step 4: Remove test console.log (keep the emit)**

Remove the `console.log` subscriber added in Step 2. Keep the `emit` call — it's the start of event-driven architecture. Future systems will subscribe to this event.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(retro-world): wire EventBus into Engine, emit biomeChanged events"
```

---

### Task 10: Validate full Phase 1-2 completion

**Files:** None — this is a verification task.

- [x] **Step 1: Verify workspace structure**

Run: `ls packages/engine/src/ packages/retro-world/src/`
Expected: Engine has `core/`, `input/`, `audio/` directories. Retro-world has all game code.

- [x] **Step 2: Verify engine exports**

Run: `cd packages/engine && npx tsc --noEmit`
Expected: Clean compile, no errors.

- [x] **Step 3: Verify retro-world imports engine**

Run: `grep -rn "@engine/core" packages/retro-world/src/ | head -20`
Expected: Engine.ts (and any audio consumers) import from `@engine/core`.

- [x] **Step 4: Full play-test**

Run: `pnpm dev`
Verify:
- Title screen loads
- Intro bridge plays (walk through lit platforms to portal)
- Castle and surrounding forest visible in daytime
- Movement works (WASD, jump, fly, sprint)
- Biome transitions work (walk to desert, snow, etc.)
- Audio works (music, footsteps, creature sounds)
- HUD works (biome name, time, crystals, runes)
- Creatures spawn and move
- No console errors related to missing imports

- [x] **Step 5: Commit verification notes**

```bash
git add -A
git commit -m "chore: verify Phase 1-2 complete — workspace + core extraction validated"
```

---

## Next Steps

After Phase 1-2 is validated, the next plan covers:
- **Phase 3:** Extract Renderer (Three.js wrapper, CameraRig abstraction, Theme system)
- **Phase 4:** Extract Terrain & Biomes (chunk streaming, biome definitions as data)

These will be written as `2026-04-XX-engine-refactor-phase3-4.md`.
