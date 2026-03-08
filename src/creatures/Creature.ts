import * as THREE from 'three'
import { SpeciesId } from './Species'

export type CreatureState =
  | 'idle' | 'wander' | 'seek_food' | 'eating'
  | 'seek_water' | 'drinking'
  | 'flee' | 'seek_mate' | 'courtship' | 'mating'
  | 'hunt' | 'chase' | 'attack'
  | 'sleep' | 'dead'

let _nextId = 0

export class Creature {
  id: string
  species: SpeciesId
  position: THREE.Vector3
  velocity: THREE.Vector3
  heading: number
  state: CreatureState
  scale: number
  age: number
  hunger: number
  thirst: number
  energy: number
  health: number
  reproductionCooldown: number
  stateTimer: number
  targetId: string | null   // creature id, or '__player__'
  targetPos: THREE.Vector3 | null
  hasMesh: boolean
  deathTimer: number

  constructor(species: SpeciesId, position: THREE.Vector3, startScale: number) {
    this.id = `c${_nextId++}`
    this.species = species
    this.position = position.clone()
    this.velocity = new THREE.Vector3()
    this.heading = Math.random() * Math.PI * 2
    this.state = 'idle'
    this.scale = startScale
    this.age = 0
    this.hunger = 0
    this.thirst = 0
    this.energy = 80
    this.health = 100
    this.reproductionCooldown = 60
    this.stateTimer = 0
    this.targetId = null
    this.targetPos = null
    this.hasMesh = false
    this.deathTimer = 0
  }
}
