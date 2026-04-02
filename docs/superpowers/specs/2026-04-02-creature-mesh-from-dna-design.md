# Creature DNA Mesh — Sub-project 2: Procedural Mesh from DNA

## Summary

Replace the hardcoded species-specific mesh builders in `CreatureMesh.ts` with a DNA-driven mesh builder that reads `CreatureDNA` gene values to construct creature geometry procedurally. Add a standalone debug viewer page for inspecting and breeding creatures visually.

## Scope

- `DNAMeshBuilder.ts` — builds creature geometry from DNA for all 5 body plans
- Modify `CreatureMesh.ts` — delegate to DNA builder when `creature.dna` is present
- `debug-viewer.html` — standalone Three.js page with DNA sliders, preset picker, breeding

Out of scope: removing legacy species-specific mesh code (kept for enemies), animation changes (reuse existing leg/wing/tail animation), full game integration changes (done in sub-project 1).

## Geometry Style

Box + Sphere hybrid:
- Body: `BoxGeometry` scaled by DNA dimensions
- Head: `SphereGeometry` sized by `headSize` gene
- Joints (shoulders, hips): small spheres at leg attachment points
- Legs, wings, tail, horns, etc.: `BoxGeometry` (thin/flat as appropriate)
- Eyes: small `SphereGeometry` on head

This gives a slightly more organic feel than pure boxes while keeping the low-poly voxel aesthetic.

## DNAMeshBuilder

### File: `src/creatures/DNAMeshBuilder.ts`

**Exports:**

```typescript
interface MeshRefs {
  legs: THREE.Mesh[]      // for leg animation
  wings: THREE.Mesh[]     // for wing flap
  tail: THREE.Mesh | null // for tail wag
}

function buildFromDNA(dna: CreatureDNA, group: THREE.Group): MeshRefs
```

### Build Order (all body plans)

1. **Body** — `BoxGeometry(bodyW, bodyH, bodyD)` where dimensions come from `dnaToStats(dna)`. Centered at origin. Material from `dna.bodyColor`.

2. **Head** — `SphereGeometry(headRadius)` where `headRadius = bodyH * headSize`. Positioned at front of body, offset by `neckLength * bodyD`. Material from `dna.accentColor`.

3. **Eyes** — `SphereGeometry(0.06)` on head surface. Count from `quantizeEyeCount(dna.eyeCount)`. Evenly spaced around front hemisphere. Predators (aggression > 0.5) get emissive orange material.

4. **Legs** — thin `BoxGeometry(thickness, length, thickness)`. Count from `quantizeLegCount(dna.legCount)`. Dimensions from `legLength` and `legThickness` genes. Positioned evenly under body (for quadruped: 4 corners, for insectoid: along sides, for avian: 2 centered, for aquatic/serpentine: 0). Joint spheres at shoulder/hip attachment points.

5. **Conditional appendages** (gene > 0.5 = present):

   | Gene | Geometry | Placement |
   |------|----------|-----------|
   | `hasWings` | Two flat boxes, `DoubleSide` material, width from `wingSpan * bodyD` | Sides of body, angled up slightly |
   | `hasTail` | 1-3 tapered boxes chained, total length from `tailLength * bodyD` | Rear of body |
   | `hasHorns` | Two angled boxes, size from `hornSize` | Top/sides of head |
   | `hasClaws` | Small boxes at leg tips, size from `clawSize` | End of each leg |
   | `hasMandibles` | Two angled boxes | Front of head, below eyes |
   | `hasFins` | Flat boxes (dorsal + pectoral), size from `finSize` | Top and sides of body |
   | `hasAntennae` | Two thin long boxes | Top of head, angled forward |

6. **Colors** — Body material from `dna.bodyColor` RGB. Head/accent from `dna.accentColor`. Legs slightly darker than body. Materials cached by hex color.

### Body Plan Variations

The base build order is the same for all body plans. Differences:

- **Quadruped**: Legs at 4 corners. Standard proportions.
- **Insectoid**: Legs along body sides (3-4 pairs). Body lower to ground. Mandibles/antennae more likely.
- **Avian**: 2 legs centered underneath. Wings always present (forced if `hasWings` gene is low but body plan is avian). Body angled slightly upward.
- **Aquatic**: No legs (forced to 0). Fins always present. Body elongated horizontally. Tail always present as tail fin.
- **Serpentine**: No legs (forced to 0). Body is 2-3 connected segments (body boxes chained). No joint spheres.

These overrides are applied after reading DNA genes — the body plan constrains which appendages make sense.

### Return Value

`buildFromDNA` returns `MeshRefs` containing references to animated parts:
- `legs[]` — the leg meshes, for oscillation animation
- `wings[]` — the wing meshes, for flap animation
- `tail` — the tail mesh, for wag animation

These are consumed by `CreatureMesh.update()` which already knows how to animate legs/wings/tails.

## CreatureMesh Integration

### File: `src/creatures/CreatureMesh.ts`

**Change to `buildGeometry(creature)`:**

```
if creature.dna exists:
  this.dnaRefs = buildFromDNA(creature.dna, this.group)
  store leg/wing/tail refs for animation
else:
  existing species-specific build code (unchanged)
```

**Change to `update(creature, delta)`:**

When `dnaRefs` is set, use its leg/wing/tail arrays for animation instead of the hardcoded part references. The animation math (sin/cos oscillation for legs, amplitude for wings) stays the same — just driven by the DNA refs instead of species-specific mesh children.

**No change to:**
- LOD system (full vs simple)
- Simple LOD builder (single colored box)
- Material/geometry caching infrastructure
- Death tilt animation
- Companion collar rendering

## Debug Viewer

### File: `src/creatures/debug-viewer.html`

Standalone HTML page with its own Three.js scene. Loaded directly in browser (not through the game).

**Layout:**
- Left panel (300px): controls
- Center: Three.js canvas with orbit camera

**Controls (left panel):**

1. **Preset dropdown** — select from 20 DNA presets, loads all sliders to preset values
2. **Body plan selector** — radio buttons for 5 body plans
3. **Gene sliders** — grouped into sections:
   - Morphology: bodyLength, bodyWidth, bodyHeight, headSize, neckLength
   - Limbs: legCount, legLength, legThickness
   - Appendages: hasWings, wingSpan, hasTail, tailLength, hasHorns, hornSize, hasClaws, clawSize, hasMandibles, hasFins, finSize, hasAntennae
   - Appearance: bodyColor (RGB), accentColor (RGB), eyeSize, eyeCount
   - Behavior: speed, aggression, size
4. **Mutate button** — applies `mutateDNA()` and updates sliders + mesh
5. **Breed section** — "Save as Parent A" / "Save as Parent B" buttons, then "Breed" button that calls `breedDNA()` and shows offspring

**Scene:**
- Ground plane (gray)
- Ambient light + directional light
- Single creature mesh at center, rebuilt on any slider change
- Orbit camera (OrbitControls)
- Stats display: derived stats (speed, role, scale, etc.) shown below sliders

**Dependencies:** Imports only from the creature DNA system files (CreatureDNA, DNAPresets, DNABreeding, DNAMeshBuilder) + Three.js. No game engine dependencies.

**Build:** Added as a separate Vite entry point or loaded as a static HTML file with inline module imports.

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/creatures/DNAMeshBuilder.ts` | `buildFromDNA(dna, group)` → geometry + MeshRefs |
| Create | `src/creatures/debug-viewer.html` | Standalone debug page with sliders, breeding, orbit camera |
| Modify | `src/creatures/CreatureMesh.ts` | Delegate to `buildFromDNA` when DNA present, use MeshRefs for animation |
