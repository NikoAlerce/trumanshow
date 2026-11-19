// Truman's sailboat: better materials, painted in the shader so they follow
// the UV layout of the original model.
//  * sails: off-white sailcloth in horizontal panels with stitched seams and
//    batten pockets; they glow when the sun is behind them (translucency)
//  * hull: glossy gelcoat, navy boot stripe, red sheer line, the name
//    "SANTA MARIA" on both sides of the bow, antifouling below the waterline
//  * fittings: polished stainless; windows: real glass
import { WATER_Y } from './waves.js';

function nameTexture(THREE, family) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 160;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 1024, 160);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `600 118px ${family}, sans-serif`;
  const text = 'SANTA MARIA';
  const track = 14;
  const widths = [...text].map((ch) => g.measureText(ch).width);
  let x = 512 - (widths.reduce((a, b) => a + b, 0) + track * (text.length - 1)) / 2;
  [...text].forEach((ch, i) => { g.fillText(ch, x + widths[i] / 2, 86); x += widths[i] + track; });
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;
}

const COMMON_V = /* glsl */ `
  uniform mat4 uRestMatrix;
  varying vec3 vRest;
  varying vec3 vRestN;
`;
const COMMON_V_MAIN = /* glsl */ `
  vRest = (uRestMatrix * vec4(transformed, 1.0)).xyz;
  vRestN = normalize(mat3(uRestMatrix) * objectNormal);
`;

