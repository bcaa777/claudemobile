# Trail Network Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dense, biome-themed trail network connecting POIs along terrain contours so the player can explore without constant jumping.

**Architecture:** Two-phase system parallel to RoadNetwork. Phase 1 builds backbone trails between landmarks/NPC houses/portals at world init. Phase 2 builds short connector trails from local structures/lore stones to the backbone during chunk generation. A* pathfinding on sampled heightmap finds gentle-slope routes around obstacles.

**Tech Stack:** Three.js (BoxGeometry, MeshLambertMaterial), existing MaterialCache, sampleWorldHeight() for pure terrain queries, SeededRandom for deterministic POI placement.

**Spec:** `docs/superpowers/specs/2026-03-28-trail-network-design.md`

---

### Task 1: Add TRAIL_CONFIG and TrailWaypoint types

**Files:**
- Modify: `src/config.ts` — add TRAIL_CONFIG
- Modify: `src/traversal/traversalTypes.ts` — add TrailWaypoint, TrailEdge, TrailStyle types

- [ ] **Step 1: Add TRAIL_CONFIG to config.ts**

After the existing `RENDER_CONFIG` block, add:

```typescript
// ─── TRAILS ─────────────────────────────────────────────────────────────────
export const TRAIL_CONFIG = {
  enableTrails:       true,   // master toggle
  maxConnections:     5,      // max trails per POI
  maxDistance:        150,    // max connection distance (world units)
  minPOIDistance:      15,    // merge POIs closer than this
  gridResolution:      4,    // A* grid cell size (world units)
  maxSearchNodes:   3000,    // A* budget per trail
  slopeWalkable:     0.3,    // slope below this = no penalty
  slopeImpassable:   0.5,    // slope above this = blocked
}
```

Also add `trail` to `loadSavedConfig()`:

```typescript
if (saved.trail) applyTo(TRAIL_CONFIG as unknown as Record<string, unknown>, saved.trail)
```

- [ ] **Step 2: Add types to traversalTypes.ts**

```typescript
export interface TrailWaypoint {
  x: number
  y: number
  z: number
  biome: BiomeType
  cx: number  // chunk coords for indexing
  cz: number
}

export interface TrailEdge {
  waypoints: TrailWaypoint[]
}

export interface TrailStyle {
  color: number
  tex: string
  w: number        // trail width
  h: number        // trail thickness
  elevated: boolean // true = boardwalk mode (swamp/water)
  emissive?: number
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/traversal/traversalTypes.ts
git commit -m "feat(trails): add TRAIL_CONFIG and trail types"
```

---

### Task 2: A* pathfinder module

**Files:**
- Create: `src/traversal/TrailPathfinder.ts`

This is the core algorithm — a standalone A* that finds gentle-slope paths between two world positions using `sampleWorldHeight()`.

- [ ] **Step 1: Create TrailPathfinder.ts**

