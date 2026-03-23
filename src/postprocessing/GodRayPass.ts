import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const GodRayShader = {
  name: 'GodRayShader',
  uniforms: {
    tDiffuse:    { value: null as THREE.Texture | null },
    sunPosition: { value: new THREE.Vector2(0.5, 0.8) },
    intensity:   { value: 0.0 },
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
    uniform vec2 sunPosition;
    uniform float intensity;
    varying vec2 vUv;

    const int NUM_SAMPLES = 12;
    const float DECAY    = 0.95;
    const float WEIGHT   = 0.06;
    const float EXPOSURE = 1.2;

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);

      // Only accumulate when intensity is meaningful
      if (intensity < 0.001) {
        gl_FragColor = base;
        return;
      }

      // Ray from fragment toward sun
      vec2 delta = sunPosition - vUv;
      delta /= float(NUM_SAMPLES);

      vec2 uv = vUv;
      float illuminationDecay = 1.0;
      vec3 accum = vec3(0.0);

      for (int i = 0; i < NUM_SAMPLES; i++) {
        uv += delta;
        vec3 samp = texture2D(tDiffuse, uv).rgb;
        // Weight by luminance so bright sky contributes more than dark terrain
        float lum = dot(samp, vec3(0.299, 0.587, 0.114));
        accum += samp * lum * illuminationDecay * WEIGHT;
        illuminationDecay *= DECAY;
      }

      // Additive blend — god rays on top of scene
      vec3 rays = accum * EXPOSURE * intensity;
      gl_FragColor = vec4(base.rgb + rays, base.a);
    }
  `,
}

export class GodRayPass extends ShaderPass {
  /** When >= 0, overrides biome-computed intensity (debug panel) */
  public intensityOverride = -1

  constructor() {
    super(GodRayShader)
  }

  /** sunPos: screen-space 0–1 UV coordinates of the sun */
  setSunPosition(x: number, y: number) {
    this.uniforms['sunPosition'].value.set(x, y)
  }

  setIntensity(v: number) {
    this.uniforms['intensity'].value = v
  }
}
