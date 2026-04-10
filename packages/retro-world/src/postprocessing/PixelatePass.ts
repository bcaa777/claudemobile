import * as THREE from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

const PixelateShader = {
  name: 'PixelateShader',
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    resolution: { value: new THREE.Vector2(320, 240) },
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
    varying vec2 vUv;

    void main() {
      // Snap UV to pixel grid
      vec2 pixelUv = floor(vUv * resolution) / resolution;
      gl_FragColor = texture2D(tDiffuse, pixelUv);
    }
  `,
}

export class PixelatePass extends ShaderPass {
  constructor(width: number, height: number) {
    super(PixelateShader)
    this.uniforms['resolution'].value.set(width, height)
  }
}