```typescript
import * as THREE from 'three'
import { sampleWorldHeight, WATER_LEVEL } from '../world/TerrainGenerator'
import { TRAIL_CONFIG } from '../config'
import type { BiomeMap } from '../world/BiomeMap'
import type { TrailWaypoint } from './traversalTypes'
import { BiomeType } from '../biomes/types'
import { CHUNK_SIZE } from '../world/TerrainGenerator'

interface AStarNode {
  gx: number  // grid x index
  gz: number  // grid z index
  g: number   // cost from start
  f: number   // g + heuristic
}

/**
 * Find a walkable trail between two world positions using A* on a sampled height grid.
 * Returns waypoints or null if no path found within budget.
 */
export function findTrailPath(
  startX: number, startZ: number,
  endX: number, endZ: number,
  biomeMap: BiomeMap,
): TrailWaypoint[] | null {
  const res = TRAIL_CONFIG.gridResolution
  const maxNodes = TRAIL_CONFIG.maxSearchNodes
  const slopeWalk = TRAIL_CONFIG.slopeWalkable
  const slopeBlock = TRAIL_CONFIG.slopeImpassable

  // Compute grid bounds with 50% padding
  const dx = endX - startX
  const dz = endZ - startZ
  const padX = Math.abs(dx) * 0.5
  const padZ = Math.abs(dz) * 0.5
  const minX = Math.min(startX, endX) - padX
  const minZ = Math.min(startZ, endZ) - padZ
  const maxX = Math.max(startX, endX) + padX
  const maxZ = Math.max(startZ, endZ) + padZ

  const gridW = Math.ceil((maxX - minX) / res) + 1
  const gridH = Math.ceil((maxZ - minZ) / res) + 1

  // Pre-sample height grid
  const heights = new Float32Array(gridW * gridH)
  for (let gz = 0; gz < gridH; gz++) {
    for (let gx = 0; gx < gridW; gx++) {
      const wx = minX + gx * res
      const wz = minZ + gz * res
      heights[gz * gridW + gx] = sampleWorldHeight(wx, wz, biomeMap)
    }
  }

  // Convert start/end to grid coords
  const startGx = Math.round((startX - minX) / res)
  const startGz = Math.round((startZ - minZ) / res)
  const endGx = Math.round((endX - minX) / res)
  const endGz = Math.round((endZ - minZ) / res)

  // Clamp to grid
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
  const sgx = clamp(startGx, gridW - 1)
  const sgz = clamp(startGz, gridH - 1)
  const egx = clamp(endGx, gridW - 1)
  const egz = clamp(endGz, gridH - 1)

  // A* data structures
  const key = (gx: number, gz: number) => gz * gridW + gx
  const gCost = new Float32Array(gridW * gridH).fill(Infinity)
  const parentX = new Int16Array(gridW * gridH).fill(-1)
  const parentZ = new Int16Array(gridW * gridH).fill(-1)
  const closed = new Uint8Array(gridW * gridH)

  // Simple binary heap (open set)
  const open: AStarNode[] = []
  let nodesExpanded = 0

  function heuristic(gx: number, gz: number): number {
    const hdx = (gx - egx) * res
    const hdz = (gz - egz) * res
    return Math.sqrt(hdx * hdx + hdz * hdz)
  }

  function pushOpen(node: AStarNode) {
    open.push(node)
    // Bubble up
    let i = open.length - 1
    while (i > 0) {
      const pi = (i - 1) >> 1
      if (open[pi].f <= open[i].f) break
      const tmp = open[pi]; open[pi] = open[i]; open[i] = tmp
      i = pi
    }
  }

  function popOpen(): AStarNode {
    const top = open[0]
    const last = open.pop()!
    if (open.length > 0) {
      open[0] = last
      let i = 0
      while (true) {
        let smallest = i
        const l = 2 * i + 1, r = 2 * i + 2
        if (l < open.length && open[l].f < open[smallest].f) smallest = l
        if (r < open.length && open[r].f < open[smallest].f) smallest = r
        if (smallest === i) break
        const tmp = open[smallest]; open[smallest] = open[i]; open[i] = tmp
        i = smallest
      }
    }
    return top
  }

  // Init
  const startKey = key(sgx, sgz)
  gCost[startKey] = 0
  pushOpen({ gx: sgx, gz: sgz, g: 0, f: heuristic(sgx, sgz) })

  // 8-directional neighbors
  const dirs = [
    [-1, 0, res], [1, 0, res], [0, -1, res], [0, 1, res],
    [-1, -1, res * 1.414], [1, -1, res * 1.414], [-1, 1, res * 1.414], [1, 1, res * 1.414],
  ]

  while (open.length > 0 && nodesExpanded < maxNodes) {
    const cur = popOpen()
    const ck = key(cur.gx, cur.gz)

    if (closed[ck]) continue
    closed[ck] = 1
    nodesExpanded++

    // Goal reached
    if (cur.gx === egx && cur.gz === egz) {
      return reconstructPath(cur.gx, cur.gz, parentX, parentZ, gridW, minX, minZ, res, heights, biomeMap)
    }

    const curH = heights[ck]

    for (const [ddx, ddz, dist] of dirs) {
      const nx = cur.gx + ddx
      const nz = cur.gz + ddz
      if (nx < 0 || nx >= gridW || nz < 0 || nz >= gridH) continue
      const nk = key(nx, nz)
      if (closed[nk]) continue

      const nh = heights[nk]

      // Water = impassable
      if (nh < WATER_LEVEL) continue

      // Slope check
      const slope = Math.abs(nh - curH) / dist
      let cost = dist
      if (slope > slopeBlock) continue // impassable
      if (slope > slopeWalk) cost *= 3  // steep penalty

      // Mild height preference (keep to valleys)
      cost += nh * 0.02

      const newG = cur.g + cost
      if (newG < gCost[nk]) {
        gCost[nk] = newG
        parentX[nk] = cur.gx
        parentZ[nk] = cur.gz
        pushOpen({ gx: nx, gz: nz, g: newG, f: newG + heuristic(nx, nz) })
      }
    }
  }

  return null // no path found
}

function reconstructPath(
  endGx: number, endGz: number,
  parentX: Int16Array, parentZ: Int16Array,
  gridW: number,
  minX: number, minZ: number,
  res: number,
  heights: Float32Array,
  biomeMap: BiomeMap,
): TrailWaypoint[] {
  const path: TrailWaypoint[] = []
  let gx = endGx, gz = endGz

  while (gx !== -1 && gz !== -1) {
    const wx = minX + gx * res
    const wz = minZ + gz * res
    const k = gz * gridW + gx
    const wy = heights[k]
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    const biome = biomeMap.getBiomeAt(wx, wz)
    path.push({ x: wx, y: wy, z: wz, biome, cx, cz })

    const pk = gz * gridW + gx
    const px = parentX[pk]
    const pz = parentZ[pk]
    gx = px
    gz = pz
  }

  path.reverse()

  // Smooth Y values (moving average, window=5) — keep X/Z on computed contour
  const win = 2 // half-window
  const smoothed = path.map(p => p.y)
  for (let i = 0; i < path.length; i++) {
    let sum = 0, count = 0
    for (let j = Math.max(0, i - win); j <= Math.min(path.length - 1, i + win); j++) {
      sum += path[j].y
      count++
    }
    smoothed[i] = sum / count
  }
  for (let i = 0; i < path.length; i++) {
    path[i].y = smoothed[i]
  }

  // Remove collinear waypoints
  if (path.length > 2) {
    const filtered = [path[0]]
    for (let i = 1; i < path.length - 1; i++) {
      const prev = filtered[filtered.length - 1]
      const next = path[i + 1]
      const cur = path[i]
      // Check if direction changes significantly
      const dx1 = cur.x - prev.x, dz1 = cur.z - prev.z
      const dx2 = next.x - cur.x, dz2 = next.z - cur.z
      const cross = Math.abs(dx1 * dz2 - dz1 * dx2)
      if (cross > 0.5) filtered.push(cur) // keep if direction changes
    }
    filtered.push(path[path.length - 1])
    return filtered
  }

  return path
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/traversal/TrailPathfinder.ts
git commit -m "feat(trails): A* pathfinder for gentle-slope terrain routes"
```

