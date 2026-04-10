# Crawler-World Release Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the crawler-world autoshooter from alpha to release quality by improving lighting, enemy feedback, projectile effects, post-processing, audio, and adding the remaining 16 weapons.

**Architecture:** All changes are in `packages/crawler-world/` and touch existing files. No new systems needed — the game already has biome vegetation, weather particles, animated water, hub growth, boss system, companions, corruption, damage numbers, death particles, screen shake, vignette, and day/night with god rays. This plan focuses on tuning, visual feedback, and weapon content.

**Tech Stack:** TypeScript, Three.js, bitECS, Web Audio API

**Spec:** Approved design from brainstorming session 2026-04-10.

---

## File Structure

### Modified files

```
packages/crawler-world/src/
  Game.ts                         <- Wire hit flash, pass elapsed time to chunks
  combat/CombatEffects.ts         <- Add hit flash, death animation, freeze frame
  combat/ProjectileSystem.ts      <- Emissive projectiles, trail lines, impact sparks
  combat/WeaponDefs.ts            <- Add 16 new weapon definitions
  combat/WeaponSystem.ts          <- Handle new weapon categories (mine, seeker, etc.)
  combat/OrbitalSystem.ts         <- Handle new orbital weapon variants
  enemies/EnemyFactory.ts         <- Wire hit flash material swap
  enemies/EnemyMeshBuilder.ts     <- Add biome color tinting
  audio/GameAudio.ts              <- Weapon-specific SFX, hub music, combat intensity
  hub/HubScene.ts                 <- Improve lighting, add hub ambient music
  expedition/BiomeSetup.ts        <- Wire color grading per biome
  hud/HUD.ts                     <- Add weapon evolution labels
```

---

## Task 1: Improve Hub Scene Lighting & Atmosphere

**Files:**
- Modify: `packages/crawler-world/src/hub/HubScene.ts`
- Modify: `packages/crawler-world/src/Game.ts`

- [ ] **Step 1: Brighten hub ambient and directional lights**

In `packages/crawler-world/src/hub/HubScene.ts`, in the `activate()` method, find:
```typescript
const ambient = new THREE.AmbientLight(0x8899bb, 0.8)
```
Replace the ambient + directional light block with:
```typescript
    // ── Ambient + directional + fill light ───────────────────────────────────
    const ambient = new THREE.AmbientLight(0xaabbdd, 1.2)
    this.addObject(ambient)

    const sun = new THREE.DirectionalLight(0xffeedd, 1.8)
    sun.position.set(30, 50, 20)
    this.addObject(sun)

    // Warm fill light from below-front to lift shadows
    const fill = new THREE.DirectionalLight(0xffddaa, 0.4)
    fill.position.set(-10, -5, 30)
    this.addObject(fill)
```

- [ ] **Step 2: Warm up background and reduce fog density**

In the same `activate()` method, find:
```typescript
    this.renderer.scene.background = new THREE.Color(0x223344)
    this.renderer.scene.fog = new THREE.FogExp2(0x223344, 0.015)
```
Replace with:
```typescript
    this.renderer.scene.background = new THREE.Color(0x1a2a3a)
    this.renderer.scene.fog = new THREE.FogExp2(0x1a2a3a, 0.008)
```

- [ ] **Step 3: Add flickering torch effect**

Add a new method to `HubScene`:
```typescript
  private torchLights: THREE.PointLight[] = []
  private torchTime = 0

  updateTorchFlicker(delta: number): void {
    this.torchTime += delta
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = 5
      const flicker = Math.sin(this.torchTime * 8 + i * 2.1) * 0.8
        + Math.sin(this.torchTime * 13 + i * 4.3) * 0.4
      this.torchLights[i].intensity = base + flicker
    }
  }
```

In `activate()`, when creating torches (the `torchPositions` loop), store the lights:
```typescript
    this.torchLights = []
    const torchPositions: [number, number, number][] = [[-6, 3, -8], [6, 3, -8]]
    for (const [x, y, z] of torchPositions) {
      const torchGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2)
      const torchMat = new THREE.MeshLambertMaterial({ color: 0x553311 })
      const torch = new THREE.Mesh(torchGeo, torchMat)
      torch.position.set(x, y, z)
      this.addObject(torch)

      const light = new THREE.PointLight(0xffaa44, 5, 20)
      light.position.set(x, y + 0.5, z)
      this.addObject(light)
      this.torchLights.push(light)
    }
```

