import * as THREE from 'three'

export class PointLightPool {
  private pool: THREE.PointLight[] = []
  private active: THREE.PointLight[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene, size: number) {
    this.scene = scene
    for (let i = 0; i < size; i++) {
      const light = new THREE.PointLight(0xff4400, 0, 20, 2)
      light.visible = false
      scene.add(light)
      this.pool.push(light)
    }
  }

  acquire(): THREE.PointLight | null {
    const light = this.pool.pop()
    if (!light) return null
    light.visible = true
    light.color.set(0xff4400)
    this.active.push(light)
    return light
  }

  release(light: THREE.PointLight) {
    const idx = this.active.indexOf(light)
    if (idx !== -1) this.active.splice(idx, 1)
    light.visible = false
    light.intensity = 0
    this.pool.push(light)
  }

  // Flicker update for lava/fire lights
  update(time: number) {
    for (const light of this.active) {
      const base = light.userData.baseIntensity ?? 1.0
      light.intensity = base * (0.85 + 0.3 * Math.sin(time * 8 + light.id))
    }
  }
}
