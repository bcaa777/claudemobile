import * as THREE from 'three'
import { AudioSystem } from '../audio/AudioSystem'

export class IntroBridge {
  private scene: THREE.Scene
  private group: THREE.Group
  private platforms: { mesh: THREE.Mesh; lit: boolean; material: THREE.MeshLambertMaterial }[]
  private crystals: { mesh: THREE.Mesh; position: THREE.Vector3; tones: number[]; triggered: boolean }[]
  private portalRing: THREE.Mesh
  private audioSystem: AudioSystem
  private castlePosition: THREE.Vector3
  private bridgeDirection: THREE.Vector3
  private bridgeStart: THREE.Vector3
  private complete: boolean = false

  // Audio nodes for the intro drone
  private droneOsc: OscillatorNode | null = null
  private droneGain: GainNode | null = null
  private droneOctave: OscillatorNode | null = null
  private droneOctaveGain: GainNode | null = null
  private droneFifth: OscillatorNode | null = null
  private droneFifthGain: GainNode | null = null
  private audioInitialized = false
  private audioStartTime = 0

  // Enclosure to block the outside world
  private enclosure: THREE.Mesh

  // Text display tracking
  private textTimers: Map<number, number> = new Map() // platform index -> remaining time

  // Platform point lights
  private platformLights: THREE.PointLight[] = []

  // Track which drone layers have been added
  private octaveAdded = false
  private fifthAdded = false

