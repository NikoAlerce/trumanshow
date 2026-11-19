// The painted sky wall of the dome: projected sky paint (so the stairs and the
// ledge disappear into it like in the film), the bow puncture, the wet line,
// the endless extension of the wall, the far dome and the EXIT lettering.
import { WAVES_GLSL, PORTAL_GLSL, WATER_Y, WALL_X, LEDGE_X } from './waves.js';

export const SKY = {
  uSpan: 2.4,        // content units covered by one horizontal repeat of the painting
  uOffset: 0.22,     // slides the painting: clear sky where the words are written
  vSpan: 1.6,        // content units from the waterline to the top of the painting
  wallTop: 9.0,      // the wall keeps going up (painted zenith)
  domeR: 14.0,
  domeH: 7.5,
  domeRepeat: 7.0,
};

const SKY_DEFS = () => ({
  DOME_H: SKY.domeH.toFixed(3),
  DOME_REP: SKY.domeRepeat.toFixed(3),
  WATER_Y: WATER_Y.toFixed(5),
  WALL_X: WALL_X.toFixed(5),
  LEDGE_X: LEDGE_X.toFixed(5),
  SKY_US: (-1 / SKY.uSpan).toFixed(6),
  SKY_UO: SKY.uOffset.toFixed(6),
  SKY_VS: (1 / SKY.vSpan).toFixed(6),
});

