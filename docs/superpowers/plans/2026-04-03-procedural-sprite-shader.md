# Procedural Sprite Shader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every sprite instance visually unique by applying per-instance shader effects (geometric distortion, color shifting, UV manipulation) to existing sprite textures.

**Architecture:** A custom `ShaderMaterial` replaces `MeshLambertMaterial` on sprite InstancedMeshes. Each instance gets a float `aSeed` attribute derived from world position. The vertex shader applies dramatic geometric distortion (bend, squash, canopy bulge) and handles billboard rotation. The fragment shader applies hue/brightness/saturation shifts, UV flip, and section offset. Ground decals skip vertex distortion.

**Tech Stack:** Three.js, GLSL, TypeScript

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/sprites/SpriteShader.ts` | GLSL shaders + `createSpriteMaterial()` factory |
| Modify | `src/sprites/BillboardBatch.ts` | Use SpriteShader, add `aSeed` attribute, pass uniforms |
| Modify | `src/world/Chunk.ts` | Compute per-sprite seed from world position, pass seed arrays |

---

### Task 1: Create SpriteShader

**Files:**
- Create: `src/sprites/SpriteShader.ts`

- [ ] **Step 1: Create the shader material factory**

Create `src/sprites/SpriteShader.ts`:

```typescript
import * as THREE from 'three'

// ─── GLSL: Vertex Shader ────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
  attribute float aSeed;

  uniform float uIsDecal;

  varying vec2 vUv;
  varying float vSeed;

  // Cheap deterministic hash
  float hash(float s, float off) {
    return fract(sin(s * 127.1 + off * 311.7) * 43758.5453);
  }

  void main() {
    vUv = uv;
    vSeed = aSeed;

    vec3 pos = position;

    // ── Per-instance distortion (billboards only) ──────────────────────
    if (uIsDecal < 0.5) {
      float bendAmt   = (hash(aSeed, 0.0) - 0.5) * 0.6;   // ±0.3
      float squash    = 0.7 + hash(aSeed, 1.0) * 0.7;      // 0.7 - 1.4
      float bulgeAmt  = (hash(aSeed, 2.0) - 0.5) * 0.5;    // ±0.25
      float twistAmt  = (hash(aSeed, 8.0) - 0.5) * 0.3;    // ±0.15

      // Y is 0 at bottom, 1 at top of sprite (PlaneGeometry 1x1 centered)
      float normalY = pos.y + 0.5;  // remap from [-0.5, 0.5] to [0, 1]

      // Vertical squash/stretch
      pos.y *= squash;

      // Horizontal bend: sine wave based on height
      pos.x += sin(normalY * 3.14159) * bendAmt;

      // Canopy bulge: expand/contract upper half
      if (normalY > 0.4) {
        float bulgeT = (normalY - 0.4) / 0.6;  // 0-1 in upper portion
        pos.x += pos.x * bulgeAmt * bulgeT;
      }

      // Trunk twist: offset lower half
      if (normalY < 0.4) {
        pos.x += twistAmt * (0.4 - normalY);
      }
    }

    // ── Instance transform from instanceMatrix ─────────────────────────
    // instanceMatrix already contains position, rotation, scale
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

// ─── GLSL: Fragment Shader ──────────────────────────────────────────────────

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uIsDecal;

  varying vec2 vUv;
  varying float vSeed;

  float hash(float s, float off) {
    return fract(sin(s * 127.1 + off * 311.7) * 43758.5453);
  }

  // RGB → HSL conversion
  vec3 rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float l = (maxC + minC) * 0.5;
    if (maxC == minC) return vec3(0.0, 0.0, l);
    float d = maxC - minC;
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    float h;
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    return vec3(h / 6.0, s, l);
  }

  // HSL → RGB conversion
  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 hsl) {
    if (hsl.y == 0.0) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    return vec3(
      hue2rgb(p, q, hsl.x + 1.0/3.0),
      hue2rgb(p, q, hsl.x),
      hue2rgb(p, q, hsl.x - 1.0/3.0)
    );
  }

  void main() {
    // ── UV manipulation ──────────────────────────────────────────────
    vec2 uv = vUv;

    // Horizontal flip (50% chance)
    float flipChance = hash(vSeed, 6.0);
    if (flipChance > 0.5) {
      uv.x = 1.0 - uv.x;
    }

    // Section offset: shift upper half left/right
    if (uv.y > 0.5 && uIsDecal < 0.5) {
      float sectionOff = (hash(vSeed, 7.0) - 0.5) * 0.2;  // ±0.1
      uv.x = clamp(uv.x + sectionOff, 0.0, 1.0);
    }

    // ── Sample texture ───────────────────────────────────────────────
    vec4 texColor = texture2D(uTexture, uv);

    // Alpha test
    if (texColor.a < 0.5) discard;

    // ── Color manipulation ───────────────────────────────────────────
    vec3 hsl = rgb2hsl(texColor.rgb);

    // Hue rotation: ±30 degrees (±0.083 in 0-1 range)
    float hueShift = (hash(vSeed, 3.0) - 0.5) * 0.166;
    hsl.x = fract(hsl.x + hueShift);

    // Brightness: ±20%
    float brightShift = (hash(vSeed, 4.0) - 0.5) * 0.4;
    hsl.z = clamp(hsl.z + brightShift, 0.0, 1.0);

    // Saturation: ±25%
    float satShift = (hash(vSeed, 5.0) - 0.5) * 0.5;
    hsl.y = clamp(hsl.y + satShift, 0.0, 1.0);

    vec3 finalColor = hsl2rgb(hsl);

    // ── Simple lighting ──────────────────────────────────────────────
    // Hemi-light approximation: blend dark ground → bright sky based on world up
    // Sprites always face camera, so use a fixed up-biased light
    float lightFactor = 0.6 + 0.4 * (uIsDecal > 0.5 ? 0.8 : vUv.y * 0.5 + 0.5);
    finalColor *= lightFactor;

    gl_FragColor = vec4(finalColor, texColor.a);
  }
