import * as THREE from 'three'

export function createWaterMaterial(waterColor: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0.0 },
      waterColor: { value: waterColor },
      fogColor: { value: new THREE.Color(0x000000) },
      fogNear: { value: 20.0 },
      fogFar: { value: 120.0 },
    },
    vertexShader: /* glsl */`
      uniform float time;
      varying vec2 vUv;
      varying float vFogDepth;

      void main() {
        vUv = uv;
        vec3 pos = position;

        // Two overlapping sine waves for gentle surface motion
        pos.z += sin(pos.x * 0.8 + time * 1.2) * 0.15;
        pos.z += sin(pos.y * 1.3 + time * 0.9) * 0.1;

        vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
        vFogDepth = -mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float time;
      uniform vec3 waterColor;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec2 vUv;
      varying float vFogDepth;

      void main() {
        vec2 uv = vUv;

        // Caustic shimmer pattern via time-based UV distortion
        float caustic1 = sin(uv.x * 20.0 + time * 2.0) * sin(uv.y * 20.0 + time * 1.5);
        float caustic2 = sin(uv.x * 15.0 - time * 1.8) * sin(uv.y * 12.0 + time * 2.2);
        float caustic = max(0.0, caustic1) * 0.08 + max(0.0, caustic2) * 0.06;

        // Base color with caustics
        vec3 color = waterColor + caustic;

        // Fresnel-ish: more opaque at edges (approximate with UV distance from center)
        float fresnel = 1.0 - abs(uv.y - 0.5) * 0.4;
        float alpha = 0.65 * fresnel;

        // Subtle sparkle
        float sparkle = max(0.0, sin(uv.x * 50.0 + time * 4.0) * sin(uv.y * 50.0 - time * 3.0));
        sparkle = pow(sparkle, 8.0) * 0.3;
        color += sparkle;

        // Fog
        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        color = mix(color, fogColor, fogFactor);

        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

export function updateWaterTime(material: THREE.ShaderMaterial, time: number) {
  material.uniforms.time.value = time
}

export function updateWaterFog(material: THREE.ShaderMaterial, fogColor: THREE.Color, fogNear: number, fogFar: number) {
  material.uniforms.fogColor.value.copy(fogColor)
  material.uniforms.fogNear.value = fogNear
  material.uniforms.fogFar.value = fogFar
}
