import * as THREE from 'three'
import { AudioSystem } from '../audio/AudioSystem'

const PLATFORM_COUNT = 30
const PLATFORM_SPACING = 3
const PLATFORM_DARK = 0x1a2233
const PLATFORM_LIT = 0xccaa55
const TRIGGER_RADIUS = 2.5
const CRYSTAL_TRIGGER_RADIUS = 4
const PORTAL_RADIUS = 3

interface PlatformData {
  mesh: THREE.Mesh
  lit: boolean
  light: THREE.PointLight
}

export class IntroBridge {
  private scene: THREE.Scene
  private group: THREE.Group
  private platforms: PlatformData[] = []
  private crystals: { meshes: THREE.Mesh[]; position: THREE.Vector3; tones: number[]; triggered: boolean }[] = []
  private portalRing: THREE.Mesh
  private portalGlow: THREE.Mesh
  private audioSystem: AudioSystem
  private bridgeDirection: THREE.Vector3
  private bridgeStart: THREE.Vector3
  private complete = false

  // Audio
  private droneOsc: OscillatorNode | null = null
  private droneGain: GainNode | null = null
  private droneOctave: OscillatorNode | null = null
  private droneOctaveGain: GainNode | null = null
  private droneFifth: OscillatorNode | null = null
  private droneFifthGain: GainNode | null = null
  private audioInitialized = false
  private octaveAdded = false
  private fifthAdded = false

  // Floating particles
  private particles: THREE.Points
  private particlePositions: Float32Array
  private particleCount = 200

  // Animated elements
  private elapsedTime = 0
  private archMeshes: THREE.Mesh[] = []
  private pillarMeshes: THREE.Mesh[] = []
  private starField: THREE.Points

  constructor(castlePosition: THREE.Vector3, scene: THREE.Scene, audioSystem: AudioSystem) {
    this.scene = scene
    this.audioSystem = audioSystem
    this.group = new THREE.Group()

    this.bridgeStart = new THREE.Vector3(
      castlePosition.x,
      castlePosition.y + 2,
      castlePosition.z - 100,
    )
    this.bridgeDirection = new THREE.Vector3(0, 0, 1)

    const bridgeEnd = this.bridgeStart.clone().addScaledVector(this.bridgeDirection, (PLATFORM_COUNT - 1) * PLATFORM_SPACING)

    // ── Star field background ──
    {
      const starCount = 500
      const starGeo = new THREE.BufferGeometry()
      const starPositions = new Float32Array(starCount * 3)
      const midZ = (this.bridgeStart.z + bridgeEnd.z) / 2
      for (let i = 0; i < starCount; i++) {
        starPositions[i * 3] = this.bridgeStart.x + (Math.random() - 0.5) * 200
        starPositions[i * 3 + 1] = this.bridgeStart.y + (Math.random() - 0.5) * 80
        starPositions[i * 3 + 2] = midZ + (Math.random() - 0.5) * 140
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
      const starMat = new THREE.PointsMaterial({ color: 0x8899cc, size: 0.15, transparent: true, opacity: 0.6 })
      this.starField = new THREE.Points(starGeo, starMat)
      this.group.add(this.starField)
    }

    // ── Floating particles (golden motes drifting upward) ──
    {
      const pGeo = new THREE.BufferGeometry()
      this.particlePositions = new Float32Array(this.particleCount * 3)
      const midZ = (this.bridgeStart.z + bridgeEnd.z) / 2
      for (let i = 0; i < this.particleCount; i++) {
        this.particlePositions[i * 3] = this.bridgeStart.x + (Math.random() - 0.5) * 30
        this.particlePositions[i * 3 + 1] = this.bridgeStart.y - 5 + Math.random() * 15
        this.particlePositions[i * 3 + 2] = midZ + (Math.random() - 0.5) * 100
      }
      pGeo.setAttribute('position', new THREE.BufferAttribute(this.particlePositions, 3))
      const pMat = new THREE.PointsMaterial({ color: 0xffdd88, size: 0.1, transparent: true, opacity: 0.5 })
      this.particles = new THREE.Points(pGeo, pMat)
      this.group.add(this.particles)
    }

    // ── Platforms (all pre-created with lights OFF) ──
    const platformGeo = new THREE.BoxGeometry(2.5, 0.3, 2.5)
    // Shared material for unlit — cloned per platform so we can color individually
    for (let i = 0; i < PLATFORM_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: PLATFORM_DARK })
      const mesh = new THREE.Mesh(platformGeo, mat)
      const pos = this.bridgeStart.clone().addScaledVector(this.bridgeDirection, i * PLATFORM_SPACING)
      mesh.position.copy(pos)
      this.group.add(mesh)

      // Pre-create PointLight (starts at intensity 0 — no shader recompile on activation)
      const light = new THREE.PointLight(0xffcc66, 0, 10)
      light.position.set(pos.x, pos.y + 1, pos.z)
      this.group.add(light)

      this.platforms.push({ mesh, lit: false, light })
    }

