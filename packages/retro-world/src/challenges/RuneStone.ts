import * as THREE from 'three'

const BIOME_COLORS: Record<number, number> = {
  0: 0x44cc44, 1: 0xddaa22, 2: 0xee3300, 3: 0x88ccff,
  4: 0x336633, 5: 0x8888aa, 6: 0xbb44ee, 7: 0x888877,
  8: 0x4466ee, 9: 0xcc8833, 10: 0xffdd44, 11: 0xff3300,
  12: 0xe0e8f0, 13: 0x8899aa, 14: 0xaaddff, 15: 0x226622,
  16: 0xcc6633, 17: 0xff88aa, 18: 0x445533, 19: 0xaa5533,
  20: 0x446655, 21: 0x88cc44,
}

export class RuneStone {
  group: THREE.Group
  position: THREE.Vector3
  biome: number
  completed = false
  private blocks: THREE.Mesh[] = []
  private particleRing: THREE.Points | null = null

  constructor(position: THREE.Vector3, biome: number, scene: THREE.Scene) {
    this.position = position.clone()
    this.biome = biome
    this.group = new THREE.Group()
    this.group.position.copy(position)

    const color = BIOME_COLORS[biome] ?? 0xaaaaaa

    // 3 stacked boxes
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BoxGeometry(0.6, 1.5, 0.6)
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.y = i * 1.5 + 0.75
      this.group.add(mesh)
      this.blocks.push(mesh)
    }

    scene.add(this.group)
  }

  setCompleted(scene: THREE.Scene) {
    this.completed = true

    // Brighten blocks
    for (const block of this.blocks) {
      const mat = block.material as THREE.MeshBasicMaterial
      mat.opacity = 1.0
    }

    // Add particle ring
    const count = 20
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      positions[i * 3] = Math.cos(angle) * 2
      positions[i * 3 + 1] = 2
      positions[i * 3 + 2] = Math.sin(angle) * 2
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.15,
      transparent: true,
      opacity: 0.7,
    })
    this.particleRing = new THREE.Points(geo, mat)
    this.particleRing.position.copy(this.position)
    scene.add(this.particleRing)
  }

  update(delta: number) {
    // Pulse glow for incomplete
    if (!this.completed) {
      const pulse = 0.5 + Math.sin(Date.now() * 0.003 + this.biome) * 0.3
      for (const block of this.blocks) {
        (block.material as THREE.MeshBasicMaterial).opacity = pulse
      }
    }

    // Gentle rotation when completed
    if (this.completed) {
      this.group.rotation.y += delta * 0.3

      // Rotate particle ring
      if (this.particleRing) {
        this.particleRing.rotation.y -= delta * 0.5
      }
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    if (this.particleRing) scene.remove(this.particleRing)
  }
}
