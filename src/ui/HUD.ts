import * as THREE from 'three'
import { CompassWidget } from './CompassWidget'
import { CompanionIndicator, CompanionData } from './CompanionIndicator'
import type { ResonanceSite } from '../systems/WorldState'
import type { BiomeType } from '../biomes/types'

export interface HUDUpdateParams {
  playerHealth: number
  maxHealth: number
  cameraYaw: number
  companionData: CompanionData
  nearInteractable: boolean
  playerPos: THREE.Vector3
  resonanceSites: Map<BiomeType, ResonanceSite>
  activationMessage: string | null
  time: number // elapsed seconds
}

/**
 * Minimal floating HUD overlay.
 * No backgrounds or borders — just floating contextual elements.
 */
export class HUD {
  private container: HTMLDivElement
  private healthBar: HTMLDivElement
  private healthBarFill: HTMLDivElement
  private compass: CompassWidget
  private companion: CompanionIndicator
  private interactionPrompt: HTMLDivElement
  private activationMessageEl: HTMLDivElement

  private healthShowTime = -Infinity // time when health was last shown
  private healthOpacity = 0
  private lastActivationMessage: string | null = null

  constructor() {
    this.container = document.createElement('div')
    Object.assign(this.container.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '15',
    })

    // --- Compass (top-center) ---
    this.compass = new CompassWidget()
    this.container.appendChild(this.compass.getElement())

    // --- Companion indicator (bottom-left) ---
    this.companion = new CompanionIndicator()
    this.container.appendChild(this.companion.getElement())

    // --- Health bar (bottom-center, only when damaged) ---
    this.healthBar = document.createElement('div')
    Object.assign(this.healthBar.style, {
      position: 'absolute',
      bottom: '55px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '140px',
      height: '3px',
      background: 'rgba(0,0,0,0.3)',
      borderRadius: '2px',
      overflow: 'hidden',
      opacity: '0',
      transition: 'opacity 1s',
      pointerEvents: 'none',
    })

    this.healthBarFill = document.createElement('div')
    Object.assign(this.healthBarFill.style, {
      width: '100%',
      height: '100%',
      background: 'rgba(200,50,50,0.8)',
      borderRadius: '2px',
      transition: 'width 0.3s',
    })
    this.healthBar.appendChild(this.healthBarFill)
    this.container.appendChild(this.healthBar)

    // --- Interaction prompt (center-bottom, small "E") ---
    this.interactionPrompt = document.createElement('div')
    Object.assign(this.interactionPrompt.style, {
      position: 'absolute',
      top: '55%',
      left: '50%',
      transform: 'translate(-50%, 0)',
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      letterSpacing: '0.1em',
      color: 'rgba(232,192,96,0.7)',
      textShadow: '0 0 8px rgba(232,192,96,0.3)',
      pointerEvents: 'none',
      display: 'none',
    })
    this.interactionPrompt.textContent = '[ E ]'
    this.container.appendChild(this.interactionPrompt)

    // --- Activation message (center) ---
    this.activationMessageEl = document.createElement('div')
    Object.assign(this.activationMessageEl.style, {
      position: 'absolute',
      top: '30%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      letterSpacing: '0.2em',
      color: 'rgba(232,210,140,0.9)',
      textShadow: '0 0 16px rgba(232,210,140,0.5)',
      textAlign: 'center',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 1.5s',
      maxWidth: '80%',
      textTransform: 'uppercase',
    })
    this.container.appendChild(this.activationMessageEl)

    document.body.appendChild(this.container)
  }

  update(params: HUDUpdateParams): void {
    const {
      playerHealth,
      maxHealth,
      cameraYaw,
      companionData,
      nearInteractable,
      playerPos,
      resonanceSites,
      activationMessage,
      time,
    } = params

    // --- Compass ---
    this.compass.update(cameraYaw, playerPos, resonanceSites)

    // --- Companion indicator ---
    this.companion.update(companionData)

    // --- Health bar ---
    const healthPct = maxHealth > 0 ? playerHealth / maxHealth : 1
    if (healthPct < 1) {
      this.healthShowTime = time
      this.healthBarFill.style.width = `${healthPct * 100}%`
      this.healthBar.style.opacity = '1'
      this.healthBar.style.transition = 'opacity 0.3s'
    } else if (time - this.healthShowTime > 5) {
      // Fade out after 5 seconds at full health
      this.healthBar.style.transition = 'opacity 1s'
      this.healthBar.style.opacity = '0'
    }

    // --- Interaction prompt ---
    this.interactionPrompt.style.display = nearInteractable ? 'block' : 'none'

    // --- Activation message ---
    if (activationMessage && activationMessage !== this.lastActivationMessage) {
      this.activationMessageEl.textContent = activationMessage
      this.activationMessageEl.style.opacity = '1'
      this.lastActivationMessage = activationMessage
    } else if (!activationMessage && this.lastActivationMessage) {
      this.activationMessageEl.style.opacity = '0'
      this.lastActivationMessage = null
    }
  }

  dispose(): void {
    this.container.remove()
  }
}
