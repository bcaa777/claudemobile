# Continental Elevation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-tier continental elevation field (valley/midland/mountain) with natural terrain passes and a slope slide mechanic that makes the world feel vertically vast.

**Architecture:** A new low-frequency noise layer in TerrainGenerator adds a continental height offset per vertex. Domain warping creates meandering tier boundaries. A sigmoid function at tier thresholds produces steep cliffs with natural passes where the noise lingers near thresholds. CollisionSystem replaces slope blocking with slide physics.

**Tech Stack:** TypeScript, simplex-noise (existing), Three.js

**Spec:** `docs/superpowers/specs/2026-04-03-continental-elevation-design.md`

---

## File Structure

### Modified Files
| File | Changes |
|------|---------|
| `src/config.ts` | Add continental elevation params to TERRAIN_CONFIG |
| `src/world/TerrainGenerator.ts` | Add continental noise singleton, `continentalOffset()` function, apply offset in `generateHeightmap()` and `sampleWorldHeight()` |
| `src/player/CollisionSystem.ts` | Replace slope blocking with slide mechanic, add moderate slope slowdown |
| `src/player/FirstPersonController.ts` | Add `isSliding` flag, expose slope speed multiplier |

### No New Files

---

### Task 1: Add Continental Config Parameters

**Files:**
- Modify: `src/config.ts`

- [ ] **Step 1: Add continental params to TERRAIN_CONFIG**

In `src/config.ts`, find the `TERRAIN_CONFIG` object (line 69). After the existing `enableRoads` property (around line 93), add the continental elevation parameters:

```typescript
  // Continental elevation — large-scale 3-tier height field
  continentalFrequency:      0.0004,  // noise zoom (lower = bigger regions)
  continentalWarpFrequency:  0.0003,  // tier boundary meander zoom
  continentalWarpStrength:   60,      // boundary meander amplitude (units)
  continentalSigmoidSteepness: 15,    // cliff sharpness (higher = steeper walls)
  valleyOffset:              0,       // base height for valley tier (units)
  midlandOffset:             120,     // base height for midland tier (units)
  mountainOffset:            250,     // base height for mountain tier (units)
  tierThresholdLow:          0.33,    // valley→midland noise threshold
  tierThresholdHigh:         0.66,    // midland→mountain noise threshold

  // Slope physics
  slopeSlideAngle:           70,      // degrees — above this, player slides
  slopeSlowdownStart:        50,      // degrees — speed reduction begins
  slopeSlowdownFactor:       0.8,     // max speed reduction at slide threshold
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/config.ts
git commit -m "feat(terrain): add continental elevation config parameters"
```

---

### Task 2: Add Continental Elevation to TerrainGenerator

**Files:**
- Modify: `src/world/TerrainGenerator.ts`

This is the core change. We add a new noise singleton, a `continentalOffset()` function, and apply the offset in both height generation paths.

- [ ] **Step 1: Add continental noise singleton**

In `src/world/TerrainGenerator.ts`, after the existing noise singletons (lines 18-22), add:

```typescript
let continentalNoise: Noise2DFn | null = null

function getContinentalNoise() { if (!continentalNoise) continentalNoise = makeNoise2D(55555); return continentalNoise }
```

- [ ] **Step 2: Add the continentalOffset function**

After the `riverMask` function (after line 63), add the continental offset function:

```typescript
// ─── Continental elevation ───────────────────────────────────────────────────

/**
 * Compute the continental elevation offset at a world position.
 * Returns a height offset (0 for valley, ~120 for midland, ~250 for mountain)
 * with steep sigmoid transitions between tiers.
 */
export function continentalOffset(wx: number, wz: number): number {
  const cn = getContinentalNoise()
  const tn = getTerrainNoise()

  // Domain warp for organic, meandering tier boundaries
  const wf = TERRAIN_CONFIG.continentalWarpFrequency
  const ws = TERRAIN_CONFIG.continentalWarpStrength
  const warpX = wx + ws * fbm(tn, wx * wf,        wz * wf + 31.4, 2)
  const warpZ = wz + ws * fbm(tn, wx * wf + 17.3, wz * wf,        2)

  // Sample continental noise (0-1)
  const raw = fbm(cn, warpX * TERRAIN_CONFIG.continentalFrequency,
                      warpZ * TERRAIN_CONFIG.continentalFrequency, 3)

  // Sigmoid-based tier transitions — steep = cliff faces, gradual = passes
  const k = TERRAIN_CONFIG.continentalSigmoidSteepness
  const low  = TERRAIN_CONFIG.tierThresholdLow
  const high = TERRAIN_CONFIG.tierThresholdHigh

  // Remap raw from [0,1] fbm output. fbm output clusters around 0.5,
  // so spread it to use more of the 0-1 range for better tier distribution
  const spread = Math.min(1, Math.max(0, (raw - 0.25) * 2.0))

  const t1 = 1 / (1 + Math.exp(-k * (spread - low)))
  const t2 = 1 / (1 + Math.exp(-k * (spread - high)))

  return t1 * TERRAIN_CONFIG.midlandOffset
       + t2 * (TERRAIN_CONFIG.mountainOffset - TERRAIN_CONFIG.midlandOffset)
}
```

