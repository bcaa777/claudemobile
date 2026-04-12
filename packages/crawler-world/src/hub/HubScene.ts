import * as THREE from 'three'
import type { Renderer } from '@engine/core'
import type { MetaState } from '../state/MetaState'
import { WorldMap } from './WorldMap'
import { ShopUI } from './ShopUI'
import { CompanionPickerUI } from './CompanionPickerUI'
import { WeaponSmithUI } from './WeaponSmithUI'
import { CompanionTrainerUI } from './CompanionTrainerUI'
import { MutationLabUI } from './MutationLabUI'
import { HubGrowth } from './HubGrowth'
import { BiomeType } from '@engine/core'

interface NPC {
  mesh: THREE.Group
  label: string
}

interface NPCDef {
  id: string
  label: string
  subLabel: string
  color: number
  labelColor: number
  pos: [number, number, number]
  minCleansed: number
}

function buildNPCMesh(color: number): THREE.Group {
  const group = new THREE.Group()
  const mat = new THREE.MeshLambertMaterial({ color })

  // Body (box)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.35), mat)
  body.position.y = 0.85
  group.add(body)

  // Head (sphere)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshLambertMaterial({ color: 0xddbb99 }))
  head.position.y = 1.55
  group.add(head)

  // Legs (2 cylinders)
  const legMat = new THREE.MeshLambertMaterial({ color: 0x444444 })
  const legGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.7, 6)
  const legL = new THREE.Mesh(legGeo, legMat)
  legL.position.set(-0.15, 0.35, 0)
  const legR = new THREE.Mesh(legGeo, legMat)
  legR.position.set(0.15, 0.35, 0)
  group.add(legL, legR)

  // Arms (2 cylinders)
  const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6)
  const armL = new THREE.Mesh(armGeo, mat)
  armL.position.set(-0.4, 0.85, 0)
  armL.rotation.z = 0.3
  const armR = new THREE.Mesh(armGeo, mat)
  armR.position.set(0.4, 0.85, 0)
  armR.rotation.z = -0.3
  group.add(armL, armR)

  return group
}

const NPC_DEFS: NPCDef[] = [
  { id: 'commander',        label: 'COMMANDER',    subLabel: '[E] Embark',    color: 0x2244aa, labelColor: 0x6688ff, pos: [0, 0.8, -12],   minCleansed: 0 },
  { id: 'merchant',         label: 'MERCHANT',     subLabel: '[E] Shop',      color: 0xaa8811, labelColor: 0xffcc44, pos: [10, 0.8, -6],   minCleansed: 0 },
  { id: 'companion',        label: 'COMPANION',    subLabel: '[E] Choose',    color: 0x228833, labelColor: 0x88ff88, pos: [-10, 0.8, -6],  minCleansed: 0 },
  { id: 'weaponsmith',      label: 'WEAPON SMITH', subLabel: '[E] Reforge',   color: 0xcc3311, labelColor: 0xff7755, pos: [-15, 0.8, -14], minCleansed: 1 },
  { id: 'companiontrainer', label: 'TRAINER',      subLabel: '[E] Train',     color: 0x228844, labelColor: 0x66ffaa, pos: [0, 0.8, 8],     minCleansed: 2 },
  { id: 'mutationlab',      label: 'MUTATION LAB', subLabel: '[E] Research',  color: 0x882299, labelColor: 0xcc66ff, pos: [-12, 0.8, -18], minCleansed: 4 },
  { id: 'archivist',        label: 'ARCHIVIST',    subLabel: '[E] Browse',    color: 0xddddee, labelColor: 0xffffff, pos: [15, 0.8, -14],  minCleansed: 6 },
  { id: 'portalmaster',     label: 'PORTAL MASTER',subLabel: '[E] Travel',    color: 0x00cccc, labelColor: 0x44ffff, pos: [0, 0.8, -22],   minCleansed: 8 },
]

export class HubScene {
  private hubObjects: THREE.Object3D[] = []
  private npcs: NPC[] = []
  private torchLights: THREE.PointLight[] = []
  private torchTime = 0
  private worldMap: WorldMap
  private shopUI: ShopUI
  private companionPickerUI: CompanionPickerUI
  private weaponSmithUI: WeaponSmithUI
  private companionTrainerUI: CompanionTrainerUI
  private mutationLabUI: MutationLabUI
  private hubGrowth: HubGrowth
  private labelEls: HTMLElement[] = []
  private uiOpen = false