---

### Task 3: TrailNetwork — Phase 1 backbone

**Files:**
- Create: `src/traversal/TrailNetwork.ts`
- Modify: `src/npcs/NPCHouses.ts` — add `getHousePositions()` accessor

- [ ] **Step 1: Add getHousePositions() to NPCHouses.ts**

Add a public method that returns all house positions:

```typescript
getHousePositions(): THREE.Vector3[] {
  return this.houses.map(h => h.homePos.clone())
}
```

- [ ] **Step 2: Create TrailNetwork.ts**

```typescript
import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { TRAIL_CONFIG } from '../config'
import { CHUNK_SIZE, sampleWorldHeight } from '../world/TerrainGenerator'
import type { BiomeMap } from '../world/BiomeMap'
import type { TrailWaypoint, TrailEdge } from './traversalTypes'
import { findTrailPath } from './TrailPathfinder'

interface POI {
  position: THREE.Vector3
  biome: BiomeType
}

export class TrailNetwork {
  readonly edges: TrailEdge[] = []
  private chunkIndex = new Map<string, TrailEdge[]>()

  constructor(
    landmarkPositions: Map<BiomeType, THREE.Vector3>,
    housePositions: THREE.Vector3[],
    portalPositions: { position: THREE.Vector3; biome: BiomeType }[],
    biomeMap: BiomeMap,
  ) {
    if (!TRAIL_CONFIG.enableTrails) return

    // Collect all Phase 1 POIs
    const pois: POI[] = []

    for (const [biome, pos] of landmarkPositions) {
      if (biome === BiomeType.Heaven || biome === BiomeType.Hell) continue
      pois.push({ position: pos, biome })
    }

    for (const pos of housePositions) {
      const biome = biomeMap.getBiomeAt(pos.x, pos.z)
      if (biome === BiomeType.Heaven || biome === BiomeType.Hell) continue
      pois.push({ position: pos, biome })
    }

    for (const p of portalPositions) {
      if (p.biome === BiomeType.Heaven || p.biome === BiomeType.Hell) continue
      pois.push({ position: p.position, biome: p.biome })
    }

    // Merge POIs that are too close
    const merged = this.mergePOIs(pois)

    // Build connections — each POI to up to maxConnections nearest others
    this.buildBackbone(merged, biomeMap)

    // Index waypoints by chunk
    this.buildChunkIndex()

    console.log(`[Trails] Phase 1: ${this.edges.length} backbone trails, ${this.edges.reduce((s, e) => s + e.waypoints.length, 0)} waypoints`)
  }

  private mergePOIs(pois: POI[]): POI[] {
    const minDist = TRAIL_CONFIG.minPOIDistance
    const minDistSq = minDist * minDist
    const merged: POI[] = []

    for (const poi of pois) {
      let tooClose = false
      for (const existing of merged) {
        const dx = poi.position.x - existing.position.x
        const dz = poi.position.z - existing.position.z
        if (dx * dx + dz * dz < minDistSq) {
          tooClose = true
          break
        }
      }
      if (!tooClose) merged.push(poi)
    }

    return merged
  }

  private buildBackbone(pois: POI[], biomeMap: BiomeMap) {
    const maxDist = TRAIL_CONFIG.maxDistance
    const maxDistSq = maxDist * maxDist
    const maxConn = TRAIL_CONFIG.maxConnections
    const connectionCount = new Map<number, number>()

    // Build candidate edges sorted by distance
    const candidates: { i: number; j: number; distSq: number }[] = []
    for (let i = 0; i < pois.length; i++) {
      for (let j = i + 1; j < pois.length; j++) {
        const dx = pois[i].position.x - pois[j].position.x
        const dz = pois[i].position.z - pois[j].position.z
        const distSq = dx * dx + dz * dz
        if (distSq <= maxDistSq) {
          candidates.push({ i, j, distSq })
        }
      }
    }

    candidates.sort((a, b) => a.distSq - b.distSq)

    for (const { i, j } of candidates) {
      const ci = connectionCount.get(i) ?? 0
      const cj = connectionCount.get(j) ?? 0
      if (ci >= maxConn || cj >= maxConn) continue

      const a = pois[i].position
      const b = pois[j].position

      const waypoints = findTrailPath(a.x, a.z, b.x, b.z, biomeMap)
      if (!waypoints || waypoints.length < 2) continue

      this.edges.push({ waypoints })
      connectionCount.set(i, ci + 1)
      connectionCount.set(j, cj + 1)
    }
  }

  private buildChunkIndex() {
    this.chunkIndex.clear()
    for (const edge of this.edges) {
      // Index each edge into every chunk it passes through
      const chunks = new Set<string>()
      for (const wp of edge.waypoints) chunks.add(`${wp.cx},${wp.cz}`)
      for (const key of chunks) {
        let arr = this.chunkIndex.get(key)
        if (!arr) {
          arr = []
          this.chunkIndex.set(key, arr)
        }
        arr.push(edge)
      }
    }
  }

  getEdgesForChunk(cx: number, cz: number): TrailEdge[] {
    return this.chunkIndex.get(`${cx},${cz}`) ?? []
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/traversal/TrailNetwork.ts src/npcs/NPCHouses.ts
git commit -m "feat(trails): TrailNetwork Phase 1 — backbone trails between landmarks/NPCs/portals"
```

