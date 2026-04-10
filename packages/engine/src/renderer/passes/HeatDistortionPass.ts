import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const HeatDistortionShader = {
  name: 'HeatDistortionShader',
  uniforms: {
    tDiffuse:  { value: null as THREE.Texture | null },
    time:      { value: 0.0 },
    intensity: { value: 0.0 },
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
    uniform float time;
    uniform float intensity;
    varying vec2 vUv;

    void main() {
      if (intensity < 0.001) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      // Heat shimmer — scrolling noise offset
      float offsetX = sin(vUv.y * 18.0 + time) * sin(vUv.x * 12.0 + time * 0.7) * intensity * 0.003;
      float offsetY = sin(vUv.x * 14.0 + time * 0.8) * sin(vUv.y * 10.0 + time * 1.1) * intensity * 0.003;

      // Stronger near the ground (bottom of screen)
      float groundFactor = 1.0 - vUv.y;
      offsetX *= groundFactor;
      offsetY *= groundFactor;

      vec2 uv = vUv + vec2(offsetX, offsetY);
      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `,
}

export class HeatDistortionPass extends ShaderPass {
  /** When >= 0, overrides biome-computed intensity (debug panel) */
  public intensityOverride = -1

  constructor() {
    super(HeatDistortionShader)
  }

  setIntensity(v: number) {
    this.uniforms['intensity'].value = v
  }

  setTime(t: number) {
    this.uniforms['time'].value = t
  }
}
