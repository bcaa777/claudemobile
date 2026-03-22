import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const CRTShader = {
  name: 'CRTShader',
  uniforms: {
    tDiffuse:      { value: null as THREE.Texture | null },
    resolution:    { value: new THREE.Vector2(320, 240) },
    scanlineIntensity: { value: 0.05 },
    barrelDistortion: { value: 0 },
    vignetteStrength: { value: 0.35 },
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
    uniform vec2 resolution;
    uniform float scanlineIntensity;
    uniform float barrelDistortion;
    uniform float vignetteStrength;
    varying vec2 vUv;

    vec2 barrelDistort(vec2 uv, float strength) {
      vec2 cc = uv - 0.5;
      float dist = dot(cc, cc);
      return uv + cc * dist * strength;
    }

    void main() {
      // Barrel distortion — skipped when barrelDistortion is 0
      vec2 uv = barrelDistortion > 0.0 ? barrelDistort(vUv, barrelDistortion) : vUv;

      // Clamp — areas outside become black (CRT edge)
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      vec4 texel = texture2D(tDiffuse, uv);
      vec3 color = texel.rgb;

      // Scanlines — darken every other row in screen-pixel space
      float screenY = uv.y * resolution.y;
      float scanline = mod(floor(screenY), 2.0);
      color *= 1.0 - scanline * scanlineIntensity;

      // Vignette
      vec2 d = vUv - 0.5;
      float vignette = 1.0 - dot(d, d) * vignetteStrength * 3.5;
      color *= clamp(vignette, 0.0, 1.0);

      gl_FragColor = vec4(color, texel.a);
    }
  `,
}

export class CRTPass extends ShaderPass {
  constructor() {
    super(CRTShader)
  }
}
