import { BiomeMap } from '../world/BiomeMap'
import { sampleWorldHeight, WATER_LEVEL, CHUNK_SIZE } from '../world/TerrainGenerator'
import { TRAIL_CONFIG } from '../config'
import { TrailWaypoint } from './traversalTypes'

// ─── Internal A* node ────────────────────────────────────────────────────────

interface AStarNode {
  gx: number  // grid x index
  gz: number  // grid z index
  g: number   // cost from start
  f: number   // g + heuristic
}

// ─── Binary min-heap (ordered by f) ──────────────────────────────────────────

function pushOpen(heap: AStarNode[], node: AStarNode): void {
  heap.push(node)
  let i = heap.length - 1
  while (i > 0) {
    const parent = (i - 1) >> 1
    if (heap[parent].f <= heap[i].f) break
    const tmp = heap[parent]
    heap[parent] = heap[i]
    heap[i] = tmp
    i = parent
  }
}

function popOpen(heap: AStarNode[]): AStarNode | undefined {
  const top = heap[0]
  const last = heap.pop()!
  if (heap.length > 0) {
    heap[0] = last
    let i = 0
    while (true) {
      const l = 2 * i + 1
      const r = 2 * i + 2
      let smallest = i
      if (l < heap.length && heap[l].f < heap[smallest].f) smallest = l
      if (r < heap.length && heap[r].f < heap[smallest].f) smallest = r
      if (smallest === i) break
      const tmp = heap[smallest]
      heap[smallest] = heap[i]
      heap[i] = tmp
      i = smallest
    }
  }
  return top
}

// ─── Main exported function ───────────────────────────────────────────────────

