import * as THREE from 'three'

const vertexShader = /* glsl */ `
  attribute float aSeed;

  uniform float uIsDecal;

  varying vec2 vUv;
  varying float vSeed;

  float hash(float s, float off) {
    return fract(sin(s * 127.1 + off * 311.7) * 43758.5453);
  }

  void main() {
    vUv = uv;
    vSeed = aSeed;

    vec3 pos = position;

    if (uIsDecal < 0.5) {
      float bendAmt   = (hash(aSeed, 0.0) - 0.5) * 0.6;
      float squash    = 0.7 + hash(aSeed, 1.0) * 0.7;
      float bulgeAmt  = (hash(aSeed, 2.0) - 0.5) * 0.5;
      float twistAmt  = (hash(aSeed, 8.0) - 0.5) * 0.3;

      float normalY = pos.y + 0.5;

      pos.y *= squash;
      pos.x += sin(normalY * 3.14159) * bendAmt;

      if (normalY > 0.4) {
        float bulgeT = (normalY - 0.4) / 0.6;
        pos.x += pos.x * bulgeAmt * bulgeT;
      }

      if (normalY < 0.4) {
        pos.x += twistAmt * (0.4 - normalY);
      }
    }

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uIsDecal;

  varying vec2 vUv;
  varying float vSeed;

  float hash(float s, float off) {
    return fract(sin(s * 127.1 + off * 311.7) * 43758.5453);
  }

  vec3 rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float l = (maxC + minC) * 0.5;
    if (maxC == minC) return vec3(0.0, 0.0, l);
    float d = maxC - minC;
    float s = l > 0.5 ? d / (2.0 - maxC - minC) : d / (maxC + minC);
    float h;
    if (maxC == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
    else if (maxC == c.g) h = (c.b - c.r) / d + 2.0;
    else h = (c.r - c.g) / d + 4.0;
    return vec3(h / 6.0, s, l);
  }

  float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0/6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0/2.0) return q;
    if (t < 2.0/3.0) return p + (q - p) * (2.0/3.0 - t) * 6.0;
    return p;
  }

  vec3 hsl2rgb(vec3 hsl) {
    if (hsl.y == 0.0) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    return vec3(
      hue2rgb(p, q, hsl.x + 1.0/3.0),
      hue2rgb(p, q, hsl.x),
      hue2rgb(p, q, hsl.x - 1.0/3.0)
    );
  }

  void main() {
    vec2 uv = vUv;

    float flipChance = hash(vSeed, 6.0);
    if (flipChance > 0.5) {
      uv.x = 1.0 - uv.x;
    }

    if (uv.y > 0.5 && uIsDecal < 0.5) {
      float sectionOff = (hash(vSeed, 7.0) - 0.5) * 0.2;
      uv.x = clamp(uv.x + sectionOff, 0.0, 1.0);
    }

    vec4 texColor = texture2D(uTexture, uv);

    if (texColor.a < 0.5) discard;

    vec3 hsl = rgb2hsl(texColor.rgb);

    float hueShift = (hash(vSeed, 3.0) - 0.5) * 0.166;
    hsl.x = fract(hsl.x + hueShift);

    float brightShift = (hash(vSeed, 4.0) - 0.5) * 0.4;
    hsl.z = clamp(hsl.z + brightShift, 0.0, 1.0);

    float satShift = (hash(vSeed, 5.0) - 0.5) * 0.5;
    hsl.y = clamp(hsl.y + satShift, 0.0, 1.0);

    vec3 finalColor = hsl2rgb(hsl);

    float lightFactor = 0.6 + 0.4 * (uIsDecal > 0.5 ? 0.8 : vUv.y * 0.5 + 0.5);
    finalColor *= lightFactor;

    gl_FragColor = vec4(finalColor, texColor.a);
  }
`

export function createSpriteMaterial(
  texture: THREE.Texture,
  isDecal: boolean,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTexture: { value: texture },
      uIsDecal: { value: isDecal ? 1.0 : 0.0 },
    },
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  })
}