- [ ] **Step 4: Wire torch flicker into game loop**

In `packages/crawler-world/src/Game.ts`, in the `loop()` method, inside the `if (this.expeditionManager.isInHub())` block, add after `this.hubScene.updateLabels()`:
```typescript
      this.hubScene.updateTorchFlicker(delta)
```

- [ ] **Step 5: Pass elapsed time to ChunkManager for water animation**

In `Game.ts`, in the combat section of `loop()`, find:
```typescript
      this.chunkManager.update(pos.x, pos.z)
```
Replace with:
```typescript
      this.chunkManager.update(pos.x, pos.z, timestamp / 1000)
```

- [ ] **Step 6: Commit**

```bash
git add packages/crawler-world/src/hub/HubScene.ts packages/crawler-world/src/Game.ts
git commit -m "feat(crawler): improve hub lighting, add torch flicker, animate water"
```

---

## Task 2: Enemy Hit Flash & Death Animation

**Files:**
- Modify: `packages/crawler-world/src/combat/CombatEffects.ts`
- Modify: `packages/crawler-world/src/Game.ts`
- Modify: `packages/crawler-world/src/enemies/EnemyFactory.ts`

- [ ] **Step 1: Add hit flash system to CombatEffects**

In `packages/crawler-world/src/combat/CombatEffects.ts`, add after the `ShakeState` interface:

```typescript
// ─── Hit flash ──────────────────────────────────────────────────────────────

interface HitFlash {
  mesh: THREE.Group
  originalMats: Map<THREE.Mesh, THREE.Material>
  timer: number
}

const HIT_FLASH_DURATION = 0.1
const _whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff })
```

Add to the class fields:
```typescript
  private hitFlashes: HitFlash[] = []
```

Add public method:
```typescript
  /** Flash an enemy group white for a brief moment */
  hitFlash(group: THREE.Group): void {
    const originals = new Map<THREE.Mesh, THREE.Material>()
    group.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (mesh.isMesh && !originals.has(mesh)) {
        originals.set(mesh, mesh.material as THREE.Material)
        mesh.material = _whiteMat
      }
    })
    this.hitFlashes.push({ mesh: group, originalMats: originals, timer: HIT_FLASH_DURATION })
  }
```

In the `update()` method, add a call to `this.updateHitFlashes(delta)`.

Add the private update method:
```typescript
  private updateHitFlashes(delta: number): void {
    for (let i = this.hitFlashes.length - 1; i >= 0; i--) {
      const flash = this.hitFlashes[i]
      flash.timer -= delta
      if (flash.timer <= 0) {
        // Restore original materials
        for (const [mesh, mat] of flash.originalMats) {
          if (mesh.parent) mesh.material = mat
        }
        this.hitFlashes.splice(i, 1)
      }
    }
  }
```

- [ ] **Step 2: Add death shrink animation**

In `packages/crawler-world/src/enemies/EnemyFactory.ts`, in the `EnemyManager` class, add a death animation system.

Add field:
```typescript
  private dying: { mesh: THREE.Group; timer: number; duration: number }[] = []
```

Add method:
```typescript
  /** Animate enemy death (shrink + fade). Call instead of immediate remove. */
  animateDeath(index: number): THREE.Group | null {
    const enemy = this.enemies[index]
    if (!enemy) return null
    const mesh = enemy.mesh
    this.enemies.splice(index, 1)
    // Don't remove from scene yet — animate first
    this.dying.push({ mesh, timer: 0.3, duration: 0.3 })
    return mesh
  }

  updateDeathAnimations(delta: number): void {
    for (let i = this.dying.length - 1; i >= 0; i--) {
      const d = this.dying[i]
      d.timer -= delta
      const progress = 1 - d.timer / d.duration
      const scale = Math.max(0, 1 - progress)
      d.mesh.scale.setScalar(scale * d.mesh.userData.originalScale)
      if (d.timer <= 0) {
        this.scene.remove(d.mesh)
        disposeMeshGroup(d.mesh)
        this.dying.splice(i, 1)
      }
    }
  }
```

In the existing `spawn()` method, after setting `group.scale.setScalar(scale)`, store the original scale:
```typescript
    group.userData.originalScale = scale
```

- [ ] **Step 3: Wire hit flash and death animation into Game.ts**

