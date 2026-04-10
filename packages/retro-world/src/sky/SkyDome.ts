import * as THREE from 'three'

const vertexShader = /* glsl */`
varying vec3 vDir;
void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vDir = normalize(worldPos.xyz - cameraPosition);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = /* glsl */`
uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 cloudColor;
uniform float cloudDensity;
uniform float hazeStrength;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float timeOfDay;
uniform float time;

varying vec3 vDir;

// Pseudo-random hash
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Simple 2D noise for clouds
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec3 dir = normalize(vDir);
  float y = clamp(dir.y, 0.0, 1.0);

  // Gradient with haze influence
  float gradientPow = mix(1.0, 0.3, hazeStrength);
  float gradient = smoothstep(0.0, 1.0, pow(y, gradientPow));
  vec3 col = mix(horizonColor, zenithColor, gradient);

  // Sun angle factor (how high the sun is)
  float sunAngle = timeOfDay * 6.28318;
  float sunY = sin(sunAngle);
  float dayFactor = clamp(sunY * 2.0 + 0.5, 0.0, 1.0);

  // Sun disc
  float sunDot = dot(dir, sunDirection);
  if (sunDot > 0.997) {
    col = sunColor * 2.0;
  } else if (sunDot > 0.99) {
    float glow = smoothstep(0.99, 0.997, sunDot);
    col = mix(col, sunColor * 1.5, glow);
  }
  // Sun glow halo
  if (sunDot > 0.95) {
    float halo = smoothstep(0.95, 0.99, sunDot) * 0.3 * dayFactor;
    col += sunColor * halo;
  }

  // Moon disc (opposite sun)
  vec3 moonDir = -sunDirection;
  float moonDot = dot(dir, moonDir);
  float nightFactor = 1.0 - dayFactor;
  if (moonDot > 0.998 && nightFactor > 0.1) {
    col = mix(col, vec3(0.7, 0.75, 0.9), nightFactor * 0.8);
  } else if (moonDot > 0.993 && nightFactor > 0.1) {
    float glow = smoothstep(0.993, 0.998, moonDot);
    col = mix(col, vec3(0.5, 0.55, 0.7), glow * nightFactor * 0.6);
  }

  // Stars
  if (nightFactor > 0.2 && y > 0.05) {
    vec2 starUV = dir.xz / (dir.y + 0.001) * 8.0;
    float starHash = hash(floor(starUV));
    if (starHash > 0.985) {
      float twinkle = sin(time * 2.0 + starHash * 100.0) * 0.5 + 0.5;
      float starBright = (starHash - 0.985) * 66.0 * twinkle * nightFactor;
      starBright *= smoothstep(0.05, 0.2, y);
      col += vec3(starBright * 0.8, starBright * 0.85, starBright);
    }
  }

  // Clouds - horizontal band noise
  if (cloudDensity > 0.01) {
    vec2 cloudUV = dir.xz / (abs(dir.y) + 0.3) * 2.0;
    cloudUV.x += time * 0.02;
    float n = noise(cloudUV * 3.0) * 0.5 + noise(cloudUV * 6.0) * 0.25 + noise(cloudUV * 12.0) * 0.125;
    float cloudMask = smoothstep(0.4 - cloudDensity * 0.3, 0.7, n) * cloudDensity;
    // Clouds visible mainly in upper hemisphere
    cloudMask *= smoothstep(0.0, 0.15, y);
    // Darken clouds at night
    vec3 litCloud = cloudColor * mix(0.15, 1.0, dayFactor);
    col = mix(col, litCloud, cloudMask);
  }

  // PS1 color quantization (5-bit per channel)
  col = floor(col * 31.0 + 0.5) / 31.0;

  gl_FragColor = vec4(col, 1.0);
}
`

export class SkyDome {
  private mesh: THREE.Mesh
  private material: THREE.ShaderMaterial

  constructor(scene: THREE.Scene) {
    const geo = new THREE.SphereGeometry(1, 16, 12)
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        zenithColor:  { value: new THREE.Color() },
        horizonColor: { value: new THREE.Color() },
        cloudColor:   { value: new THREE.Color() },
        cloudDensity: { value: 0.3 },
        hazeStrength: { value: 0.4 },
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
        sunColor:     { value: new THREE.Color(0xffe8c0) },
        timeOfDay:    { value: 0.4 },
        time:         { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
    })

    this.mesh = new THREE.Mesh(geo, this.material)
    this.mesh.renderOrder = -1000
    this.mesh.frustumCulled = false
    scene.add(this.mesh)
  }

  update(camera: THREE.Camera, timeOfDay: number, sunDirection: THREE.Vector3, sunColor: THREE.Color, delta: number) {
    this.mesh.position.copy(camera.position)
    // Scale sky dome to 90% of far plane so it always fits inside the frustum
    const far = (camera as THREE.PerspectiveCamera).far ?? 500
    const s = far * 0.9
    this.mesh.scale.set(s, s, s)
    this.material.uniforms.timeOfDay.value = timeOfDay
    this.material.uniforms.time.value += delta
    this.material.uniforms.sunDirection.value.copy(sunDirection)
    this.material.uniforms.sunColor.value.copy(sunColor)
  }

  setColors(zenith: THREE.Color, horizon: THREE.Color, cloud: THREE.Color, cloudDensity: number, haze: number) {
    this.material.uniforms.zenithColor.value.copy(zenith)
    this.material.uniforms.horizonColor.value.copy(horizon)
    this.material.uniforms.cloudColor.value.copy(cloud)
    this.material.uniforms.cloudDensity.value = cloudDensity
    this.material.uniforms.hazeStrength.value = haze
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
  }
}