  private setUiOpen(open: boolean): void {
    this.uiOpen = open
    if (open) {
      document.exitPointerLock()
    } else {
      document.body.requestPointerLock()
    }
  }
  private nearbyNpc: string | null = null
  private interactPrompt: HTMLElement | null = null
  private storedMetaState: MetaState | null = null
  private storedOnBiomeSelected: ((biome: BiomeType) => void) | null = null
  private storedOnUndergroundSelected: ((id: number) => void) | null = null

  /** Companion id chosen in this hub visit — empty string means solo */
  selectedCompanionId: string = 'wolf'

  constructor(
    private renderer: Renderer,
    private container: HTMLElement,
  ) {
    this.worldMap = new WorldMap()
    this.shopUI = new ShopUI()
    this.companionPickerUI = new CompanionPickerUI()
    this.weaponSmithUI = new WeaponSmithUI()
    this.companionTrainerUI = new CompanionTrainerUI()
    this.mutationLabUI = new MutationLabUI()
    this.hubGrowth = new HubGrowth()
  }

  activate(
    metaState: MetaState,
    onBiomeSelected: (biome: BiomeType) => void,
    onUndergroundSelected?: (id: number) => void,
  ): void {
    this.clearScene()

    // Store callbacks for proximity-based interaction
    this.storedMetaState = metaState
    this.storedOnBiomeSelected = onBiomeSelected
    this.storedOnUndergroundSelected = onUndergroundSelected ?? null

    const cleansedCount = metaState.cleansedBiomes.length

    // ── Large ground plane ───────────────────────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(100, 100)
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x556644 })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.01
    this.addObject(ground)

    // ── Hub structures (progressive) ─────────────────────────────────────────
    this.hubGrowth.build(this.renderer.scene, this.hubObjects, cleansedCount)

    // ── Torches (always present baseline) ────────────────────────────────────
    this.torchLights = []
    const torchPositions: [number, number, number][] = [
      [-6, 3, -8], [6, 3, -8],
      [-12, 3, -12], [12, 3, -12],
      [-8, 3, 0], [8, 3, 0],
      [0, 3, -18],
    ]
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

    // ── Path markers (ground strips leading to NPCs) ─────────────────────────
    const pathMat = new THREE.MeshLambertMaterial({ color: 0x665533 })
    for (const def of NPC_DEFS) {
      if (cleansedCount < def.minCleansed) continue
      const [nx, , nz] = def.pos
      const dx = nx
      const dz = nz
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 1) continue
      const pathGeo = new THREE.BoxGeometry(1.2, 0.02, dist)
      const pathMesh = new THREE.Mesh(pathGeo, pathMat)
      pathMesh.position.set(dx / 2, 0, dz / 2)
      pathMesh.rotation.y = Math.atan2(dx, dz)
      this.addObject(pathMesh)
    }

    // ── NPCs (unlocked by cleansed count) ────────────────────────────────────
    for (const def of NPC_DEFS) {
      if (cleansedCount < def.minCleansed) continue

      const mesh = buildNPCMesh(def.color)
      mesh.position.set(...def.pos)
      mesh.scale.setScalar(1.5)
      mesh.userData = { npc: def.id }
      this.addObject(mesh)
      this.npcs.push({ mesh, label: def.label })
      this.addLabel(`${def.label}\n${def.subLabel}`, mesh.position, def.labelColor)
    }

    // ── Ambient + directional light ───────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xccddff, 2.0)
    this.addObject(ambient)

    const sun = new THREE.DirectionalLight(0xffeedd, 2.5)
    sun.position.set(30, 50, 20)
    this.addObject(sun)

    // Warm fill light from below-front to lift shadows
    const fill = new THREE.DirectionalLight(0xffddaa, 0.8)
    fill.position.set(-10, -5, 30)
    this.addObject(fill)

    // Warm point light at center of courtyard
    const centerLight = new THREE.PointLight(0xffddaa, 3, 30)
    centerLight.position.set(0, 4, -4)
    this.addObject(centerLight)

    // ── Scene background and fog ──────────────────────────────────────────────
    this.renderer.scene.background = new THREE.Color(0x2a3a4a)
    this.renderer.scene.fog = new THREE.FogExp2(0x2a3a4a, 0.005)

    // ── Interact prompt (shown when near an NPC) ─────────────────────────────
    this.interactPrompt = document.createElement('div')
    this.interactPrompt.style.cssText = `
      position: fixed; z-index: 100; bottom: 100px; left: 50%;
      transform: translateX(-50%);
      font-family: 'Courier New', monospace; font-size: 14px;
      color: #ffcc44; text-shadow: 0 0 8px #ff880088;
      pointer-events: none; display: none; letter-spacing: 2px;
    `
    document.body.appendChild(this.interactPrompt)
  }

  private handleNPCClick(
    npcId: string,
    metaState: MetaState,
    onBiomeSelected: (biome: BiomeType) => void,
    onUndergroundSelected?: (id: number) => void,
  ): void {
    switch (npcId) {
      case 'commander':
        this.setUiOpen(true)
        this.worldMap.show(
          metaState,
          (biome) => {
            this.setUiOpen(false)
            onBiomeSelected(biome)
          },
          () => { this.setUiOpen(false) },
          onUndergroundSelected
            ? (id) => {
                this.setUiOpen(false)
                onUndergroundSelected(id)
              }
            : undefined,
        )
        break

      case 'merchant':
        this.setUiOpen(true)
        this.shopUI.show(metaState, () => { this.setUiOpen(false) })
        break

      case 'companion':
        this.setUiOpen(true)
        this.companionPickerUI.show(
          this.selectedCompanionId,
          (id) => { this.selectedCompanionId = id },
          () => { this.setUiOpen(false) },
        )
        break

      case 'weaponsmith':
        this.setUiOpen(true)
        this.weaponSmithUI.show(metaState, () => { this.setUiOpen(false) })
        break

      case 'companiontrainer':
        this.setUiOpen(true)
        this.companionTrainerUI.show(metaState, () => { this.setUiOpen(false) })
        break

      case 'mutationlab':
        this.setUiOpen(true)
        this.mutationLabUI.show(metaState, () => { this.setUiOpen(false) })
        break

      case 'archivist':
        this.setUiOpen(true)
        this.showArchivistUI(metaState)
        break

      case 'portalmaster':
        this.setUiOpen(true)
        this.showPortalMasterUI()
        break
    }
  }

  private showArchivistUI(metaState: MetaState): void {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.88);
      display:flex;align-items:center;justify-content:center;
      font-family:'Courier New',monospace;
    `
    const panel = document.createElement('div')
    panel.style.cssText = `
      background:#08080f;border:2px solid #aaaacc;padding:28px 32px;
      min-width:420px;max-width:560px;
    `
    panel.innerHTML = `
      <h2 style="color:#ddddff;text-align:center;letter-spacing:4px;margin:0 0 14px;font-size:18px;text-shadow:0 0 10px #8888ff;">ARCHIVIST</h2>
      <div style="color:#666688;font-size:10px;text-align:center;margin-bottom:18px;">Records of your expeditions.</div>
      <div style="color:#8888aa;font-size:11px;line-height:2;">
        <div>Biomes cleansed: <span style="color:#ddddff;">${metaState.cleansedBiomes.length}</span></div>
        <div>Enemies encountered: <span style="color:#ddddff;">${metaState.encounterLog.join(', ') || 'None yet'}</span></div>
        <div>Resistances: <span style="color:#ddddff;">${Object.entries(metaState.resistances).map(([k,v])=>`${k} ${v*5}%`).join(', ') || 'None'}</span></div>
        <div>Companion upgrades: <span style="color:#ddddff;">${Object.keys(metaState.companionUpgrades).length} companions trained</span></div>
      </div>
    `
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '[ LEAVE ]'
    closeBtn.style.cssText = `
      display:block;margin:18px auto 0;background:transparent;
      border:1px solid #aaaacc;color:#ddddff;font-family:'Courier New',monospace;
      font-size:13px;padding:7px 22px;cursor:pointer;letter-spacing:2px;
    `
    closeBtn.addEventListener('click', () => {
      overlay.parentElement?.removeChild(overlay)
      this.setUiOpen(false)
    })
    panel.appendChild(closeBtn)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)
  }

  private showPortalMasterUI(): void {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.92);
      display:flex;align-items:center;justify-content:center;
      font-family:'Courier New',monospace;
    `
    const panel = document.createElement('div')
    panel.style.cssText = `
      background:#000d0d;border:2px solid #00bbcc;padding:28px 32px;
      min-width:400px;max-width:520px;
    `
    panel.innerHTML = `
      <h2 style="color:#44ffff;text-align:center;letter-spacing:4px;margin:0 0 14px;font-size:18px;text-shadow:0 0 10px #00aaaa;">PORTAL MASTER</h2>
      <div style="color:#226666;font-size:10px;text-align:center;margin-bottom:18px;">You have mastered the portal arts.</div>
      <div style="color:#44aaaa;font-size:12px;text-align:center;line-height:2;">
        All 8 biomes cleansed.<br>
        The ancient corruption retreats.<br>
        <span style="color:#44ffff;">Victory approaches...</span>
      </div>
    `
    const closeBtn = document.createElement('button')
    closeBtn.textContent = '[ CLOSE ]'
    closeBtn.style.cssText = `
      display:block;margin:18px auto 0;background:transparent;
      border:1px solid #00bbcc;color:#44ffff;font-family:'Courier New',monospace;
      font-size:13px;padding:7px 22px;cursor:pointer;letter-spacing:2px;
    `
    closeBtn.addEventListener('click', () => {
      overlay.parentElement?.removeChild(overlay)
      this.setUiOpen(false)
    })
    panel.appendChild(closeBtn)
    overlay.appendChild(panel)
    document.body.appendChild(overlay)
  }

  /** Check which NPC is closest to the player and show/hide the interact prompt. */
  checkProximity(playerPos: THREE.Vector3): void {
    let closestId: string | null = null
    let closestDist = 4.0 // interaction range

    for (const npc of this.npcs) {
      const dist = playerPos.distanceTo(npc.mesh.position)
      if (dist < closestDist) {
        closestDist = dist
        closestId = npc.mesh.userData.npc as string
      }
    }

    this.nearbyNpc = closestId

    if (this.interactPrompt) {
      if (closestId) {
        const def = NPC_DEFS.find(d => d.id === closestId)
        this.interactPrompt.textContent = `[ E ] ${def?.label ?? closestId}`
        this.interactPrompt.style.display = 'block'
      } else {
        this.interactPrompt.style.display = 'none'
      }
    }
  }

  /** Call when player presses E. Returns true if interaction happened. */
  tryInteract(): boolean {
    if (!this.nearbyNpc || this.uiOpen || !this.storedMetaState || !this.storedOnBiomeSelected) return false
    this.handleNPCClick(this.nearbyNpc, this.storedMetaState, this.storedOnBiomeSelected, this.storedOnUndergroundSelected ?? undefined)
    return true
  }

  deactivate(): void {
    this.worldMap.hide()
    this.shopUI.hide()
    this.companionPickerUI.hide()
    this.weaponSmithUI.hide()
    this.companionTrainerUI.hide()
    this.mutationLabUI.hide()
    this.clearScene()
  }

  private addObject(obj: THREE.Object3D): void {
    this.renderer.scene.add(obj)
    this.hubObjects.push(obj)
  }

  private addLabel(text: string, position: THREE.Vector3, color: number): void {
    const el = document.createElement('div')
    el.style.cssText = `
      position: fixed;
      z-index: 50;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      color: #${color.toString(16).padStart(6, '0')};
      text-align: center;
      pointer-events: none;
      white-space: pre;
      text-shadow: 0 0 6px currentColor;
      transform: translateX(-50%);
    `
    el.textContent = text
    el.dataset.worldX = String(position.x)
    el.dataset.worldY = String(position.y + 1.4)
    el.dataset.worldZ = String(position.z)
    document.body.appendChild(el)
    this.labelEls.push(el)
  }

  updateTorchFlicker(delta: number): void {
    this.torchTime += delta
    for (let i = 0; i < this.torchLights.length; i++) {
      const base = 5
      const flicker = Math.sin(this.torchTime * 8 + i * 2.1) * 0.8
        + Math.sin(this.torchTime * 13 + i * 4.3) * 0.4
      this.torchLights[i].intensity = base + flicker
    }
  }

  updateLabels(): void {
    const proj = new THREE.Vector3()
    for (const el of this.labelEls) {
      proj.set(
        parseFloat(el.dataset.worldX!),
        parseFloat(el.dataset.worldY!),
        parseFloat(el.dataset.worldZ!),
      )
      proj.project(this.renderer.camera)
      const sx = ((proj.x + 1) / 2) * window.innerWidth
      const sy = ((1 - proj.y) / 2) * window.innerHeight
      el.style.left = `${sx}px`
      el.style.top = `${sy}px`
      el.style.display = proj.z < 1 ? 'block' : 'none'
    }
  }

  private clearScene(): void {
    // Reset background/fog so combat scene starts clean
    this.renderer.scene.background = null
    this.renderer.scene.fog = null

    for (const obj of this.hubObjects) {
      this.renderer.scene.remove(obj)
      obj.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh) {
          mesh.geometry?.dispose()
          const mat = mesh.material
          if (mat) {
            if (Array.isArray(mat)) mat.forEach(m => m.dispose())
            else (mat as THREE.Material).dispose()
          }
        }
      })
    }
    this.hubObjects = []
    this.npcs = []
    this.torchLights = []
    this.torchTime = 0

    for (const el of this.labelEls) {
      el.parentElement?.removeChild(el)
    }
    this.labelEls = []

    this.interactPrompt?.parentElement?.removeChild(this.interactPrompt)
    this.interactPrompt = null
    this.nearbyNpc = null
    this.storedMetaState = null
    this.storedOnBiomeSelected = null
    this.storedOnUndergroundSelected = null
  }
}