In `Game.ts`, in the `enemyDied` event handler, add hit flash before death particles:
```typescript
    this.eventBus.on('enemyDied', (data: { position: THREE.Vector3; archetype: string; eid: number; color?: THREE.Color }) => {
      this.expeditionManager.recordEnemyKill()
      if (this.companionSystem.active) {
        this.companionSystem.addXp(10)
      }
      this.gameAudio.playKillSound()
      this.combatEffects.deathParticles(
        this.renderer.scene,
        data.position,
        data.color ?? new THREE.Color(1, 0.3, 0),
      )
    })
```

In the damage processing loop (where `this.damageSystem.applyDamage` is called), add hit flash for non-kills:
```typescript
        if (!killed) {
          this.gameAudio.playHitSound()
          const enemy = this.enemyManager.enemies[hit.enemyIndex]
          if (enemy) this.combatEffects.hitFlash(enemy.mesh)
        }
```

In the combat update section of `loop()`, add after `this.damageSystem.update(delta)`:
```typescript
      this.enemyManager.updateDeathAnimations(delta)
```

- [ ] **Step 4: Add freeze frame on big kills**

In `CombatEffects`, add:
```typescript
  private freezeTimer = 0

  /** Brief time-freeze for impactful kills */
  freezeFrame(duration: number): void {
    this.freezeTimer = Math.max(this.freezeTimer, duration)
  }

  /** Returns true if the game should skip this frame's simulation */
  isFrozen(): boolean {
    return this.freezeTimer > 0
  }
```

In the `update()` method, add at the top:
```typescript
    if (this.freezeTimer > 0) {
      this.freezeTimer -= delta
    }
```

In `Game.ts`, in the `enemyDied` handler, add freeze for tanks/bosses:
```typescript
      if (data.archetype === 'tank') {
        this.combatEffects.freezeFrame(0.06)
      }
```

In the combat section of `loop()`, add freeze check at the start:
```typescript
      if (this.combatEffects.isFrozen()) {
        this.renderer.render(delta)
        requestAnimationFrame((t) => this.loop(t))
        return
      }
```
(Place this right after the `!this.paused` check in the `else if` condition.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(crawler): add enemy hit flash, death animation, freeze frames"
```

---

## Task 3: Projectile Visual Effects

**Files:**
- Modify: `packages/crawler-world/src/combat/ProjectileSystem.ts`

- [ ] **Step 1: Make projectiles emissive and colored by weapon**

In `ProjectileSystem.ts`, change the pool construction. Replace:
```typescript
    const geo = new THREE.SphereGeometry(0.15, 6, 6)
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffee44 })
```
With:
```typescript
    const geo = new THREE.SphereGeometry(0.15, 6, 6)
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffee44,
        emissive: 0xffee44,
        emissiveIntensity: 2.0,
      })
```

- [ ] **Step 2: Add projectile color parameter to spawn()**

In the `spawn()` method signature, add an optional `color` parameter:
```typescript
  spawn(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    speed: number,
    damage: number,
    maxRange: number,
    bounceCount = 0,
    color = 0xffee44,
  ): void {
```

When activating a projectile, set its color:
```typescript
    const mat = p.mesh.material as THREE.MeshStandardMaterial
    mat.color.setHex(color)
    mat.emissive.setHex(color)
```

- [ ] **Step 3: Add impact spark particles on projectile hit**

Add a new field and method to `ProjectileSystem`:
```typescript
  private impactParticles: { mesh: THREE.Mesh; vel: THREE.Vector3; timer: number }[] = []
  private impactGeo = new THREE.SphereGeometry(0.08, 4, 4)

  private spawnImpact(pos: THREE.Vector3, color: number): void {
    const count = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true })
      const mesh = new THREE.Mesh(this.impactGeo, mat)
      mesh.position.copy(pos)
      this.scene.add(mesh)
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        Math.random() * 4 + 1,
        (Math.random() - 0.5) * 8,
      )
      this.impactParticles.push({ mesh, vel, timer: 0.3 })
    }
  }
```

Call `this.spawnImpact(p.mesh.position, mat.color.getHex())` when a projectile hits an enemy (in the `update()` method, where hits are detected).

Add to the `update()` method bottom:
```typescript
    // Update impact particles
    for (let i = this.impactParticles.length - 1; i >= 0; i--) {
      const sp = this.impactParticles[i]
      sp.timer -= delta
      sp.mesh.position.addScaledVector(sp.vel, delta)
      sp.vel.y -= 15 * delta
      const m = sp.mesh.material as THREE.MeshBasicMaterial
      m.opacity = sp.timer / 0.3
      if (sp.timer <= 0) {
        this.scene.remove(sp.mesh)
        m.dispose()
        this.impactParticles.splice(i, 1)
      }
    }
