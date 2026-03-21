import * as THREE from 'three'
import { BiomeType } from '../biomes/types'

const MAX_CAMPFIRES = 3
const HEAL_RADIUS_SQ = 25 // 5^2
const HEAL_RATE = 10 // hp/s
const SMOKE_HEIGHT = 30
const STORAGE_KEY = 'campfires'

interface CampfireData {
  position: THREE.Vector3
  biomeName: string
  group: THREE.Group
  embers: THREE.Points
  smoke: THREE.Mesh
  emberPhases: Float32Array
}

export class CampfireSystem {
  private campfires: CampfireData[] = []
  private scene: THREE.Scene
  private fastTravelEl: HTMLElement | null
  private campfireHud: HTMLElement | null
  private isFastTravelOpen = false
  private onTeleport: ((pos: THREE.Vector3) => void) | null = null

  constructor(scene: THREE.Scene, onTeleport: (pos: THREE.Vector3) => void) {
    this.scene = scene
    this.onTeleport = onTeleport
    this.fastTravelEl = document.getElementById('fast-travel-overlay')
    this.campfireHud = document.getElementById('campfire-hud')
    this.loadSaved()
    this.updateHud()
  }

  get positions(): THREE.Vector3[] {
    return this.campfires.map(c => c.position)
  }

  isFastTravelActive(): boolean { return this.isFastTravelOpen }

  placeCampfire(playerPos: THREE.Vector3, biomeName: string, isGrounded: boolean): boolean {
    if (!isGrounded) return false

    // Check not too close to existing
    for (const cf of this.campfires) {
      const dx = cf.position.x - playerPos.x
      const dz = cf.position.z - playerPos.z
      if (dx * dx + dz * dz < 16) return false // 4^2
    }

    // Remove oldest if at limit
    if (this.campfires.length >= MAX_CAMPFIRES) {
      const oldest = this.campfires.shift()!
      this.scene.remove(oldest.group)
    }

    const pos = playerPos.clone()
    pos.y -= 1.5 // Place at feet
    const data = this.createCampfire(pos, biomeName)
    this.campfires.push(data)
    this.save()
    this.updateHud()
    return true
  }

  openFastTravel(playerPos: THREE.Vector3): boolean {
    if (this.campfires.length < 2) return false

    // Must be near a campfire
    let nearCampfire = false
    for (const cf of this.campfires) {
      const dx = cf.position.x - playerPos.x
      const dz = cf.position.z - playerPos.z
      if (dx * dx + dz * dz < HEAL_RADIUS_SQ * 4) {
        nearCampfire = true
        break
      }
    }
    if (!nearCampfire) return false

    this.isFastTravelOpen = true
    this.showFastTravelUI(playerPos)
    return true
  }

  closeFastTravel() {
    this.isFastTravelOpen = false
    if (this.fastTravelEl) {
      this.fastTravelEl.style.display = 'none'
    }
  }