---

### Task 4: TrailRenderer — biome-styled trail geometry

**Files:**
- Create: `src/traversal/TrailRenderer.ts`

- [ ] **Step 1: Create TrailRenderer.ts**

Follow the same pattern as `RoadRenderer.ts` but narrower, thinner, ground-hugging.

```typescript
import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import type { BiomeMap } from '../world/BiomeMap'
import type { MaterialCache } from '../utils/MaterialCache'
import type { TrailWaypoint, TrailStyle } from './traversalTypes'
import type { WalkableBox } from '../world/Chunk'
import { CHUNK_SIZE, WATER_LEVEL } from '../world/TerrainGenerator'

function getTrailStyle(biome: BiomeType): TrailStyle {
  switch (biome) {
    case BiomeType.Forest:
      return { color: 0x8a6838, tex: 'sand', w: 2.5, h: 0.2, elevated: false }
    case BiomeType.Desert:
      return { color: 0xb09868, tex: 'sand', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Jungle:
      return { color: 0x5a4020, tex: 'sand', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Swamp:
      return { color: 0x7a5228, tex: 'wood', w: 2.5, h: 0.25, elevated: true }
    case BiomeType.Volcanic:
      return { color: 0x3a3a3a, tex: 'slate', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Snow:
      return { color: 0xd8d8e0, tex: 'ice', w: 2.5, h: 0.15, elevated: false }
    case BiomeType.Crystal:
      return { color: 0x88aacc, tex: 'ice', w: 2.0, h: 0.2, elevated: false, emissive: 0x224466 }
    case BiomeType.Heaven:
      return { color: 0xeeeeff, tex: 'stone', w: 2.5, h: 0.2, elevated: false, emissive: 0x556688 }
    case BiomeType.Hell:
      return { color: 0x3a1810, tex: 'slate', w: 2.0, h: 0.2, elevated: false }
    case BiomeType.Mesa:
      return { color: 0xc08050, tex: 'sand', w: 2.5, h: 0.2, elevated: false }
    case BiomeType.CoralReef:
      return { color: 0xdd8899, tex: 'stone', w: 2.0, h: 0.25, elevated: true }
    default:
      return { color: 0x888888, tex: 'stone', w: 2.0, h: 0.2, elevated: false }
  }
}

/**
 * Build trail segment geometry for waypoints within a chunk.
 * Returns meshes and walkable surfaces, same pattern as buildRoadSegments.
 */
export function buildTrailSegments(
  cx: number,
  cz: number,
  edges: TrailEdge[],
  biomeMap: BiomeMap,
  matCache: MaterialCache,
  group: THREE.Group,
): { meshes: THREE.Object3D[]; walkables: WalkableBox[] } {
  const meshes: THREE.Object3D[] = []
  const walkables: WalkableBox[] = []
  const chunkOffX = cx * CHUNK_SIZE
  const chunkOffZ = cz * CHUNK_SIZE

  // Iterate each edge's waypoints — consecutive pairs within an edge are trail segments
  for (const edge of edges) {
  const waypoints = edge.waypoints
  for (let i = 0; i < waypoints.length - 1; i++) {
    const a = waypoints[i]
    const b = waypoints[i + 1]

    // Skip if neither endpoint is in this chunk
    const aInChunk = a.cx === cx && a.cz === cz
    const bInChunk = b.cx === cx && b.cz === cz
    if (!aInChunk && !bInChunk) continue

    // Skip if segment is too long (discontinuity between edges)
    const segDx = b.x - a.x
    const segDz = b.z - a.z
    const segLen = Math.sqrt(segDx * segDx + segDz * segDz)
    if (segLen > 12 || segLen < 0.5) continue

    const style = getTrailStyle(a.biome)
    const trailW = style.w
    const trailH = style.h

    // Midpoint and direction
    const mx = (a.x + b.x) * 0.5 - chunkOffX
    const mz = (a.z + b.z) * 0.5 - chunkOffZ
    const angle = Math.atan2(segDx, segDz)

    // Y positioning: ground-hugging or elevated
    let my: number
    if (style.elevated) {
      my = Math.max(WATER_LEVEL + 0.3, (a.y + b.y) * 0.5) + 0.1
    } else {
      my = (a.y + b.y) * 0.5 + 0.1
    }

    // Slope angle
    const slopeAngle = Math.atan2(b.y - a.y, segLen)

    // Material
    const matOpts: Record<string, unknown> = {}
    if (style.emissive) matOpts.emissive = style.emissive
    const mat = matCache.getLambert(style.color, matOpts)

    // Plank geometry
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(trailW, trailH, segLen + 0.5),
      mat,
    )
    plank.position.set(mx, my + trailH / 2, mz)
    plank.rotation.y = angle
    plank.rotation.x = slopeAngle
    group.add(plank)
    meshes.push(plank)

    // WalkableBox (conservative AABB)
    const cos = Math.abs(Math.cos(angle))
    const sin = Math.abs(Math.sin(angle))
    const halfW = trailW / 2
    const halfL = (segLen + 0.5) / 2
    const aabbHalfX = halfW * cos + halfL * sin
    const aabbHalfZ = halfW * sin + halfL * cos
    const worldMx = mx + chunkOffX
    const worldMz = mz + chunkOffZ
    walkables.push({
      minX: worldMx - aabbHalfX,
      maxX: worldMx + aabbHalfX,
      minZ: worldMz - aabbHalfZ,
      maxZ: worldMz + aabbHalfZ,
      y: my + trailH,
    })

    // Elevated mode: add support posts
    if (style.elevated && my > a.y + 1) {
      const postMat = matCache.getLambert(0x5a3a1a, {})
      const postH = my - Math.min(a.y, b.y)
      const post = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, postH, 0.3),
        postMat,
      )
      post.position.set(mx, my - postH / 2, mz)
      group.add(post)
      meshes.push(post)
    }
  }

  } // end edge loop
  return { meshes, walkables }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors (may need to export WalkableBox interface from Chunk.ts if not already exported — check and fix)

- [ ] **Step 3: Commit**

```bash
git add src/traversal/TrailRenderer.ts
git commit -m "feat(trails): TrailRenderer with biome-styled ground-hugging trail geometry"
```

---

### Task 5: Wire TrailNetwork into Engine and World

**Files:**
- Modify: `src/engine/Engine.ts` — instantiate TrailNetwork after RoadNetwork, pass to World
- Modify: `src/world/World.ts` — receive TrailNetwork, pass to Chunk
- Modify: `src/world/Chunk.ts` — render backbone trail segments during chunk build

- [ ] **Step 1: Add TrailNetwork to Engine.ts**

Find where PortalNetwork is instantiated (around line 263). **After** it (not after RoadNetwork — PortalNetwork must exist first), add:

```typescript
// Trail network — POI-to-POI paths along terrain contours
import { TrailNetwork } from '../traversal/TrailNetwork'