function patch(THREE, material, uniforms, restMatrix, extra) {
  const rest = { value: restMatrix.clone() };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRestMatrix = rest;
    shader.uniforms.uLight = uniforms.uLight;
    shader.uniforms.uSunDir = uniforms.uSunDir;
    shader.uniforms.uRootRot = uniforms.uRootRot;
    Object.assign(shader.uniforms, extra.uniforms || {});
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + COMMON_V)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + COMMON_V_MAIN);
    let fs = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uLight;
      uniform vec3 uSunDir;
      uniform mat3 uRootRot;
      varying vec3 vRest;
      varying vec3 vRestN;
      ${extra.decl || ''}`);
    if (extra.afterMap) fs = fs.replace('#include <map_fragment>', '#include <map_fragment>\n' + extra.afterMap);
    if (extra.emissive) fs = fs.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + extra.emissive);
    if (extra.rough) fs = fs.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n' + extra.rough);
    // three r154+ calls the last chunk opaque_fragment (r151, the EJX player's: output_fragment)
    const out = fs.includes('#include <opaque_fragment>') ? '#include <opaque_fragment>' : '#include <output_fragment>';
    fs = fs.replace(out, `
      float uwDepth = ${WATER_Y.toFixed(5)} - vRest.y;
      outgoingLight = mix(outgoingLight, vec3(0.008, 0.07, 0.09), smoothstep(0.0, 0.035, uwDepth) * 0.85);
      outgoingLight *= uLight;
      ${out}`);
    shader.fragmentShader = fs;
  };
  material.customProgramCacheKey = () => 'boat-' + (extra.key || 'base');
  material.needsUpdate = true;
}

export function dressBoat(THREE, { boatPivot, bowPoint, uniforms, noiseTex, family }) {
  boatPivot.updateMatrixWorld(true);
  const pivotInv = new THREE.Matrix4().copy(boatPivot.matrixWorld).invert();
  const toRest = new THREE.Matrix4().makeTranslation(bowPoint.x, bowPoint.y, bowPoint.z);
  const nameTex = nameTexture(THREE, family);

  boatPivot.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    // object space -> content space of the boat at rest (follows the boat when it rocks)
    const rest = new THREE.Matrix4().multiplyMatrices(toRest, new THREE.Matrix4().multiplyMatrices(pivotInv, o.matrixWorld));
    const m = o.material;
    if (Array.isArray(m)) return;

    if (m.name === 'J_04580_base') {
      // the atlas: sails, mast, deck wood and the underwater body
      // was a transparent material with depthWrite off: opaque now, so it must write depth
      m.metalness = 0.0; m.roughness = 0.7; m.alphaTest = 0.35; m.transparent = false; m.depthWrite = true; m.side = THREE.DoubleSide;
      m.emissive = new THREE.Color(1, 1, 1); m.emissiveMap = null; m.emissiveIntensity = 1;
      patch(THREE, m, uniforms, rest, {
        key: 'atlas',
        uniforms: { uNoise: { value: noiseTex } },
        decl: 'uniform sampler2D uNoise;',
        afterMap: /* glsl */ `
          float lum = dot(diffuseColor.rgb, vec3(0.3333));
          // mast, boom, stays and the bow pole map to the swatch corner of the atlas:
          // anodised aluminium, so the rig reads against the white sails and the sky
          float rig = step(vMapUv.x, 0.05) * step(0.97, vMapUv.y) * step(0.5, lum);   // r151: per-map uv varying
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.085, 0.09, 0.10), rig);
          // underwater body: antifouling
          float bottom = (1.0 - step(-0.3625, vRest.y)) * (1.0 - smoothstep(0.15, 0.35, lum));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.22, 0.045, 0.035), bottom);
        `,
        emissive: 'totalEmissiveRadiance = vec3(0.0);',
        rough: 'roughnessFactor = mix(roughnessFactor, 0.45, rig); metalnessFactor = mix(metalnessFactor, 0.35, rig);',
      });
    } else if (m.name === 'Material.002') {
      // hull topsides
      m.color.setRGB(1, 1, 1); m.metalness = 0.0; m.roughness = 0.22;
      m.envMapIntensity = 1.2;
      patch(THREE, m, uniforms, rest, {
        key: 'hull',
        uniforms: { uName: { value: nameTex } },
        decl: 'uniform sampler2D uName;',
        afterMap: /* glsl */ `
          vec3 hull = vec3(0.92, 0.93, 0.935);
          float boot = smoothstep(-0.3628, -0.3622, vRest.y) * (1.0 - smoothstep(-0.3568, -0.3562, vRest.y));
          float sheer = smoothstep(-0.3158, -0.3154, vRest.y) * (1.0 - smoothstep(-0.3142, -0.3138, vRest.y));
          hull = mix(hull, vec3(0.025, 0.05, 0.13), boot);
          hull = mix(hull, vec3(0.55, 0.05, 0.04), sheer);
          // the name, on both sides of the bow (read from bow to stern)
          if (abs(vRestN.z) > 0.35) {
            float u = (vRest.x + 0.352) / 0.088;
            if (vRestN.z < 0.0) u = 1.0 - u;
            float v = (vRest.y + 0.3415) / 0.0150;
            if (u > 0.0 && u < 1.0 && v > 0.0 && v < 1.0) {
              float a = texture2D(uName, vec2(u, v)).a;
              hull = mix(hull, vec3(0.025, 0.05, 0.13), a);
            }
          }
          // a faint tide mark above the boot stripe
          hull *= 1.0 - 0.10 * (1.0 - smoothstep(-0.3562, -0.350, vRest.y));
          diffuseColor.rgb = hull;
        `,
      });
    } else if (m.name === 'Material.014') {
      // the sails: cross-cut sailcloth, stitched panels, glowing against the sun
      m.color.setRGB(1, 1, 1); m.metalness = 0.0; m.roughness = 0.85; m.side = THREE.DoubleSide;
      m.emissive = new THREE.Color(1, 1, 1); m.emissiveIntensity = 1;
      patch(THREE, m, uniforms, rest, {
        key: 'sail',
        uniforms: { uNoise: { value: noiseTex } },
        decl: 'uniform sampler2D uNoise;',
        afterMap: /* glsl */ `
          float panel = 0.033;
          float fy = (vRest.y + 0.3) / panel;
          float sd = min(fract(fy), 1.0 - fract(fy)) * panel;          // distance to the nearest seam
          float sailSeam = 1.0 - smoothstep(0.00035, 0.0008, sd);
          float stitch = (1.0 - smoothstep(0.00012, 0.0002, abs(sd - 0.0014)))
                       * step(0.45, fract((vRest.x + vRest.z) * 1400.0));
          float bt = abs(fract((vRest.y + 0.3) / 0.105) - 0.5) * 0.105;   // batten pockets
          float batten = (1.0 - smoothstep(0.0007, 0.0012, abs(bt - 0.0))) * step(vRest.x, -0.17);
          float tone = 0.975 + 0.035 * fract(sin(floor(fy) * 12.9898) * 43758.5453);
          float wr = texture2D(uNoise, vRest.xz * 22.0 + vec2(vRest.y * 7.0, vRest.y * 3.0)).g;
          // reinforcement patches at the head and the clew
          float head = 1.0 - smoothstep(0.02, 0.028, length(vec2(vRest.y - 0.15, (vRest.x + 0.215) * 0.6)));
          vec3 cloth = vec3(0.965, 0.952, 0.905) * tone * (0.965 + 0.06 * wr);
          cloth *= 1.0 - 0.13 * sailSeam - 0.06 * stitch - 0.07 * batten - 0.05 * head;
          diffuseColor.rgb = cloth;
        `,
        emissive: /* glsl */ `
          vec3 sunV = normalize((viewMatrix * vec4(uRootRot * uSunDir, 0.0)).xyz);
          float backlit = clamp(dot(-normal, sunV), 0.0, 1.0);
          totalEmissiveRadiance = cloth * (0.28 + 0.55 * backlit) * (1.0 - 0.5 * sailSeam - 0.3 * batten) * uLight;
        `,
      });
    } else if (m.name === 'Clear_Glass') {
      m.color.setRGB(0.7, 0.8, 0.85); m.metalness = 0.0; m.roughness = 0.05; m.opacity = 0.45; m.envMapIntensity = 1.5;
      patch(THREE, m, uniforms, rest, { key: 'glass' });
    } else if (m.name === 'Dark_Glass') {
      m.color.setRGB(0.03, 0.04, 0.05); m.metalness = 0.2; m.roughness = 0.04; m.envMapIntensity = 1.4;
      patch(THREE, m, uniforms, rest, { key: 'darkglass' });
    } else {
      patch(THREE, m, uniforms, rest, { key: 'other-' + m.type });
    }
  });
}
