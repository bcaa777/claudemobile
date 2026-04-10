import * as THREE from 'three'
import { Creature } from '../creatures/Creature'
import { CreatureManager } from '../creatures/CreatureManager'
import { InputManager } from '../engine/InputManager'
import { FieldGuide } from '../fieldguide/FieldGuide'
import { getVariantId, getRarityColor } from '../creatures/CreatureVariant'
import { scorePhoto, PhotoResult } from './PhotoScoring'
import { BiomeType } from '../biomes/types'
import { WorldState } from '../systems/WorldState'

const CAMERA_SPEED_MULTIPLIER = 0.375
const DETECTION_RANGE = 50
const DETECTION_CONE = 0.5236  // 30 degrees in radians
const PHOTO_COOLDOWN = 0.5
const RESULT_DISPLAY_TIME = 3.0
const SIGHTING_RANGE = 20

export class CameraSystem {
  active = false
  lastResult: PhotoResult | null = null

  private cooldown = 0
  private resultTimer = 0
  private camera: THREE.Camera
  private creatureManager: CreatureManager
  private input: InputManager
  private fieldGuide: FieldGuide
  private currentBiome: BiomeType = BiomeType.Forest
  private worldState: WorldState | null = null
  private sightingTimer = 0

  private viewfinder: HTMLDivElement
  private resultCard: HTMLDivElement

  private _tmpFwd = new THREE.Vector3()
  private _tmpDir = new THREE.Vector3()

  constructor(
    camera: THREE.Camera,
    creatureManager: CreatureManager,
    input: InputManager,
    fieldGuide: FieldGuide,
  ) {
    this.camera = camera
    this.creatureManager = creatureManager
    this.input = input
    this.fieldGuide = fieldGuide

    // Build viewfinder overlay
    const vf = document.createElement('div')
    vf.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:50',
      'pointer-events:none',
      'display:none',
      'border:3px solid rgba(255,255,255,0.3)',
      'margin:40px',
      'box-shadow:inset 0 0 80px rgba(0,0,0,0.5)',
    ].join(';')

