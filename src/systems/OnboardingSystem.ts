import * as THREE from 'three'
import { WorldState } from './WorldState'
import { WeatherType } from './WeatherSystem'

export interface OnboardingFlags {
  /** True once the player has walked 20+ units from spawn — HUD should show compass */
  showCompass: boolean
  /** When > 0, show "Journal Updated [J]" hint; counts down to 0 */
  journalHintTimer: number
  /** Extra opacity boost for compass pull dot (0 = normal, positive = boost) */
  compassPullBoost: number
  /** Time multiplier for DayNightCycle (1.0 = normal) */
  timeMultiplier: number
  /** True when onboarding is complete (all milestones or 30 min) */
  complete: boolean
}

export class OnboardingSystem {
  private milestones = {
    firstWalk: false,
    firstLoreStone: false,
    firstNPC: false,
    firstSiteVisit: false,
    firstWeather: false,
    firstCreatureBehavior: false,
    firstCompanion: false,
  }

  private playTime = 0
  private complete = false
  private spawnPos: THREE.Vector3
  private journalHintTimer = 0
  private prevLoreCount = 0
  private prevNPCTalked = false

  readonly flags: OnboardingFlags = {
    showCompass: false,
    journalHintTimer: 0,
    compassPullBoost: 0,
    timeMultiplier: 1.0,
    complete: false,
  }

  constructor(spawnPos: THREE.Vector3) {
    this.spawnPos = spawnPos.clone()
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    worldState: WorldState,
    currentWeather: WeatherType,
    companionBonded: boolean,
    loreCollectedCount: number,
    npcTalkedTo: boolean,
  ): void {
    if (this.complete) return

    this.playTime += dt

    // --- Check milestones ---

    // First walk: moved 20+ units from spawn
    if (!this.milestones.firstWalk) {
      const dx = playerPos.x - this.spawnPos.x
      const dz = playerPos.z - this.spawnPos.z
      if (dx * dx + dz * dz > 400) { // 20^2
        this.milestones.firstWalk = true
      }
    }

    // First lore stone collected
    if (!this.milestones.firstLoreStone && loreCollectedCount > this.prevLoreCount) {
      this.milestones.firstLoreStone = true
      this.journalHintTimer = 3.0 // show hint for 3 seconds
    }
    this.prevLoreCount = loreCollectedCount

    // First NPC interaction
    if (!this.milestones.firstNPC && npcTalkedTo && !this.prevNPCTalked) {
      this.milestones.firstNPC = true
    }
    this.prevNPCTalked = npcTalkedTo

    // First resonance site visit (within 50 units)
    if (!this.milestones.firstSiteVisit) {
      for (const [, site] of worldState.resonanceSites) {
        const sdx = site.position.x - playerPos.x
        const sdz = site.position.z - playerPos.z
        if (sdx * sdx + sdz * sdz < 2500) { // 50^2
          this.milestones.firstSiteVisit = true
          break
        }
      }
    }

    // First weather event (anything non-clear)
    if (!this.milestones.firstWeather && currentWeather !== WeatherType.Clear) {
      this.milestones.firstWeather = true
    }

    // First creature behavior near site (check ritualObservations)
    if (!this.milestones.firstCreatureBehavior) {
      for (const [, obs] of worldState.ritualObservations) {
        if (obs.creatureBehavior) {
          this.milestones.firstCreatureBehavior = true
          break
        }
      }
    }

    // First companion bonded
    if (!this.milestones.firstCompanion && companionBonded) {
      this.milestones.firstCompanion = true
    }

    // --- Update flags based on milestones and time ---

    // Compass visibility: show after first walk
    this.flags.showCompass = this.milestones.firstWalk

    // Journal hint countdown
    if (this.journalHintTimer > 0) {
      this.journalHintTimer -= dt
    }
    this.flags.journalHintTimer = Math.max(0, this.journalHintTimer)

    // Compass pull boost: if 10+ minutes and no site visit, boost pull dot opacity
    if (this.playTime > 600 && !this.milestones.firstSiteVisit) {
      this.flags.compassPullBoost = 0.4
    } else {
      this.flags.compassPullBoost = 0
    }

    // Time acceleration: if 15+ minutes and dusk hasn't happened yet
    // (timeOfDay starts at 0.4 ~morning, dusk is at 0.73-0.77)
    // If player hasn't seen dusk yet, gently accelerate
    if (this.playTime > 900 && worldState.timeOfDay < 0.73) {
      this.flags.timeMultiplier = 1.3
    } else {
      this.flags.timeMultiplier = 1.0
    }

    // --- Completion check ---
    const allMilestones = Object.values(this.milestones).every(v => v)
    if (allMilestones || this.playTime >= 1800) { // 30 minutes
      this.complete = true
      this.flags.complete = true
      this.flags.compassPullBoost = 0
      this.flags.timeMultiplier = 1.0
      this.flags.showCompass = true // ensure compass stays visible
    }
  }
}
