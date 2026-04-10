import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const DamageShader = {
  name: 'DamageShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    strength: { value: 0.0 },
    deathFade: { value: 0.0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float strength;
    uniform float deathFade;
    varying vec2 vUv;

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // Red vignette on damage
      if (strength > 0.0) {
        vec2 d = vUv - 0.5;
        float dist = length(d);
        float vignette = smoothstep(0.2, 0.7, dist);
        color = mix(color, vec3(0.8, 0.05, 0.02), vignette * strength * 0.6);
      }

      // Death fade to black
      color *= 1.0 - deathFade;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

export class DamagePass extends ShaderPass {
  constructor() {
    super(DamageShader)
  }

  setStrength(strength: number, deathFade: number) {
    this.uniforms['strength'].value = strength
    this.uniforms['deathFade'].value = deathFade
  }
}
