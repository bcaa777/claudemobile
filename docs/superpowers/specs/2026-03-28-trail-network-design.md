# Trail Network Design

## Problem

The terrain generation creates dramatic, interesting landscapes but traversal is painful. High terracing (Snow/Crystal at 0.55 strength), steep mountain ridges, and raw terrain between roads force the player to constantly jump. This discourages exploration. The existing road system only connects biome centers, leaving most of the world without walkable paths.

## Solution

A dense, biome-themed trail network that connects points of interest (POIs) along terrain contours. Trails follow gentle slopes, routing around mountains and cliffs rather than over them. The dramatic terrain stays untouched — trails are an overlay that makes it navigable.

## Design Decisions

- **Trails are independent of roads** — they form their own network connecting POIs directly
- **Biome-themed appearance** — each biome has a distinct trail style (dirt, stone, boardwalk, etc.)
- **Dense coverage** — trails connect nearly everything; player can almost always find a trail within view
- **Avoid steep areas** — trails route around mountains and cliffs rather than over them
- **Keep dramatic terrain** — no changes to height generation, terracing, or terrain character
- **Heaven/Hell excluded** — these biomes are accessed via portals; trails do not enter them (slope thresholds make it impossible and portals are the intended access method)

## Architecture

### TrailNetwork (new system, parallel to RoadNetwork)

Computed in two phases:

**Phase 1 — Backbone trails (world init):**
Generate trails between global POIs known upfront:
- Landmarks (temples, pyramids, citadels) — from LandmarkManager.positions
- NPC houses (7 locations) — requires adding a public `getHousePositions()` accessor to NPCHouses
- Portals (wormhole entry points) — from PortalNetwork.getPortalPositions()

These form the long-distance trail backbone. Backbone trail waypoints are indexed by chunk (same pattern as RoadNetwork.chunkIndex) so each chunk only renders its local segments.

**Phase 2 — Connector trails (per-chunk generation):**
When a chunk generates, it discovers local POIs and generates short connector trails to the nearest backbone waypoint or nearby local POI.

**POI discovery mechanism**: Structure placement positions are derived deterministically using the same SeededRandom + biome checks that the build methods use, without actually building geometry. A new function `sampleChunkPOIs(cx, cz, biomeMap): Vector3[]` in TrailNetwork.ts re-derives candidate structure positions for a given chunk. This mirrors how RoadNetwork pre-computes waypoints independently of chunk build. Lore stone and rune stone positions are similarly deterministic from their seed logic.

**Height sampling**: Pathfinding uses `sampleWorldHeight(wx, wz, biomeMap)` which is a pure function that works at any world coordinate regardless of whether the chunk is loaded. Phase 2 pathfinding does not depend on chunk heightGrid data.

**Chunk-boundary ownership**: A trail is owned by the chunk containing its source POI. When a trail crosses into a neighboring chunk, waypoints are still indexed into both chunks (like roads), but generation is triggered only once from the source chunk.

**Disposal**: Phase 1 backbone trails are rendered per-chunk via chunk index (same as roads) — meshes are added to the chunk's group and disposed when the chunk unloads. Phase 2 connector trail meshes are stored in the chunk's extras array and follow the same disposal lifecycle.

### POI Connection Strategy

- Each POI connects to up to **5 nearest** POIs within **150 units**
- POIs within 15 units of each other are merged (avoid micro-trails)
- Trail segments overlapping within 3 units for > 20 units are merged into one shared path
- A* cost function adds mild penalty for proximity to road waypoints (< 8 units) to avoid visual overlap
- Expected density: ~8-15 trail segments visible at any time

### Pathfinding: Weighted A* on Sampled Grid

Runs at generation time, not real-time.

**Grid**: Sample world height every 4 units. Grid covers bounding box between two POIs, padded by 50% to allow routing around obstacles.

**Neighbors**: 8-directional (cardinal + diagonal). Diagonal cost = sqrt(2) x base cost.

**Cost function per step:**
- Base cost = horizontal distance (4 or 5.66 units)
- Slope factor = abs(heightDiff) / horizontalDist
  - slope < 0.3 (17 deg): no penalty (comfortable walk)
  - slope 0.3-0.5: cost x 3 (steep but passable)
  - slope > 0.5 (27 deg): impassable — forces routing around
- Water: if either cell below water level, impassable
- Height: mild preference for lower elevations to keep trails in valleys
- Road proximity: mild penalty when within 8 units of a road waypoint

**Heuristic**: Euclidean distance to goal x minimum cost factor (admissible).