const housePositions = this.npcManager?.npcHouses ? this.npcManager.npcHouses.getHousePositions() : []
const portalPositions = this.portalNetwork ? this.portalNetwork.getPortalPositions() : []
this.trailNetwork = new TrailNetwork(
  this.landmarkManager.positions,
  housePositions,
  portalPositions,
  this.biomeMap,
)
this.world.setTrailNetwork(this.trailNetwork)
```

Add the property: `private trailNetwork!: TrailNetwork`

- [ ] **Step 2: Add setTrailNetwork to World.ts**

Following the `setRoadNetwork` pattern:

```typescript
private trailNetwork: TrailNetwork | null = null

setTrailNetwork(tn: TrailNetwork) {
  this.trailNetwork = tn
}
```

Import TrailNetwork. Pass `this.trailNetwork` to the Chunk constructor (add as another optional parameter after `roadNetwork`).

- [ ] **Step 3: Update Chunk constructor and build to render trail segments**

Add `trailNetwork?: TrailNetwork | null` parameter to both the constructor and `build()` method. In `build()`, after the road segment rendering block, add:

```typescript
if (TRAIL_CONFIG.enableTrails && trailNetwork && this.heightGrid) {
  const trailEdges = trailNetwork.getEdgesForChunk(this.cx, this.cz)
  if (trailEdges.length > 0) {
    const result = buildTrailSegments(this.cx, this.cz, trailEdges, biomeMap, this.matCache, this.group)
    for (const m of result.meshes) this.extras.push(m)
    for (const w of result.walkables) this.walkableSurfaces.push(w)
  }
}
```

Import `buildTrailSegments` from `'../traversal/TrailRenderer'` and `TRAIL_CONFIG` from `'../config'`.

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Manual test**

Run `npm run dev`, open browser at localhost:3000. Walk around and verify:
- Trail geometry appears connecting landmarks and NPC houses
- Trails are narrower than roads and ground-hugging
- Trails have biome-appropriate colors
- Walking on trails works (WalkableBox collision)
- No console errors

- [ ] **Step 6: Commit**

```bash
git add src/engine/Engine.ts src/world/World.ts src/world/Chunk.ts
git commit -m "feat(trails): wire TrailNetwork into Engine → World → Chunk pipeline"
```

---

### Task 6: Phase 2 — connector trails from local POIs

**Files:**
- Modify: `src/traversal/TrailNetwork.ts` — add `generateConnectorTrails()` method
- Modify: `src/world/Chunk.ts` — call connector trail generation during build

- [ ] **Step 1: Add sampleChunkPOIs and generateConnectorTrails to TrailNetwork.ts**

Add a static method that deterministically finds POI positions in a chunk using the same seed logic as lore stones and structure placement:

```typescript
import { SeededRandom, chunkSeed } from '../utils/SeededRandom'