```

- [ ] **Step 4: Commit**

```bash
git add packages/crawler-world/src/combat/ProjectileSystem.ts
git commit -m "feat(crawler): emissive projectiles, impact sparks, weapon coloring"
```

---

## Task 4: Per-Biome Post-Processing

**Files:**
- Modify: `packages/crawler-world/src/Game.ts`
- Modify: `packages/crawler-world/src/expedition/BiomeSetup.ts`

- [ ] **Step 1: Add biome color grading config**

In `packages/crawler-world/src/expedition/BiomeSetup.ts`, add after the `BIOME_FOG` map:

```typescript
// ─── Per-biome color grading for post-processing ────────────────────────────

interface ColorGradeSpec {
  tint: [number, number, number]
  contrast: number
  saturation: number
}

const BIOME_COLOR_GRADE: Partial<Record<BiomeType, ColorGradeSpec>> = {
  [BiomeType.Forest]:   { tint: [0.95, 1.05, 0.90], contrast: 1.05, saturation: 1.1 },
  [BiomeType.Desert]:   { tint: [1.10, 1.05, 0.85], contrast: 1.10, saturation: 0.9 },
  [BiomeType.Snow]:     { tint: [0.90, 0.95, 1.10], contrast: 1.00, saturation: 0.8 },
  [BiomeType.Volcanic]: { tint: [1.15, 0.85, 0.75], contrast: 1.15, saturation: 1.2 },
  [BiomeType.Swamp]:    { tint: [0.90, 1.00, 0.80], contrast: 0.95, saturation: 0.9 },
  [BiomeType.Crystal]:  { tint: [0.85, 0.90, 1.15], contrast: 1.05, saturation: 1.3 },
  [BiomeType.Jungle]:   { tint: [0.85, 1.10, 0.80], contrast: 1.05, saturation: 1.2 },
  [BiomeType.Mesa]:     { tint: [1.15, 0.95, 0.80], contrast: 1.10, saturation: 1.0 },
}

export function getBiomeColorGrade(type: BiomeType): ColorGradeSpec {
  return BIOME_COLOR_GRADE[type] ?? { tint: [1, 1, 1], contrast: 1, saturation: 1 }
}
```

- [ ] **Step 2: Wire color grading into combat start**

In `packages/crawler-world/src/Game.ts`, import `getBiomeColorGrade` from BiomeSetup.

In `startCombat()`, after the `applyBiomeFog` call, add:
```typescript
    // Apply biome color grading to post-processing
    const grade = getBiomeColorGrade(biomeType)
    this.renderer.colorGradePass.setBiomeColorGrade(grade.tint, grade.contrast, grade.saturation)
```

- [ ] **Step 3: Enable retro scanlines and damage flash**

In `_initCombatSystems()`, after the DayNightSystem init block, add:
```typescript
    // Enable retro scanlines (subtle) and prepare damage flash
    this.renderer.crtPass.setEnabled(true)
    this.renderer.crtPass.setIntensity(0.15) // subtle scanlines
    this.renderer.damagePass.setEnabled(true)
```

Wire damage flash on player hit. In the combat loop where player damage is detected:
```typescript
      if (healthWrapper.current < healthBefore) {
        this.gameAudio.playPlayerHitSound()
        this.combatEffects.screenShake(this.renderer.camera, 0.2, 0.3)
        this.renderer.damagePass.flash(0.3) // red flash for 0.3s
      }