**Budget**: Max 3000 nodes per trail (validated against max grid size: 150 units x 1.5 padding / 4 unit spacing = ~56x56 = ~3136 cells, so 3000 covers most cases). If exceeded, trail is not generated (acceptable — means terrain is truly impassable between those POIs).

**Post-processing**:
- Moving average smoothing on Y values only (window=5), matching road pattern — X/Z positions stay on their computed contour
- Remove redundant collinear waypoints

### Trail Rendering

Reuses the RoadRenderer plank/slab pattern but narrower and ground-hugging.

**Geometry:**
- Width: 2.0-2.5 units (vs 5-6 for roads)
- Thickness: 0.2 units (vs 0.5 for roads)
- Y position: terrain height + 0.1 (ground-hugging, no floating)
- Exception: Swamp/water areas use elevated boardwalk style

**Walkability:** Every trail segment registers a WalkableBox (same as roads).

### Biome Trail Styles

| Biome | Material | Width | Visual Character |
|-------|----------|-------|-----------------|
| Forest | Dirt (brown) | 2.5 | Packed earth with occasional flat stones |
| Desert | Sand-packed (tan) | 2.0 | Worn sand path, slightly raised edges |
| Jungle | Mud/roots (dark brown) | 2.0 | Narrow, winding, overgrown feel |
| Swamp | Wooden planks | 2.5 | Elevated mini-boardwalk |
| Volcanic | Basalt slabs (dark grey) | 2.0 | Cracked stone stepping path |
| Snow | Packed snow (off-white) | 2.5 | Compressed snow trail |
| Crystal | Polished crystal (tinted) | 2.0 | Glowing narrow walkway |
| Heaven | Cloud-stone (white) | 2.5 | Luminous floating path segments |
| Hell | Bone/obsidian (dark red) | 2.0 | Jagged but flat path |
| Mesa | Sandstone (orange) | 2.5 | Carved ledge path |
| Coral Reef | Shell/coral (pink) | 2.0 | Raised coral pathway |
| Savanna | Dry grass (yellow-brown) | 2.5 | Trampled grass path |
| Tundra | Frozen dirt (grey) | 2.5 | Permafrost trail |
| Mushroom | Mycelium (purple) | 2.0 | Spongy fungal path |
| Ash | Cinder (dark grey) | 2.0 | Ash-packed trail |
| Alpine | Gravel (grey-brown) | 2.5 | Mountain gravel path |
| Cliff | Slate (dark grey) | 2.0 | Narrow cliff-edge path |
| Floating | Cloud (white) | 2.0 | Floating stepping stones |
| Bog | Peat (dark brown) | 2.5 | Raised peat boardwalk |
| Badlands | Red clay (terracotta) | 2.0 | Eroded clay path |
| Taiga | Pine needles (red-brown) | 2.5 | Needle-covered trail |
| Oasis | Sandstone (warm tan) | 2.0 | Sandy garden path |
| **Fallback** | Stone (grey) | 2.0 | Generic stone path |

## Configuration

```typescript
export const TRAIL_CONFIG = {
  enableTrails:       true,   // master toggle
  maxConnections:     5,      // max trails per POI
  maxDistance:         150,    // max connection distance (world units)
  minPOIDistance:      15,     // merge POIs closer than this
  gridResolution:     4,      // A* grid cell size (world units)
  maxSearchNodes:     3000,   // A* budget per trail
  slopeWalkable:      0.3,    // slope below this = no penalty
  slopeImpassable:    0.5,    // slope above this = blocked
}
```

## File Structure

New files:
- `src/traversal/TrailNetwork.ts` — graph building, A* pathfinding, POI discovery, waypoint storage (chunk-indexed)
- `src/traversal/TrailRenderer.ts` — trail geometry, biome styles, WalkableBox registration
- Types (TrailWaypoint, TrailEdge, TrailStyle) added to `src/traversal/traversalTypes.ts`

Modified files:
- `src/engine/Engine.ts` — instantiate TrailNetwork, pass to World
- `src/world/World.ts` — pass TrailNetwork to chunks
- `src/world/Chunk.ts` — render Phase 2 connector trails during chunk build
- `src/config.ts` — add TRAIL_CONFIG
- `src/npcs/NPCHouses.ts` — add public `getHousePositions()` accessor

## Performance Considerations

- Phase 1 pathfinding: ~10-20 backbone trails at world init, ~3000 nodes max each = lightweight
- Phase 2 pathfinding: ~5-10 short connector trails per chunk, smaller search grids
- Trail geometry: narrow planks = fewer triangles than roads
- WalkableBox count: increases proportionally but boxes are small (cheap collision checks)
- Height sampling via sampleWorldHeight() is pure and fast (no chunk dependency)
