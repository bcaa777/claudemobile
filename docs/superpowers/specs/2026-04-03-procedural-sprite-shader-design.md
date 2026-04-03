# Procedural Sprite Variation — Sub-project 1: Per-Instance Shader Effects

## Summary

Apply per-instance shader effects to existing sprite textures so each tree, bush, rock, and grass sprite looks unique. A custom ShaderMaterial replaces MeshLambertMaterial on sprite InstancedMeshes. Each instance gets a seed (from world position) that drives dramatic geometric distortion, color shifting, and UV manipulation in the shader.

## Scope

- Custom `SpriteShader` material with vertex + fragment shaders
- Per-instance `aSeed` attribute on sprite InstancedMeshes
- Integration into BillboardBatch and Chunk sprite placement
- Dramatic variation: clearly different silhouettes from the same base texture

Out of scope: changing sprite draw functions, adding new sprite types, texture generation changes (sub-project 2).

## Shader Effects

### Vertex Shader — Geometric Distortion

All effects use the per-instance seed to generate deterministic pseudo-random values. Distortion pivots from the sprite base (Y=0) so trunks stay grounded.

| Effect | Range | Description |
|--------|-------|-------------|
| **Horizontal bend** | ±0.3 | Sine wave on X based on Y position. Makes trees lean or S-curve. `x += sin(y * bendFreq) * bendAmount` |
| **Vertical squash/stretch** | 0.7 - 1.4 | Scale Y, making sprites tall/thin or short/wide |
| **Canopy bulge** | ±0.25 | Above Y > 0.4 (upper half), expand or contract X. Wider or narrower treetops |
| **Trunk twist** | ±0.15 | Below Y < 0.4, slight X offset. Crooked trunks |

The vertex shader also handles billboard rotation (currently done via instance matrix). The new shader takes over that responsibility so the full vertex transform is:
1. Apply UV-space distortion (bend, squash, bulge)
2. Apply billboard Y-axis rotation toward camera
3. Apply instance position + scale from instance matrix

### Fragment Shader — Color + UV Manipulation

| Effect | Range | Description |
|--------|-------|-------------|
| **Hue rotation** | ±30° | Shifts hue in HSL space. Autumn oranges, deep greens, blue tints |
| **Brightness** | ±20% | Lighter or darker per instance |
| **Saturation** | ±25% | More vivid or muted |
| **UV horizontal flip** | 50% chance | Mirrors texture horizontally — doubles visual variety for free |
| **UV section offset** | ±0.1 | Shifts upper half of UV left/right, displacing canopy relative to trunk |

Alpha test (discard < 0.5) is preserved for sprite transparency.

### Seed-Driven Random

A single float `aSeed` per instance drives all randomness via a cheap hash:

```glsl
float hash(float seed, float offset) {
  return fract(sin(seed * 127.1 + offset * 311.7) * 43758.5453);
}
```

Each effect reads a different `offset` so they're independently random:
- `hash(seed, 0.0)` → bend amount
- `hash(seed, 1.0)` → squash factor
- `hash(seed, 2.0)` → bulge
- `hash(seed, 3.0)` → hue shift
- `hash(seed, 4.0)` → brightness
- `hash(seed, 5.0)` → saturation
- `hash(seed, 6.0)` → flip
- `hash(seed, 7.0)` → section offset

### Ground Decals

Decal sprites (rocks, ground grass) get only color effects (hue, brightness, saturation, flip) — no geometric distortion since they're flat on the ground.

## Per-Instance Attribute

Each sprite InstancedMesh gets an additional instanced `BufferAttribute`:

```typescript
const seedAttr = new THREE.InstancedBufferAttribute(seedArray, 1)
mesh.geometry.setAttribute('aSeed', seedAttr)
```

The seed value for each instance: `hash(worldX * 1000 + worldZ)` — deterministic per world position.

## Lighting

The current sprites use `MeshLambertMaterial` which provides Lambert diffuse shading via Three.js built-in lighting. The custom ShaderMaterial needs to replicate basic lighting to avoid sprites looking flat. Approach: include Three.js lighting chunks (`#include <common>`, `#include <lights_lambert_vertex>`, etc.) or compute a simple N·L diffuse term using the directional light direction as a uniform.

Simpler approach: use a hemi-light approximation — blend between a dark ground color and the sky color based on the normal's Y component. This gives ambient + directional feel without the complexity of full Three.js light integration. The sprite plane normal always faces the camera, so we can use the up vector for lighting.

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/sprites/SpriteShader.ts` | ShaderMaterial factory, GLSL vertex+fragment, uniform setup |
| Modify | `src/sprites/BillboardBatch.ts` | Use SpriteShader, add aSeed attribute, pass camera uniforms |
| Modify | `src/world/Chunk.ts` | Compute seed per sprite instance, pass to BillboardBatch |

## Integration Details

### BillboardBatch.ts

- Constructor: replace `new THREE.MeshLambertMaterial(...)` with `createSpriteShaderMaterial(texture)`
- Add `aSeed` InstancedBufferAttribute populated from sprite entries
- `updateBillboard()`: instead of writing rotation into instance matrix, pass camera position as a uniform (the shader handles billboard rotation)
- Decals: pass a `uIsDecal` uniform = 1.0 to skip geometric distortion

### Chunk.ts (placeSprites)

- When creating SpriteEntry, compute a seed from world position: `seed = fract(sin(wx * 127.1 + wz * 311.7) * 43758.5453) * 10000`
- Pass seed array to BillboardBatch constructor

### SpriteShader.ts

Exports:
```typescript
function createSpriteShaderMaterial(texture: THREE.Texture, isDecal?: boolean): THREE.ShaderMaterial
```

Uniforms:
- `uTexture` — the sprite texture
- `uCameraPos` — camera world position (for billboard rotation)
- `uSunDir` — directional light direction (for basic lighting)
- `uIsDecal` — 0.0 or 1.0 (skip vertex distortion for decals)
