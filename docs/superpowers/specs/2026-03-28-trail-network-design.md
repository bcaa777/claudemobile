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

## Architecture

### TrailNetwork (new system, parallel to RoadNetwork)

Computed in two phases:

**Phase 1 — Backbone trails (world init):**
Generate trails between global POIs known upfront:
- Landmarks (temples, pyramids, citadels)
- NPC houses (7 locations)
- Portals (wormhole entry points)

These form the long-distance trail backbone.

**Phase 2 — Connector trails (per-chunk generation):**
When a chunk generates, it discovers local POIs and generates short trails to the nearest backbone trail or nearby POI:
- Lore stones
- Rune stones
- Structures (chapels, ruins, wells, huts, tents, igloos, stone circles, etc.)

### POI Connection Strategy

- Each POI connects to up to **5 nearest** POIs within **150 units**
- POIs within 15 units of each other are merged (avoid micro-trails)
- Trail segments overlapping within 3 units for > 20 units are merged into one shared path
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

**Heuristic**: Euclidean distance to goal x minimum cost factor (admissible).

**Budget**: Max 2000 nodes per trail. If exceeded, trail is not generated.

**Post-processing**:
- Moving average smoothing on waypoint positions (window=5)
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

## File Structure

New files:
- `src/traversal/TrailNetwork.ts` — graph building, A* pathfinding, waypoint storage
- `src/traversal/TrailRenderer.ts` — trail geometry, biome styles, WalkableBox registration

Modified files:
- `src/engine/Engine.ts` — instantiate TrailNetwork, pass to World
- `src/world/World.ts` — pass TrailNetwork to chunks
- `src/world/Chunk.ts` — render Phase 2 connector trails during chunk build
- `src/config.ts` — add TRAIL_CONFIG with enable flag and density controls

## Performance Considerations

- Phase 1 pathfinding: ~10-20 backbone trails at world init, ~2000 nodes max each = lightweight
- Phase 2 pathfinding: ~5-10 short connector trails per chunk, smaller search grids
- Trail geometry: narrow planks = fewer triangles than roads
- WalkableBox count: increases proportionally but boxes are small (cheap collision checks)
