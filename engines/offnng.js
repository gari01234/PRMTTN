// ./engines/offnng.js
// OFFNNG volumétrico continuo (extraído y encapsulado)
let isOn = false;
let group = null;
let mesh  = null;
let prevBg = null;
let prevPR = null;
let rafId  = null;

function getTHREE(){ return window.THREE; }
function getCubeSize(){
  const w = window.cubeUniverse?.geometry?.parameters?.width;
  return (typeof w === 'number' && w > 0) ? w : 30;
}

function applyQuality(){
  const basePR = Math.min(window.devicePixelRatio || 1, 1.25);
  window.renderer.setPixelRatio(basePR);
  if (mesh?.material?.uniforms) {
    mesh.material.uniforms.uSteps.value = 46; // calidad “medio”
  }
}

function build(){
  const THREE = getTHREE();
  const cubeSize = getCubeSize();

  if (group){
    group.traverse(o => { if (o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
    window.scene.remove(group);
    group = null; mesh = null;
  }

  const geo = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uHalf  : { value: cubeSize * 0.5 },
      uInvModel: { value: new THREE.Matrix4() },

      uDensity   : { value: 0.70 },
      uSMin      : { value: 0.60 },
      uVMin      : { value: 0.84 },
      uSatGain   : { value: 1.22 },
      uValGain   : { value: 1.30 },
      uGammaV    : { value: 0.58 },
      uExposure  : { value: 1.90 },

      uEdgeStrength: { value: 1.0 },
      uEdgeBase    : { value: 1.00 },
      uEdgePow     : { value: 1.2 },
      uEdgeTintV   : { value: 0.84 },

      uFrontBias : { value: 0.85 },
      uSteps     : { value: 46 },

      uTime      : { value: 0.0 },
      uHueBias   : { value: 0.0 },
      uHueRate   : { value: 7.0 },
      uVBreathAmp: { value: 0.14 },
      uVBreathHz : { value: 0.06 },
      uVBreathPhase: { value: 0.0 },

      uPhaseX    : { value: 0.0 },
      uRotAxis   : { value: new THREE.Vector3(0,1,0) },
      uRotRateDeg: { value: 4.0 },
      uOpaque    : { value: 1 },

      uAxisMixH  : { value: new THREE.Vector2(0.0, 0.0) },
      uAxisMixS  : { value: new THREE.Vector2(0.0, 0.0) },
      uAxisMixV  : { value: new THREE.Vector2(0.0, 0.0) },

      uHueLFO1Amp  : { value: 0.35 },
      uHueLFO1Hz   : { value: 0.030 },
      uHueLFO1Phase: { value: 0.0 },
      uHueLFO2Amp  : { value: 0.20 },
      uHueLFO2Hz   : { value: 0.013 },
      uHueLFO2Phase: { value: 0.0 },

      uRotLFO1AmpDeg: { value: 0.30 },
      uRotLFO1Hz    : { value: 0.020 },
      uRotLFO1Phase : { value: 0.0 },
      uRotLFO2AmpDeg: { value: 0.15 },
      uRotLFO2Hz    : { value: 0.011 },
      uRotLFO2Phase : { value: 0.0 }
    },
    transparent : true,
    depthWrite  : false,
    depthTest   : true,
    side        : THREE.DoubleSide,
    dithering   : true,
    vertexShader: `
      varying vec3 vPos;
      void main(){
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
precision highp float;
uniform float uHalf; uniform mat4  uInvModel;
uniform float uDensity, uSMin, uVMin, uSatGain, uValGain, uGammaV, uExposure;
uniform float uEdgeStrength, uEdgeBase, uEdgePow, uEdgeTintV, uFrontBias;
uniform int   uSteps;
uniform float uTime, uHueBias, uHueRate, uVBreathAmp, uVBreathHz, uVBreathPhase;
uniform float uPhaseX;
uniform vec3  uRotAxis; uniform float uRotRateDeg;
uniform int   uOpaque;
uniform vec2  uAxisMixH; uniform vec2 uAxisMixS; uniform vec2 uAxisMixV;
uniform float uHueLFO1Amp, uHueLFO1Hz, uHueLFO1Phase;
uniform float uHueLFO2Amp, uHueLFO2Hz, uHueLFO2Phase;
uniform float uRotLFO1AmpDeg, uRotLFO1Hz, uRotLFO1Phase;
uniform float uRotLFO2AmpDeg, uRotLFO2Hz, uRotLFO2Phase;
varying vec3  vPos;
vec3 hsv2rgb(float H, float S, float V){
  float h = H / 360.0;
  vec3 K = vec3(1.0, 2.0/3.0, 1.0/3.0);
  vec3 P = abs(fract(vec3(h) + K.xyz) * 6.0 - 3.0);
  return V * mix(vec3(1.0), clamp(P - 1.0, 0.0, 1.0), S);
}
bool rayBox(vec3 ro, vec3 rd, out float t0, out float t1){
  vec3 bmin = vec3(-uHalf), bmax = vec3(uHalf);
  vec3 invD=1.0/rd; vec3 tA=(bmin-ro)*invD, tB=(bmax-ro)*invD;
  vec3 tsm=min(tA,tB), tbg=max(tA,tB);
  t0=max(max(tsm.x,tsm.y),tsm.z); t1=min(min(tbg.x,tbg.y),tbg.z);
  return (t1 >= max(t0,0.0));
}
vec3 rotateAxis(vec3 p, vec3 axis, float theta){
  vec3 a = normalize(axis);
  float c = cos(theta), s = sin(theta);
  return p*c + cross(a,p)*s + a*dot(a,p)*(1.0-c);
}
void main(){
  vec3 ro = (uInvModel * vec4(cameraPosition,1.0)).xyz;
  vec3 rd = normalize(vPos - ro);
  float tEnter, tExit;
  if (!rayBox(ro, rd, tEnter, tExit)) discard;
  float t0 = max(tEnter, 0.0), t1 = tExit;
  float len = t1 - t0;
  float dt = len / float(max(uSteps,1));
  vec3 pos = ro + rd * (t0 + 0.5 * dt);

  vec3 acc = vec3(0.0); float a=0.0;

  float hueDrift = uHueRate
                 + uHueLFO1Amp * sin(6.2831853 * uHueLFO1Hz * uTime + uHueLFO1Phase)
                 + uHueLFO2Amp * sin(6.2831853 * uHueLFO2Hz * uTime + uHueLFO2Phase);
  float rotRate = uRotRateDeg
                + uRotLFO1AmpDeg * sin(6.2831853 * uRotLFO1Hz * uTime + uRotLFO1Phase)
                + uRotLFO2AmpDeg * sin(6.2831853 * uRotLFO2Hz * uTime + uRotLFO2Phase);
  float theta = radians(rotRate) * uTime;

  const int MAX_STEPS = 64;
  for (int i=0;i<MAX_STEPS;i++){
    if (i >= uSteps) break;
    vec3 q = pos / uHalf;
    q = rotateAxis(q, uRotAxis, theta);
    vec3 u = q*0.5 + 0.5;
    u.x = fract(u.x + uPhaseX);

    float dx=min(u.x,1.0-u.x), dy=min(u.y,1.0-u.y), dz=min(u.z,1.0-u.z);
    float edgeDist=min(min(dx,dy),dz);
    float edge = smoothstep(0.06,0.18,edgeDist);
    edge = pow(edge, max(0.2, uEdgePow));

    float uHx = clamp(u.x + dot(uAxisMixH, vec2(u.y-0.5, u.z-0.5)), 0.0, 1.0);
    float uSz = clamp(u.z + dot(uAxisMixS, vec2(u.x-0.5, u.y-0.5)), 0.0, 1.0);
    float uVy = clamp(u.y + dot(uAxisMixV, vec2(u.x-0.5, u.z-0.5)), 0.0, 1.0);

    float H = mod(uHx * 360.0 + uHueBias + uTime * hueDrift, 360.0);

    float V = clamp(uVy,0.0,1.0);
    V *= (1.0 + uVBreathAmp * sin(6.2831853 * uVBreathHz * uTime + uVBreathPhase));
    V = clamp(V,0.0,1.0); V = pow(V,uGammaV); V = max(V,uVMin); V = clamp(V * uValGain, 0.0, 1.0);

    float S = clamp(uSz,0.0,1.0); S = max(S,uSMin); S = clamp(S * uSatGain, 0.0, 1.0);

    vec3 rgb = hsv2rgb(H,S,V);

    vec3 uF=u;
    if (dx <= dy && dx <= dz) { uF.x = (u.x < 0.5 ? 0.0 : 1.0); }
    else if (dy <= dx && dy <= dz) { uF.y = (u.y < 0.5 ? 0.0 : 1.0); }
    else { uF.z = (u.z < 0.5 ? 0.0 : 1.0); }
    float HF = mod((uF.x)*360.0 + uHueBias + uTime*hueDrift, 360.0);
    float VF = max(uF.y, uEdgeTintV);
    float SF = max(uF.z, uSMin);
    vec3  rgbFace = hsv2rgb(HF,SF,VF);
    rgb = mix(rgbFace, rgb, edge);

    float tau = float(i) / float(max(uSteps-1,1));
    float front = mix(1.0, 1.0 - tau, clamp(uFrontBias, 0.0, 1.0));
    float edgeAlpha = mix(uEdgeBase, 1.0, edge);

    float w = (1.0 - a) * (1.0 - exp(-uDensity * dt / (2.0*uHalf))) * front * edgeAlpha;
    acc += rgb * w; a += w;
    if (a > 0.995) break;
    pos += rd * dt;
  }
  vec3 col = min(acc * uExposure, vec3(1.0));
  float outA = (uOpaque == 1) ? 1.0 : a;
  gl_FragColor = vec4(col, outA);
}
    `
  });

  mesh = new THREE.Mesh(geo, mat);
  mesh.updateMatrixWorld(true);
  mat.uniforms.uInvModel.value.copy(mesh.matrixWorld).invert();

  group = new THREE.Group();
  group.add(mesh);
  window.scene.add(group);

  applyQuality();
  syncFromScene();
}