- [ ] **Step 3: Apply continental offset in generateHeightmap**

In the `generateHeightmap` function, inside the main vertex loop (after line 148 where `height` is computed from biome blending), add the continental offset BEFORE the mega mountain boost:

Find this line:
```typescript
      let height = hA + (hB - hA) * blend.blend
```

Change it to:
```typescript
      let height = hA + (hB - hA) * blend.blend

      // Continental elevation — large-scale tier offset
      const contOffset = continentalOffset(wx, wz)
      height += contOffset
```

Also update the river carving section to use a local water level. Find:
```typescript
      // River carving
      const rm = riverMask(wx, wz)
      if (rm < 1) {
        const bed = WATER_LEVEL - TERRAIN_CONFIG.riverCarveDepth
        height    = height * rm + bed * (1 - rm)
      }
```

Change to:
```typescript
      // River carving — use local water level relative to continental base
      const rm = riverMask(wx, wz)
      if (rm < 1) {
        const localWater = contOffset + WATER_LEVEL
        const bed = localWater - TERRAIN_CONFIG.riverCarveDepth
        height = height * rm + bed * (1 - rm)
      }
```

And update the water check. Find:
```typescript
      if (height < WATER_LEVEL) hasWater = true
```

Change to:
```typescript
      const localWater = contOffset + WATER_LEVEL
      if (height < localWater) hasWater = true
```

Wait — `localWater` is already computed above in the river section. But we need it for both. Move the localWater computation before river carving, and remove the duplicate:

The final order should be:
```typescript
      // Continental elevation
      const contOffset = continentalOffset(wx, wz)
      height += contOffset

      // ... mega mountain boost (unchanged) ...

      // ... hell pit carving (unchanged) ...

      // Local water level relative to continental base
      const localWater = contOffset + WATER_LEVEL

      // River carving
      const rm = riverMask(wx, wz)
      if (rm < 1) {
        const bed = localWater - TERRAIN_CONFIG.riverCarveDepth
        height = height * rm + bed * (1 - rm)
      }

      if (height < localWater) hasWater = true
```

Also update the vertex colour section. Find:
```typescript
      if (height < WATER_LEVEL) {
```

Change to:
```typescript
      if (height < localWater) {
```

- [ ] **Step 4: Apply continental offset in sampleWorldHeight**

The `sampleWorldHeight` function (line 269) is a standalone query used by landmarks, NPCs, etc. It must also apply the continental offset.

After the biome blending (after `let height = hA + (hB - hA) * blend.blend` around line 283), add:

```typescript
  // Continental elevation
  const contOffset = continentalOffset(wx, wz)
  height += contOffset
```

And update the river carving section in sampleWorldHeight. Find:
```typescript
  // River carving
  const rm = riverMask(wx, wz)
  if (rm < 1) {
    const bed = WATER_LEVEL - TERRAIN_CONFIG.riverCarveDepth
    height = height * rm + bed * (1 - rm)
  }
```

Change to:
```typescript
  // River carving — local water level relative to continental base
  const localWater = contOffset + WATER_LEVEL
  const rm = riverMask(wx, wz)
  if (rm < 1) {
    const bed = localWater - TERRAIN_CONFIG.riverCarveDepth
    height = height * rm + bed * (1 - rm)
  }
```

And update the return statement. Find:
```typescript
  return inHellPit ? height : Math.max(height, WATER_LEVEL)
```