  constructor(castlePosition: THREE.Vector3, scene: THREE.Scene, audioSystem: AudioSystem) {
    this.scene = scene
    this.audioSystem = audioSystem
    this.castlePosition = castlePosition.clone()
    this.group = new THREE.Group()
    this.platforms = []
    this.crystals = []

    // Bridge starts 100 units north of castle (negative Z), elevated
    this.bridgeStart = new THREE.Vector3(
      castlePosition.x,
      castlePosition.y + 2,
      castlePosition.z - 100
    )

    // Bridge extends toward castle (positive Z direction)
    this.bridgeDirection = new THREE.Vector3(0, 0, 1)

    // -- Enclosure: large black box to block outside world --
    const enclosureGeo = new THREE.BoxGeometry(200, 60, 120)
    const enclosureMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide })
    this.enclosure = new THREE.Mesh(enclosureGeo, enclosureMat)
    // Center enclosure on the bridge midpoint
    const bridgeMid = this.bridgeStart.clone().addScaledVector(this.bridgeDirection, 45)
    this.enclosure.position.copy(bridgeMid)
    this.enclosure.position.y = castlePosition.y + 2 // center vertically around bridge
    this.group.add(this.enclosure)

    // -- 30 Platforms --
    const platformGeo = new THREE.BoxGeometry(2.5, 0.3, 2.5)
    for (let i = 0; i < 30; i++) {
      const mat = new THREE.MeshLambertMaterial({ color: 0x334455, emissive: 0x000000 })
      const mesh = new THREE.Mesh(platformGeo, mat)
      const pos = this.bridgeStart.clone().addScaledVector(this.bridgeDirection, i * 3)
      mesh.position.copy(pos)
      this.group.add(mesh)
      this.platforms.push({ mesh, lit: false, material: mat })
    }

    // -- Portal ring at the end (after platform 30) --
    const portalGeo = new THREE.RingGeometry(2, 3, 32)
    const portalMat = new THREE.MeshBasicMaterial({
      color: 0xffdd88,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })
    this.portalRing = new THREE.Mesh(portalGeo, portalMat)
    const portalPos = this.bridgeStart.clone().addScaledVector(this.bridgeDirection, 29 * 3)
    this.portalRing.position.copy(portalPos)
    this.portalRing.position.y += 1.5 // raise center of ring above platform
    // Orient vertically facing the player (rotate around X axis)
    this.portalRing.rotation.y = Math.PI // face toward negative Z (toward player)
    this.group.add(this.portalRing)

    // -- Crystal formations --
    const crystalGeo = new THREE.BoxGeometry(0.3, 1.2, 0.3)

    // Platform 12 (index 11): 1 crystal to the right
    const p12Pos = this.platforms[11].mesh.position
    const c12Mat = new THREE.MeshLambertMaterial({ color: 0x445566, emissive: 0x000000 })
    const c12 = new THREE.Mesh(crystalGeo, c12Mat)
    c12.position.set(p12Pos.x + 2, p12Pos.y + 0.6, p12Pos.z)
    this.group.add(c12)
    this.crystals.push({ mesh: c12, position: c12.position.clone(), tones: [261.6], triggered: false })

    // Platform 20 (index 19): 2 crystals on opposite sides
    const p20Pos = this.platforms[19].mesh.position
    const c20aMat = new THREE.MeshLambertMaterial({ color: 0x445566, emissive: 0x000000 })
    const c20a = new THREE.Mesh(crystalGeo, c20aMat)
    c20a.position.set(p20Pos.x - 2, p20Pos.y + 0.6, p20Pos.z)
    this.group.add(c20a)

    const c20bMat = new THREE.MeshLambertMaterial({ color: 0x445566, emissive: 0x000000 })
    const c20b = new THREE.Mesh(crystalGeo, c20bMat)
    c20b.position.set(p20Pos.x + 2, p20Pos.y + 0.6, p20Pos.z)
    this.group.add(c20b)
    this.crystals.push({ mesh: c20a, position: p20Pos.clone(), tones: [261.6, 329.6], triggered: false })
    // Store second mesh reference on the first crystal entry (we'll glow both)
    // Actually, keep it simple: just store one entry per crystal formation
    // The second mesh will be glowed via the crystals array index

    // Platform 27 (index 26): 3 crystals in triangle
    const p27Pos = this.platforms[26].mesh.position
    const c27aMat = new THREE.MeshLambertMaterial({ color: 0x445566, emissive: 0x000000 })
    const c27a = new THREE.Mesh(crystalGeo, c27aMat)
    c27a.position.set(p27Pos.x - 2, p27Pos.y + 0.6, p27Pos.z)
    this.group.add(c27a)

    const c27bMat = new THREE.MeshLambertMaterial({ color: 0x445566, emissive: 0x000000 })
    const c27b = new THREE.Mesh(crystalGeo, c27bMat)
    c27b.position.set(p27Pos.x + 2, p27Pos.y + 0.6, p27Pos.z)
    this.group.add(c27b)

    const c27cMat = new THREE.MeshLambertMaterial({ color: 0x445566, emissive: 0x000000 })
    const c27c = new THREE.Mesh(crystalGeo, c27cMat)
    c27c.position.set(p27Pos.x, p27Pos.y + 0.6, p27Pos.z - 2)
    this.group.add(c27c)
    this.crystals.push({ mesh: c27a, position: p27Pos.clone(), tones: [261.6, 329.6, 392], triggered: false })

    // Store extra crystal meshes for glow control
    this._extraCrystalMeshes = [
      [],           // crystal 0 (platform 12): single crystal, no extras
      [c20b],       // crystal 1 (platform 20): c20b is the extra
      [c27b, c27c], // crystal 2 (platform 27): c27b, c27c are extras
    ]

    // Add an ambient light so platforms are slightly visible in the void
    const ambientLight = new THREE.AmbientLight(0x222244, 0.3)
    this.group.add(ambientLight)

    scene.add(this.group)
  }

  // Extra crystal meshes per crystal formation index
  private _extraCrystalMeshes: THREE.Mesh[][] = []

  /** Returns the position where the player should spawn */
  getSpawnPosition(): THREE.Vector3 {
    // Spawn slightly above the first platform
    return new THREE.Vector3(
      this.bridgeStart.x,
      this.bridgeStart.y + 1.5,
      this.bridgeStart.z
    )
  }

  /** Returns the direction the player should face (toward portal) */
  getSpawnDirection(): THREE.Vector3 {
    return this.bridgeDirection.clone()
  }

  /** Initialize audio (drone). Call after AudioContext is available. */
  initAudio(): void {
    const ctx = this.audioSystem.getContext()
    if (!ctx || this.audioInitialized) return
    this.audioInitialized = true
    this.audioStartTime = ctx.currentTime

    // Create drone with 2-second delay
    const startTime = ctx.currentTime + 2

    const dest = this.audioSystem.getMasterGain() || ctx.destination

    this.droneOsc = ctx.createOscillator()
    this.droneOsc.type = 'sine'
    this.droneOsc.frequency.value = 65.41 // C2
    this.droneGain = ctx.createGain()
    this.droneGain.gain.setValueAtTime(0, startTime)
    this.droneGain.gain.linearRampToValueAtTime(0.04, startTime + 3)
    this.droneOsc.connect(this.droneGain)
    this.droneGain.connect(dest)
    this.droneOsc.start(startTime)
  }

  /** Call each frame. Returns true when bridge is complete (player reached portal) */
  update(dt: number, playerPos: THREE.Vector3, _elapsedTime: number, worldState: any): boolean {
    if (this.complete) return true

    const ctx = this.audioSystem.getContext()

    // -- Platform lighting --
    for (let i = 0; i < this.platforms.length; i++) {
      const plat = this.platforms[i]
      if (plat.lit) continue

      const dx = playerPos.x - plat.mesh.position.x
      const dz = playerPos.z - plat.mesh.position.z
      const horizDist = Math.sqrt(dx * dx + dz * dz)

      if (horizDist < 2.5) {
        plat.lit = true
        plat.material.emissive.setHex(0x886622)

        // Add point light
        const light = new THREE.PointLight(0xffcc66, 0.5, 8)
        light.position.copy(plat.mesh.position)
        light.position.y += 0.5
        this.group.add(light)
        this.platformLights.push(light)

        // Text interactions
        if (i === 4) {
          worldState.activationMessage = 'Before the chord, there was silence.'
          worldState.activationMessageTimer = 4
          this.textTimers.set(i, 4)
        } else if (i === 14) {
          worldState.activationMessage = 'They built a world from frequencies.'
          worldState.activationMessageTimer = 4
          this.textTimers.set(i, 4)
        } else if (i === 24) {
          worldState.activationMessage = 'The harmony shattered. Only echoes remain.'
          worldState.activationMessageTimer = 4
          this.textTimers.set(i, 4)
        }

        // Drone layer additions
        if (i >= 10 && !this.octaveAdded && ctx) {
          this.octaveAdded = true
          const dest = this.audioSystem.getMasterGain() || ctx.destination
          this.droneOctave = ctx.createOscillator()
          this.droneOctave.type = 'sine'
          this.droneOctave.frequency.value = 130.81 // C3
          this.droneOctaveGain = ctx.createGain()
          this.droneOctaveGain.gain.setValueAtTime(0, ctx.currentTime)
          this.droneOctaveGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 3)
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
          this.droneFifthGain.gain.linearRampToValueAtTime(0.025, ctx.currentTime + 3)
          this.droneFifth.connect(this.droneFifthGain)
          this.droneFifthGain.connect(dest)
          this.droneFifth.start()
        }
      }
    }

    // -- Text timer decay --
    for (const [idx, remaining] of this.textTimers) {
      const newVal = remaining - dt
      if (newVal <= 0) {
        this.textTimers.delete(idx)
      } else {
        this.textTimers.set(idx, newVal)
      }
    }

    // -- Crystal interactions --
    for (let i = 0; i < this.crystals.length; i++) {
      const crystal = this.crystals[i]
      if (crystal.triggered) continue

      const dx = playerPos.x - crystal.position.x
      const dz = playerPos.z - crystal.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < 4) {
        crystal.triggered = true

        // Glow main crystal mesh
        const mat = crystal.mesh.material as THREE.MeshLambertMaterial
        mat.emissive.setHex(0x446688)

        // Glow extra meshes for this formation
        for (const extra of this._extraCrystalMeshes[i]) {
          const eMat = extra.material as THREE.MeshLambertMaterial
          eMat.emissive.setHex(0x446688)
        }

        // Play tones
        if (ctx) {
          const dest = this.audioSystem.getMasterGain() || ctx.destination
          const duration = i === 2 ? 2.5 : 2
          for (const freq of crystal.tones) {
            const osc = ctx.createOscillator()
            osc.type = 'sine'
            osc.frequency.value = freq
            const gain = ctx.createGain()
            gain.gain.setValueAtTime(0.08, ctx.currentTime)
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
            osc.connect(gain)
            gain.connect(dest)
            osc.start()
            osc.stop(ctx.currentTime + duration + 0.1)
          }
        }
      }
    }

    // -- Portal check --
    const portalPos = this.portalRing.position
    const pdx = playerPos.x - portalPos.x
    const pdz = playerPos.z - portalPos.z
    const portalDist = Math.sqrt(pdx * pdx + pdz * pdz)

    if (portalDist < 3) {
      this.complete = true

      // Flash portal bright
      const pMat = this.portalRing.material as THREE.MeshBasicMaterial
      pMat.opacity = 1.0

      // Fade drone to 0
      if (ctx) {
        const now = ctx.currentTime
        if (this.droneGain) {
          this.droneGain.gain.cancelScheduledValues(now)
          this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, now)
          this.droneGain.gain.linearRampToValueAtTime(0, now + 1)
        }
        if (this.droneOctaveGain) {
          this.droneOctaveGain.gain.cancelScheduledValues(now)
          this.droneOctaveGain.gain.setValueAtTime(this.droneOctaveGain.gain.value, now)
          this.droneOctaveGain.gain.linearRampToValueAtTime(0, now + 1)
        }
        if (this.droneFifthGain) {
          this.droneFifthGain.gain.cancelScheduledValues(now)
          this.droneFifthGain.gain.setValueAtTime(this.droneFifthGain.gain.value, now)
          this.droneFifthGain.gain.linearRampToValueAtTime(0, now + 1)
        }
      }

      return true
    }

    return false
  }

  /** Clean up all bridge meshes and audio */
  dispose(): void {
    // Stop all oscillators
    try { this.droneOsc?.stop() } catch { /* already stopped */ }
    try { this.droneOctave?.stop() } catch { /* already stopped */ }
    try { this.droneFifth?.stop() } catch { /* already stopped */ }

    // Disconnect audio
    this.droneGain?.disconnect()
    this.droneOctaveGain?.disconnect()
    this.droneFifthGain?.disconnect()
    this.droneOsc?.disconnect()
    this.droneOctave?.disconnect()
    this.droneFifth?.disconnect()

    // Remove group from scene
    this.scene.remove(this.group)

    // Dispose geometries and materials
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })

    // Remove point lights
    for (const light of this.platformLights) {
      light.dispose()
    }
  }
}
