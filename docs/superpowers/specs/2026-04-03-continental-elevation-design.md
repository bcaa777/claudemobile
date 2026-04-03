# Continental Elevation System — Design Spec

## Overview

Add a low-frequency continental elevation field that divides the world into three elevation tiers: valley, midland, and mountain. Tiers are independent from biomes — any biome can appear at any elevation. Transitions between tiers create steep cliff faces with natural terrain-carved passes where the noise topology produces gentler slopes. A new slope slide mechanic prevents climbing cliffs while rewarding players who explore for passable routes.

**Goal:** Make the world feel vertically vast. Hard-to-reach mountain areas reward exploration with rare creatures and undiscovered biomes. Players read the landscape to find passes instead of being guided by paths.

---

## 1. Continental Elevation Field

### Noise Configuration

A new simplex noise layer, sampled once per terrain vertex alongside existing terrain noise:

- **Seed:** 55555 (independent from terrain seed 12345 and river seed 77777)
- **Frequency:** 0.0004 (feature scale ~2500 units, spanning ~9 biomes at 280-unit spacing)
- **Domain warp:** Applied before sampling to make tier boundaries meander organically
  - Warp frequency: 0.0003
  - Warp strength: 60 units
  - Uses the existing `warpFbm` pattern from TerrainGenerator

### Tier Quantization

The continental noise outputs a continuous 0-1 value. This is mapped to three tiers using a steep sigmoid at each threshold:

- **Valley:** noise < 0.33 → offset +0 units
- **Midland:** noise 0.33-0.66 → offset +120 units
- **Mountain:** noise > 0.66 → offset +250 units

**Sigmoid transition:** At tier boundaries, a sigmoid function with steepness 15 compresses the height change into a narrow band (~40 units of world space). This creates cliff faces.

**Natural passes:** Where the warped noise value hovers near a threshold (due to domain warp causing the noise gradient to be shallow), the sigmoid stretches over a wider distance, producing a gentler slope. The noise topology naturally creates 3-5 such passes per transition zone with varying widths. No artificial carving is needed.

### Sigmoid Formula

```
function continentalOffset(rawNoise: number): number {
  // Smooth step between tiers using sigmoid
  const low = tierThresholdLow   // 0.33
  const high = tierThresholdHigh  // 0.66
  const k = sigmoidSteepness      // 15

  // Valley → Midland transition
  const t1 = 1 / (1 + exp(-k * (rawNoise - low)))
  // Midland → Mountain transition
  const t2 = 1 / (1 + exp(-k * (rawNoise - high)))

  return t1 * midlandOffset + t2 * (mountainOffset - midlandOffset)
}
```

This produces:
- rawNoise ~0.15: offset ~0 (deep valley)
- rawNoise ~0.33: offset transitions steeply through 0→120 (cliff face)
- rawNoise ~0.50: offset ~120 (midland plateau)
- rawNoise ~0.66: offset transitions steeply through 120→250 (cliff face)
- rawNoise ~0.85: offset ~250 (mountain plateau)

### Application in TerrainGenerator

The continental offset is added to the per-vertex height AFTER computing the biome-blended local terrain height. The existing per-biome terrain (hills, ridges, terracing, rivers) sits on top of the continental base as local detail.

```
finalHeight = continentalOffset(warpedNoise(wx, wz)) + biomeBlendedLocalHeight(wx, wz)
```

---

## 2. Slope Slide Mechanic

### Current Behavior

Slopes >70 degrees block player movement — the player stops against them like a wall.

### New Behavior

Slopes >70 degrees become slides:

- **Slide activation:** When terrain normal at player position has slope angle >70 degrees, enter slide state.
- **Slide physics:** Player velocity is projected along the slope surface. Gravity pulls them downward along the slope face. Slide speed: `gravity * sin(slopeAngle) * delta`.
- **Jump suppression:** While sliding, jump input is ignored. The player cannot wall-jump up cliffs.
- **Exit condition:** Slope angle drops below 65 degrees (5-degree hysteresis prevents jitter at the boundary).
- **Camera control:** Player retains full mouse look while sliding, allowing them to scan for nearby passes.

