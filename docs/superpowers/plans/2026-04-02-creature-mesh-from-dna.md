# Creature DNA Mesh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded species-specific creature mesh builders with a DNA-driven procedural mesh generator, and add a standalone debug viewer for inspecting/breeding creatures visually.

**Architecture:** `DNAMeshBuilder.buildFromDNA(dna, group)` reads `CreatureDNA` genes to construct Box+Sphere geometry for all 5 body plans, returning animation refs. `CreatureMesh.buildGeometry()` delegates to this when `creature.dna` is set. A standalone `debug-viewer.html` provides sliders for every gene, preset loading, and breeding UI.

**Tech Stack:** TypeScript, Three.js, Vite (existing)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/creatures/DNAMeshBuilder.ts` | `buildFromDNA(dna, group)` — geometry from DNA, returns MeshRefs |
| Modify | `src/creatures/CreatureMesh.ts` | Delegate to DNA builder, use MeshRefs for animation |
| Create | `debug-viewer.html` | Vite entry point for standalone debug page |
| Create | `src/creatures/debug-viewer.ts` | Debug viewer Three.js app with DNA sliders + breeding |
| Modify | `vite.config.ts` | Add debug-viewer as multi-page entry |

---

### Task 1: Create DNAMeshBuilder

**Files:**
- Create: `src/creatures/DNAMeshBuilder.ts`

- [ ] **Step 1: Create DNAMeshBuilder with full geometry construction**

Create `src/creatures/DNAMeshBuilder.ts`:

```typescript
import * as THREE from 'three'
import type { CreatureDNA } from './CreatureDNA'
import { dnaToStats, quantizeLegCount, quantizeEyeCount } from './CreatureDNA'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface MeshRefs {
  legs: THREE.Mesh[]
  wings: THREE.Mesh[]
  tail: THREE.Mesh | null
  body: THREE.Mesh
}

// ─── Caches ─────────────────────────────────────────────────────────────────

const _boxCache = new Map<string, THREE.BoxGeometry>()
const _sphereCache = new Map<string, THREE.SphereGeometry>()
const _matCache = new Map<number, THREE.MeshLambertMaterial>()