function syncFromScene(){
  if (!mesh || !mesh.material || !mesh.material.uniforms) return;
  const U = mesh.material.uniforms;

  const sel = document.getElementById('permutationList');
  const selPerms = sel ? Array.from(sel.selectedOptions).map(o => o.value.split(',').map(Number)) : [];

  let avgR = 4.0;
  if (selPerms.length){
    const ranges = selPerms.map(p => window.computeRange(window.computeSignature(p)));
    avgR = ranges.reduce((a,b)=>a+b,0) / ranges.length;
  }
  const nr = Math.max(0, Math.min(1, (avgR - 2) / 4));
  const sigN = 0.5;

  U.uHueBias.value = window.sceneSeed;
  U.uHueRate.value = 6.0 + 2.0 * (0.6*nr + 0.4*sigN);
  U.uRotRateDeg.value = 3.0 + 2.0 * (0.5*nr + 0.5*sigN);

  // fases deterministas
  const sumR  = selPerms.reduce((a,p)=>a+window.lehmerRank(p),0);
  const sumR2 = selPerms.reduce((a,p)=>{const r=window.lehmerRank(p); return a + r*r;},0);
  const seedA = (window.sceneSeed*7 + window.S_global*13 + sumR)  % 997;
  const seedB = (window.sceneSeed*5 + window.S_global*11 + sumR2) % 991;
  U.uHueLFO1Phase.value = 2*Math.PI * (seedA / 997);
  U.uHueLFO2Phase.value = 2*Math.PI * (seedB / 991);
  U.uRotLFO1Phase.value = 2*Math.PI * (seedB / 991) + 0.5;
  U.uRotLFO2Phase.value = 2*Math.PI * (seedA / 997) + 1.0;

  const phaseX = ((window.sceneSeed + 2 * window.S_global) % 360) / 360;
  U.uPhaseX.value = phaseX;

  // eje de giro
  const toRad = Math.PI / 180;
  const ax = Math.cos((window.sceneSeed*13 + window.S_global*7) * toRad);
  const ay = Math.cos((window.sceneSeed*5  + window.S_global*11) * toRad);
  const az = Math.cos((window.sceneSeed*17 - window.S_global*3) * toRad);
  const norm = Math.max(1e-6, Math.hypot(ax, ay, az));
  U.uRotAxis.value.set(ax/norm, ay/norm, az/norm);
}

