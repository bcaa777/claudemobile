import * as THREE from 'three'
import { InterpolatedVisual } from './BiomeTransition'

// Water level is 3.0; fog hovers just above it
const FOG_Y = 4.5
const PLANE_SIZE = 200

const vertexShader = /* glsl */`
  varying vec2 vUv;
  varying float vEdgeFade;

  void main() {
    vUv = uv;
    // Edge fade: distance from centre in UV space (0 at centre, 1 at edges)
    vec2 centred = uv * 2.0 - 1.0;
    vEdgeFade = 1.0 - smoothstep(0.4, 1.0, max(abs(centred.x), abs(centred.y)));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Inline 2D simplex-style hash noise — avoids needing a texture or import
const fragmentShader = /* glsl */`
  uniform float uTime;
  uniform float uDensity;
  uniform vec3  uFogColor;

  varying vec2 vUv;
  varying float vEdgeFade;

  // Hash-based value noise — fast, no texture needed
  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2  s = vec2(1.0);
    for (int i = 0; i < 4; i++) {
      v += a * valueNoise(p * s);
      s *= 2.1;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Scroll UV in two directions for drifting effect
    vec2 uv1 = vUv * 3.0 + vec2(uTime * 0.03, uTime * 0.015);
    vec2 uv2 = vUv * 2.0 - vec2(uTime * 0.02, uTime * 0.025);

    float n1 = fbm(uv1);
    float n2 = fbm(uv2);
    float noise = n1 * 0.6 + n2 * 0.4;

    // Patchy threshold — only values above ~0.45 form visible fog
    float alpha = smoothstep(0.45, 0.75, noise);

    // Fade at plane edges and apply biome density
    alpha *= vEdgeFade * uDensity;

    if (alpha < 0.001) discard;

    gl_FragColor = vec4(uFogColor, alpha);
  }
`

export class GroundFog {
  private mesh: THREE.Mesh
  private material: THREE.ShaderMaterial
  private elapsed = 0
  /** When >= 0, overrides biome-computed density (debug panel) */
  public densityOverride = -1

  constructor(scene: THREE.Scene) {
    const geo = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1)
    // Rotate to lie flat (XZ plane)
    geo.rotateX(-Math.PI / 2)

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime:     { value: 0 },
        uDensity:  { value: 0 },
        uFogColor: { value: new THREE.Color(0xb0c8d0) },
      },
    })

    this.mesh = new THREE.Mesh(geo, this.material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = 1
    scene.add(this.mesh)
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    visual: InterpolatedVisual,
    dayTime: number,   // 0–1, full day cycle
  ) {
    this.elapsed += delta

    // Follow player horizontally, stay at fixed Y
    this.mesh.position.set(playerPos.x, FOG_Y, playerPos.z)

    // Time-of-day modulation:
    //   dawn  ~0.20–0.30 → peak (factor = 1.0)
    //   dusk  ~0.70–0.80 → peak (factor = 1.0)
    //   noon  ~0.45–0.55 → thin (factor ≈ 0.1)
    //   night ~0.90–0.10 → moderate (factor ≈ 0.5)
    const dawn = Math.max(0, 1 - Math.abs(dayTime - 0.25) / 0.07)
    const dusk = Math.max(0, 1 - Math.abs(dayTime - 0.75) / 0.07)
    const dayPeak = Math.max(0, 1 - Math.abs(dayTime - 0.5) / 0.08)
    const todFactor = Math.max(0.1, Math.max(dawn, dusk) - dayPeak * 0.9)

    // Final density = biome density × time-of-day factor (or debug override)
    const density = this.densityOverride >= 0 ? this.densityOverride : visual.groundFogDensity * todFactor

    this.material.uniforms.uTime.value     = this.elapsed
    this.material.uniforms.uDensity.value  = density

    // Fog color from biome
    const fc = visual.fog.color
    this.material.uniforms.uFogColor.value.setRGB(fc[0], fc[1], fc[2])
  }
}
