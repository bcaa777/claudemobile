import type { MetaState } from '../state/MetaState'
import { UNDERGROUND_BIOME_ID, type UndergroundBiomeId } from './UndergroundBiomes'
import { saveMetaState } from '../state/SaveManager'

// Total surface biome count (Forest … Hell = 11)
const SURFACE_BIOME_COUNT = 11
const UNDERGROUND_IDS: UndergroundBiomeId[] = [
  UNDERGROUND_BIOME_ID.Caverns,
  UNDERGROUND_BIOME_ID.LavaTunnels,
  UNDERGROUND_BIOME_ID.CrystalDepths,
]

export class RestorationSystem {
  /**
   * Call after every expedition victory.  Marks worldRestored = true when all
   * surface biomes AND all underground biomes have been cleansed.
   */
  checkRestoration(metaState: MetaState): boolean {
    if (metaState.worldRestored) return false // already done

    const surfaceDone = metaState.cleansedBiomes.length >= SURFACE_BIOME_COUNT
    const undergroundDone = UNDERGROUND_IDS.every(id =>
      (metaState.cleansedUnderground ?? []).includes(id),
    )

    if (surfaceDone && undergroundDone) {
      metaState.worldRestored = true
      saveMetaState(metaState)
      return true
    }
    return false
  }

  /** Mark an underground biome as cleansed and persist. */
  cleansedUnderground(metaState: MetaState, id: UndergroundBiomeId): void {
    if (!metaState.cleansedUnderground) metaState.cleansedUnderground = []
    if (!metaState.cleansedUnderground.includes(id)) {
      metaState.cleansedUnderground.push(id)
      saveMetaState(metaState)
    }
  }

  /** Play the "World Restored" hub celebration effect. */
  playRestorationEffect(scene: { add: (o: object) => void; remove: (o: object) => void }): void {
    // Dynamic import THREE lazily to keep this module lightweight
    import('three').then(({ PointLight, AmbientLight }) => {
      const golden = new PointLight(0xffd700, 6, 60)
      ;(golden as any).position?.set(0, 20, 0)
      scene.add(golden)

      const ambient = new AmbientLight(0xffd060, 0.8)
      scene.add(ambient)

      // Pulse and fade over 4 seconds
      let elapsed = 0
      const pulse = (dt: number) => {
        elapsed += dt
        const t = Math.min(elapsed / 4, 1)
        const intensity = 6 * Math.sin(Math.PI * t) * (1 - t * 0.5)
        ;(golden as any).intensity = intensity
        ;(ambient as any).intensity = 0.8 * (1 - t)
        if (t >= 1) {
          scene.remove(golden)
          scene.remove(ambient)
        }
      }

      // Attach to global update queue via a simple interval shim
      const intervalId = setInterval(() => {
        pulse(0.016)
        if (elapsed >= 4) clearInterval(intervalId)
      }, 16)
    })
  }

  /** Show a full-screen "World Restored" banner. */
  showRestorationBanner(): void {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 500;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.75);
      font-family: 'Courier New', monospace;
      pointer-events: none;
      animation: restoreFadeOut 5s forwards;
    `

    const style = document.createElement('style')
    style.textContent = `
      @keyframes restoreFadeOut {
        0%   { opacity: 0; }
        15%  { opacity: 1; }
        75%  { opacity: 1; }
        100% { opacity: 0; }
      }
    `
    document.head.appendChild(style)

    el.innerHTML = `
      <div style="color: #ffd700; font-size: 36px; letter-spacing: 8px; text-shadow: 0 0 30px #ffd700; margin-bottom: 16px;">
        ✦ WORLD RESTORED ✦
      </div>
      <div style="color: #ffeeaa; font-size: 15px; letter-spacing: 3px; text-shadow: 0 0 12px #ffcc00;">
        THE CORRUPTION HAS BEEN VANQUISHED
      </div>
    `

    document.body.appendChild(el)
    setTimeout(() => el.parentElement?.removeChild(el), 5200)
  }

  /**
   * Trigger prestige: increment level, reset progress, scale future enemy HP.
   * Persists immediately.
   */
  prestige(metaState: MetaState): void {
    metaState.prestigeLevel = (metaState.prestigeLevel ?? 0) + 1
    metaState.cleansedBiomes = []
    metaState.cleansedUnderground = []
    metaState.worldRestored = false
    saveMetaState(metaState)
  }

  /** HP multiplier for the current prestige level (1.5x per prestige). */
  static getPrestigeHpMultiplier(metaState: MetaState): number {
    const level = metaState.prestigeLevel ?? 0
    return Math.pow(1.5, level)
  }
}