function animate(){
  if (!isOn || !mesh) return;
  // mantener uInvModel correcto por si hay transformaciones de escena
  mesh.updateMatrixWorld(true);
  mesh.material.uniforms.uInvModel.value.copy(mesh.matrixWorld).invert();

  mesh.material.uniforms.uTime.value = performance.now() * 0.001;
  rafId = requestAnimationFrame(animate);
}

const OFFNNG_ENGINE = {
  name: 'OFFNNG',
  enter(){
    if (isOn) return;
    if (prevPR === null) prevPR = window.renderer.getPixelRatio();

    build();

    prevBg = window.scene.background ? window.scene.background.clone() : null;
    // usa el fondo calculado por BUILD/refreshAll
    window.cubeUniverse.visible = false;
    window.permutationGroup.visible = false;

    isOn = true;
    rafId = requestAnimationFrame(animate);
    if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
  },
  leave(){
    if (!isOn) return;
    if (group){
      group.traverse(o => { if (o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
      window.scene.remove(group);
      group = null; mesh = null;
    }
    if (prevBg) window.scene.background = prevBg;
    if (prevPR !== null){ window.renderer.setPixelRatio(prevPR); prevPR = null; }

    window.cubeUniverse.visible = true;
    window.permutationGroup.visible = true;

    isOn = false;
    if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
    if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
  },
  syncFromScene(){
    if (isOn) syncFromScene();
  }
};

if (window.ENGINE && typeof window.ENGINE.register === 'function'){
  window.ENGINE.register('OFFNNG', OFFNNG_ENGINE);
}
export default OFFNNG_ENGINE;