/**
 * Deterministically sample likely POI positions in a chunk.
 * Uses same seed patterns as structure placement to find where
 * structures would be placed, without building geometry.
 */
static sampleChunkPOIs(cx: number, cz: number, biomeMap: BiomeMap): THREE.Vector3[] {
  const pois: THREE.Vector3[] = []
  const rng = new SeededRandom(chunkSeed(cx, cz, 9999))

  // Sample 6-8 candidate positions within chunk (mimics structure placement density)
  const count = 6 + Math.floor(rng.next() * 3)
  for (let i = 0; i < count; i++) {
    const wx = cx * CHUNK_SIZE + rng.range(8, CHUNK_SIZE - 8)
    const wz = cz * CHUNK_SIZE + rng.range(8, CHUNK_SIZE - 8)
    const wy = sampleWorldHeight(wx, wz, biomeMap)

    // Skip underwater positions
    if (wy < WATER_LEVEL + 0.5) continue

    // Skip positions in Heaven/Hell
    const biome = biomeMap.getBiomeAt(wx, wz)
    if (biome === BiomeType.Heaven || biome === BiomeType.Hell) continue

    pois.push(new THREE.Vector3(wx, wy, wz))
  }

  return pois
}

/**
 * Generate short connector trails from local POIs to nearest backbone waypoint.
 * Called per-chunk during chunk generation.
 */
