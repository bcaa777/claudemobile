import * as THREE from 'three'
import type { NPCId } from './NPCData'

/**
 * Per-NPC environmental beacons visible from far away (~80+ units).
 * Each NPC has a unique structure so the player learns to recognise them.
 *
 * Finch:     Tall wooden flag pole with a fluttering gold pennant
 * Vesper:    Crystal obelisk with orbiting star sparks
 * Bramble:   Smoldering campfire with rising smoke / ember particles
 * Plume:     Merchant's lantern post with dangling colored lanterns
 * Cinder:    Forge anvil on a stone pedestal with rising sparks
 * Pearl:     Spirit wisp column — soft white glow pillar
 * Thornwick: Enchanted bookstand with floating, spinning books
 */

const _boxCache = new Map<string, THREE.BoxGeometry>()
function box(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w}_${h}_${d}`
  let g = _boxCache.get(k)
  if (!g) { g = new THREE.BoxGeometry(w, h, d); _boxCache.set(k, g) }
  return g
}

function mat(color: number, emissive?: number, intensity?: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    color,
    ...(emissive != null ? { emissive, emissiveIntensity: intensity ?? 1.0 } : {}),
  })
}

function basicMat(color: number, opacity = 1, depthWrite = true): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite,
  })
}

// ── Particle ring helper (reused by several beacons) ──────────────────
function makeParticles(count: number, radius: number, color: number, size: number): THREE.Points {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const a = i * (Math.PI * 2 / count)
    pos[i * 3 + 0] = Math.cos(a) * radius
    pos[i * 3 + 1] = 0
    pos[i * 3 + 2] = Math.sin(a) * radius
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false,
  }))
}

// ── Rising column particles (smoke, embers, wisps) ────────────────────
function makeColumnParticles(count: number, color: number, size: number, spread: number): THREE.Points {
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = (Math.random() - 0.5) * spread
    pos[i * 3 + 1] = Math.random() * 8    // 0..8 units tall
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color, size, sizeAttenuation: true, transparent: true, opacity: 0.7, depthWrite: false,
  }))
}

export class NPCBeacon {
  group: THREE.Group
  private particles: THREE.Points | null = null
  private columnParticles: THREE.Points | null = null
  private emberParticles: THREE.Points | null = null
  private animParts: THREE.Mesh[] = []
  private npcId: NPCId
  private baseY = 0
  private particleSpread: number
  private particleCount: number

  constructor(npcId: NPCId) {
    this.npcId = npcId
    this.group = new THREE.Group()
    this.particleSpread = 0.6
    this.particleCount = 0

    switch (npcId) {
      case 'finch': this.buildFlag(); break
      case 'vesper': this.buildObelisk(); break
      case 'bramble': this.buildCampfire(); break
      case 'plume': this.buildLanternPost(); break
      case 'cinder': this.buildAnvil(); break
      case 'pearl': this.buildWispColumn(); break
      case 'thornwick': this.buildBookstand(); break
    }
  }

  // ── Finch: tall flag pole with gold pennant ─────────────────────────
  private buildFlag() {
    // Pole
    const pole = new THREE.Mesh(box(0.12, 7, 0.12), mat(0x664422))
    pole.position.y = 3.5
    this.group.add(pole)

    // Cross-beam at top
    const crossbeam = new THREE.Mesh(box(0.08, 0.08, 1.2), mat(0x664422))
    crossbeam.position.set(0, 6.8, 0.5)
    this.group.add(crossbeam)

    // Pennant — 3 stacked flat boxes (simulate fluttering cloth)
    const pennantColors = [0xe8b040, 0xd9a030, 0xc89020]
    for (let i = 0; i < 3; i++) {
      const w = 0.04
      const h = 1.2 - i * 0.3
      const strip = new THREE.Mesh(box(w, h, 0.8 - i * 0.15), basicMat(pennantColors[i], 0.9))
      strip.position.set(0, 6.2 - i * 0.4, 0.5)
      this.group.add(strip)
      this.animParts.push(strip)  // for flutter animation
    }

    // Small gold finial on top
    const finial = new THREE.Mesh(box(0.2, 0.2, 0.2), basicMat(0xffe060, 1))
    finial.position.set(0, 7.1, 0)
    finial.rotation.y = Math.PI / 4
    this.group.add(finial)
  }

  // ── Vesper: crystal obelisk with orbiting star sparks ───────────────
  private buildObelisk() {
    // Base stone
    const base = new THREE.Mesh(box(1.2, 0.4, 1.2), mat(0x556677))
    base.position.y = 0.2
    this.group.add(base)

    // Obelisk shaft
    const shaft = new THREE.Mesh(box(0.5, 5, 0.5), mat(0x445588, 0x4466cc, 0.3))
    shaft.position.y = 2.9
    this.group.add(shaft)

    // Pointed top
    const tip = new THREE.Mesh(box(0.3, 1.0, 0.3), basicMat(0x6688ff, 0.8))
    tip.position.y = 5.9
    this.group.add(tip)

    // Orbiting star sparks
    this.particles = makeParticles(10, 1.5, 0x88aaff, 0.2)
    this.particles.position.y = 4.0
    this.group.add(this.particles)
  }

  // ── Bramble: smoldering campfire with rising smoke/embers ───────────
  private buildCampfire() {
    // Stone ring (4 rocks around fire)
    for (let i = 0; i < 6; i++) {
      const a = i * (Math.PI * 2 / 6)
      const rock = new THREE.Mesh(box(0.5, 0.35, 0.4), mat(0x555544))
      rock.position.set(Math.cos(a) * 0.7, 0.17, Math.sin(a) * 0.7)
      rock.rotation.y = a
      this.group.add(rock)
    }

    // Logs (crossed)
    const logMat = mat(0x443322)
    const log1 = new THREE.Mesh(box(0.18, 0.18, 1.4), logMat)
    log1.position.y = 0.25
    log1.rotation.y = 0.4
    this.group.add(log1)
    const log2 = new THREE.Mesh(box(0.18, 0.18, 1.2), logMat)
    log2.position.y = 0.35
    log2.rotation.y = -0.5
    this.group.add(log2)

    // Fire core (emissive orange glow box)
    const fire = new THREE.Mesh(box(0.5, 0.6, 0.5), basicMat(0xff6622, 0.85))
    fire.position.y = 0.5
    this.group.add(fire)
    this.animParts.push(fire)

    // Smoke + ember column particles
    this.columnParticles = makeColumnParticles(20, 0x887766, 0.2, 0.8)
    this.columnParticles.position.y = 0.5
    this.group.add(this.columnParticles)
    this.particleSpread = 0.8
    this.particleCount = 20

    // Ember particles (bright orange, fewer, larger)
    this.emberParticles = makeColumnParticles(8, 0xff8833, 0.15, 0.5)
    this.emberParticles.position.y = 0.3
    this.group.add(this.emberParticles)
  }

  // ── Plume: merchant's lantern post with hanging colored lanterns ────
  private buildLanternPost() {
    // Main post
    const post = new THREE.Mesh(box(0.15, 5, 0.15), mat(0x554433))
    post.position.y = 2.5
    this.group.add(post)

    // Curved arms (3 arms radiating out at top)
    const armAngles = [0, Math.PI * 2 / 3, Math.PI * 4 / 3]
    const lanternColors = [0xff44aa, 0xaa44ff, 0x44ffaa]

    for (let i = 0; i < 3; i++) {
      const a = armAngles[i]
      // Arm
      const arm = new THREE.Mesh(box(0.08, 0.08, 1.0), mat(0x554433))
      arm.position.set(Math.sin(a) * 0.5, 4.8, Math.cos(a) * 0.5)
      arm.rotation.y = a
      this.group.add(arm)

      // Chain (thin vertical)
      const chain = new THREE.Mesh(box(0.04, 0.5, 0.04), mat(0x888888))
      chain.position.set(Math.sin(a) * 0.9, 4.35, Math.cos(a) * 0.9)
      this.group.add(chain)

      // Lantern (glowing box)
      const lantern = new THREE.Mesh(box(0.35, 0.45, 0.35),
        basicMat(lanternColors[i], 0.85, false))
      lantern.position.set(Math.sin(a) * 0.9, 3.9, Math.cos(a) * 0.9)
      this.group.add(lantern)
      this.animParts.push(lantern)
    }

    // Decorative top
    const top = new THREE.Mesh(box(0.3, 0.15, 0.3), mat(0xcc44ee, 0xcc44ee, 0.5))
    top.position.y = 5.1
    this.group.add(top)
  }

  // ── Cinder: forge anvil on stone pedestal with rising sparks ────────
  private buildAnvil() {
    // Stone pedestal
    const pedestal = new THREE.Mesh(box(1.4, 0.8, 1.4), mat(0x555555))
    pedestal.position.y = 0.4
    this.group.add(pedestal)

    // Anvil body
    const anvilBody = new THREE.Mesh(box(0.8, 0.5, 0.5), mat(0x444444))
    anvilBody.position.y = 1.05
    this.group.add(anvilBody)

    // Anvil horn (tapered front)
    const horn = new THREE.Mesh(box(0.3, 0.3, 0.7), mat(0x444444))
    horn.position.set(0, 1.0, 0.5)
    this.group.add(horn)

    // Anvil top (wider)
    const anvilTop = new THREE.Mesh(box(1.0, 0.15, 0.6), mat(0x555566))
    anvilTop.position.y = 1.38
    this.group.add(anvilTop)

    // Glowing hot metal piece on anvil
    const hotMetal = new THREE.Mesh(box(0.3, 0.08, 0.15),
      basicMat(0xff6600, 0.9))
    hotMetal.position.y = 1.5
    this.group.add(hotMetal)
    this.animParts.push(hotMetal)

    // Rising sparks
    this.columnParticles = makeColumnParticles(14, 0xff8833, 0.18, 0.6)
    this.columnParticles.position.y = 1.5
    this.group.add(this.columnParticles)
    this.particleSpread = 0.6
    this.particleCount = 14
  }

  // ── Pearl: spirit wisp column — ethereal glowing pillar ─────────────
  private buildWispColumn() {
    // Base — shallow stone bowl
    const bowl = new THREE.Mesh(box(1.2, 0.3, 1.2), mat(0xaaaaaa))
    bowl.position.y = 0.15
    this.group.add(bowl)

    // Central pillar of light (stacked translucent boxes getting smaller)
    for (let i = 0; i < 6; i++) {
      const s = 0.6 - i * 0.07
      const h = 1.0
      const pillar = new THREE.Mesh(box(s, h, s),
        basicMat(0xeeeeff, 0.25 - i * 0.03, false))
      pillar.position.y = 0.8 + i * 0.9
      this.group.add(pillar)
      this.animParts.push(pillar)
    }

    // Bright wisp at top
    const wisp = new THREE.Mesh(box(0.3, 0.3, 0.3),
      basicMat(0xffffff, 0.7, false))
    wisp.position.y = 6.5
    wisp.rotation.y = Math.PI / 4
    this.group.add(wisp)
    this.animParts.push(wisp)

    // Floating wisp particles
    this.particles = makeParticles(8, 0.8, 0xddddff, 0.15)
    this.particles.position.y = 4.0
    this.group.add(this.particles)
  }

  // ── Thornwick: enchanted bookstand with floating spinning books ─────
  private buildBookstand() {
    // Wooden stand
    const standLeg1 = new THREE.Mesh(box(0.1, 2.5, 0.1), mat(0x664422))
    standLeg1.position.set(-0.3, 1.25, -0.3)
    this.group.add(standLeg1)
    const standLeg2 = new THREE.Mesh(box(0.1, 2.5, 0.1), mat(0x664422))
    standLeg2.position.set(0.3, 1.25, -0.3)
    this.group.add(standLeg2)
    const standLeg3 = new THREE.Mesh(box(0.1, 2.5, 0.1), mat(0x664422))
    standLeg3.position.set(0, 1.25, 0.3)
    this.group.add(standLeg3)

    // Shelf
    const shelf = new THREE.Mesh(box(1.0, 0.08, 0.8), mat(0x664422))
    shelf.position.y = 2.5
    this.group.add(shelf)

    // Open book on shelf (emissive green glow — the "reading" book)
    const openBook = new THREE.Mesh(box(0.5, 0.06, 0.4),
      basicMat(0x88aa44, 0.9))
    openBook.position.y = 2.58
    this.group.add(openBook)

    // Floating books orbiting above (3 books at different heights)
    const bookColors = [0x882211, 0x225588, 0x448822]
    for (let i = 0; i < 3; i++) {
      const book = new THREE.Mesh(box(0.4, 0.12, 0.3), mat(bookColors[i]))
      book.position.y = 3.5 + i * 1.2
      this.group.add(book)
      this.animParts.push(book)
    }

    // Magic sparkle particles
    this.particles = makeParticles(8, 1.0, 0xaaff66, 0.15)
    this.particles.position.y = 4.5
    this.group.add(this.particles)
  }

  update(time: number) {
    switch (this.npcId) {
      case 'finch':
        // Pennant flutter
        for (let i = 0; i < this.animParts.length; i++) {
          const strip = this.animParts[i]
          strip.position.x = Math.sin(time * 3.0 + i * 0.8) * 0.08
          strip.rotation.y = Math.sin(time * 2.5 + i * 0.5) * 0.15
        }
        break

      case 'vesper':
        // Orbit star sparks
        if (this.particles) {
          const attr = this.particles.geometry.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < attr.count; i++) {
            const a = i * (Math.PI * 2 / attr.count) + time * 0.8
            attr.setX(i, Math.cos(a) * 1.5)
            attr.setY(i, Math.sin(time * 0.5 + i * 0.9) * 1.0)
            attr.setZ(i, Math.sin(a) * 1.5)
          }
          attr.needsUpdate = true
        }
        break

      case 'bramble': {
        // Fire flicker
        const fire = this.animParts[0]
        if (fire) {
          fire.scale.y = 0.8 + Math.sin(time * 8) * 0.2 + Math.sin(time * 13) * 0.1
          fire.scale.x = 0.9 + Math.sin(time * 6) * 0.1
        }
        // Rising smoke + embers
        this.updateColumnParticles(time)
        // Ember particles
        if (this.emberParticles) {
          const ea = this.emberParticles.geometry.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < ea.count; i++) {
            const baseY = ((time * 1.5 + i * 1.1) % 6.0)
            ea.setY(i, baseY)
            ea.setX(i, (Math.sin(time * 2 + i * 2.3) * 0.3))
            ea.setZ(i, (Math.cos(time * 1.8 + i * 1.7) * 0.3))
          }
          ea.needsUpdate = true
        }
        break
      }

      case 'plume':
        // Lantern sway
        for (let i = 0; i < this.animParts.length; i++) {
          const lantern = this.animParts[i]
          lantern.position.y = 3.9 + Math.sin(time * 2.0 + i * 2.0) * 0.06
          const lMat = lantern.material as THREE.MeshBasicMaterial
          if (lMat.opacity !== undefined) {
            lMat.opacity = 0.7 + Math.sin(time * 3.5 + i * 1.3) * 0.15
          }
        }
        break

      case 'cinder': {
        // Hot metal pulse
        const hotMetal = this.animParts[0]
        if (hotMetal) {
          const hMat = hotMetal.material as THREE.MeshBasicMaterial
          hMat.opacity = 0.7 + Math.sin(time * 4) * 0.2
        }
        // Rising sparks
        this.updateColumnParticles(time)
        break
      }

      case 'pearl':
        // Wisp column pulse (pillar segments)
        for (let i = 0; i < this.animParts.length - 1; i++) {
          const seg = this.animParts[i]
          const pMat = seg.material as THREE.MeshBasicMaterial
          pMat.opacity = 0.15 + Math.sin(time * 2.0 + i * 0.7) * 0.1
          seg.position.x = Math.sin(time * 1.5 + i * 1.1) * 0.05
          seg.position.z = Math.cos(time * 1.3 + i * 0.9) * 0.05
        }
        // Top wisp bob
        {
          const wisp = this.animParts[this.animParts.length - 1]
          if (wisp) {
            wisp.position.y = 6.5 + Math.sin(time * 1.8) * 0.3
            wisp.rotation.y = time * 1.5
          }
        }
        // Orbit wisps
        if (this.particles) {
          const attr = this.particles.geometry.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < attr.count; i++) {
            const a = i * (Math.PI * 2 / attr.count) + time * 0.6
            const r = 0.8 + Math.sin(time * 0.8 + i) * 0.3
            attr.setX(i, Math.cos(a) * r)
            attr.setY(i, Math.sin(time * 0.4 + i * 0.8) * 2.0)
            attr.setZ(i, Math.sin(a) * r)
          }
          attr.needsUpdate = true
        }
        break

      case 'thornwick':
        // Floating books orbit and spin
        for (let i = 0; i < this.animParts.length; i++) {
          const book = this.animParts[i]
          const a = time * (0.5 + i * 0.15) + i * (Math.PI * 2 / 3)
          const r = 0.8 + i * 0.2
          book.position.x = Math.cos(a) * r
          book.position.z = Math.sin(a) * r
          book.position.y = 3.5 + i * 1.2 + Math.sin(time * 1.2 + i * 1.5) * 0.2
          book.rotation.y = time * (1.0 + i * 0.3)
          book.rotation.x = Math.sin(time * 0.8 + i) * 0.2
        }
        // Magic sparkles
        if (this.particles) {
          const attr = this.particles.geometry.attributes.position as THREE.BufferAttribute
          for (let i = 0; i < attr.count; i++) {
            const a = i * (Math.PI * 2 / attr.count) + time * 1.0
            attr.setX(i, Math.cos(a) * 1.0)
            attr.setY(i, Math.sin(time * 0.6 + i * 0.7) * 1.5)
            attr.setZ(i, Math.sin(a) * 1.0)
          }
          attr.needsUpdate = true
        }
        break
    }
  }

  private updateColumnParticles(time: number) {
    if (!this.columnParticles) return
    const attr = this.columnParticles.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < attr.count; i++) {
      // Rise upward, loop back
      const speed = 0.8 + (i % 3) * 0.3
      const baseY = ((time * speed + i * 0.6) % 8.0)
      attr.setY(i, baseY)
      // Drift sideways
      const drift = Math.sin(time * 0.7 + i * 1.3) * this.particleSpread * 0.5
      attr.setX(i, drift)
      attr.setZ(i, Math.cos(time * 0.5 + i * 1.7) * this.particleSpread * 0.4)
    }
    attr.needsUpdate = true
  }

  dispose() {
    this.group.parent?.remove(this.group)
  }
}