Change to:
```typescript
  return inHellPit ? height : Math.max(height, localWater)
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Manual test**

Run `npm run dev`, load the game, and verify:
1. Walk in one direction for a while — you should hit a dramatic elevation change (cliff face) where the terrain rises ~120 units
2. The cliff should be too steep to walk up (existing 70° blocking still in place)
3. Walk along the cliff face — you should find spots where the transition is gentler (natural passes)
4. On the elevated plateau, terrain should have normal biome character (hills, ridges, terracing) sitting on top of the higher base
5. Rivers in valleys should have water as before
6. Rivers on elevated tiers should appear as carved channels (possibly dry — no standing water)

- [ ] **Step 7: Commit**

```bash
git add src/world/TerrainGenerator.ts
git commit -m "feat(terrain): add continental elevation field with 3-tier system"
```

---

### Task 3: Slope Slide Mechanic

**Files:**
- Modify: `src/player/CollisionSystem.ts`
- Modify: `src/player/FirstPersonController.ts`

- [ ] **Step 1: Add sliding state to FirstPersonController**

In `src/player/FirstPersonController.ts`, add a new public field alongside the existing ones (near `isGrounded`, `isGliding`, etc.):

```typescript
public isSliding: boolean = false
```

- [ ] **Step 2: Replace slope blocking with slide physics in CollisionSystem**

In `src/player/CollisionSystem.ts`, first add the import for TERRAIN_CONFIG:

```typescript
import { TERRAIN_CONFIG } from '../config'
```

Replace the entire slope blocking section (lines 48-80, from `// ── Slope blocking with sliding` to the closing brace of that `if` block) with:

```typescript
    // ── Slope detection: slide on steep slopes, slow on moderate slopes ──────
    if (controller.isGrounded) {
      this.groundedFrames++
    } else {
      this.groundedFrames = 0
      controller.isSliding = false
    }

    const slideAngleRad = TERRAIN_CONFIG.slopeSlideAngle * Math.PI / 180
    const slideTan = Math.tan(slideAngleRad)
    const slowdownStartRad = TERRAIN_CONFIG.slopeSlowdownStart * Math.PI / 180
    const slowdownTan = Math.tan(slowdownStartRad)

    if (this.groundedFrames > 5 && controller.verticalVelocity <= 0 && groundYAtNew > -Infinity && groundYAtPrev > -Infinity) {
      const stepUp = groundYAtNew - groundYAtPrev
      if (stepUp > AUTO_STEP_HEIGHT) {
        const dx = pos.x - prevPos.x
        const dz = pos.z - prevPos.z
        const horizDist = Math.sqrt(dx * dx + dz * dz)
        if (horizDist > 0.001) {
          const slopeTan = stepUp / horizDist
          const slopeAngle = Math.atan(slopeTan) * 180 / Math.PI

          if (slopeTan > slideTan) {
            // ── Slide down the slope ──────────────────────────────────────
            controller.isSliding = true

            // Push player back to previous position
            pos.x = prevPos.x
            pos.z = prevPos.z

            // Apply downhill slide velocity
            // Compute slope normal direction (pointing downhill in XZ)
            const nx = dx / horizDist
            const nz = dz / horizDist
            // Slide perpendicular to the slope face, downhill
            const slideSpeed = 28 * Math.sin(slopeAngle * Math.PI / 180) * delta
            pos.x -= nx * slideSpeed
            pos.z -= nz * slideSpeed

            // Suppress jump while sliding
            controller.verticalVelocity = 0

          } else if (slopeTan > slowdownTan) {
            // ── Moderate slope: reduce speed ──────────────────────────────
            controller.isSliding = false
            // smoothstep interpolation between slowdownStart and slideAngle
            const t = (slopeAngle - TERRAIN_CONFIG.slopeSlowdownStart)
                    / (TERRAIN_CONFIG.slopeSlideAngle - TERRAIN_CONFIG.slopeSlowdownStart)
            const smooth = t * t * (3 - 2 * t) // smoothstep
            controller.frictionMultiplier = 1.0 - smooth * TERRAIN_CONFIG.slopeSlowdownFactor

          } else {
            // ── Normal terrain ────────────────────────────────────────────
            controller.isSliding = false
            controller.frictionMultiplier = 1.0
          }
        } else {
          controller.isSliding = false
          controller.frictionMultiplier = 1.0
        }
      } else {
        // Exit sliding when slope is gentle (5° hysteresis)
        if (controller.isSliding) {
          const exitAngle = TERRAIN_CONFIG.slopeSlideAngle - 5
          const exitTan = Math.tan(exitAngle * Math.PI / 180)
          if (stepUp <= AUTO_STEP_HEIGHT || (Math.sqrt((pos.x - prevPos.x) ** 2 + (pos.z - prevPos.z) ** 2) > 0.001 &&
              stepUp / Math.sqrt((pos.x - prevPos.x) ** 2 + (pos.z - prevPos.z) ** 2) < exitTan)) {
            controller.isSliding = false
          }
        }
        controller.frictionMultiplier = 1.0
      }
    } else {
      controller.frictionMultiplier = 1.0
    }
```