  private showFastTravelUI(playerPos: THREE.Vector3) {
    if (!this.fastTravelEl) return
    this.fastTravelEl.style.display = 'block'

    let html = '<div style="color:#e8c060;font-size:0.8rem;margin-bottom:8px;letter-spacing:0.15em">FAST TRAVEL</div>'
    for (let i = 0; i < this.campfires.length; i++) {
      const cf = this.campfires[i]
      const dx = cf.position.x - playerPos.x
      const dz = cf.position.z - playerPos.z
      const isNear = dx * dx + dz * dz < HEAL_RADIUS_SQ * 4
      if (!isNear) {
        const dist = Math.round(Math.sqrt(dx * dx + dz * dz))
        html += `<div class="ft-option" data-idx="${i}" style="padding:6px 12px;margin:4px 0;cursor:pointer;color:#ccc;border:1px solid #665533;border-radius:3px">${cf.biomeName} (${dist}u)</div>`
      }
    }
    html += '<div style="color:#666;font-size:0.6rem;margin-top:8px;letter-spacing:0.1em">[T] Close</div>'
    this.fastTravelEl.innerHTML = html

    // Add click handlers
    const options = this.fastTravelEl.querySelectorAll('.ft-option')
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        const idx = parseInt((opt as HTMLElement).dataset.idx || '0')
        this.teleportTo(idx)
      })
    })
  }

  private teleportTo(idx: number) {
    const cf = this.campfires[idx]
    if (cf && this.onTeleport) {
      this.onTeleport(new THREE.Vector3(cf.position.x, cf.position.y + 3, cf.position.z))
    }
    this.closeFastTravel()
  }

  update(delta: number, playerPos: THREE.Vector3): number {
    let healAmount = 0

    for (const cf of this.campfires) {
      const dx = cf.position.x - playerPos.x
      const dz = cf.position.z - playerPos.z
      const distSq = dx * dx + dz * dz

      // Heal when near
      if (distSq < HEAL_RADIUS_SQ) {
        healAmount += HEAL_RATE * delta
      }

      // Animate embers
      const positions = cf.embers.geometry.getAttribute('position') as THREE.BufferAttribute
      const count = positions.count
      for (let i = 0; i < count; i++) {
        let y = positions.getY(i)
        y += delta * (1.5 + cf.emberPhases[i] * 0.5)
        if (y > cf.position.y + 3) {
          y = cf.position.y + 0.3
          positions.setX(i, cf.position.x + (Math.random() - 0.5) * 0.8)
          positions.setZ(i, cf.position.z + (Math.random() - 0.5) * 0.8)
        }
        positions.setY(i, y)
      }
      positions.needsUpdate = true

      // Smoke column sway
      cf.smoke.position.x = cf.position.x + Math.sin(Date.now() * 0.001) * 0.5
      cf.smoke.position.z = cf.position.z + Math.cos(Date.now() * 0.0008) * 0.3

      // Fire flicker
      const fireMesh = cf.group.children.find(c =>
        c instanceof THREE.Mesh && (c as THREE.Mesh).material instanceof THREE.MeshBasicMaterial
      ) as THREE.Mesh | undefined
      if (fireMesh && fireMesh.material instanceof THREE.MeshBasicMaterial) {
        fireMesh.material.opacity = 0.7 + Math.sin(Date.now() * 0.01) * 0.3
      }
    }

    return healAmount
  }

  private createCampfire(pos: THREE.Vector3, biomeName: string): CampfireData {
    const group = new THREE.Group()
    group.position.copy(pos)

    // Stone ring (6 small rocks)
    const rockGeo = new THREE.BoxGeometry(0.3, 0.2, 0.3)
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x666666 })
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const rock = new THREE.Mesh(rockGeo, rockMat)
      rock.position.set(Math.cos(angle) * 0.7, 0, Math.sin(angle) * 0.7)
      rock.rotation.y = Math.random() * Math.PI
      group.add(rock)
    }

    // Crossed logs
    const logGeo = new THREE.BoxGeometry(0.15, 0.15, 1.2)
    const logMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e })
    const log1 = new THREE.Mesh(logGeo, logMat)
    log1.rotation.y = Math.PI / 4
    log1.position.y = 0.15
    const log2 = new THREE.Mesh(logGeo, logMat)
    log2.rotation.y = -Math.PI / 4
    log2.position.y = 0.15
    group.add(log1, log2)

    // Fire (emissive box)
    const fireGeo = new THREE.BoxGeometry(0.4, 0.5, 0.4)
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff6622,
      transparent: true,
      opacity: 0.9,
    })
    const fire = new THREE.Mesh(fireGeo, fireMat)
    fire.position.y = 0.4
    group.add(fire)

    this.scene.add(group)

    // Ember particles
    const emberCount = 12
    const emberPositions = new Float32Array(emberCount * 3)
    const emberPhases = new Float32Array(emberCount)
    for (let i = 0; i < emberCount; i++) {
      emberPositions[i * 3] = pos.x + (Math.random() - 0.5) * 0.8
      emberPositions[i * 3 + 1] = pos.y + Math.random() * 2
      emberPositions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.8
      emberPhases[i] = Math.random()
    }
    const emberGeo = new THREE.BufferGeometry()
    emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPositions, 3))
    const emberMat = new THREE.PointsMaterial({
      color: 0xff8844,
      size: 0.12,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
    })
    const embers = new THREE.Points(emberGeo, emberMat)
    embers.frustumCulled = false
    this.scene.add(embers)

    // Smoke column (tall semi-transparent strip, visible from far)
    const smokeGeo = new THREE.BoxGeometry(0.8, SMOKE_HEIGHT, 0.8)
    const smokeMat = new THREE.MeshBasicMaterial({
      color: 0x888888,
      transparent: true,
      opacity: 0.15,
    })
    const smoke = new THREE.Mesh(smokeGeo, smokeMat)
    smoke.position.set(pos.x, pos.y + SMOKE_HEIGHT / 2, pos.z)
    this.scene.add(smoke)

    return { position: pos.clone(), biomeName, group, embers, smoke, emberPhases }
  }

  private save() {
    try {
      const data = this.campfires.map(cf => ({
        x: cf.position.x, y: cf.position.y, z: cf.position.z,
        biome: cf.biomeName,
      }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as { x: number; y: number; z: number; biome: string }[]
      for (const d of data) {
        const pos = new THREE.Vector3(d.x, d.y, d.z)
        const cfData = this.createCampfire(pos, d.biome)
        this.campfires.push(cfData)
      }
    } catch { /* ignore */ }
  }

  private updateHud() {
    if (this.campfireHud) {
      this.campfireHud.textContent = `🔥 ${this.campfires.length} / ${MAX_CAMPFIRES}`
      this.campfireHud.style.display = this.campfires.length > 0 ? 'block' : 'none'
    }
  }

  getMapMarkers(): { pos: THREE.Vector3; color: string; label: string }[] {
    return this.campfires.map((cf, i) => ({
      pos: cf.position,
      color: '#ff6622',
      label: `CF${i + 1}`,
    }))
  }
}