// ------------------------------------------------------------------ wall material
export function createWallMaterial(THREE, { skyTex, uniforms, doorCut = false, noiseTex }) {
  const mat = new THREE.MeshStandardMaterial({
    name: doorCut ? 'SkyWallExtension' : 'SkyWall',
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1,
    roughness: 0.86,
    metalness: 0.0,
    // the modelled wall has a few faces with inverted winding (the landing on
    // top of the stairs), so it is drawn double sided like the original
    side: doorCut ? THREE.FrontSide : THREE.DoubleSide,
  });
  mat.defines = { ...SKY_DEFS(), ...(doorCut ? { DOOR_CUT: 1, PORTAL_RX: 1 } : {}) };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSky = { value: skyTex };
    shader.uniforms.uNoise = { value: noiseTex };
    shader.uniforms.uRootRot = uniforms.uRootRot;
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uLight = uniforms.uLight;
    shader.uniforms.uWallGlow = uniforms.uWallGlow;
    shader.uniforms.uOpen = uniforms.uOpen;
    shader.uniforms.uOpenPos = uniforms.uOpenPos;
    shader.uniforms.uDeep = { value: new THREE.Color(0.006, 0.05, 0.075) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform mat3 uRootRot;
        varying vec3 vLocalPos;
        varying vec3 vLocalNrm;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // content space = world space with the cube rotation removed
        vLocalPos = transpose(uRootRot) * (modelMatrix * vec4(transformed, 1.0)).xyz;
        vLocalNrm = normalize(transpose(uRootRot) * (mat3(modelMatrix) * objectNormal));`);
    // three r154+ calls the last chunk opaque_fragment (r151, the EJX player's: output_fragment)
    const out = shader.fragmentShader.includes('#include <opaque_fragment>') ? '#include <opaque_fragment>' : '#include <output_fragment>';
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uSky;
        uniform sampler2D uNoise;
        uniform float uTime;
        uniform float uLight;
        uniform float uWallGlow;
        uniform float uOpen;
        uniform vec2 uOpenPos;
        uniform vec3 uDeep;
        uniform mat3 uRootRot;
        varying vec3 vLocalPos;
        varying vec3 vLocalNrm;
        ${WAVES_GLSL}
        ${PORTAL_GLSL}
        float crackLine(vec2 p, float a, float len, float w) {
          vec2 d = vec2(cos(a), sin(a));
          float t = dot(p, d);
          float dist = abs(p.x * d.y - p.y * d.x);
          float alongMask = step(0.0, t) * (1.0 - smoothstep(len * 0.6, len, t));
          return (1.0 - smoothstep(0.0, w * (1.0 - t / len), dist)) * alongMask;
        }`)
      .replace('#include <map_fragment>', `
        #ifdef DOOR_CUT
          if (vLocalPos.z > -0.2205 && vLocalPos.z < -0.1545 && vLocalPos.y > -0.1075 && vLocalPos.y < 0.0305) discard;
          if (!seenThroughWindow(transpose(uRootRot) * cameraPosition, vLocalPos)) discard;
        #endif
        vec3 an = abs(vLocalNrm);
        bool faceX = an.x >= max(an.y, an.z);
        float uOff = faceX ? 0.0 : (vLocalPos.x - WALL_X) * 0.8;
        vec2 skyUv = vec2((vLocalPos.z + uOff) * SKY_US + SKY_UO, (vLocalPos.y - WATER_Y) * SKY_VS);
        vec3 paint = texture2D(uSky, skyUv).rgb;
        // towards the far ends the wall uses the dome's projection (same azimuth and
        // height as the dome cylinder it runs into) and the dome's flat light
        float farK = smoothstep(1.6, 5.5, abs(vLocalPos.z));
        if (farK > 0.0) {
          float azD = atan(vLocalPos.x, vLocalPos.z);
          vec2 domeUv = vec2(azD / 6.2831853 * DOME_REP, clamp((vLocalPos.y - WATER_Y) / DOME_H, 0.002, 0.995));
          paint = mix(paint, texture2D(uSky, domeUv).rgb, farK);
        }
        // brush texture of the scenic paint, visible up close
        float brush = texture2D(uNoise, vec2(vLocalPos.z * 9.0, vLocalPos.y * 2.2)).g;
        paint *= 0.97 + 0.06 * brush;
        // stairs and ledge stick out of the wall: painted a touch lighter and lit
        // mostly by the studio lights, so they read through light and shadow
        float proud = smoothstep(WALL_X + 0.004, WALL_X + 0.012, vLocalPos.x);
        paint *= 1.0 + 0.06 * proud;

        // bow puncture + cracked paint
        vec2 hp = vec2(vLocalPos.z - 0.4245, vLocalPos.y + 0.3125);
        float ang = atan(hp.y, hp.x);
        float r = length(hp * vec2(1.0, 1.3));
        float jag = 0.0078 + 0.0024 * sin(ang * 7.0 + 1.3) + 0.0016 * sin(ang * 13.0 + 0.4) + 0.0009 * sin(ang * 29.0);
        float onWall = faceX && vLocalPos.x < LEDGE_X - 0.01 ? 1.0 : 0.0;
        float hole = smoothstep(jag + 0.0007, jag - 0.0007, r) * onWall;
        float chip = smoothstep(jag + 0.0045, jag + 0.001, r) * (1.0 - hole) * onWall;
        float cracks = 0.0;
        cracks += crackLine(hp, 0.35, 0.050, 0.0009);
        cracks += crackLine(hp, 1.35, 0.034, 0.0008);
        cracks += crackLine(hp, 2.45, 0.046, 0.0008);
        cracks += crackLine(hp, 3.55, 0.030, 0.0007);
        cracks += crackLine(hp, 4.40, 0.040, 0.0008);
        cracks += crackLine(hp, 5.50, 0.028, 0.0007);
        cracks = clamp(cracks, 0.0, 1.0) * onWall * (1.0 - hole);

        // water line on the ledge
        vec2 wp = vec2(LEDGE_X, vLocalPos.z);
        vec2 gw;
        float hw = WATER_Y + waveH(wp, uTime, gw) * waveFade(wp);
        float above = vLocalPos.y - hw;
        float wet = 1.0 - smoothstep(0.0, 0.017, above);
        float under = smoothstep(0.0, -0.05, above);

        vec3 base = paint;
        base = mix(base, base * vec3(0.55, 0.62, 0.66), wet * 0.75);
        base = mix(base, vec3(0.93, 0.95, 0.97), chip * 0.85);
        base *= 1.0 - cracks * 0.7;
        base = mix(base, vec3(0.012), hole);
        diffuseColor.rgb *= base * 0.8;
        float paintGlow = (1.0 - hole) * (1.0 - wet * 0.55) * (1.0 - cracks * 0.6);

        // Christof: the sky opens and lets a light through the painted clouds
        vec3 skyGlow = vec3(0.0);
        if (uOpen > 0.001) {
          vec2 op = vec2(vLocalPos.z, vLocalPos.y) - uOpenPos;
          float rr = length(op * vec2(1.0, 1.15));
          float ang = atan(op.y, op.x);
          float core = 1.0 - smoothstep(0.03 + 0.04 * uOpen, 0.10 + 0.05 * uOpen, rr);
          float halo = exp(-rr * 6.5);
          float rays = pow(max(0.0, sin(ang * 13.0 + uTime * 0.12) * 0.5 + 0.5), 7.0)
                     * pow(max(0.0, sin(ang * 7.0 - uTime * 0.07) * 0.5 + 0.5), 3.0) * exp(-rr * 2.6);
          skyGlow = vec3(1.0, 0.93, 0.78) * (core * 1.5 + halo * 0.55 + rays * 0.8) * uOpen;
          // the painted clouds around the opening catch the light
          base = mix(base, base * vec3(1.15, 1.08, 0.95), halo * uOpen);
        }
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.22, wet);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance *= base * mix(0.30, 0.10, proud) * uWallGlow * paintGlow;`)
      .replace(out, `
        outgoingLight = mix(outgoingLight, uDeep, under * 0.9);
        outgoingLight = mix(outgoingLight, paint * uWallGlow, farK);
        outgoingLight = outgoingLight * uLight + skyGlow;
        ` + out);
  };
  mat.customProgramCacheKey = () => 'skywall' + (doorCut ? '-cut' : '');
  return mat;
}