- [ ] **Step 3: Suppress jump while sliding in FirstPersonController**

In `src/player/FirstPersonController.ts`, find where jump is handled (where `consumeJump()` is called and `verticalVelocity` is set). Add a check to suppress jumping while sliding. Find the jump section (something like):

```typescript
if (this.input.consumeJump()) {
```

Wrap the jump logic so it's skipped when sliding:

```typescript
if (this.input.consumeJump() && !this.isSliding) {
```

- [ ] **Step 4: Apply friction multiplier to movement speed**

In `src/player/FirstPersonController.ts`, verify that `frictionMultiplier` is already used in the speed calculation. The field exists (`public frictionMultiplier = 1.0`) — check that it's applied to the movement vector. If it's already multiplied into the velocity calculation, no change needed. If not, find where the movement direction is applied (where `baseSpeed` is multiplied) and ensure `frictionMultiplier` is included:

```typescript
const speed = baseSpeed * this.speedMultiplier * this.frictionMultiplier
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Manual test**

Run `npm run dev` and test:
1. Find a steep cliff face (continental tier transition from Task 2)
2. Walk into it — you should SLIDE downward, not stop
3. While sliding, press Space — jump should be suppressed
4. You retain mouse look while sliding
5. Find a moderate slope (50-70°) — walking up should be slow but possible
6. Flat terrain — normal speed, no sliding
7. Walk along a cliff face to find a pass — gentler slope lets you walk through with reduced speed

- [ ] **Step 7: Commit**

```bash
git add src/player/CollisionSystem.ts src/player/FirstPersonController.ts
git commit -m "feat(collision): add slope slide mechanic replacing wall blocking"
```

---

### Task 4: Integration Test and Tuning

**Files:**
- No new files — verification and tuning pass

- [ ] **Step 1: Full build check**

Run: `npx tsc --noEmit && npm run build`
Expected: Zero errors, successful build.

- [ ] **Step 2: Comprehensive playtest**

Run `npm run dev` and verify the complete system:

1. **Tier distribution:** Walk across the world in multiple directions. You should encounter all three tiers. Approximately 1/3 of the world at each tier.
2. **Cliff faces:** Tier transitions should feel like dramatic cliff walls — too steep to walk up, player slides down when attempting.
3. **Natural passes:** Walking along cliff faces reveals spots where the terrain is gentle enough to traverse. These should feel like natural gaps, not artificial.
4. **Biome independence:** Any biome can appear at any elevation. A desert on a mountain or a snow biome in a valley should both occur.
5. **Local terrain preserved:** On top of each tier, the per-biome terrain character (hills, ridges, terracing) should look normal — not flattened or broken.
6. **Creatures:** Creatures should spawn at all elevations. The recent creature population fix ensures repopulation.
7. **Mega mountains:** Mega mountains on elevated tiers should create dramatic peaks.
8. **Rivers:** Valley rivers should have water as before. Elevated tier rivers should appear as carved channels.
9. **Slide mechanic:** Approaching cliffs from below causes smooth sliding. No wall-stop feel.
10. **Performance:** No frame rate regression — continental noise is cheap (one fbm sample + warp per vertex).

- [ ] **Step 3: Tune if needed**

If passes are too rare, decrease `continentalSigmoidSteepness` (e.g., from 15 to 10).
If cliffs are not steep enough, increase it (e.g., to 20).
If tier regions are too small/large, adjust `continentalFrequency`.
If height differences feel wrong, adjust `midlandOffset` and `mountainOffset`.

These are all in TERRAIN_CONFIG and tweakable via localStorage `engine_debug_cfg`.

- [ ] **Step 4: Commit any tuning changes**

```bash
git add -A
git commit -m "fix: tune continental elevation parameters"
```

(Only if tuning was needed.)