function box(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`
  let g = _boxCache.get(key)
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _boxCache.set(key, g) }
  return g
}

function sphere(r: number, seg = 8): THREE.SphereGeometry {
  const key = `${r.toFixed(3)}_${seg}`
  let g = _sphereCache.get(key)
  if (!g) { g = new THREE.SphereGeometry(r, seg, seg); _sphereCache.set(key, g) }
  return g
}

function mat(color: number, opts?: { side?: THREE.Side; emissive?: number; emissiveIntensity?: number }): THREE.MeshLambertMaterial {
  const key = color + (opts?.side === THREE.DoubleSide ? 0x2000000 : 0) + (opts?.emissive ?? 0)
  let m = _matCache.get(key)
  if (!m) { m = new THREE.MeshLambertMaterial({ color, ...opts }); _matCache.set(key, m) }
  return m
}

function rgbToHex(r: number, g: number, b: number): number {
  return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255))
}

function darken(r: number, g: number, b: number, amount: number): number {
  return rgbToHex(
    Math.max(0, r - amount),
    Math.max(0, g - amount),
    Math.max(0, b - amount),
  )
}

// ─── Main builder ───────────────────────────────────────────────────────────

export function buildFromDNA(dna: CreatureDNA, group: THREE.Group): MeshRefs {
  const stats = dnaToStats(dna)
  const { bodyW, bodyH, bodyD } = stats

  const [br, bg, bb] = dna.bodyColor
  const [ar, ag, ab] = dna.accentColor
  const bodyCol = rgbToHex(br, bg, bb)
  const accentCol = rgbToHex(ar, ag, ab)
  const legCol = darken(br, bg, bb, 0.1)
  const isPredator = dna.aggression > 0.5

  const refs: MeshRefs = { legs: [], wings: [], tail: null, body: null! }

  // ── Body ──────────────────────────────────────────────────────────────
  const bodyMesh = new THREE.Mesh(box(bodyW, bodyH, bodyD), mat(bodyCol))
  group.add(bodyMesh)
  refs.body = bodyMesh

  // Serpentine: add 1-2 extra body segments behind
  if (dna.bodyPlan === 'serpentine') {
    for (let s = 1; s <= 2; s++) {
      const segScale = 1 - s * 0.2
      const seg = new THREE.Mesh(
        box(bodyW * segScale, bodyH * segScale, bodyD * 0.7),
        mat(bodyCol),
      )
      seg.position.set(0, 0, -bodyD * 0.6 * s)
      group.add(seg)
    }
  }

  // ── Head (sphere) ─────────────────────────────────────────────────────
  const headR = bodyH * dna.headSize * 0.8
  const headMesh = new THREE.Mesh(sphere(headR, 8), mat(accentCol))
  const neckOffset = dna.neckLength * bodyD * 0.5
  headMesh.position.set(0, bodyH * 0.15, bodyD * 0.5 + neckOffset + headR * 0.5)
  group.add(headMesh)

  // ── Eyes ───────────────────────────────────────────────────────────────
  const eyeCount = quantizeEyeCount(dna.eyeCount)
  const eyeR = 0.04 + dna.eyeSize * 0.04
  const eyeMat = isPredator
    ? mat(0xff2200, { emissive: 0xff2200, emissiveIntensity: 0.5 })
    : mat(0x111111)

  for (let e = 0; e < eyeCount; e++) {
    const eye = new THREE.Mesh(sphere(eyeR, 6), eyeMat)
    const angle = ((e - (eyeCount - 1) / 2) / Math.max(1, eyeCount - 1)) * 1.2
    eye.position.set(
      Math.sin(angle) * headR * 0.8,
      headR * 0.2,
      headR * 0.7,
    )
    headMesh.add(eye)
  }

  // ── Legs ──────────────────────────────────────────────────────────────
  let legCount = quantizeLegCount(dna.legCount)

  // Body plan constraints
  if (dna.bodyPlan === 'aquatic' || dna.bodyPlan === 'serpentine') legCount = 0
  if (dna.bodyPlan === 'avian' && legCount > 2) legCount = 2

  const legH = bodyH * (0.5 + dna.legLength * 1.0)
  const legW = bodyW * (0.05 + dna.legThickness * 0.1)

  if (legCount > 0) {
    const pairs = Math.ceil(legCount / 2)
    for (let p = 0; p < pairs; p++) {
      const zFrac = pairs === 1 ? 0 : (p / (pairs - 1) - 0.5)
      const zPos = zFrac * bodyD * 0.7
      for (const side of [-1, 1]) {
        if (refs.legs.length >= legCount) break
        const leg = new THREE.Mesh(box(legW, legH, legW), mat(legCol))
        leg.position.set(side * bodyW * 0.4, -bodyH * 0.5 - legH * 0.5, zPos)
        group.add(leg)
        refs.legs.push(leg)

        // Joint sphere at hip
        const joint = new THREE.Mesh(sphere(legW * 0.8, 6), mat(legCol))
        joint.position.set(side * bodyW * 0.4, -bodyH * 0.5, zPos)
        group.add(joint)

        // Claws at leg tips
        if (dna.hasClaws > 0.5) {
          const clawSize = 0.03 + dna.clawSize * 0.05
          const claw = new THREE.Mesh(box(clawSize, clawSize * 0.5, clawSize * 2), mat(accentCol))
          claw.position.set(0, -legH * 0.5, legW * 0.5)
          leg.add(claw)
        }
      }
    }
  }

  // ── Wings ─────────────────────────────────────────────────────────────
  const wingsPresent = dna.hasWings > 0.5 || dna.bodyPlan === 'avian'
  if (wingsPresent) {
    const wingW = bodyD * (0.5 + dna.wingSpan * 1.5)
    const wingH = bodyH * 0.05
    const wingD = bodyD * 0.8
    const wingMat = mat(accentCol, { side: THREE.DoubleSide })
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(box(wingW, wingH, wingD), wingMat)
      wing.position.set(side * (bodyW * 0.5 + wingW * 0.4), bodyH * 0.2, 0)
      group.add(wing)
      refs.wings.push(wing)
    }
  }

  // ── Tail ──────────────────────────────────────────────────────────────
  const tailPresent = dna.hasTail > 0.5 || dna.bodyPlan === 'aquatic'
  if (tailPresent) {
    const tailLen = bodyD * (0.3 + dna.tailLength * 0.8)
    const tailW = bodyW * 0.15
    const tailH = bodyH * 0.2
    const tailMesh = new THREE.Mesh(box(tailW, tailH, tailLen), mat(bodyCol))
    tailMesh.position.set(0, 0, -bodyD * 0.5 - tailLen * 0.5)
    group.add(tailMesh)
    refs.tail = tailMesh

    // Aquatic: add tail fin at end
    if (dna.bodyPlan === 'aquatic') {
      const finMesh = new THREE.Mesh(
        box(bodyW * 0.5, tailH * 3, tailLen * 0.3),
        mat(accentCol, { side: THREE.DoubleSide }),
      )
      finMesh.position.set(0, 0, -tailLen * 0.5)
      tailMesh.add(finMesh)
    }
  }

  // ── Horns ─────────────────────────────────────────────────────────────
  if (dna.hasHorns > 0.5) {
    const hornLen = headR * (0.5 + dna.hornSize * 1.5)
    const hornW = headR * 0.15
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(box(hornW, hornLen, hornW), mat(accentCol))
      horn.position.set(side * headR * 0.5, headR * 0.6 + hornLen * 0.3, 0)
      horn.rotation.z = side * -0.3
      headMesh.add(horn)
    }
  }

  // ── Mandibles ─────────────────────────────────────────────────────────
  if (dna.hasMandibles > 0.5) {
    const mandLen = headR * 0.8
    const mandW = headR * 0.1
    for (const side of [-1, 1]) {
      const mand = new THREE.Mesh(box(mandW, mandW, mandLen), mat(legCol))
      mand.position.set(side * headR * 0.4, -headR * 0.3, headR * 0.5)
      mand.rotation.y = side * 0.3
      headMesh.add(mand)
    }
  }

  // ── Fins ──────────────────────────────────────────────────────────────
  if (dna.hasFins > 0.5 || dna.bodyPlan === 'aquatic') {
    const finH = bodyH * (0.3 + dna.finSize * 0.6)
    const finD = bodyD * 0.4
    // Dorsal fin
    const dorsal = new THREE.Mesh(
      box(bodyW * 0.05, finH, finD),
      mat(accentCol, { side: THREE.DoubleSide }),
    )
    dorsal.position.set(0, bodyH * 0.5 + finH * 0.3, 0)
    group.add(dorsal)

    // Pectoral fins (sides)
    for (const side of [-1, 1]) {
      const pec = new THREE.Mesh(
        box(bodyW * 0.4, bodyH * 0.05, finD * 0.6),
        mat(accentCol, { side: THREE.DoubleSide }),
      )
      pec.position.set(side * bodyW * 0.5, -bodyH * 0.2, bodyD * 0.15)
      pec.rotation.z = side * 0.3
      group.add(pec)
    }
  }

  // ── Antennae ──────────────────────────────────────────────────────────
  if (dna.hasAntennae > 0.5) {
    const antLen = headR * 2
    const antW = headR * 0.05
    for (const side of [-1, 1]) {
      const ant = new THREE.Mesh(box(antW, antW, antLen), mat(legCol))
      ant.position.set(side * headR * 0.3, headR * 0.5, headR * 0.3 + antLen * 0.3)
      ant.rotation.x = -0.4
      headMesh.add(ant)
    }
  }

  return refs
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/creatures/DNAMeshBuilder.ts
git commit -m "feat(mesh): add DNAMeshBuilder — procedural creature geometry from DNA genes"
```

---

### Task 2: Integrate DNAMeshBuilder into CreatureMesh

**Files:**
- Modify: `src/creatures/CreatureMesh.ts`

- [ ] **Step 1: Add imports and dnaRefs field**

At the top of `src/creatures/CreatureMesh.ts`, add import:

```typescript
import { buildFromDNA, type MeshRefs } from './DNAMeshBuilder'
```

Add a field to the class (after the existing `private bodyMesh` field around line 58):

```typescript
private dnaRefs: MeshRefs | null = null
```

- [ ] **Step 2: Modify buildGeometry to delegate to DNA builder**

In the `buildGeometry(creature)` method (line 125), right after the enemy check block (after the `return` on line 139), add this DNA check BEFORE the `const sp = SPECIES[creature.species]` line:

```typescript
    // ── DNA-driven creatures — delegate to DNAMeshBuilder ─────────────────
    if (creature.dna) {
      this.dnaRefs = buildFromDNA(creature.dna, this.group)
      this.bodyMesh = this.dnaRefs.body
      this.legs = this.dnaRefs.legs
      this.wings = this.dnaRefs.wings
      this.tailFin = this.dnaRefs.tail
      return
    }
```

This means all DNA creatures skip the legacy species-specific build code and use the new builder instead.

- [ ] **Step 3: Modify buildSimple for DNA creatures**

In the `buildSimple(creature)` method (around line 100), after the enemy check block, add a DNA check before the `const sp = SPECIES[creature.species]` line:

```typescript
    if (creature.dna) {
      const stats = dnaToStats(creature.dna)
      const mesh = new THREE.Mesh(
        getCachedBox(stats.bodyW, stats.bodyH, stats.bodyD),
        getCachedMat(stats.bodyColor)
      )
      this.group.add(mesh)
      this.bodyMesh = mesh
      return
    }
```

Add the import for `dnaToStats` at the top:

```typescript
import { dnaToStats } from './CreatureDNA'
```

- [ ] **Step 4: Modify clearGroup to reset dnaRefs**

In the `clearGroup()` method (around line 88), add after `this.bodyMesh = null`:

```typescript
    this.dnaRefs = null
```

- [ ] **Step 5: Update animation in update() for DNA creatures**

In the `update()` method, the animation code uses `SPECIES[creature.species]` for parameters like `isGiant`, mobility, species-specific flap speeds, etc. We need to make DNA creatures use their stats instead.

Find the line `const sp = SPECIES[creature.species]` in the update method (around line 685). Add before it:

```typescript
    // DNA creatures: derive animation params from stats
    if (creature.dna && creature.stats) {
      const st = creature.stats
      const moving = creature.velocity.lengthSq() > 0.04

      // Leg animation
      if (st.mobility === 'ground' && this.legs.length >= 2) {
        if (moving) {
          const freq = st.isGiant ? creature.velocity.length() * 0.8 : creature.velocity.length() * 2.5
          const amp = st.isGiant ? 0.25 : 0.5
          const sinVal = Math.sin(this.animTime * freq) * amp
          for (let i = 0; i < this.legs.length; i++) {
            this.legs[i].rotation.x = sinVal * (i % 2 === 0 ? 1 : -1)
          }
        } else {
          for (const leg of this.legs) leg.rotation.x = 0
        }
      }

      // Giant body sway
      if (st.isGiant && st.mobility === 'ground') {
        this.group.rotation.x = Math.sin(this.animTime * 0.6) * 0.015
        this.group.rotation.z = Math.sin(this.animTime * 0.4 + 1.5) * 0.01
      }

      // Wing flap
      if (this.wings.length >= 2) {
        const flapSpeed = st.isGiant ? 0.8 : creature.dna.size > 0.6 ? 2.5 : 5.0
        const flapAmp = st.isGiant ? 0.2 : creature.dna.size > 0.6 ? 0.4 : 0.6
        const angle = Math.sin(this.animTime * flapSpeed) * flapAmp
        this.wings[0].rotation.z = angle
        this.wings[1].rotation.z = -angle
      }

      // Tail wag
      if (this.tailFin) {
        this.tailFin.rotation.y = Math.sin(this.animTime * 1.5) * 0.3
      }

      // Death tilt
      if (creature.state === 'dead') {
        this.group.rotation.z = Math.min(Math.PI * 0.5, creature.deathTimer * 1.2)
      }
      return  // skip legacy animation
    }
```

- [ ] **Step 6: Update companion collar for DNA creatures**

In the companion collar section of `update()` (around line 637), the code uses `SPECIES[creature.species]` for body dimensions. Add a DNA path before the existing code:

Find:
```typescript
    if (creature.isCompanion && !this.hasCollar && this.lod === 'full') {
      const sp = SPECIES[creature.species]
```

Replace with:
```typescript
    if (creature.isCompanion && !this.hasCollar && this.lod === 'full') {
      const sp = creature.stats ?? SPECIES[creature.species]
```

Do the same for the glow material section (around line 652):

Find:
```typescript
        const sp2 = SPECIES[creature.species]
        this.glowMat = new THREE.MeshLambertMaterial({
          color: sp2.bodyColor,
```

Replace with:
```typescript
        const sp2 = creature.stats ?? SPECIES[creature.species]
        this.glowMat = new THREE.MeshLambertMaterial({
          color: sp2.bodyColor,
```

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/creatures/CreatureMesh.ts
git commit -m "feat(mesh): integrate DNAMeshBuilder into CreatureMesh with animation support"
```

---

### Task 3: Create debug viewer

**Files:**
- Create: `debug-viewer.html`
- Create: `src/creatures/debug-viewer.ts`
- Modify: `vite.config.ts`

- [ ] **Step 1: Add Vite multi-page entry**

Modify `vite.config.ts` to add the debug viewer as a second entry point:

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
        'debug-viewer': resolve(__dirname, 'debug-viewer.html'),
      },
    },
  },
})
```

- [ ] **Step 2: Create debug-viewer.html**

Create `debug-viewer.html` in the project root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Creature DNA Debug Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a2e; color: #ccc; font-family: monospace; display: flex; height: 100vh; overflow: hidden; }
    #controls { width: 320px; overflow-y: auto; padding: 12px; background: #16213e; border-right: 1px solid #333; flex-shrink: 0; }
    #canvas-wrap { flex: 1; position: relative; }
    canvas { display: block; width: 100%; height: 100%; }
    h2 { color: #6af; font-size: 14px; margin: 12px 0 6px; border-bottom: 1px solid #333; padding-bottom: 4px; }
    h2:first-child { margin-top: 0; }
    label { display: flex; align-items: center; gap: 6px; margin: 3px 0; font-size: 11px; }
    label span { min-width: 90px; }
    label input[type=range] { flex: 1; accent-color: #6af; }
    label .val { min-width: 32px; text-align: right; color: #fff; }
    select, button { width: 100%; padding: 6px; margin: 4px 0; background: #0f3460; color: #ccc; border: 1px solid #444; border-radius: 4px; cursor: pointer; font-family: monospace; }
    button:hover { background: #1a5276; }
    button.breed { background: #2a6040; }
    button.breed:hover { background: #3a8060; }
    #stats { font-size: 10px; color: #888; margin-top: 8px; white-space: pre; line-height: 1.4; }
  </style>
</head>
<body>
  <div id="controls"></div>
  <div id="canvas-wrap"></div>
  <script type="module" src="/src/creatures/debug-viewer.ts"></script>
</body>
</html>
```

- [ ] **Step 3: Create debug-viewer.ts**

Create `src/creatures/debug-viewer.ts`:

```typescript
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { CreatureDNA } from './CreatureDNA'
import { dnaToStats, quantizeLegCount, quantizeEyeCount } from './CreatureDNA'
import { DNA_PRESETS, getPresetDNA } from './DNAPresets'
import { buildFromDNA } from './DNAMeshBuilder'
import { breedDNA } from './DNABreeding'

// ─── Scene setup ────────────────────────────────────────────────────────────

const wrap = document.getElementById('canvas-wrap')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(wrap.clientWidth, wrap.clientHeight)
renderer.setClearColor(0x1a1a2e)
wrap.appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 100)
camera.position.set(3, 2, 4)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0.5, 0)
controls.update()

// Lights
scene.add(new THREE.AmbientLight(0x404060, 1.5))
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(5, 8, 3)
scene.add(dirLight)

// Ground plane
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshLambertMaterial({ color: 0x2a2a3a }),
)
ground.rotation.x = -Math.PI / 2
scene.add(ground)

// Grid
scene.add(new THREE.GridHelper(20, 20, 0x333355, 0x222244))

// ─── State ──────────────────────────────────────────────────────────────────

let currentDNA: CreatureDNA = { ...DNA_PRESETS['elk'], bodyColor: [...DNA_PRESETS['elk'].bodyColor] as [number,number,number], accentColor: [...DNA_PRESETS['elk'].accentColor] as [number,number,number] }
let creatureGroup = new THREE.Group()
scene.add(creatureGroup)

let parentA: CreatureDNA | null = null
let parentB: CreatureDNA | null = null

// Simple RNG for preset variation
const rng = { next: () => Math.random() }

// ─── Controls UI ────────────────────────────────────────────────────────────

const panel = document.getElementById('controls')!

function rebuildMesh() {
  // Clear old
  scene.remove(creatureGroup)
  creatureGroup = new THREE.Group()
  scene.add(creatureGroup)

  buildFromDNA(currentDNA, creatureGroup)

  // Position based on mobility
  const stats = dnaToStats(currentDNA)
  if (stats.mobility === 'air') {
    creatureGroup.position.y = 1.5
  } else {
    creatureGroup.position.y = stats.bodyH * 0.5 + (quantizeLegCount(currentDNA.legCount) > 0 ? stats.bodyH * (0.5 + currentDNA.legLength * 1.0) : 0)
  }

  updateStatsDisplay()
}

function updateStatsDisplay() {
  const stats = dnaToStats(currentDNA)
  const el = document.getElementById('stats')
  if (el) {
    el.textContent = [
      `Body Plan: ${currentDNA.bodyPlan}`,
      `Role: ${stats.role}`,
      `Mobility: ${stats.mobility}`,
      `Speed: ${stats.maxSpeed.toFixed(1)}`,
      `Scale: ${stats.adultScale.toFixed(2)}`,
      `Legs: ${quantizeLegCount(currentDNA.legCount)}`,
      `Eyes: ${quantizeEyeCount(currentDNA.eyeCount)}`,
      `Giant: ${stats.isGiant ? 'YES' : 'no'}`,
      `Max Age: ${stats.maxAge.toFixed(0)}`,
      `Hunger Cap: ${stats.maxHunger.toFixed(0)}`,
    ].join('\n')
  }
}

// ── Preset dropdown ─────────────────────────────────────────────────────

function addHTML(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  while (div.firstChild) panel.appendChild(div.firstChild)
}

addHTML('<h2>Preset</h2>')
const presetSelect = document.createElement('select')
for (const name of Object.keys(DNA_PRESETS)) {
  const opt = document.createElement('option')
  opt.value = name
  opt.textContent = name
  presetSelect.appendChild(opt)
}
presetSelect.addEventListener('change', () => {
  currentDNA = getPresetDNA(presetSelect.value, rng)
  updateAllSliders()
  rebuildMesh()
})
panel.appendChild(presetSelect)

// ── Body plan radio ─────────────────────────────────────────────────────

addHTML('<h2>Body Plan</h2>')
const bodyPlans: CreatureDNA['bodyPlan'][] = ['quadruped', 'insectoid', 'avian', 'aquatic', 'serpentine']
const bpWrap = document.createElement('div')
bpWrap.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin:4px 0;'
for (const bp of bodyPlans) {
  const btn = document.createElement('button')
  btn.textContent = bp
  btn.style.cssText = 'width:auto;padding:4px 8px;font-size:11px;'
  btn.addEventListener('click', () => {
    currentDNA.bodyPlan = bp
    rebuildMesh()
  })
  bpWrap.appendChild(btn)
}
panel.appendChild(bpWrap)

// ── Gene sliders ────────────────────────────────────────────────────────

type SliderEntry = { key: string; input: HTMLInputElement; valEl: HTMLElement }
const sliders: SliderEntry[] = []

function addSlider(section: string | null, key: string, label: string, min = 0, max = 1, step = 0.01) {
  if (section) addHTML(`<h2>${section}</h2>`)

  const wrap = document.createElement('label')
  const nameSpan = document.createElement('span')
  nameSpan.textContent = label
  const inp = document.createElement('input')
  inp.type = 'range'
  inp.min = String(min); inp.max = String(max); inp.step = String(step)

  const val = (currentDNA as Record<string, unknown>)[key]
  inp.value = String(typeof val === 'number' ? val : 0.5)

  const valEl = document.createElement('span')
  valEl.className = 'val'
  valEl.textContent = Number(inp.value).toFixed(2)

  inp.addEventListener('input', () => {
    const v = parseFloat(inp.value)
    valEl.textContent = v.toFixed(2)
    ;(currentDNA as Record<string, unknown>)[key] = v
    rebuildMesh()
  })

  wrap.appendChild(nameSpan)
  wrap.appendChild(inp)
  wrap.appendChild(valEl)
  panel.appendChild(wrap)

  sliders.push({ key, input: inp, valEl })
}

function addColorSliders(section: string, key: 'bodyColor' | 'accentColor') {
  addHTML(`<h2>${section}</h2>`)
  for (let ch = 0; ch < 3; ch++) {
    const chName = ['R', 'G', 'B'][ch]
    const wrap = document.createElement('label')
    const nameSpan = document.createElement('span')
    nameSpan.textContent = chName
    const inp = document.createElement('input')
    inp.type = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.01'
    inp.value = String(currentDNA[key][ch])
    const valEl = document.createElement('span')
    valEl.className = 'val'
    valEl.textContent = Number(inp.value).toFixed(2)

    inp.addEventListener('input', () => {
      const v = parseFloat(inp.value)
      valEl.textContent = v.toFixed(2)
      currentDNA[key][ch] = v
      rebuildMesh()
    })

    wrap.appendChild(nameSpan); wrap.appendChild(inp); wrap.appendChild(valEl)
    panel.appendChild(wrap)

    sliders.push({ key: `${key}.${ch}`, input: inp, valEl })
  }
}

// Morphology
addSlider('Morphology', 'bodyLength', 'Body Length')
addSlider(null, 'bodyWidth', 'Body Width')
addSlider(null, 'bodyHeight', 'Body Height')
addSlider(null, 'headSize', 'Head Size')
addSlider(null, 'neckLength', 'Neck Length')

// Limbs
addSlider('Limbs', 'legCount', 'Leg Count')
addSlider(null, 'legLength', 'Leg Length')
addSlider(null, 'legThickness', 'Leg Thickness')

// Appendages
addSlider('Appendages', 'hasWings', 'Wings')
addSlider(null, 'wingSpan', 'Wing Span')
addSlider(null, 'hasTail', 'Tail')
addSlider(null, 'tailLength', 'Tail Length')
addSlider(null, 'hasHorns', 'Horns')
addSlider(null, 'hornSize', 'Horn Size')
addSlider(null, 'hasClaws', 'Claws')
addSlider(null, 'clawSize', 'Claw Size')
addSlider(null, 'hasMandibles', 'Mandibles')
addSlider(null, 'hasFins', 'Fins')
addSlider(null, 'finSize', 'Fin Size')
addSlider(null, 'hasAntennae', 'Antennae')

// Eyes
addSlider('Eyes', 'eyeSize', 'Eye Size')
addSlider(null, 'eyeCount', 'Eye Count')

// Behavior
addSlider('Behavior', 'speed', 'Speed')
addSlider(null, 'aggression', 'Aggression')
addSlider(null, 'size', 'Size')

// Colors
addColorSliders('Body Color', 'bodyColor')
addColorSliders('Accent Color', 'accentColor')

// Stats display
addHTML('<h2>Derived Stats</h2>')
addHTML('<div id="stats"></div>')

// ── Mutate button ───────────────────────────────────────────────────────

addHTML('<h2>Actions</h2>')

const mutateBtn = document.createElement('button')
mutateBtn.textContent = 'Mutate'
mutateBtn.addEventListener('click', () => {
  // Apply random mutation inline
  const keys = ['bodyLength','bodyWidth','bodyHeight','headSize','neckLength','legCount','legLength','legThickness','hasWings','wingSpan','hasTail','tailLength','hasHorns','hornSize','hasClaws','clawSize','hasMandibles','hasFins','finSize','hasAntennae','eyeSize','eyeCount','speed','aggression','size']
  for (const k of keys) {
    if (Math.random() < 0.15) { // 15% per gene for visible mutation
      const cur = (currentDNA as Record<string, number>)[k]
      ;(currentDNA as Record<string, unknown>)[k] = Math.max(0, Math.min(1, cur + (Math.random() - 0.5) * 0.3))
    }
  }
  for (let ch = 0; ch < 3; ch++) {
    if (Math.random() < 0.15) {
      currentDNA.bodyColor[ch] = Math.max(0, Math.min(1, currentDNA.bodyColor[ch] + (Math.random() - 0.5) * 0.2))
    }
    if (Math.random() < 0.15) {
      currentDNA.accentColor[ch] = Math.max(0, Math.min(1, currentDNA.accentColor[ch] + (Math.random() - 0.5) * 0.2))
    }
  }
  updateAllSliders()
  rebuildMesh()
})
panel.appendChild(mutateBtn)

// ── Breed section ───────────────────────────────────────────────────────

addHTML('<h2>Breeding</h2>')

const saveABtn = document.createElement('button')
saveABtn.textContent = 'Save as Parent A'
saveABtn.addEventListener('click', () => {
  parentA = JSON.parse(JSON.stringify(currentDNA))
  saveABtn.textContent = `Parent A: ${currentDNA.bodyPlan} (saved)`
})
panel.appendChild(saveABtn)

const saveBBtn = document.createElement('button')
saveBBtn.textContent = 'Save as Parent B'
saveBBtn.addEventListener('click', () => {
  parentB = JSON.parse(JSON.stringify(currentDNA))
  saveBBtn.textContent = `Parent B: ${currentDNA.bodyPlan} (saved)`
})
panel.appendChild(saveBBtn)

const breedBtn = document.createElement('button')
breedBtn.className = 'breed'
breedBtn.textContent = 'Breed A + B'
breedBtn.addEventListener('click', () => {
  if (!parentA || !parentB) { breedBtn.textContent = 'Save both parents first!'; return }
  const child = breedDNA(parentA, parentB)
  if (!child) { breedBtn.textContent = 'Cross-body breeding failed (15% chance) — try again'; return }
  currentDNA = child
  updateAllSliders()
  rebuildMesh()
  breedBtn.textContent = 'Breed A + B'
})
panel.appendChild(breedBtn)

// ── Slider sync ─────────────────────────────────────────────────────────

function updateAllSliders() {
  for (const s of sliders) {
    if (s.key.includes('.')) {
      // Color channel
      const [colorKey, chStr] = s.key.split('.')
      const ch = parseInt(chStr)
      const arr = currentDNA[colorKey as 'bodyColor' | 'accentColor']
      s.input.value = String(arr[ch])
      s.valEl.textContent = arr[ch].toFixed(2)
    } else {
      const v = (currentDNA as Record<string, unknown>)[s.key]
      if (typeof v === 'number') {
        s.input.value = String(v)
        s.valEl.textContent = v.toFixed(2)
      }
    }
  }
}

// ─── Render loop ────────────────────────────────────────────────────────

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

window.addEventListener('resize', () => {
  camera.aspect = wrap.clientWidth / wrap.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(wrap.clientWidth, wrap.clientHeight)
})

rebuildMesh()
animate()
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -30`

Note: OrbitControls import may need adjustment depending on the Three.js version. If it fails, try `'three/addons/controls/OrbitControls.js'` instead. Fix any import issues.

- [ ] **Step 5: Test the debug viewer**

Run: `npx vite dev` and open `http://localhost:3000/debug-viewer.html`

Expected: See a creature mesh on a dark grid, with sliders on the left. Moving sliders should rebuild the mesh live.

- [ ] **Step 6: Commit**

```bash
git add debug-viewer.html src/creatures/debug-viewer.ts vite.config.ts
git commit -m "feat(mesh): add standalone creature DNA debug viewer with sliders and breeding"
```