`

// ─── Material factory ───────────────────────────────────────────────────────

export function createSpriteMaterial(
  texture: THREE.Texture,
  isDecal: boolean,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uIsDecal: { value: isDecal ? 1.0 : 0.0 },
    },
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  })
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/sprites/SpriteShader.ts
git commit -m "feat(sprites): add SpriteShader with per-instance distortion and color variation"
```

---

### Task 2: Integrate shader into BillboardBatch

**Files:**
- Modify: `src/sprites/BillboardBatch.ts`

- [ ] **Step 1: Read the current file and understand the structure**

Read `src/sprites/BillboardBatch.ts` to understand the current `SpriteEntry` interface, constructor, and `updateBillboard` method.

- [ ] **Step 2: Add seed to SpriteEntry and import shader**

Add import at top:
```typescript
import { createSpriteMaterial } from './SpriteShader'
```

Extend the `SpriteEntry` interface to include a seed:
```typescript
interface SpriteEntry {
  x: number
  y: number
  z: number
  scale: number
  seed: number  // per-instance random seed for shader effects
}
```

- [ ] **Step 3: Replace material creation with SpriteShader**

In the constructor, replace:
```typescript
    const mat = new THREE.MeshLambertMaterial({
      map: texture,
      transparent: false,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      depthWrite: true,
    })
```
with:
```typescript
    const mat = createSpriteMaterial(texture, !billboard)
```

- [ ] **Step 4: Add aSeed instanced attribute**

After creating the InstancedMesh (after `this.mesh = new THREE.InstancedMesh(...)` line), add:

```typescript
    // Per-instance seed attribute for shader variation
    const seedArray = new Float32Array(sprites.length)
    for (let i = 0; i < sprites.length; i++) {
      seedArray[i] = sprites[i].seed
    }
    this.mesh.geometry = _sharedGeo.clone()  // clone so attribute is per-batch, not shared
    this.mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedArray, 1))
```

Note: we clone the geometry because `aSeed` is an instanced attribute that varies per batch. The shared PlaneGeometry can't have different aSeed arrays for different batches.

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/sprites/BillboardBatch.ts
git commit -m "feat(sprites): integrate SpriteShader into BillboardBatch with per-instance seeds"
```

---

### Task 3: Pass seed from Chunk sprite placement

**Files:**
- Modify: `src/world/Chunk.ts`

- [ ] **Step 1: Add seed computation in placeSprites**

In the `placeSprites` method, find the line where the entry is created (around line 2543):
```typescript
        const entry   = { x: lx, y: height + heightOffset, z: lz, scale }
```

Replace with:
```typescript
        const seed = Math.abs(Math.sin(wx * 127.1 + wz * 311.7) * 43758.5453) % 10000
        const entry   = { x: lx, y: height + heightOffset, z: lz, scale, seed }
```

This computes a deterministic seed from world position — same position always produces same visual variation.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Test visually**

Run: `npx vite dev` and load the game. Walk around and observe sprites:
- Trees should have visibly different silhouettes (some leaning, some tall/thin, some wide)
- Colors should shift across instances (greener, yellower, darker, lighter)
- Some sprites should be horizontally flipped
- Ground decals (rocks) should have color variation but no geometric distortion

- [ ] **Step 4: Commit**

```bash
git add src/world/Chunk.ts
git commit -m "feat(sprites): pass per-instance seed from world position for sprite shader variation"
```
