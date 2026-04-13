import * as THREE from 'three'
import type { CreatureDNA } from '@engine/core'
import { quantizeLegCount } from '@engine/core'

export function buildEnemyMesh(dna: CreatureDNA, archetype: string, biome?: number): THREE.Group {
  const group = new THREE.Group()
  const color = new THREE.Color(dna.bodyColor[0], dna.bodyColor[1], dna.bodyColor[2])
  const accentColor = new THREE.Color(dna.accentColor[0], dna.accentColor[1], dna.accentColor[2])

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
      color.lerp(new THREE.Color(tint), 0.25)
    }
  }

  // Body: sphere scaled by DNA body dimensions — emissive glow makes enemies pop
  const bodyGeo = new THREE.SphereGeometry(0.5, 8, 6)
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
  })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.scale.set(dna.bodyWidth, dna.bodyHeight, dna.bodyLength)
  body.userData.isBobTarget = true
  group.add(body)

  // Legs: cylinders based on legCount gene (quantized)
  const legCount = quantizeLegCount(dna.legCount)
  if (legCount > 0) {
    const limbLength = dna.legLength || 0.4
    const legGeo = new THREE.CylinderGeometry(dna.legThickness * 0.5, dna.legThickness * 0.8, limbLength, 4)
    const legMat = new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.7) })
    for (let i = 0; i < legCount; i++) {
      const leg = new THREE.Mesh(legGeo, legMat)
      const angle = (i / legCount) * Math.PI * 2
      leg.position.set(
        Math.cos(angle) * dna.bodyWidth * 0.4,
        -dna.bodyHeight * 0.5,
        Math.sin(angle) * dna.bodyLength * 0.4,
      )
      group.add(leg)
    }
  }

  // Head: small sphere offset forward/up
  const headSize = dna.headSize * 0.5
  const headGeo = new THREE.SphereGeometry(headSize, 6, 4)

  // All enemies get emissive heads for visibility; shooters glow brighter
  const headMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: archetype === 'shooter' ? 0.8 : 0.4,
  })
  const head = new THREE.Mesh(headGeo, headMat)
  const headY = dna.bodyHeight * 0.3
  const headZ = dna.bodyLength * 0.5
  head.position.set(0, headY, headZ)
  group.add(head)

  // Eyes: 2 small spheres on the head (white with dark pupil offset)
  const eyeOffsetX = headSize * 0.5
  const eyeOffsetY = headSize * 0.15
  const eyeOffsetZ = headSize * 0.85
  const eyeRadius = headSize * 0.22
  const eyeGeo = new THREE.SphereGeometry(eyeRadius, 5, 4)
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const pupilGeo = new THREE.SphereGeometry(eyeRadius * 0.55, 4, 3)
  const pupilMat = new THREE.MeshLambertMaterial({ color: 0x111111 })

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(
      head.position.x + side * eyeOffsetX,
      head.position.y + eyeOffsetY,
      head.position.z + eyeOffsetZ,
    )
    group.add(eye)

    const pupil = new THREE.Mesh(pupilGeo, pupilMat)
    pupil.position.set(
      eye.position.x + side * eyeRadius * 0.1,
      eye.position.y,
      eye.position.z + eyeRadius * 0.6,
    )
    group.add(pupil)
  }

  // Horns (tank-like, if hasHorns is strong)
  if (dna.hasHorns > 0.5) {
    const hornH = dna.hornSize * 0.4
    const hornGeo = new THREE.ConeGeometry(0.05, hornH, 4)
    const hornMat = new THREE.MeshLambertMaterial({ color: accentColor })
    const hornL = new THREE.Mesh(hornGeo, hornMat)
    hornL.position.set(-0.15, headY + headSize, headZ)
    hornL.rotation.z = -0.3
    const hornR = new THREE.Mesh(hornGeo, hornMat)
    hornR.position.set(0.15, headY + headSize, headZ)
    hornR.rotation.z = 0.3
    group.add(hornL, hornR)
  }

  // Mandibles: rusher archetype gets 2 forward-pointing cones below head
  if (archetype === 'rusher') {
    const mandibleGeo = new THREE.ConeGeometry(0.04, 0.18, 4)
    const mandibleMat = new THREE.MeshLambertMaterial({ color: accentColor })
    for (const side of [-1, 1]) {
      const mandible = new THREE.Mesh(mandibleGeo, mandibleMat)
      mandible.position.set(
        head.position.x + side * headSize * 0.45,
        head.position.y - headSize * 0.55,
        head.position.z + headSize * 0.5,
      )
      // Point forward-downward
      mandible.rotation.x = Math.PI * 0.35
      mandible.rotation.z = side * 0.25
      group.add(mandible)
    }
  }

  // Dorsal spikes: tank archetype gets 4 cones along the body top
  if (archetype === 'tank') {
    const spikeGeo = new THREE.ConeGeometry(0.05, 0.22, 4)
    const spikeMat = new THREE.MeshLambertMaterial({ color: accentColor })
    const spikeCount = 4
    for (let i = 0; i < spikeCount; i++) {
      const t = (i / (spikeCount - 1)) - 0.5  // -0.5 to 0.5
      const spike = new THREE.Mesh(spikeGeo, spikeMat)
      spike.position.set(
        0,
        dna.bodyHeight * 0.5 + 0.1,
        t * dna.bodyLength * 0.7,
      )
      group.add(spike)
    }
  }

  // Wings for flyers (or any creature with hasWings > 0.5)
  if (archetype === 'flyer' && dna.hasWings > 0.5) {
    const wingSpan = dna.wingSpan || 1
    const wingGeo = new THREE.PlaneGeometry(wingSpan, 0.3)
    const wingMat = new THREE.MeshLambertMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    })
    const wingL = new THREE.Mesh(wingGeo, wingMat)
    wingL.position.set(-dna.bodyWidth * 0.6, dna.bodyHeight * 0.2, 0)
    wingL.rotation.z = 0.3
    const wingR = new THREE.Mesh(wingGeo, wingMat)
    wingR.position.set(dna.bodyWidth * 0.6, dna.bodyHeight * 0.2, 0)
    wingR.rotation.z = -0.3
    group.add(wingL, wingR)
  }

  // Tail (visual stub)
  if (dna.hasTail > 0.5) {
    const tailLen = dna.tailLength * 0.5
    const tailGeo = new THREE.CylinderGeometry(0.03, 0.07, tailLen, 4)
    const tailMat = new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.8) })
    const tail = new THREE.Mesh(tailGeo, tailMat)
    tail.position.set(0, 0, -dna.bodyLength * 0.5 - tailLen * 0.5)
    tail.rotation.x = Math.PI / 2
    group.add(tail)
  }

  // Add glowing colored outline to make enemy pop against environment
  const outlineColor = color.clone().multiplyScalar(1.5).addScalar(0.1)
  addOutline(group, outlineColor.getHex(), 1.12)

  // Scale by DNA size
  group.scale.setScalar(dna.size || 1)
  return group
}

/** Add dark inverted-hull outline to a group (back-face only, slightly larger) */
function addOutline(group: THREE.Group, outlineColor: number, scale: number): void {
  const outlineMat = new THREE.MeshBasicMaterial({
    color: outlineColor,
    side: THREE.BackSide,
  })
  const outlines: THREE.Mesh[] = []
  group.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const outline = new THREE.Mesh(child.geometry, outlineMat)
      outline.position.copy(child.position)
      outline.rotation.copy(child.rotation)
      outline.scale.copy(child.scale).multiplyScalar(scale)
      outline.renderOrder = -1
      outlines.push(outline)
    }
  })
  for (const o of outlines) group.add(o)
}

/**
 * Call each frame to animate a living enemy group.
 * Drives a gentle up/down body bob.
 */
export function animateEnemy(group: THREE.Group, time: number): void {
  const bob = Math.sin(time * 2.5) * 0.1
  // The whole group bobs; base Y offset is managed externally
  group.position.y += bob - (group.userData._lastBob ?? 0)
  group.userData._lastBob = bob
}

export function disposeMeshGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose()
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose())
      } else {
        obj.material.dispose()
      }
    }
  })
}