```

Note: If `CRTPass.setEnabled()`, `CRTPass.setIntensity()`, or `DamagePass.flash()` don't exist yet, check the engine pass implementations and add these methods. The passes exist in `packages/engine/src/renderer/passes/` — read them to find the right API.

- [ ] **Step 4: Reset post-processing when returning to hub**

In `activateHub()`, add:
```typescript
    this.renderer.colorGradePass.setBiomeColorGrade([1, 1, 1], 1, 1)
    this.renderer.crtPass.setEnabled(false)
    this.renderer.damagePass.setEnabled(false)
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(crawler): per-biome color grading, CRT scanlines, damage flash"
```

---

## Task 5: Audio Polish

**Files:**
- Modify: `packages/crawler-world/src/audio/GameAudio.ts`
- Modify: `packages/crawler-world/src/hub/HubScene.ts`
- Modify: `packages/crawler-world/src/Game.ts`

- [ ] **Step 1: Add weapon-category-specific fire sounds**

In `GameAudio.ts`, replace the single `playHitSound` with category-aware methods:
```typescript
  playShootSound(category: string): void {
    switch (category) {
      case 'projectile': this.playTone(900, 0.04, 0.08, 'square'); break
      case 'area':       this.playNoise(0.06, 0.2); break
      case 'chain':      this.playTone(1400, 0.03, 0.12, 'sawtooth'); break
      case 'deployable': this.playTone(400, 0.05, 0.15, 'triangle'); break
      case 'gravity':    this.playTone(150, 0.04, 0.3, 'sine'); break
      default:           this.playTone(800, 0.04, 0.1, 'square'); break
    }
  }
```

Add a noise method for area weapon SFX:
```typescript
  private playNoise(volume: number, duration: number): void {
    const ctx = this.getContext()
    if (!ctx) return
    const sfxGain = this.getSfxGain()
    if (!sfxGain) return

    const bufferSize = ctx.sampleRate * duration
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * volume * (1 - i / bufferSize)
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const g = ctx.createGain()
    g.gain.setValueAtTime(volume, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + duration)
    source.connect(g)
    g.connect(sfxGain)
    source.start()
  }
```

- [ ] **Step 2: Add hub ambient pad**

In `GameAudio.ts`, add:
```typescript
  private hubPad: OscillatorNode | null = null

  startHubMusic(): void {
    this.stopHubMusic()
    const ctx = this.getContext()
    if (!ctx) return
    const gain = this.getAmbienceGain()
    if (!gain) return

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = 174.61 // F3 - warm low pad
    const g = ctx.createGain()
    g.gain.value = 0.03
    osc.connect(g)
    g.connect(gain)
    osc.start()
    this.hubPad = osc
  }

  stopHubMusic(): void {
    try { this.hubPad?.stop() } catch { /* ok */ }
    this.hubPad = null
  }
```

- [ ] **Step 3: Wire hub music and weapon SFX into game**

In `Game.ts`, in `activateHub()`, add:
```typescript
    this.gameAudio.init()
    this.gameAudio.startHubMusic()
```

In `startCombat()` and `startUndergroundCombat()`, before starting biome music:
```typescript
    this.gameAudio.stopHubMusic()
```

- [ ] **Step 4: Add combat intensity percussion layer**

In `GameAudio.ts`, enhance `setCombatIntensity()`:
```typescript
  private percLoop: OscillatorNode | null = null

  setCombatIntensity(intensity: number): void {
    this.threatLevel = Math.max(0, Math.min(1, intensity))
    const ctx = this.getContext()
    if (!ctx) return
    const sfxGain = this.getSfxGain()
    if (!sfxGain) return

    // Start percussion loop when intensity > 0.3
    if (this.threatLevel > 0.3 && !this.percLoop) {
      const osc = ctx.createOscillator()
      osc.type = 'square'
      osc.frequency.value = 80
      const g = ctx.createGain()
      g.gain.value = 0.02
      osc.connect(g)
      g.connect(sfxGain)
      osc.start()
      this.percLoop = osc
    } else if (this.threatLevel <= 0.3 && this.percLoop) {
      try { this.percLoop.stop() } catch { /* ok */ }
      this.percLoop = null
    }

    // Modulate percussion volume with intensity
    if (this.percLoop) {
      const g = this.percLoop as unknown as { _gainNode?: GainNode }
      // The gain node is connected inline — intensity modulates biome music volume instead
    }
  }
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(crawler): weapon-specific SFX, hub ambient music, combat percussion"
```

---

## Task 6: Add Remaining 16 Weapons

**Files:**
- Modify: `packages/crawler-world/src/combat/WeaponDefs.ts`
- Modify: `packages/crawler-world/src/combat/WeaponSystem.ts`
- Modify: `packages/crawler-world/src/combat/WeaponEvolution.ts`

- [ ] **Step 1: Add 8 new base weapon definitions**

In `WeaponDefs.ts`, add after the existing weapons:
```typescript
  // ── New base weapons ──────────────────────────────────────────────────────
  seeker_swarm: {
    id: 'seeker_swarm', name: 'Seeker Swarm', category: 'projectile',
    damage: 8, cooldown: 0.3, range: 45, projectileSpeed: 25,
    projectileCount: 2, spreadAngle: 0.5, autoTarget: true,
  },
  void_mine: {
    id: 'void_mine', name: 'Void Mine', category: 'deployable',
    damage: 80, cooldown: 3.0, range: 6, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 6, deployDuration: 10,
  },
  sonic_boom: {
    id: 'sonic_boom', name: 'Sonic Boom', category: 'area',
    damage: 35, cooldown: 1.5, range: 15, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 15, aoeDuration: 0.5,
  },
  flak_cannon: {
    id: 'flak_cannon', name: 'Flak Cannon', category: 'projectile',
    damage: 6, cooldown: 0.8, range: 30, projectileSpeed: 30,
    projectileCount: 8, spreadAngle: 0.6, autoTarget: false,
  },
  homing_missile: {
    id: 'homing_missile', name: 'Homing Missile', category: 'projectile',
    damage: 40, cooldown: 2.0, range: 60, projectileSpeed: 20,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
  },
  chain_lightning: {
    id: 'chain_lightning', name: 'Chain Lightning', category: 'chain',
    damage: 20, cooldown: 1.0, range: 30, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    chainCount: 4, chainRange: 12,
  },
  gravity_well: {
    id: 'gravity_well', name: 'Gravity Well', category: 'gravity',
    damage: 5, cooldown: 8.0, range: 20, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    pullDuration: 4, pullStrength: 8,
  },
  drone_buddy: {
    id: 'drone_buddy', name: 'Drone Buddy', category: 'orbital',
    damage: 12, cooldown: 0.5, range: 25, projectileSpeed: 30,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    orbitRadius: 4, orbitSpeed: 2.0, orbitCount: 1,
  },