// ------------------------------------------------------------------ extensions
export function createWallExtensions(THREE, { skyTex, noiseTex, uniforms }) {
  const group = new THREE.Group();
  group.name = 'SkyWallExtension';
  const mat = createWallMaterial(THREE, { skyTex, noiseTex, uniforms, doorCut: true });

  // The modelled wall/ledge spans z in [Z0, Z1] and y up to WALL_TOP_MODEL.
  // Extensions only cover what the model does not, so no surfaces overlap
  // (overlapping coplanar faces would z-fight at a distance).
  const R = SKY.domeR;
  const Z0 = -0.488, Z1 = 0.497;
  const LEDGE_TOP = -0.353, LEDGE_BOTTOM_MODEL = -0.375, WALL_TOP_MODEL = 0.492;
  const addQuadX = (x, z0, z1, y0, y1) => {      // vertical quad facing +x
    const g = new THREE.PlaneGeometry(z1 - z0, y1 - y0, Math.max(1, Math.round((z1 - z0) / 0.5)), 1);
    g.rotateY(Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  const addQuadY = (y, x0, x1, z0, z1) => {      // horizontal quad facing +y
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, 1, Math.max(1, Math.round((z1 - z0) / 0.5)));
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  // wall face: both sides of the model and above it
  addQuadX(WALL_X, -R, Z0, LEDGE_TOP, SKY.wallTop);
  addQuadX(WALL_X, Z1, R, LEDGE_TOP, SKY.wallTop);
  addQuadX(WALL_X, Z0, Z1, WALL_TOP_MODEL, SKY.wallTop);
  // ledge front: both sides, and below the modelled ledge down into the sea
  addQuadX(LEDGE_X, -R, Z0, -0.75, LEDGE_TOP);
  addQuadX(LEDGE_X, Z1, R, -0.75, LEDGE_TOP);
  addQuadX(LEDGE_X, Z0, Z1, -0.75, LEDGE_BOTTOM_MODEL);
  // ledge top: both sides
  addQuadY(LEDGE_TOP, WALL_X, LEDGE_X, -R, Z0);
  addQuadY(LEDGE_TOP, WALL_X, LEDGE_X, Z1, R);
  const wallBottom = LEDGE_TOP;

  // section caps where the cube faces cut the set structure
  const capMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0.12, 0.13, 0.15), roughness: 1, name: 'SetSection' });
  const capFront1 = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X + 0.5, 1.0), capMat);
  capFront1.position.set((-0.5 + WALL_X) / 2, 0, 0.5);
  const capFront2 = new THREE.Mesh(new THREE.PlaneGeometry(LEDGE_X - WALL_X, wallBottom + 0.5), capMat);
  capFront2.position.set((WALL_X + LEDGE_X) / 2, (wallBottom - 0.5) / 2, 0.5);
  const capTop = new THREE.Mesh(new THREE.PlaneGeometry(WALL_X + 0.5, 1.0), capMat);
  capTop.rotation.x = -Math.PI / 2;
  capTop.position.set((-0.5 + WALL_X) / 2, 0.5, 0);
  const capBottom = new THREE.Mesh(new THREE.PlaneGeometry(LEDGE_X + 0.5, 1.0), capMat);
  capBottom.rotation.x = Math.PI / 2;
  capBottom.position.set((-0.5 + LEDGE_X) / 2, -0.5, 0);
  [capFront1, capFront2, capTop, capBottom].forEach((m) => { m.name = 'SetSectionCap'; group.add(m); });

  return { group, material: mat };
}

// ------------------------------------------------------------------ far dome
export function createDome(THREE, { skyTex, uniforms }) {
  const h = 60;
  const geo = new THREE.CylinderGeometry(SKY.domeR, SKY.domeR, h, 128, 1, true);
  geo.translate(0, WATER_Y - 0.6 + h / 2, 0);
  const mat = new THREE.ShaderMaterial({
    name: 'DomeSky',
    side: THREE.BackSide,
    depthWrite: false,
    defines: { WATER_Y: WATER_Y.toFixed(5), DOME_H: SKY.domeH.toFixed(3), DOME_REP: SKY.domeRepeat.toFixed(3) },
    uniforms: { uSky: { value: skyTex }, uLight: uniforms.uLight, uWallGlow: uniforms.uWallGlow },
    vertexShader: /* glsl */ `
      varying vec3 vLocal;
      void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uSky;
      uniform float uLight;
      uniform float uWallGlow;
      varying vec3 vLocal;
      void main() {
        float az = atan(vLocal.x, vLocal.z);
        float v = clamp((vLocal.y - WATER_Y) / DOME_H, 0.002, 0.995);
        vec3 c = texture2D(uSky, vec2(az / 6.2831853 * DOME_REP, v)).rgb;
        gl_FragColor = vec4(c * uWallGlow * uLight, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.name = 'DomeSky';
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  return dome;
}

// ------------------------------------------------------------------ EXIT lettering
export function createExitSign(THREE, exitTex) {
  const w = 0.062, h = w * (160 / 512);
  const geo = new THREE.PlaneGeometry(w, h);
  geo.rotateY(Math.PI / 2);   // faces +x, reads left->right from the sea
  const mat = new THREE.MeshStandardMaterial({
    name: 'ExitLettering', map: exitTex, transparent: true, roughness: 0.55, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const sign = new THREE.Mesh(geo, mat);
  sign.name = 'ExitSign';
  sign.position.set(WALL_X + 0.0006, 0.03 + 0.0115, -0.1875);
  sign.receiveShadow = true;
  return sign;
}
