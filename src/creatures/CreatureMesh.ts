import * as THREE from 'three'
import { Creature } from './Creature'
import { SPECIES } from './Species'

export class CreatureMesh {
  group: THREE.Group
  private legs: THREE.Mesh[] = []
  private wings: THREE.Mesh[] = []
  private tailFin: THREE.Mesh | null = null
  private crocLegs: THREE.Mesh[] = []
  private animTime = 0

  constructor(creature: Creature, scene: THREE.Scene) {
    this.group = new THREE.Group()
    this.buildGeometry(creature)
    scene.add(this.group)
    // Sync initial transform
    this.group.position.copy(creature.position)
    this.group.scale.setScalar(creature.scale)
  }

  private box(w: number, h: number, d: number, color: number): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshLambertMaterial({ color })
    )
  }

  private buildGeometry(creature: Creature) {
    const sp = SPECIES[creature.species]
    const { bodyW, bodyH, bodyD, bodyColor, headColor, legColor } = sp

    if (sp.mobility === 'ground') {
      // Body
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      // Head — offset forward and slightly up
      const head = this.box(bodyW * 0.6, bodyH * 0.7, bodyD * 0.5, headColor)
      head.position.set(0, bodyH * 0.2, bodyD * 0.55)
      this.group.add(head)

      // Eyes
      const eyeGeo = new THREE.SphereGeometry(0.06, 4, 4)
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 })
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
      eyeL.position.set(-bodyW * 0.22, bodyH * 0.35, bodyD * 0.79)
      const eyeR = eyeL.clone()
      eyeR.position.x = bodyW * 0.22
      this.group.add(eyeL, eyeR)

      // 4 legs
      const legH = bodyH * 1.0
      const legW = bodyW * 0.18
      const legOffsets: [number, number, number][] = [
        [-bodyW * 0.35, -bodyH * 0.95, bodyD * 0.28],
        [ bodyW * 0.35, -bodyH * 0.95, bodyD * 0.28],
        [-bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.28],
        [ bodyW * 0.35, -bodyH * 0.95, -bodyD * 0.28],
      ]
      for (const [lx, ly, lz] of legOffsets) {
        const leg = this.box(legW, legH, legW, legColor)
        leg.position.set(lx, ly, lz)
        this.group.add(leg)
        this.legs.push(leg)
      }

      // Antlers for deer
      if (creature.species === 'deer') {
        const antlerMat = new THREE.MeshLambertMaterial({ color: 0x6b4c1e })
        const aL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), antlerMat)
        aL.position.set(-bodyW * 0.2, bodyH * 0.82, bodyD * 0.52)
        const aR = aL.clone()
        aR.position.x = bodyW * 0.2
        this.group.add(aL, aR)
      }

      // Camel hump
      if (creature.species === 'camel') {
        const hump = this.box(bodyW * 0.5, bodyH * 0.6, bodyW * 0.4, bodyColor)
        hump.position.set(0, bodyH * 0.9, -bodyD * 0.1)
        this.group.add(hump)
      }

      // Fox bushy tail (white tip)
      if (creature.species === 'fox') {
        const tail = this.box(bodyW * 0.3, bodyW * 0.35, bodyD * 0.4, 0xffffff)
        tail.position.set(0, bodyH * 0.35, -bodyD * 0.55)
        this.group.add(tail)
      }

      // Lion mane (dark golden ring around head)
      if (creature.species === 'lion') {
        const mane = this.box(bodyW * 1.0, bodyH * 1.0, bodyD * 0.35, 0xb8780a)
        mane.position.set(0, bodyH * 0.2, bodyD * 0.55)
        this.group.add(mane)
      }

      // Mammoth tusks (two white boxes pointing forward)
      if (creature.species === 'mammoth') {
        const tuskL = this.box(bodyW * 0.12, bodyW * 0.12, bodyD * 0.35, 0xfffff0)
        tuskL.position.set(-bodyW * 0.28, -bodyH * 0.15, bodyD * 0.55)
        const tuskR = tuskL.clone()
        tuskR.position.x = bodyW * 0.28
        this.group.add(tuskL, tuskR)
      }

    } else if (sp.mobility === 'air') {
      // Body
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      // Head
      const head = this.box(bodyW * 0.7, bodyH * 0.65, bodyD * 0.4, headColor)
      head.position.set(0, bodyH * 0.12, bodyD * 0.58)
      this.group.add(head)

      // Eyes
      const eyeGeo = new THREE.SphereGeometry(0.05, 4, 4)
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 })
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
      eyeL.position.set(-bodyW * 0.28, bodyH * 0.2, bodyD * 0.76)
      const eyeR = eyeL.clone()
      eyeR.position.x = bodyW * 0.28
      this.group.add(eyeL, eyeR)

      // Wings — pivot at body side
      const wingSpan = sp.id === 'dragon' ? bodyD * 1.5 : bodyD * 1.1
      const wingD = bodyD * 0.45
      const wingMat = new THREE.MeshLambertMaterial({ color: bodyColor, side: THREE.DoubleSide })
      const wingGeo = new THREE.BoxGeometry(wingSpan, 0.1, wingD)

      const wingL = new THREE.Mesh(wingGeo, wingMat)
      wingL.position.set(-(bodyW * 0.5 + wingSpan * 0.5), 0, -bodyD * 0.1)
      const wingR = new THREE.Mesh(wingGeo, wingMat)
      wingR.position.set( bodyW * 0.5 + wingSpan * 0.5, 0, -bodyD * 0.1)
      this.group.add(wingL, wingR)
      this.wings.push(wingL, wingR)

      // Dragon spine ridges
      if (sp.id === 'dragon') {
        const ridgeMat = new THREE.MeshLambertMaterial({ color: 0x440000 })
        for (let i = 0; i < 4; i++) {
          const ridge = new THREE.Mesh(
            new THREE.BoxGeometry(0.15, 0.38 - i * 0.06, 0.15),
            ridgeMat
          )
          ridge.position.set(0, bodyH * 0.58, bodyD * 0.28 - i * bodyD * 0.18)
          this.group.add(ridge)
        }
      }

    } else if (creature.species === 'croc') {
      // Crocodile — flat water predator
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      // Snout — forward and slightly down
      const snout = this.box(bodyW * 0.65, bodyH * 0.7, bodyD * 0.38, headColor)
      snout.position.set(0, -bodyH * 0.15, bodyD * 0.69)
      this.group.add(snout)

      // Tail — rear, slight downward tilt
      const tail = this.box(bodyW * 0.5, bodyH * 0.5, bodyD * 0.4, bodyColor)
      tail.position.set(0, -bodyH * 0.1, -bodyD * 0.7)
      tail.rotation.x = 0.2
      this.group.add(tail)
      this.tailFin = tail

      // 4 short legs at body corners
      const legOffsets: [number, number, number][] = [
        [-bodyW * 0.55, -bodyH * 0.5,  bodyD * 0.25],
        [ bodyW * 0.55, -bodyH * 0.5,  bodyD * 0.25],
        [-bodyW * 0.55, -bodyH * 0.5, -bodyD * 0.25],
        [ bodyW * 0.55, -bodyH * 0.5, -bodyD * 0.25],
      ]
      for (const [lx, ly, lz] of legOffsets) {
        const leg = this.box(bodyW * 0.18, bodyH * 0.9, bodyW * 0.18, sp.legColor)
        leg.position.set(lx, ly, lz)
        this.group.add(leg)
        this.crocLegs.push(leg)
      }

      // Eyes — on top of head, yellow-green
      const eyeGeo = new THREE.SphereGeometry(0.07, 5, 4)
      const eyeMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 })
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat)
      eyeL.position.set(-bodyW * 0.28, bodyH * 0.55, bodyD * 0.35)
      const eyeR = eyeL.clone()
      eyeR.position.x = bodyW * 0.28
      this.group.add(eyeL, eyeR)

    } else {
      // Water — fish body
      this.group.add(this.box(bodyW, bodyH, bodyD, bodyColor))

      // Tail fin
      const tail = this.box(bodyW * 0.8, bodyH * 0.9, bodyD * 0.22, headColor)
      tail.position.set(0, 0, -bodyD * 0.6)
      this.group.add(tail)
      this.tailFin = tail

      // Dorsal fin
      const dorsal = this.box(bodyW * 0.12, bodyH * 0.5, bodyD * 0.28, headColor)
      dorsal.position.set(0, bodyH * 0.62, 0)
      this.group.add(dorsal)
    }
  }

  update(creature: Creature, delta: number) {
    this.animTime += delta
    const sp = SPECIES[creature.species]
    const moving = creature.velocity.lengthSq() > 0.04

    this.group.position.copy(creature.position)
    this.group.scale.setScalar(creature.scale)
    this.group.rotation.y = creature.heading + Math.PI

    // Leg animation
    if (sp.mobility === 'ground' && this.legs.length >= 4) {
      if (moving) {
        const freq = creature.velocity.length() * 2.5
        this.legs[0].rotation.x =  Math.sin(this.animTime * freq) * 0.5
        this.legs[1].rotation.x = -Math.sin(this.animTime * freq) * 0.5
        this.legs[2].rotation.x = -Math.sin(this.animTime * freq) * 0.5
        this.legs[3].rotation.x =  Math.sin(this.animTime * freq) * 0.5
      } else {
        for (const leg of this.legs) leg.rotation.x = 0
      }
    }

    // Wing flap
    if (sp.mobility === 'air' && this.wings.length >= 2) {
      const flapSpeed = sp.id === 'dragon' ? 2.5 : 6.0
      const flapAmp  = sp.id === 'dragon' ? 0.4 : 0.6
      const angle = Math.sin(this.animTime * flapSpeed) * flapAmp
      this.wings[0].rotation.z =  angle
      this.wings[1].rotation.z = -angle
    }

    // Tail fin / croc tail
    if (sp.mobility === 'water' && this.tailFin) {
      if (creature.species === 'croc') {
        this.tailFin.rotation.y = Math.sin(this.animTime * 1.2) * 0.35
        if (moving && this.crocLegs.length >= 4) {
          const rock = Math.sin(this.animTime * 2.5) * 0.15
          this.crocLegs[0].rotation.x =  rock
          this.crocLegs[1].rotation.x = -rock
          this.crocLegs[2].rotation.x = -rock
          this.crocLegs[3].rotation.x =  rock
        }
      } else {
        this.tailFin.rotation.y = Math.sin(this.animTime * 3.0) * 0.4
      }
    }

    // Death tilt
    if (creature.state === 'dead') {
      this.group.rotation.z = Math.min(Math.PI * 0.5, creature.deathTimer * 1.2)
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) m.dispose()
        } else {
          (obj.material as THREE.Material).dispose()
        }
      }
    })
  }
}
