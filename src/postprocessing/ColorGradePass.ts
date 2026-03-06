import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const ColorGradeShader = {
  name: 'ColorGradeShader',
  uniforms: {
    tDiffuse:   { value: null as THREE.Texture | null },
    biomeTint:  { value: new THREE.Color(0x0d1a0d) },
    tintStrength: { value: 0.12 },
    contrast:   { value: 1.15 },
    saturation: { value: 0.80 },
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
    uniform vec3 biomeTint;
    uniform float tintStrength;
    uniform float contrast;
    uniform float saturation;
    varying vec2 vUv;

    vec3 adjustContrast(vec3 color, float c) {
      return clamp((color - 0.5) * c + 0.5, 0.0, 1.0);
    }

    vec3 adjustSaturation(vec3 color, float s) {
      float lum = dot(color, vec3(0.299, 0.587, 0.114));
      return mix(vec3(lum), color, s);
    }

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = texel.rgb;

      // Biome fog tint
      color = mix(color, biomeTint, tintStrength * 0.4);

      // PS1-style color quantization (5-bit)
      color = floor(color * 31.0 + 0.5) / 31.0;

      // Contrast + saturation
      color = adjustContrast(color, contrast);
      color = adjustSaturation(color, saturation);

      gl_FragColor = vec4(color, texel.a);
    }
  `,
}

export class ColorGradePass extends ShaderPass {
  constructor() {
    super(ColorGradeShader)
  }

  setBiomeTint(color: THREE.Color, _blend: number) {
    this.uniforms['biomeTint'].value.copy(color)
  }
}