```

- [ ] **Step 2: Add 8 evolved weapon definitions**

```typescript
  // ── Evolved weapons ───────────────────────────────────────────────────────
  railgun: {
    id: 'railgun', name: 'Railgun', category: 'projectile',
    damage: 60, cooldown: 1.0, range: 80, projectileSpeed: 80,
    projectileCount: 1, spreadAngle: 0, autoTarget: false,
  },
  spread_cannon: {
    id: 'spread_cannon', name: 'Spread Cannon', category: 'projectile',
    damage: 14, cooldown: 0.5, range: 35, projectileSpeed: 38,
    projectileCount: 5, spreadAngle: 0.35, autoTarget: true,
  },
  mega_ricochet: {
    id: 'mega_ricochet', name: 'Mega Ricochet', category: 'projectile',
    damage: 30, cooldown: 0.5, range: 80, projectileSpeed: 45,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    bounceCount: 5,
  },
  nova_blast: {
    id: 'nova_blast', name: 'Nova Blast', category: 'area',
    damage: 50, cooldown: 1.5, range: 20, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 20, aoeDuration: 0.6,
  },
  tesla_coil: {
    id: 'tesla_coil', name: 'Tesla Coil', category: 'chain',
    damage: 35, cooldown: 0.8, range: 35, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    chainCount: 8, chainRange: 15,
  },
  singularity: {
    id: 'singularity', name: 'Singularity', category: 'gravity',
    damage: 15, cooldown: 12.0, range: 25, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    pullDuration: 6, pullStrength: 15,
  },
  swarm_queen: {
    id: 'swarm_queen', name: 'Swarm Queen', category: 'projectile',
    damage: 12, cooldown: 0.15, range: 40, projectileSpeed: 30,
    projectileCount: 3, spreadAngle: 0.7, autoTarget: true,
  },
  sky_beam: {
    id: 'sky_beam', name: 'Sky Beam', category: 'area',
    damage: 100, cooldown: 6.0, range: 10, projectileSpeed: 0,
    projectileCount: 1, spreadAngle: 0, autoTarget: true,
    aoeRadius: 10, aoeDuration: 1.5,
  },
```

- [ ] **Step 3: Add evolution paths**

In `packages/crawler-world/src/combat/WeaponEvolution.ts`, add the evolution map entries for all new weapons. Read the existing file format first and follow the same pattern, mapping each base weapon to its evolved form at level 5.

Evolution paths:
- `bolt_caster` → `railgun`
- `tri_shot` → `spread_cannon`
- `ricochet` → `mega_ricochet`
- `shockwave` → `nova_blast`
- `chain_lightning` → `tesla_coil`
- `gravity_well` → `singularity`
- `seeker_swarm` → `swarm_queen`
- `sonic_boom` → `sky_beam`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(crawler): add 16 new weapons with evolved variants"
```

