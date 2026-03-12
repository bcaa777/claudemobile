import * as THREE from 'three'

export class SpatialGrid<T extends { position: THREE.Vector3 }> {
  private cells: Map<number, T[]> = new Map()
  private cellSize: number
  flat: T[] = []

  constructor(cellSize = 32) {
    this.cellSize = cellSize
  }

  private key(x: number, z: number): number {
    const cx = Math.floor(x / this.cellSize)
    const cz = Math.floor(z / this.cellSize)
    return (cx << 16) | (cz & 0xFFFF)
  }

  clear() {
    this.cells.clear()
    this.flat.length = 0
  }

  insert(item: T) {
    this.flat.push(item)
    const k = this.key(item.position.x, item.position.z)
    let cell = this.cells.get(k)
    if (!cell) {
      cell = []
      this.cells.set(k, cell)
    }
    cell.push(item)
  }

  insertAll(items: Iterable<T>) {
    for (const item of items) this.insert(item)
  }

  queryRadius(center: THREE.Vector3, radius: number, filter?: (item: T) => boolean): T[] {
    const results: T[] = []
    const r2 = radius * radius
    const minCX = Math.floor((center.x - radius) / this.cellSize)
    const maxCX = Math.floor((center.x + radius) / this.cellSize)
    const minCZ = Math.floor((center.z - radius) / this.cellSize)
    const maxCZ = Math.floor((center.z + radius) / this.cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const cell = this.cells.get((cx << 16) | (cz & 0xFFFF))
        if (!cell) continue
        for (let i = 0; i < cell.length; i++) {
          const item = cell[i]
          const dx = item.position.x - center.x
          const dz = item.position.z - center.z
          if (dx * dx + dz * dz <= r2) {
            if (!filter || filter(item)) results.push(item)
          }
        }
      }
    }
    return results
  }

  queryNearest(center: THREE.Vector3, radius: number, filter?: (item: T) => boolean): T | null {
    let best: T | null = null
    let bestD2 = radius * radius
    const minCX = Math.floor((center.x - radius) / this.cellSize)
    const maxCX = Math.floor((center.x + radius) / this.cellSize)
    const minCZ = Math.floor((center.z - radius) / this.cellSize)
    const maxCZ = Math.floor((center.z + radius) / this.cellSize)

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const cell = this.cells.get((cx << 16) | (cz & 0xFFFF))
        if (!cell) continue
        for (let i = 0; i < cell.length; i++) {
          const item = cell[i]
          const dx = item.position.x - center.x
          const dz = item.position.z - center.z
          const d2 = dx * dx + dz * dz
          if (d2 < bestD2) {
            if (!filter || filter(item)) {
              bestD2 = d2
              best = item
            }
          }
        }
      }
    }
    return best
  }
}
