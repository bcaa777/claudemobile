import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const UnderwaterShader = {
  name: 'UnderwaterShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time:     { value: 0.0 },
    strength: { value: 0.0 },
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
    uniform float strength;
    varying vec2 vUv;

    void main() {
      // Wave distortion
      vec2 uv = vUv;
      uv.x += sin(vUv.y * 20.0 + time * 2.0) * 0.008 * strength;
      uv.y += sin(vUv.x * 15.0 + time * 1.5) * 0.004 * strength;

      // 3-tap cheap blur along distorted UVs
      float blurAmount = 0.003 * strength;
      vec3 color  = texture2D(tDiffuse, uv).rgb;
      color += texture2D(tDiffuse, uv + vec2( blurAmount,  blurAmount)).rgb;
      color += texture2D(tDiffuse, uv + vec2(-blurAmount, -blurAmount)).rgb;
      color /= 3.0;

      // Blue-green tint
      color *= mix(vec3(1.0), vec3(0.4, 0.7, 1.0), strength * 0.7);

      // Caustic shimmer — faint animated bright spots
      float caustic = sin(vUv.x * 30.0 + time * 3.0) * sin(vUv.y * 30.0 + time * 2.5);
      caustic = max(0.0, caustic) * 0.06 * strength;
      color += caustic;

      // Darkening vignette
      vec2 d = vUv - 0.5;
      float vignette = 1.0 - dot(d, d) * strength * 2.5;
      color *= clamp(vignette, 0.0, 1.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
}

export class UnderwaterPass extends ShaderPass {
  private elapsed = 0

  constructor() {
    super(UnderwaterShader)
  }

  update(delta: number, strength: number) {
    this.elapsed += delta
    this.uniforms['time'].value = this.elapsed
    this.uniforms['strength'].value = strength
  }
}
