import * as THREE from 'three'

export class MaterialCache {
  private cache: Map<string, THREE.MeshLambertMaterial> = new Map()

  getLambert(color: number, opts?: {
    transparent?: boolean
    opacity?: number
    side?: THREE.Side
    emissive?: THREE.ColorRepresentation
    emissiveIntensity?: number
    depthWrite?: boolean
    fog?: boolean
  }): THREE.MeshLambertMaterial {
    const key = `${color}_${opts?.transparent ?? false}_${opts?.opacity ?? 1}_${opts?.side ?? THREE.FrontSide}_${opts?.emissive ?? 0}_${opts?.emissiveIntensity ?? 1}_${opts?.depthWrite ?? true}_${opts?.fog ?? true}`

    let mat = this.cache.get(key)
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ color, ...opts })
      this.cache.set(key, mat)
    }
    return mat
  }

  dispose() {
    for (const mat of this.cache.values()) mat.dispose()
    this.cache.clear()
  }
}