    // Crosshair
    const crosshair = document.createElement('div')
    crosshair.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:20px',
      'height:20px',
      'border-radius:50%',
      'border:2px solid rgba(255,255,255,0.8)',
    ].join(';')

    const dot = document.createElement('div')
    dot.style.cssText = [
      'position:absolute',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'width:4px',
      'height:4px',
      'border-radius:50%',
      'background:rgba(255,255,255,0.8)',
    ].join(';')
    crosshair.appendChild(dot)
    vf.appendChild(crosshair)

    // Hint
    const hint = document.createElement('div')
    hint.style.cssText = [
      'position:absolute',
      'bottom:12px',
      'right:12px',
      'color:rgba(255,255,255,0.6)',
      'font:11px monospace',
    ].join(';')
    hint.textContent = 'camera mode [X]'
    vf.appendChild(hint)

    const app = document.getElementById('app')
    if (app) app.appendChild(vf)
    this.viewfinder = vf

    // Build result card
    const card = document.createElement('div')
    card.style.cssText = [
      'position:fixed',
      'top:20%',
      'left:50%',
      'transform:translateX(-50%)',
      'z-index:55',
      'background:rgba(10,10,15,0.9)',
      'border:1px solid #d4a574',
      'padding:12px 20px',
      'font:12px monospace',
      'color:#d4a574',
      'display:none',
      'text-align:center',
      'min-width:200px',
    ].join(';')

    if (app) app.appendChild(card)
    this.resultCard = card
  }

  setBiome(biome: BiomeType): void {
    this.currentBiome = biome
  }

  setWorldState(ws: WorldState): void { this.worldState = ws }

  update(delta: number, playerPos: THREE.Vector3): void {
    if (this.input.consumeCameraToggle()) {
      this.active = !this.active
      this.viewfinder.style.display = this.active ? 'block' : 'none'
      if (!this.active) {
        this.resultCard.style.display = 'none'
      }
    }

    if (!this.active) return

    this.cooldown -= delta
    this.resultTimer -= delta

    if (this.resultTimer <= 0 && this.resultCard.style.display !== 'none') {
      this.resultCard.style.display = 'none'
    }

    this.sightingTimer -= delta
    if (this.sightingTimer <= 0) {
      this.registerNearbySightings(playerPos)
      this.sightingTimer = 1.5
    }

    if (this.input.consumeAttack() && this.cooldown <= 0) {
      this.takePhoto(playerPos)
      this.cooldown = PHOTO_COOLDOWN
    }
  }

  private registerNearbySightings(playerPos: THREE.Vector3): void {
    for (const creature of this.creatureManager.creatures.values()) {
      if (!creature.dna) continue
      const dist = creature.position.distanceTo(playerPos)
      if (dist < SIGHTING_RANGE) {
        const variantId = getVariantId(creature.dna)
        this.fieldGuide.registerSighting(
          variantId,
          creature.dna,
          creature.species,
          this.currentBiome,
        )
      }
    }
  }

  private takePhoto(playerPos: THREE.Vector3): void {
    this.camera.getWorldDirection(this._tmpFwd)

    let closest: Creature | null = null
    let closestDist = Infinity

    for (const creature of this.creatureManager.creatures.values()) {
      if (!creature.dna) continue
      if (creature.isEnemy) continue
      if (creature.state === 'dead') continue

      this._tmpDir.subVectors(creature.position, playerPos)
      const dist = this._tmpDir.length()
      if (dist >= DETECTION_RANGE) continue

      this._tmpDir.normalize()
      const dot = this._tmpDir.dot(this._tmpFwd)
      const angle = Math.acos(Math.min(1, Math.max(-1, dot)))
      if (angle >= DETECTION_CONE) continue

      if (dist < closestDist) {
        closestDist = dist
        closest = creature
      }
    }

    if (!closest || !closest.dna) {
      this.showResult(null)
      return
    }

    const variantId = getVariantId(closest.dna)
    const isNew = !this.fieldGuide.isPhotographed(variantId)
    const result = scorePhoto(
      closest.dna,
      variantId,
      closest.species,
      closest.state,
      isNew,
    )

    this.fieldGuide.recordPhoto(
      variantId,
      closest.dna,
      closest.species,
      closest.state,
      result.finalScore,
      result.rarityTier,
      this.currentBiome,
    )

    const entry = this.fieldGuide.getEntry(variantId)
    if (this.worldState && entry) {
      this.worldState.addPhotoXP(
        result.rarityTier,
        result.isNewDiscovery,
        this.fieldGuide._lastTierChanged ? entry.tier : 0,
      )
    }

    this.lastResult = result
    this.showResult(result)
  }

  private showResult(result: PhotoResult | null): void {
    if (!result) {
      this.resultCard.innerHTML = '<div style="opacity:0.7">No creature in frame</div>'
      this.resultCard.style.display = 'block'
      this.resultTimer = 1.0
      return
    }

    const rarityColor = getRarityColor(result.rarityTier)
    const newBadge = result.isNewDiscovery
      ? ' <span style="color:#fff;background:#c3503f;padding:1px 5px;font-size:10px">NEW!</span>'
      : ''

    const stars = '★'.repeat(result.stars) + '☆'.repeat(5 - result.stars)

    this.resultCard.innerHTML = [
      `<div style="font-size:13px;margin-bottom:6px">${result.species}${newBadge}</div>`,
      `<div style="color:${rarityColor};margin-bottom:4px">${result.rarityTier.toUpperCase()}</div>`,
      `<div style="margin-bottom:4px">${result.behavior} <span style="opacity:0.7">×${result.behaviorMultiplier.toFixed(1)}</span></div>`,
      `<div style="font-size:16px;letter-spacing:2px">${stars}</div>`,
    ].join('')

    this.resultCard.style.display = 'block'
    this.resultTimer = RESULT_DISPLAY_TIME
  }

  getSpeedMultiplier(): number {
    return this.active ? CAMERA_SPEED_MULTIPLIER : 1.0
  }

  dispose(): void {
    this.viewfinder.remove()
    this.resultCard.remove()
  }
}
