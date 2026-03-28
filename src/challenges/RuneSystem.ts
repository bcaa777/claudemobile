import * as THREE from 'three'
import { BiomeType } from '../biomes/types'
import { BiomeMap } from '../world/BiomeMap'
import { sampleWorldHeight, WATER_LEVEL } from '../world/TerrainGenerator'
import { RuneStone } from './RuneStone'
import { RUNE_CHALLENGES, ChallengeContext, ChallengeProgress, createDefaultProgress } from './RuneChallenge'
import { RENDER_CONFIG } from '../config'

const INTERACT_DIST_SQ = 100 // 10^2
const STORAGE_KEY = 'rune_completed'

export class RuneSystem {
  private stones: RuneStone[] = []
  private progress: ChallengeProgress[] = []
  private completed: Set<number> = new Set()
  private scene: THREE.Scene
  private activeChallenge: number | null = null
  private runeHud: HTMLElement | null
  private challengeDesc: HTMLElement | null
  private allComplete = false
  private ghostSpawned = false

  constructor(scene: THREE.Scene, biomeMap: BiomeMap, landmarkPositions: Map<BiomeType, THREE.Vector3>) {
    this.scene = scene
    this.runeHud = document.getElementById('rune-hud')
    this.challengeDesc = document.getElementById('challenge-description')

    this.loadCompleted()

    // Place rune stones — one per biome, offset from landmarks
    for (let i = 0; i < RUNE_CHALLENGES.length; i++) {
      const def = RUNE_CHALLENGES[i]
      const lmPos = landmarkPositions.get(def.biome)
      if (!lmPos) {
        this.progress.push(createDefaultProgress())
        continue
      }

      // Place 30-50 units from landmark
      const angle = (def.biome * 137.5) * Math.PI / 180 // golden angle spread
      const dist = 35 + (def.biome % 3) * 5
      const x = lmPos.x + Math.cos(angle) * dist
      const z = lmPos.z + Math.sin(angle) * dist
      const y = sampleWorldHeight(x, z, biomeMap)
      const pos = new THREE.Vector3(x, Math.max(y, WATER_LEVEL + 0.5), z)

      const stone = new RuneStone(pos, def.biome, scene)
      if (this.completed.has(i)) {
        stone.setCompleted(scene)
      }
      this.stones.push(stone)
      this.progress.push(createDefaultProgress())
    }

    this.updateHud()
  }

  update(delta: number, ctx: ChallengeContext, consumeInteract: boolean): boolean {
    let justCompleted = false

    for (let i = 0; i < this.stones.length; i++) {
      const stone = this.stones[i]
      if (!stone) continue

      const dx = stone.position.x - ctx.playerPos.x
      const dz = stone.position.z - ctx.playerPos.z
      const distSq = dx * dx + dz * dz

      // Visibility — geometry draw distance
      const visDistSq = RENDER_CONFIG.drawGeometry ** 2
      stone.group.visible = distSq < visDistSq
      stone.update(delta)

      if (this.completed.has(i)) continue

      // Proximity interaction
      if (distSq < INTERACT_DIST_SQ) {
        if (!this.progress[i].active && consumeInteract) {
          this.progress[i].active = true
          this.activeChallenge = i
          this.showChallengeDesc(i)
        }

        // Check completion
        if (this.progress[i].active) {
          const def = RUNE_CHALLENGES[i]
          if (def.checkComplete(ctx, this.progress[i])) {
            this.completed.add(i)
            stone.setCompleted(this.scene)
            this.saveCompleted()
            this.updateHud()
            this.activeChallenge = null
            this.hideChallengeDesc()
            justCompleted = true

            // Check if all complete
            if (this.completed.size >= RUNE_CHALLENGES.length && !this.allComplete) {
              this.allComplete = true
            }
          } else {
            // Update progress display
            this.updateChallengeDesc(i)
          }
        }
      } else if (this.activeChallenge === i) {
        // Moved away from active challenge
        this.activeChallenge = null
        this.hideChallengeDesc()
      }
    }

    return justCompleted
  }

  isAllComplete(): boolean {
    return this.allComplete
  }

  shouldSpawnGhost(): boolean {
    if (this.ghostSpawned) return false
    if (this.allComplete) {
      this.ghostSpawned = true
      return true
    }
    return false
  }

  private showChallengeDesc(idx: number) {
    if (!this.challengeDesc) return
    const def = RUNE_CHALLENGES[idx]
    this.challengeDesc.style.display = 'block'
    this.challengeDesc.innerHTML = `<div style="color:#e8c060;font-size:0.7rem;letter-spacing:0.15em;margin-bottom:4px">RUNE CHALLENGE</div><div style="color:#ccc;font-size:0.75rem">${def.description}</div><div id="challenge-progress" style="color:#888;font-size:0.6rem;margin-top:4px"></div>`
  }

  private updateChallengeDesc(idx: number) {
    const el = document.getElementById('challenge-progress')
    if (!el) return
    const def = RUNE_CHALLENGES[idx]
    el.textContent = def.getProgressText(this.progress[idx])
  }

  private hideChallengeDesc() {
    if (this.challengeDesc) this.challengeDesc.style.display = 'none'
  }

  private updateHud() {
    if (this.runeHud) {
      this.runeHud.textContent = `RUNES ${this.completed.size} / ${RUNE_CHALLENGES.length}`
      this.runeHud.style.display = 'block'
    }
  }

  getMapMarkers(): { pos: THREE.Vector3; color: string; label: string; bright: boolean }[] {
    return this.stones.map((stone, i) => ({
      pos: stone.position,
      color: this.completed.has(i) ? '#ffdd44' : '#665533',
      label: 'R',
      bright: this.completed.has(i),
    }))
  }

  private saveCompleted() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.completed]))
    } catch { /* ignore */ }
  }

  private loadCompleted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const arr = JSON.parse(raw) as number[]
        for (const n of arr) this.completed.add(n)
      }
    } catch { /* ignore */ }
  }
}