    // Pre-light first 3
    for (let i = 0; i < 3; i++) {
      this.platforms[i].lit = true
      ;(this.platforms[i].mesh.material as THREE.MeshBasicMaterial).color.setHex(PLATFORM_LIT)
      this.platforms[i].light.intensity = 0.6
    }

    // ── Edge trim / railing lines along the path ──
    {
      const railMat = new THREE.MeshBasicMaterial({ color: 0x222244, transparent: true, opacity: 0.4 })
      const railGeo = new THREE.BoxGeometry(0.08, 0.5, PLATFORM_COUNT * PLATFORM_SPACING)
      const leftRail = new THREE.Mesh(railGeo, railMat)
      const rightRail = new THREE.Mesh(railGeo, railMat)
      const midZ = (this.bridgeStart.z + bridgeEnd.z) / 2
      leftRail.position.set(this.bridgeStart.x - 1.5, this.bridgeStart.y + 0.25, midZ)
      rightRail.position.set(this.bridgeStart.x + 1.5, this.bridgeStart.y + 0.25, midZ)
      this.group.add(leftRail, rightRail)
    }

    // ── Pillar markers every 5 platforms ──
    {
      const pillarGeo = new THREE.BoxGeometry(0.2, 3, 0.2)
      const pillarMat = new THREE.MeshBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.5 })
      for (let i = 0; i < PLATFORM_COUNT; i += 5) {
        const pos = this.platforms[i].mesh.position
        for (const side of [-1.8, 1.8]) {
          const pillar = new THREE.Mesh(pillarGeo, pillarMat)
          pillar.position.set(pos.x + side, pos.y + 1.5, pos.z)
          this.group.add(pillar)
          this.pillarMeshes.push(pillar)
        }
      }
    }

    // ── Arches at platforms 8, 16, 24 ──
    {
      const archMat = new THREE.MeshBasicMaterial({ color: 0x334466, transparent: true, opacity: 0.3 })
      for (const idx of [8, 16, 24]) {
        const pos = this.platforms[idx].mesh.position
        // Two vertical pillars + horizontal beam
        const vGeo = new THREE.BoxGeometry(0.25, 4, 0.25)
        const hGeo = new THREE.BoxGeometry(4.5, 0.2, 0.25)
        const left = new THREE.Mesh(vGeo, archMat)
        const right = new THREE.Mesh(vGeo, archMat)
        const top = new THREE.Mesh(hGeo, archMat)
        left.position.set(pos.x - 2, pos.y + 2, pos.z)
        right.position.set(pos.x + 2, pos.y + 2, pos.z)
        top.position.set(pos.x, pos.y + 4, pos.z)
        this.group.add(left, right, top)
        this.archMeshes.push(left, right, top)
      }
    }

    // ── Crystal formations ──
    const crystalGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3)
    const crystalBaseMat = () => new THREE.MeshBasicMaterial({ color: 0x334466 })

    // Platform 12: 1 crystal
    const p12 = this.platforms[11].mesh.position
    const c12 = new THREE.Mesh(crystalGeo, crystalBaseMat())
    c12.position.set(p12.x + 2.5, p12.y + 0.6, p12.z)
    c12.rotation.z = 0.15
    this.group.add(c12)
    this.crystals.push({ meshes: [c12], position: p12.clone(), tones: [261.6], triggered: false })

    // Platform 20: 2 crystals
    const p20 = this.platforms[19].mesh.position
    const c20a = new THREE.Mesh(crystalGeo, crystalBaseMat())
    const c20b = new THREE.Mesh(crystalGeo, crystalBaseMat())
    c20a.position.set(p20.x - 2.5, p20.y + 0.6, p20.z)
    c20a.rotation.z = -0.1
    c20b.position.set(p20.x + 2.5, p20.y + 0.6, p20.z)
    c20b.rotation.z = 0.1
    this.group.add(c20a, c20b)
    this.crystals.push({ meshes: [c20a, c20b], position: p20.clone(), tones: [261.6, 329.6], triggered: false })

    // Platform 27: 3 crystals
    const p27 = this.platforms[26].mesh.position
    const c27a = new THREE.Mesh(crystalGeo, crystalBaseMat())
    const c27b = new THREE.Mesh(crystalGeo, crystalBaseMat())
    const c27c = new THREE.Mesh(crystalGeo, crystalBaseMat())
    c27a.position.set(p27.x - 2.5, p27.y + 0.6, p27.z)
    c27a.rotation.z = -0.15
    c27b.position.set(p27.x + 2.5, p27.y + 0.6, p27.z)
    c27b.rotation.z = 0.15
    c27c.position.set(p27.x, p27.y + 0.8, p27.z - 2)
    c27c.rotation.x = 0.1
    this.group.add(c27a, c27b, c27c)
    this.crystals.push({ meshes: [c27a, c27b, c27c], position: p27.clone(), tones: [261.6, 329.6, 392], triggered: false })

    // ── Portal ring + outer glow ring ──
    const portalPos = bridgeEnd.clone()
    portalPos.y += 1.5

    const portalGeo = new THREE.RingGeometry(1.8, 2.5, 32)
    const portalMat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    this.portalRing = new THREE.Mesh(portalGeo, portalMat)
    this.portalRing.position.copy(portalPos)
    this.portalRing.rotation.x = Math.PI / 2 // horizontal ring on ground
    this.group.add(this.portalRing)

    const outerGlowGeo = new THREE.RingGeometry(2.5, 3.5, 32)
    const outerGlowMat = new THREE.MeshBasicMaterial({ color: 0xffeecc, transparent: true, opacity: 0.2, side: THREE.DoubleSide })
    this.portalGlow = new THREE.Mesh(outerGlowGeo, outerGlowMat)
    this.portalGlow.position.copy(portalPos)
    this.portalGlow.rotation.x = Math.PI / 2
    this.group.add(this.portalGlow)

    // ── Ambient + directional light (pre-created, no runtime additions) ──
    this.group.add(new THREE.AmbientLight(0x556688, 0.8))
    const dirLight = new THREE.DirectionalLight(0x8899bb, 0.4)
    dirLight.position.set(0, 20, 0)
    this.group.add(dirLight)

    scene.add(this.group)
  }

  getSpawnPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.bridgeStart.x, this.bridgeStart.y + 1.5, this.bridgeStart.z)
  }

  getSpawnDirection(): THREE.Vector3 {
    return this.bridgeDirection.clone()
  }

  initAudio(): void {
    const ctx = this.audioSystem.getContext()
    if (!ctx || this.audioInitialized) return
    this.audioInitialized = true

    const startTime = ctx.currentTime + 2
    const dest = this.audioSystem.getMasterGain() || ctx.destination

    this.droneOsc = ctx.createOscillator()
    this.droneOsc.type = 'sine'
    this.droneOsc.frequency.value = 65.41 // C2
    this.droneGain = ctx.createGain()
    this.droneGain.gain.setValueAtTime(0, startTime)
    this.droneGain.gain.linearRampToValueAtTime(0.06, startTime + 3)
    this.droneOsc.connect(this.droneGain)
    this.droneGain.connect(dest)
    this.droneOsc.start(startTime)
  }

  update(dt: number, playerPos: THREE.Vector3, _elapsedTime: number, worldState: any): boolean {
    if (this.complete) return true
    this.elapsedTime += dt

    const ctx = this.audioSystem.getContext()

    // ── Animate floating particles (drift upward slowly) ──
    for (let i = 0; i < this.particleCount; i++) {
      this.particlePositions[i * 3 + 1] += dt * 0.3 // rise
      this.particlePositions[i * 3] += Math.sin(this.elapsedTime * 0.5 + i) * dt * 0.1 // sway
      // Wrap around if too high
      if (this.particlePositions[i * 3 + 1] > this.bridgeStart.y + 12) {
        this.particlePositions[i * 3 + 1] = this.bridgeStart.y - 5
      }
    }
    this.particles.geometry.attributes.position.needsUpdate = true

    // ── Pulse portal ring ──
    const portalPulse = 0.5 + Math.sin(this.elapsedTime * 2) * 0.2
    ;(this.portalRing.material as THREE.MeshBasicMaterial).opacity = portalPulse
    ;(this.portalGlow.material as THREE.MeshBasicMaterial).opacity = portalPulse * 0.3

    // ── Platform lighting (just flip color + intensity, no new objects) ──
    for (let i = 0; i < this.platforms.length; i++) {
      const plat = this.platforms[i]
      if (plat.lit) continue

      const dx = playerPos.x - plat.mesh.position.x
      const dz = playerPos.z - plat.mesh.position.z
      if (dx * dx + dz * dz < TRIGGER_RADIUS * TRIGGER_RADIUS) {
        plat.lit = true
        ;(plat.mesh.material as THREE.MeshBasicMaterial).color.setHex(PLATFORM_LIT)
        plat.light.intensity = 0.6 // just turn on pre-existing light

        // Text at specific platforms
        if (i === 4) {
          worldState.activationMessage = 'Before the chord, there was silence.'
          worldState.activationMessageTimer = 4
        } else if (i === 10) {
          worldState.activationMessage = 'They heard something beneath the world — a hum, older than stone.'
          worldState.activationMessageTimer = 4
        } else if (i === 17) {
          worldState.activationMessage = 'They built instruments to speak its language.'
          worldState.activationMessageTimer = 4
        } else if (i === 24) {
          worldState.activationMessage = 'The harmony shattered. Only echoes remain.'
          worldState.activationMessageTimer = 4
        }

        // Drone layers
        if (i >= 10 && !this.octaveAdded && ctx) {
          this.octaveAdded = true
          const dest = this.audioSystem.getMasterGain() || ctx.destination
          this.droneOctave = ctx.createOscillator()
          this.droneOctave.type = 'sine'
          this.droneOctave.frequency.value = 130.81 // C3
          this.droneOctaveGain = ctx.createGain()
          this.droneOctaveGain.gain.setValueAtTime(0, ctx.currentTime)
          this.droneOctaveGain.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 3)
          this.droneOctave.connect(this.droneOctaveGain)
          this.droneOctaveGain.connect(dest)
          this.droneOctave.start()
        }
        if (i >= 20 && !this.fifthAdded && ctx) {
          this.fifthAdded = true
          const dest = this.audioSystem.getMasterGain() || ctx.destination
          this.droneFifth = ctx.createOscillator()
          this.droneFifth.type = 'sine'
          this.droneFifth.frequency.value = 98 // G2
          this.droneFifthGain = ctx.createGain()
          this.droneFifthGain.gain.setValueAtTime(0, ctx.currentTime)
          this.droneFifthGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 3)
          this.droneFifth.connect(this.droneFifthGain)
          this.droneFifthGain.connect(dest)
          this.droneFifth.start()
        }
      }
    }

    // ── Crystal interactions ──
    for (const crystal of this.crystals) {
      if (crystal.triggered) continue
      const dx = playerPos.x - crystal.position.x
      const dz = playerPos.z - crystal.position.z
      if (dx * dx + dz * dz < CRYSTAL_TRIGGER_RADIUS * CRYSTAL_TRIGGER_RADIUS) {
        crystal.triggered = true
        for (const m of crystal.meshes) {
          ;(m.material as THREE.MeshBasicMaterial).color.setHex(0x88bbff)
        }
        if (ctx) {
          const dest = this.audioSystem.getMasterGain() || ctx.destination
          const dur = crystal.tones.length >= 3 ? 2.5 : 2
          for (const freq of crystal.tones) {
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = freq
            const g = ctx.createGain()
            g.gain.setValueAtTime(0.1, ctx.currentTime)
            g.gain.linearRampToValueAtTime(0, ctx.currentTime + dur)
            osc.connect(g)
            g.connect(dest)
            osc.start()
            osc.stop(ctx.currentTime + dur + 0.1)
          }
        }
      }
    }

    // ── Portal check ──
    const pp = this.portalRing.position
    const pdx = playerPos.x - pp.x
    const pdz = playerPos.z - pp.z
    if (pdx * pdx + pdz * pdz < PORTAL_RADIUS * PORTAL_RADIUS) {
      this.complete = true
      ;(this.portalRing.material as THREE.MeshBasicMaterial).opacity = 1.0
      this.fadeDrone()
      return true
    }

    return false
  }

  private fadeDrone(): void {
    const ctx = this.audioSystem.getContext()
    if (!ctx) return
    const now = ctx.currentTime
    for (const g of [this.droneGain, this.droneOctaveGain, this.droneFifthGain]) {
      if (g) {
        g.gain.cancelScheduledValues(now)
        g.gain.setValueAtTime(g.gain.value, now)
        g.gain.linearRampToValueAtTime(0, now + 1)
      }
    }
  }

  dispose(): void {
    for (const osc of [this.droneOsc, this.droneOctave, this.droneFifth]) {
      try { osc?.stop() } catch { /* */ }
      osc?.disconnect()
    }
    for (const g of [this.droneGain, this.droneOctaveGain, this.droneFifthGain]) {
      g?.disconnect()
    }
    this.scene.remove(this.group)
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose()
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((m) => m.dispose())
      }
    })
    for (const plat of this.platforms) plat.light.dispose()
  }
}