export function findTrailPath(
  startX: number, startZ: number,
  endX: number, endZ: number,
  biomeMap: BiomeMap,
): TrailWaypoint[] | null {
  const res = TRAIL_CONFIG.gridResolution
  const maxNodes = TRAIL_CONFIG.maxSearchNodes
  const slopeWalkable = TRAIL_CONFIG.slopeWalkable
  const slopeImpassable = TRAIL_CONFIG.slopeImpassable

  // ── 1. Grid setup ────────────────────────────────────────────────────────

  const minWX = Math.min(startX, endX)
  const maxWX = Math.max(startX, endX)
  const minWZ = Math.min(startZ, endZ)
  const maxWZ = Math.max(startZ, endZ)

  const spanX = maxWX - minWX
  const spanZ = maxWZ - minWZ
  const padX = spanX * 0.5
  const padZ = spanZ * 0.5

  const originX = minWX - padX
  const originZ = minWZ - padZ
  const extentX = maxWX + padX
  const extentZ = maxWZ + padZ

  const gridW = Math.ceil((extentX - originX) / res) + 1
  const gridH = Math.ceil((extentZ - originZ) / res) + 1

  // Pre-sample heightmap into Float32Array
  const heights = new Float32Array(gridW * gridH)
  for (let gz = 0; gz < gridH; gz++) {
    for (let gx = 0; gx < gridW; gx++) {
      const wx = originX + gx * res
      const wz = originZ + gz * res
      heights[gz * gridW + gx] = sampleWorldHeight(wx, wz, biomeMap)
    }
  }

  // Convert start/end world coords to grid coords (clamped)
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const sgx = clamp(Math.round((startX - originX) / res), 0, gridW - 1)
  const sgz = clamp(Math.round((startZ - originZ) / res), 0, gridH - 1)
  const egx = clamp(Math.round((endX - originX) / res), 0, gridW - 1)
  const egz = clamp(Math.round((endZ - originZ) / res), 0, gridH - 1)

  // ── 2. A* ────────────────────────────────────────────────────────────────

  const gCost   = new Float32Array(gridW * gridH).fill(Infinity)
  const parentX = new Int16Array(gridW * gridH).fill(-1)
  const parentZ = new Int16Array(gridW * gridH).fill(-1)
  const closed  = new Uint8Array(gridW * gridH)

  const startIdx = sgz * gridW + sgx
  gCost[startIdx] = 0

  const heuristic = (gx: number, gz: number): number => {
    const dx = (gx - egx) * res
    const dz = (gz - egz) * res
    return Math.sqrt(dx * dx + dz * dz)
  }

  const openHeap: AStarNode[] = []
  pushOpen(openHeap, { gx: sgx, gz: sgz, g: 0, f: heuristic(sgx, sgz) })

  const DIRS: Array<[number, number, number]> = [
    [ 1,  0, res],
    [-1,  0, res],
    [ 0,  1, res],
    [ 0, -1, res],
    [ 1,  1, res * 1.414],
    [ 1, -1, res * 1.414],
    [-1,  1, res * 1.414],
    [-1, -1, res * 1.414],
  ]

  let nodesExpanded = 0
  let found = false

  while (openHeap.length > 0) {
    const cur = popOpen(openHeap)!
    const curIdx = cur.gz * gridW + cur.gx

    if (closed[curIdx]) continue
    closed[curIdx] = 1
    nodesExpanded++

    if (nodesExpanded > maxNodes) return null

    if (cur.gx === egx && cur.gz === egz) {
      found = true
      break
    }

    const curHeight = heights[curIdx]

    for (const [dx, dz, hDist] of DIRS) {
      const nx = cur.gx + dx
      const nz = cur.gz + dz
      if (nx < 0 || nx >= gridW || nz < 0 || nz >= gridH) continue

      const nIdx = nz * gridW + nx
      if (closed[nIdx]) continue

      const nHeight = heights[nIdx]

      // Water check
      if (nHeight < WATER_LEVEL) continue

      // Slope check
      const heightDiff = Math.abs(nHeight - curHeight)
      const slope = heightDiff / hDist
      if (slope > slopeImpassable) continue

      // Step cost
      let stepCost = hDist
      if (slope >= slopeWalkable) {
        stepCost *= 3
      }
      // Mild valley preference
      stepCost += nHeight * 0.02

      const tentativeG = gCost[curIdx] + stepCost
      if (tentativeG < gCost[nIdx]) {
        gCost[nIdx] = tentativeG
        parentX[nIdx] = cur.gx
        parentZ[nIdx] = cur.gz
        pushOpen(openHeap, { gx: nx, gz: nz, g: tentativeG, f: tentativeG + heuristic(nx, nz) })
      }
    }
  }

  if (!found) return null

  // ── 3. Path reconstruction ───────────────────────────────────────────────

  const rawPath: TrailWaypoint[] = []
  let cx = egx
  let cz = egz

  while (!(cx === sgx && cz === sgz)) {
    const idx = cz * gridW + cx
    const wx = originX + cx * res
    const wz = originZ + cz * res
    const wy = heights[idx]
    const biome = biomeMap.getBiomeAt(wx, wz)
    const chunkX = Math.floor(wx / CHUNK_SIZE)
    const chunkZ = Math.floor(wz / CHUNK_SIZE)
    rawPath.push({ x: wx, y: wy, z: wz, biome, cx: chunkX, cz: chunkZ })
    const px = parentX[idx]
    const pz = parentZ[idx]
    cx = px
    cz = pz
  }

  // Push start
  {
    const wx = originX + sgx * res
    const wz = originZ + sgz * res
    const wy = heights[sgz * gridW + sgx]
    const biome = biomeMap.getBiomeAt(wx, wz)
    rawPath.push({ x: wx, y: wy, z: wz, biome, cx: Math.floor(wx / CHUNK_SIZE), cz: Math.floor(wz / CHUNK_SIZE) })
  }

  rawPath.reverse()

  // ── 4. Post-processing ───────────────────────────────────────────────────

  // Moving average smoothing on Y (window = 5, half = 2)
  const halfWin = 2
  const smoothed: TrailWaypoint[] = rawPath.map((wp, i) => {
    let sumY = 0
    let count = 0
    for (let j = Math.max(0, i - halfWin); j <= Math.min(rawPath.length - 1, i + halfWin); j++) {
      sumY += rawPath[j].y
      count++
    }
    return { ...wp, y: sumY / count }
  })

  // Remove collinear waypoints (cross product threshold > 0.5)
  if (smoothed.length < 3) return smoothed

  const result: TrailWaypoint[] = [smoothed[0]]
  for (let i = 1; i < smoothed.length - 1; i++) {
    const prev = smoothed[i - 1]
    const cur  = smoothed[i]
    const next = smoothed[i + 1]

    const ax = cur.x - prev.x
    const az = cur.z - prev.z
    const bx = next.x - cur.x
    const bz = next.z - cur.z

    const lenA = Math.sqrt(ax * ax + az * az)
    const lenB = Math.sqrt(bx * bx + bz * bz)

    if (lenA < 1e-6 || lenB < 1e-6) continue

    const cross = Math.abs((ax / lenA) * (bz / lenB) - (az / lenA) * (bx / lenB))
    if (cross > 0.5) {
      result.push(cur)
    }
  }
  result.push(smoothed[smoothed.length - 1])

  return result
}
