import * as THREE from 'three'
import type { ResonanceSite } from '../systems/WorldState'
import type { BiomeType } from '../biomes/types'

/**
 * Top-center compass strip that scrolls with camera yaw.
 * Shows N/S/E/W cardinal letters and a pull dot toward undiscovered resonance sites.
 */
export class CompassWidget {
  private container: HTMLDivElement
  private strip: HTMLDivElement
  private pullDot: HTMLDivElement
  private readonly STRIP_WIDTH = 280
  private readonly VISIBLE_WIDTH = 200
  private visible = true
  private pullBoost = 0

  constructor() {
    this.container = document.createElement('div')
    Object.assign(this.container.style, {
      position: 'absolute',
      top: '12px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: `${this.VISIBLE_WIDTH}px`,
      height: '18px',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: '20',
      opacity: '0',          // hidden until onboarding reveals it
      transition: 'opacity 1.5s',
    })

    // The strip is wider than the container; we scroll it
    this.strip = document.createElement('div')
    Object.assign(this.strip.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${this.STRIP_WIDTH * 2}px`, // double for wrapping
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      fontFamily: '"Courier New", monospace',
      fontSize: '11px',
      letterSpacing: '0.05em',
      color: 'rgba(255,255,255,0.35)',
      whiteSpace: 'nowrap',
    })

    // Build cardinal markers on the strip
    // The strip represents 360 degrees mapped to STRIP_WIDTH * 2 px
    // We render tick marks and cardinal letters
    this.buildStrip()

    this.container.appendChild(this.strip)

    // Pull dot — a small colored circle for nearby undiscovered resonance sites
    this.pullDot = document.createElement('div')
    Object.assign(this.pullDot.style, {
      position: 'absolute',
      top: '14px',
      width: '4px',
      height: '4px',
      borderRadius: '50%',
      background: 'rgba(120,200,255,0.7)',
      boxShadow: '0 0 6px rgba(120,200,255,0.5)',
      display: 'none',
      pointerEvents: 'none',
    })
    this.container.appendChild(this.pullDot)

    // Fade edges with a mask
    this.container.style.maskImage = 'linear-gradient(to right, transparent 0%, white 15%, white 85%, transparent 100%)'
    this.container.style.webkitMaskImage = 'linear-gradient(to right, transparent 0%, white 15%, white 85%, transparent 100%)'

    // Center line indicator
    const centerLine = document.createElement('div')
    Object.assign(centerLine.style, {
      position: 'absolute',
      top: '0',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '1px',
      height: '100%',
      background: 'rgba(255,255,255,0.25)',
      pointerEvents: 'none',
    })
    this.container.appendChild(centerLine)
  }

  private buildStrip(): void {
    // Create a canvas-like strip with tick marks
    // 360 degrees = STRIP_WIDTH px, repeated for seamless wrap
    const degsPerPx = 360 / this.STRIP_WIDTH
    const cardinals: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }
    const intercardinals: Record<number, string> = { 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }

    // We'll use absolute positioning within the strip
    this.strip.innerHTML = ''
    this.strip.style.position = 'relative'

    for (let repeat = 0; repeat < 2; repeat++) {
      const offset = repeat * this.STRIP_WIDTH
      for (let deg = 0; deg < 360; deg += 5) {
        const px = offset + (deg / 360) * this.STRIP_WIDTH
        const isCardinal = deg in cardinals
        const isIntercardinal = deg in intercardinals

        if (isCardinal || isIntercardinal) {
          const label = document.createElement('span')
          Object.assign(label.style, {
            position: 'absolute',
            left: `${px}px`,
            top: '0',
            transform: 'translateX(-50%)',
            fontSize: isCardinal ? '12px' : '9px',
            fontWeight: isCardinal ? 'bold' : 'normal',
            color: isCardinal ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)',
            textShadow: isCardinal ? '0 0 4px rgba(255,255,255,0.2)' : 'none',
          })
          label.textContent = isCardinal ? cardinals[deg] : intercardinals[deg]
          this.strip.appendChild(label)
        } else if (deg % 15 === 0) {
          // Small tick mark
          const tick = document.createElement('span')
          Object.assign(tick.style, {
            position: 'absolute',
            left: `${px}px`,
            top: '7px',
            width: '1px',
            height: '4px',
            background: 'rgba(255,255,255,0.15)',
          })
          this.strip.appendChild(tick)
        }
      }
    }
  }

  getElement(): HTMLDivElement {
    return this.container
  }

  setVisible(show: boolean): void {
    if (this.visible === show) return
    this.visible = show
    this.container.style.opacity = show ? '1' : '0'
    this.container.style.transition = 'opacity 1.5s'
  }

  setPullBoost(boost: number): void {
    this.pullBoost = boost
  }

  /**
   * @param yaw Camera yaw in radians (0 = +Z, increases clockwise looking down)
   * @param playerPos Player world position
   * @param resonanceSites Map of resonance sites from WorldState
   */
  update(
    yaw: number,
    playerPos: THREE.Vector3,
    resonanceSites: Map<BiomeType, ResonanceSite>,
  ): void {
    // Convert yaw to degrees (0=N, 90=E, 180=S, 270=W)
    // Camera yaw: 0 = looking along +Z (which is South in typical Three.js)
    // We map: yaw 0 = South (180 deg), yaw PI/2 = West (270 deg)
    let compassDeg = ((yaw * 180 / Math.PI) + 180) % 360
    if (compassDeg < 0) compassDeg += 360

    // Scroll strip so that compassDeg is centered
    const pxPerDeg = this.STRIP_WIDTH / 360
    const scrollX = compassDeg * pxPerDeg - this.VISIBLE_WIDTH / 2
    this.strip.style.transform = `translateX(${-scrollX}px)`

    // Pull dot — find nearest undiscovered resonance site within 200 units
    let closestAngle = -1
    let closestDist = 200 * 200

    for (const [, site] of resonanceSites) {
      if (site.activated) continue
      const dx = site.position.x - playerPos.x
      const dz = site.position.z - playerPos.z
      const distSq = dx * dx + dz * dz
      if (distSq < closestDist) {
        closestDist = distSq
        // Angle from player to site in compass degrees
        // atan2(dx, dz) gives angle from +Z axis
        const angleRad = Math.atan2(dx, dz)
        closestAngle = ((angleRad * 180 / Math.PI) + 180) % 360
        if (closestAngle < 0) closestAngle += 360
      }
    }

    if (closestAngle >= 0) {
      this.pullDot.style.display = 'block'
      // Position on compass: difference from current heading
      let diff = closestAngle - compassDeg
      if (diff > 180) diff -= 360
      if (diff < -180) diff += 360
      const dotPx = (this.VISIBLE_WIDTH / 2) + diff * pxPerDeg
      // Only show if within visible range
      if (dotPx >= 0 && dotPx <= this.VISIBLE_WIDTH) {
        this.pullDot.style.left = `${dotPx}px`
        const baseOpacity = 0.7 + this.pullBoost
        this.pullDot.style.opacity = `${Math.min(1, baseOpacity)}`
        // Scale up when boosted for extra visibility
        const scale = this.pullBoost > 0 ? 1.5 : 1
        this.pullDot.style.transform = `scale(${scale})`
      } else {
        this.pullDot.style.opacity = '0'
      }
    } else {
      this.pullDot.style.display = 'none'
    }
  }
}
