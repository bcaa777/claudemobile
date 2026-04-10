import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Merges all static Mesh children in a group by material,
 * replacing many individual meshes with a few merged ones.
 * Skips Points, Lights, and other non-Mesh objects.
 */
export function mergeStaticMeshes(group: THREE.Group): void {
  group.updateMatrixWorld(true)
  const groupInverse = new THREE.Matrix4().copy(group.matrixWorld).invert()
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  const toRemove: THREE.Mesh[] = []

  group.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return
    child.updateMatrixWorld(true)
    const rel = new THREE.Matrix4().multiplyMatrices(groupInverse, child.matrixWorld)
    const geo = child.geometry.clone()
    geo.applyMatrix4(rel)

    const mat = child.material as THREE.Material
    let bucket = buckets.get(mat)
    if (!bucket) { bucket = []; buckets.set(mat, bucket) }
    bucket.push(geo)
    toRemove.push(child)
  })

  for (const m of toRemove) {
    m.parent?.remove(m)
    m.geometry.dispose()
  }

  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false)
    if (merged) group.add(new THREE.Mesh(merged, mat))
    for (const g of geos) g.dispose()
  }
}