---

## Task 7: Final Visual Polish Pass

**Files:**
- Modify: `packages/crawler-world/src/combat/CombatEffects.ts`
- Modify: `packages/crawler-world/src/hud/HUD.ts`
- Modify: `packages/crawler-world/src/enemies/EnemyMeshBuilder.ts`

- [ ] **Step 1: Color-code damage numbers by amount**

In `CombatEffects.ts`, in `showDamageNumber()`, add color coding:
```typescript
  showDamageNumber(worldPos: THREE.Vector3, amount: number): void {
    const label = this.labelPool.find((l) => !l.active)
    if (!label) return
    label.active = true
    label.timer = LABEL_DURATION
    label.duration = LABEL_DURATION
    label.worldPos.copy(worldPos)
    label.el.textContent = `-${Math.round(amount)}`

    // Color by damage amount
    if (amount >= 100) {
      label.el.style.color = '#ff44ff'   // magenta: huge
      label.el.style.fontSize = '22px'
    } else if (amount >= 50) {
      label.el.style.color = '#ff4444'   // red: heavy
      label.el.style.fontSize = '18px'
    } else if (amount >= 25) {
      label.el.style.color = '#ffaa44'   // orange: medium
      label.el.style.fontSize = '16px'
    } else {
      label.el.style.color = '#ffdd44'   // yellow: light
      label.el.style.fontSize = '14px'
    }

    label.el.style.display = 'block'
  }
```

- [ ] **Step 2: Add weapon tags to HUD weapon list**

In `packages/crawler-world/src/hud/HUD.ts`, when rendering the weapon list, check if the weapon ID starts with a known evolved prefix and add a tag. Read the existing HUD code to find where weapons are displayed and add `[EVOLVED]` or `[FUSED]` labels in a different color.

- [ ] **Step 3: Add biome-specific enemy color tinting**

In `packages/crawler-world/src/enemies/EnemyMeshBuilder.ts`, add biome influence to enemy colors. At the start of `buildEnemyMesh()`, if a biome type is available (add optional parameter), tint the body color:

```typescript
export function buildEnemyMesh(dna: CreatureDNA, archetype: string, biome?: number): THREE.Group {
  const group = new THREE.Group()
  const color = new THREE.Color(dna.bodyColor[0], dna.bodyColor[1], dna.bodyColor[2])

  // Tint toward biome palette
  if (biome !== undefined) {
    const biomeTints: Record<number, number> = {
      0: 0x336633, // Forest: greenish
      1: 0x998855, // Desert: sandy
      2: 0x445544, // Swamp: murky
      3: 0x8888aa, // Snow: icy
      4: 0x993322, // Volcanic: reddish
      5: 0x6677aa, // Crystal: bluish
      6: 0x337722, // Jungle: deep green
      7: 0x886644, // Mesa: terracotta
    }
    const tint = biomeTints[biome]
    if (tint) {
      const tc = new THREE.Color(tint)
      color.lerp(tc, 0.25) // 25% biome tint
    }
  }
```

Update `EnemyFactory.ts` to pass the biome to `buildEnemyMesh()`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(crawler): color-coded damage, weapon tags, biome enemy tinting"
```

---

## Task 8: Verify & Playtest

**Files:** None — verification only.

- [ ] **Step 1: Build and check for errors**

```bash
cd /Users/michalplodek/Documents/Code/claudemobile
pnpm --filter @crawler-world/game exec vite build
```
Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 2: Run dev server and playtest**

```bash
pnpm dev:crawler
```

Open in browser and verify:
- Hub scene: brighter lighting, flickering torches, NPC labels visible
- Click Commander → select Forest biome → combat starts
- Combat: emissive projectiles, impact sparks, enemy hit flash (white blink)
- Kill enemy: death shrink animation, colored death particles, damage numbers color-coded
- Kill tank: brief freeze frame
- Post-processing: biome color grading visible, subtle CRT scanlines
- Audio: hub pad music, biome music on expedition, weapon SFX, combat percussion at high intensity
- Take damage: screen shake + red damage flash
- Level up: new weapons appear in options

- [ ] **Step 3: Commit verification**

```bash
git add -A
git commit -m "chore: verify crawler-world release polish — playtest passed"
```
