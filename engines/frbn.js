// engines/frbn.js
// FRBN como Engine: exclusivo, pero con fallbacks a window.* y loop de tiempo propio.

let hostRef = null;
const FRBNEngine = (() => {
  let skySphere = null;
  let rafId = null;
  let prev = { bg: null, cube: true, perms: true };

  // tabla simple por patrón → curva de saturación/valor + amplitud y rate
  const PAT = {
    1:  { sat0:0.55, sat1:0.70, val0:0.88, val1:0.96, amp0:0.06, amp1:0.10, rate0:0.80, rate1:1.00 },
    2:  { sat0:0.70, sat1:0.90, val0:0.80, val1:0.90, amp0:0.10, amp1:0.16, rate0:1.05, rate1:1.35 },
    3:  { sat0:0.45, sat1:0.60, val0:0.86, val1:0.93, amp0:0.06, amp1:0.08, rate0:0.90, rate1:1.05 },
    4:  { sat0:0.50, sat1:0.65, val0:0.84, val1:0.92, amp0:0.07, amp1:0.10, rate0:0.95, rate1:1.10 },
    5:  { sat0:0.52, sat1:0.58, val0:0.92, val1:0.94, amp0:0.05, amp1:0.07, rate0:0.85, rate1:0.95 },
    6:  { sat0:0.40, sat1:0.55, val0:0.82, val1:0.90, amp0:0.06, amp1:0.09, rate0:0.95, rate1:1.05 },
    7:  { sat0:0.55, sat1:0.78, val0:0.84, val1:0.92, amp0:0.08, amp1:0.12, rate0:1.00, rate1:1.20 },
    8:  { sat0:0.62, sat1:0.80, val0:0.86, val1:0.94, amp0:0.10, amp1:0.14, rate0:1.05, rate1:1.30 },
    9:  { sat0:0.35, sat1:0.50, val0:0.86, val1:0.92, amp0:0.06, amp1:0.08, rate0:0.90, rate1:1.00 },
    10: { sat0:0.52, sat1:0.70, val0:0.86, val1:0.94, amp0:0.08, amp1:0.12, rate0:1.00, rate1:1.20 },
    11: { sat0:0.68, sat1:0.88, val0:0.90, val1:0.98, amp0:0.10, amp1:0.16, rate0:1.10, rate1:1.35 }
  };

  const clamp01 = x => Math.max(0, Math.min(1, x));

  // —— Fallbacks a window.* si el registry no aportó host completo
  function safeHost(h) {
    const H = h || {};
    const w = (typeof window !== 'undefined') ? window : {};
    const core = w.core || {};
    const THREE = H.THREE || w.THREE;
    const scene = H.scene || w.scene;
    const cubeUniverse = H.cubeUniverse || w.cubeUniverse;
    const permutationGroup = H.permutationGroup || w.permutationGroup;

    // invariants
    const invariants = H.invariants || {
      sceneSeed: (typeof w.sceneSeed === 'number' ? w.sceneSeed : 0),
      activePatternId: (typeof w.activePatternId === 'number' ? w.activePatternId : 1)
    };

    // seleccion actual desde el <select> si no hay getter
    const getSelectedPerms =
      H.getSelectedPerms ||
      (() => {
        const sel = w.document && w.document.getElementById('permutationList');
        if (!sel) return [];
        return Array.from(sel.selectedOptions).map(o => o.value.split(',').map(Number));
      });

    // utils (core)
    const utils = H.utils || {
      computeSignature: H.utils?.computeSignature || w.computeSignature || core.computeSignature,
      computeRange:     H.utils?.computeRange     || w.computeRange     || core.computeRange
    };

    return { THREE, scene, cubeUniverse, permutationGroup, invariants, getSelectedPerms, utils };
  }

  function buildSkySphere(host){
    const { THREE } = safeHost(host);
    if (!THREE) { console.error('[FRBN] THREE no disponible'); return null; }
    const geo = new THREE.SphereGeometry(500, 64, 64);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time:    { value: 0 },
        rate:    { value: 1 },
        hueBias: { value: 0 },
        sat:     { value: 0.60 },
        val:     { value: 0.92 },
        valAmp:  { value: 0.08 }
      },
      side: THREE.BackSide,
      depthWrite: false,
      transparent: false,
      vertexShader: `
        varying vec3 vPos;
        void main(){
          vPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vPos;
        uniform float time, rate, hueBias, sat, val, valAmp;

        vec3 hsv2rgb(float h, float s, float v){
          float c=v*s, x=c*(1.0-abs(mod(h/60.0,2.0)-1.0)), m=v-c;
          vec3 rgb;
          if(h<60.0) rgb=vec3(c,x,0.0);
          else if(h<120.0) rgb=vec3(x,c,0.0);
          else if(h<180.0) rgb=vec3(0.0,c,x);
          else if(h<240.0) rgb=vec3(0.0,x,c);
          else if(h<300.0) rgb=vec3(x,0.0,c);
          else rgb=vec3(c,0.0,x);
          return rgb + vec3(m);
        }

        void main(){
          float u = (atan(vPos.z, vPos.x) + 3.14159265) / (2.0*3.14159265);
          float v = vPos.y * 0.5 + 0.5;

          float t = time * rate;

          float h = mod(hueBias + 360.0*u + 20.0*sin(t*0.20) + 10.0*sin(t*0.07 + u*6.2831), 360.0);
          float s = clamp(sat * (0.85 + 0.15*sin(t*0.11 + v*6.2831)), 0.0, 1.0);
          float vv= clamp(val * (0.92 + valAmp*cos(t*0.09 + u*3.1415)), 0.0, 1.0);
          gl_FragColor = vec4(hsv2rgb(h,s,vv), 1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'FRBN_skySphere';
    return mesh;
  }

  // —— loop interno (al margen de animate()) para alimentar el uniforme time
  function startTick(){
    stopTick();
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const loop = (nowMs) => {
      if (!skySphere || !skySphere.material || !skySphere.material.uniforms) return;
      const now = nowMs || (typeof performance !== 'undefined' ? performance.now() : Date.now());
      skySphere.material.uniforms.time.value = (now - t0) / 1000;
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }
  function stopTick(){
    if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
  }

  function sync(){
    if (!hostRef || !skySphere) return;
    const H = safeHost(hostRef);
    const u = skySphere.material?.uniforms;
    if (!u) return;

    // 1) Semilla cromática principal
    const seed = (H.invariants && typeof H.invariants.sceneSeed === 'number')
      ? H.invariants.sceneSeed
      : (typeof window !== 'undefined' && typeof window.sceneSeed === 'number' ? window.sceneSeed : 0);
    u.hueBias.value = seed % 360;

    // 2) Estadística de la escena: rango medio (2..6 → 0..1)
    let nr = 0.5;
    try {
      const perms = H.getSelectedPerms ? H.getSelectedPerms() : [];
      if (perms.length && H.utils?.computeSignature && H.utils?.computeRange) {
        const rgs = perms.map(p => H.utils.computeRange(H.utils.computeSignature(p)));
        const avg = rgs.reduce((a,b)=>a+b,0) / rgs.length;
        nr = clamp01((avg - 2) / 4);
      }
    } catch { /* fallback 0.5 */ }

    // 3) Patrón activo
    const pid = (H.invariants && typeof H.invariants.activePatternId === 'number')
      ? H.invariants.activePatternId
      : (typeof window !== 'undefined' && typeof window.activePatternId === 'number' ? window.activePatternId : 1);
    const spec = PAT[pid] || PAT[1];

    // 4) Interpolación suave → S, V, amplitud y rate de animación
    u.sat.value    = spec.sat0 + (spec.sat1 - spec.sat0) * nr;
    u.val.value    = spec.val0 + (spec.val1 - spec.val0) * nr;
    u.valAmp.value = spec.amp0 + (spec.amp1 - spec.amp0) * nr;
    u.rate.value   = spec.rate0 + (spec.rate1 - spec.rate0) * nr;
  }

  return {
    name: 'FRBN',
    id: 'FRBN',
    enter(host){
      hostRef = host || hostRef || {};
      const H = safeHost(hostRef);

      if (H.scene) prev.bg = H.scene.background ? H.scene.background.clone() : null;
      if (H.cubeUniverse){ prev.cube = H.cubeUniverse.visible; H.cubeUniverse.visible = false; }
      if (H.permutationGroup){ prev.perms = H.permutationGroup.visible; H.permutationGroup.visible = false; }

      if (!skySphere) skySphere = buildSkySphere(H);
      if (H.scene && skySphere && skySphere.parent !== H.scene) H.scene.add(skySphere);

      // shim/namespace público
      try {
        window.FRBN = Object.assign(window.FRBN || {}, {
          isFRBN: true,
          skySphere,
          syncFromScene: sync,
          controlsVisibility: ({cube, perms})=>{
            if (H.cubeUniverse) H.cubeUniverse.visible = !!cube;
            if (H.permutationGroup) H.permutationGroup.visible = !!perms;
          },
          __host: hostRef
        });
      } catch(_) {}

      sync();
      startTick();
    },
    exit(){
      const H = safeHost(hostRef);
      stopTick();
      if (skySphere && H.scene) H.scene.remove(skySphere);
      if (H.cubeUniverse)      H.cubeUniverse.visible     = prev.cube;
      if (H.permutationGroup)  H.permutationGroup.visible = prev.perms;
      if (H.scene)             H.scene.background         = prev.bg || H.scene.background;
      try { if (window.FRBN) window.FRBN.isFRBN = false; } catch(_) {}
    },
    syncFromScene: sync
  };
})();

// auto-registro (con reintento si registry aún no cargó)
(function registerWhenReady(){
  if (window.ENGINE && typeof window.ENGINE.register === 'function') {
    window.ENGINE.register(FRBNEngine);
  } else {
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const again = () => {
      if (window.ENGINE && typeof window.ENGINE.register === 'function') {
        window.ENGINE.register(FRBNEngine);
      } else if (((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0) < 4000) {
        setTimeout(again, 50);
      }
    };
    setTimeout(again, 50);
  }
})();

export default FRBNEngine;
export const FRBN = FRBNEngine;

// ——— Controlador público (wire/toggle) con fallbacks ———
(function(){
  try{
    const CTRL = window.FRBN = Object.assign(window.FRBN || {}, {});
    CTRL.wire = function(host){
      try { CTRL.__host = host; } catch(_){ }
      try { FRBNEngine && FRBNEngine.enter && (hostRef = host); } catch(_){ }
    };
    CTRL.toggle = async function(){
      const host = CTRL.__host || null;
      if (!CTRL.isFRBN) FRBNEngine.enter(host);
      else FRBNEngine.exit();
    };
    if (typeof CTRL.syncFromScene !== 'function') {
      CTRL.syncFromScene = () => { try { FRBNEngine.syncFromScene(); } catch(_){ } };
    }
  }catch(e){
    console.error('[FRBN] controlador público', e);
  }
})();
