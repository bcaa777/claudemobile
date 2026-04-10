import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const RetroShader = {
  name: 'RetroShader',
  uniforms: {
    tDiffuse:     { value: null as THREE.Texture | null },
    time:         { value: 0.0 },
    chromaStrength: { value: 0.004 },
    grainStrength: { value: 0.06 },
    grainSize:    { value: 1.5 },
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
    uniform float chromaStrength;
    uniform float grainStrength;
    uniform float grainSize;
    varying vec2 vUv;

    // Fast hash for grain
    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    void main() {
      // Chromatic aberration — shift R and B channels
      vec2 dir = vUv - 0.5;
      float len = length(dir);
      vec2 offset = normalize(dir + 0.001) * len * chromaStrength;

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 color = vec3(r, g, b);

      // Film grain — quantized to pixel grid for retro feel
      vec2 grainUv = floor(vUv * 320.0 / grainSize) / (320.0 / grainSize);
      float grain = hash(grainUv + vec2(time * 0.1, time * 0.07));
      grain = (grain - 0.5) * grainStrength;
      color += grain;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `,
}

export class RetroPass extends ShaderPass {
  private elapsed = 0

  constructor() {
    super(RetroShader)
  }

  update(delta: number) {
    this.elapsed += delta
    this.uniforms['time'].value = this.elapsed
  }
}
