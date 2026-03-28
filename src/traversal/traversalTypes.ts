import * as THREE from 'three'
import { BiomeType } from '../biomes/types'

export interface RoadWaypoint {
  x: number
  y: number
  z: number
  biome: BiomeType
  /** Chunk coords this waypoint belongs to */
  cx: number
  cz: number
}

export interface RoadEdge {
  from: BiomeType
  to: BiomeType
  waypoints: RoadWaypoint[]
}

export interface TraversalAnchor {
  type: 'zipline' | 'vine'
  mesh: THREE.Mesh
  /** Start position (world space) */
  startPos: THREE.Vector3
  /** End position (world space) — for ziplines, the other end */
  endPos: THREE.Vector3
  /** Cable/vine waypoints for ride interpolation */
  cablePoints?: THREE.Vector3[]
  /** Top of vine for pendulum */
  vineTop?: THREE.Vector3
  ropeLength?: number
}

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

export interface LavaRockState {
  mesh: THREE.Mesh
  baseY: number
  sinkTimer: number
  resetting: boolean
  resetTimer: number
}