### Moderate Slope Slowdown (50-70 degrees)

Slopes between 50-70 degrees are walkable but with reduced speed:

- `speedMultiplier = 1.0 - smoothstep(50, 70, slopeAngle) * 0.8`
- At 50 degrees: full speed
- At 60 degrees: ~60% speed
- At 70 degrees: ~20% speed (just before slide kicks in)

This makes passable slopes feel like effort — you're hiking up a mountain pass, not sprinting.

### Integration Point

Modify `CollisionSystem.ts` where the current slope blocking logic lives (the >70 degree check). Replace "stop movement" with "redirect movement downhill + apply slide velocity."

---

## 3. Water Level Adjustment

Water level is currently a global constant at 3.0 units. With continental elevation, water must be relative to the local continental base:

- **Local water level:** `continentalOffset + WATER_LEVEL` per vertex
- Rivers are carved relative to local terrain, so they naturally appear at the correct elevation per tier
- A mountain lake at elevation 250 has water at 253.0
- Valley rivers remain at 3.0 as before

### Implementation

In TerrainGenerator, wherever `WATER_LEVEL` (3.0) is referenced for river carving and water checks, replace with the per-vertex continental offset + WATER_LEVEL. The `hasWater` flag per chunk already checks if any vertex is below water level — this just needs to use the local water level.

---

## 4. Unchanged Systems

These systems require NO modifications:

- **Biome placement:** BiomeMap Voronoi is independent of elevation. Any biome at any tier.
- **Per-biome terrain character:** heightScale, mountainScale, terraceStrength, terraceStep all preserved as local detail.
- **Creature spawning:** Already samples terrain height and positions creatures accordingly.
- **Mega mountains:** Additive on top of continental base. A mega mountain on a mountain tier becomes an extreme peak (~330 units) — dramatic landmark.
- **Hell pit / Heaven:** These use circular override zones with fixed altitudes. Hell carves down to -60 regardless of continental base. Heaven floats at 100 regardless.
- **Road network:** Roads connecting biome centers may cross tier transitions. Roads on steep slopes become visually present but not walkable — this is intentional. Players find terrain passes instead.
- **Camera/rendering:** Draw distances unchanged. Mountain terrain visible from valleys creates dramatic skylines.
- **All gameplay systems:** Camera, field guide, ecology tools, companion, combat, journal — untouched.

---

## 5. Configuration Parameters

All continental elevation parameters added to `TERRAIN_CONFIG` in `config.ts`:

```
continentalFrequency: 0.0004       // noise zoom — lower = bigger elevation regions
continentalWarpFrequency: 0.0003   // how much tier boundaries meander
continentalWarpStrength: 60        // boundary meander amplitude (units)
continentalSigmoidSteepness: 15    // cliff sharpness (higher = steeper walls)
valleyOffset: 0                    // base height for valley tier (units)
midlandOffset: 120                 // base height for midland tier (units)
mountainOffset: 250                // base height for mountain tier (units)
tierThresholdLow: 0.33             // valley→midland noise threshold
tierThresholdHigh: 0.66            // midland→mountain noise threshold
slopeSlideAngle: 70                // degrees — above this, player slides
slopeSlowdownStart: 50             // degrees — speed reduction begins
slopeSlowdownFactor: 0.8           // max speed reduction at slide threshold
```

---

## 6. File Changes Summary

### Modified Files

| File | Changes |
|------|---------|
| `src/config.ts` | Add continental elevation params to TERRAIN_CONFIG |
| `src/world/TerrainGenerator.ts` | Add continental noise, warp, sigmoid, offset calculation; adjust water level to be per-vertex |
| `src/player/CollisionSystem.ts` | Replace slope blocking with slide mechanic; add speed reduction for moderate slopes |

### No New Files

All changes modify existing systems. The continental noise is a new layer within TerrainGenerator, not a separate system.