generateConnectorTrails(cx: number, cz: number, biomeMap: BiomeMap): TrailEdge[] {
  const localPOIs = TrailNetwork.sampleChunkPOIs(cx, cz, biomeMap)
  if (localPOIs.length === 0) return []

  // Find backbone waypoints near this chunk (search 2-chunk radius)
  const nearbyBackbone: TrailWaypoint[] = []
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      const wps = this.getWaypointsForChunk(cx + dx, cz + dz)
      nearbyBackbone.push(...wps)
    }
  }

  const connectorEdges: TrailEdge[] = []
  const maxConnDist = 80 // shorter than backbone max distance

  for (const poi of localPOIs) {
    // Find nearest backbone waypoint
    let nearestDist = Infinity
    let nearestWp: TrailWaypoint | null = null
    for (const wp of nearbyBackbone) {
      const dx = poi.x - wp.x
      const dz = poi.z - wp.z
      const d = dx * dx + dz * dz
      if (d < nearestDist) {
        nearestDist = d
        nearestWp = wp
      }
    }

    if (!nearestWp || nearestDist > maxConnDist * maxConnDist) continue

    const path = findTrailPath(poi.x, poi.z, nearestWp.x, nearestWp.z, biomeMap)
    if (path && path.length >= 2) {
      connectorEdges.push({ waypoints: path })
    }
  }

  return connectorEdges
}
```

- [ ] **Step 2: Call connector trail generation in Chunk.ts**

After the backbone trail rendering block added in Task 5, add:

```typescript
// Phase 2: connector trails from local POIs
if (TRAIL_CONFIG.enableTrails && trailNetwork) {
  const connectorEdges = trailNetwork.generateConnectorTrails(this.cx, this.cz, biomeMap)
  if (connectorEdges.length > 0) {
    const result = buildTrailSegments(this.cx, this.cz, connectorEdges, biomeMap, this.matCache, this.group)
    for (const m of result.meshes) this.extras.push(m)
    for (const w of result.walkables) this.walkableSurfaces.push(w)
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Manual test**

Run `npm run dev`. Verify:
- Short trail segments appear near structures and lore stones
- Connector trails visually connect to the backbone network
- Trail density feels appropriate (trails visible from most locations)
- No performance degradation (check FPS counter)

- [ ] **Step 5: Commit**

```bash
git add src/traversal/TrailNetwork.ts src/world/Chunk.ts
git commit -m "feat(trails): Phase 2 connector trails from local POIs to backbone"
```

---

### Task 7: Add trail toggle to debug panel

**Files:**
- Modify: `src/debug/DebugPanel.ts` — add enable/disable toggle for trails

- [ ] **Step 1: Add trail toggle to DebugPanel.ts**

Find the WORLD section where the draw distance sliders are. Add after them:

```typescript
panel.appendChild(slider('Trail density', 0, 10, 1, TRAIL_CONFIG.maxConnections,
  v => { TRAIL_CONFIG.maxConnections = Math.round(v) }, true))
```

Import TRAIL_CONFIG in the imports at the top.

Also add a checkbox or slider for enable/disable:

```typescript
panel.appendChild(slider('Trails', 0, 1, 1, TRAIL_CONFIG.enableTrails ? 1 : 0,
  v => { TRAIL_CONFIG.enableTrails = v > 0.5 }, true))
```

Note: the `true` flag on these sliders means they require reload to take effect.

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/debug/DebugPanel.ts
git commit -m "feat(trails): add trail toggle and density slider to debug panel"
```

---

### Task 8: Final integration test and cleanup

**Files:**
- All modified files — verify end-to-end

- [ ] **Step 1: Full compilation check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run the game and test thoroughly**

Run `npm run dev`. Test:
- Walk the world for 3-5 minutes across multiple biomes
- Verify trails appear in all non-Heaven/Hell biomes
- Verify trail colors match biome themes
- Verify walking on trails is smooth (WalkableBox working)
- Verify trails route around steep terrain (not up cliffs)
- Verify swamp trails are elevated boardwalk style
- Toggle trails off in debug panel, reload, verify they disappear
- Check FPS is stable (60fps target)
- Check draw call count hasn't exploded (compare to before)

- [ ] **Step 3: Fix any issues found during testing**

Address any visual glitches, collision problems, or performance issues.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(trails): trail network — dense biome-themed paths connecting POIs"
```
