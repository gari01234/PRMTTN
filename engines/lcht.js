// ./engines/lcht.js
// LCHT: deterministic light-tubes (extraído del HTML, registrado en ENGINE)
let isOn = false;
let lichtGroup = null;
/* Semilla determinista para el fondo HSL */
let __lchtBgHueSeed = 0;
/* step actual (para z push) */
let __lchtStep = 1;
let prevBg = null;
let rafId = null;
const { hsvToRgb, rgbToHsv } = window;

/* ——— Fondo animado HSL (frío, tranquilo) ——— */
const LCHT_BG_HUE_SPEED   = 0.005;  // MUY lento
const LCHT_BG_S_BASE      = 0.22;   // baja saturación (calmo)
const LCHT_BG_L_BASE      = 0.94;   // alto, pero sin deslumbrar
const LCHT_BG_DRIFT_AMP   = 0.05;   // pequeña deriva alrededor del frío

/* ——— Protagonismo (igual que backup) ——— */
const LCHT_FOCUS_PERIOD = 18.0;
const LCHT_FOCUS_SIGMA  = 0.55;
const LCHT_FOCUS_SHAPE  = 0.60;

const LCHT_FOCUS_OPACITY = 1.00;
const LCHT_OFF_OPACITY   = 0.58;
const LCHT_OPACITY_FLOOR = 0.58;

const LCHT_FOCUS_GAIN  = 1.80;
const LCHT_OFF_GAIN    = 1.00;
const LCHT_GAIN_FLOOR  = 1.00;

/* Emissive */
const LCHT_BASE_EI         = 0.40;
const LCHT_PROTAG_EI_BOOST = 3.20;

/* — Push & Pull cromático (solo desde color) — */
const PP_WARM_CENTER = 0.00;   // rojo
const PP_COOL_CENTER = 0.58;   // cian/azulado estable

// bias de tono hacia cálido en la prota y hacia frío en el resto
const WARM_BIAS = 0.22;        // cuánto se acerca la prota al rojo (0..1)
const COOL_BIAS = 0.18;        // cuánto se enfrían las no-prota (0..1)

// ligera respiración según calidez (igual que backup)
const PP_SAT_PUSH = 0.12;
const PP_VAL_PUSH = 0.06;

// separación Z entre capas (↑) y micro-push
const LAYER_Z_SEP = 1.85;      // ← MÁS separación entre rasters
const PP_Z_PUSH   = 0.12;      // micro-parallax por calidez (conservar)

/* Halo (igual base, pero más discreto en no-protas) */
const HALO_SCALE       = 1.55;
const HALO_BASE        = 0.08;
const HALO_FOCUS_BOOST = 0.85;
const HALO_COOL_CUT    = 0.35;

function getTHREE(){ return window.THREE; }
function getScene(){ return window.scene; }
function getCubeUniverse(){ return window.cubeUniverse; }
function getPermutationGroup(){ return window.permutationGroup; }
function getPerms(){
  const sel = document.getElementById('permutationList');
  if (!sel) return [];
  return Array.from(sel.selectedOptions).map(o => o.value.split(',').map(Number));
}
function getCubeSize(){
  const w = getCubeUniverse()?.geometry?.parameters?.width;
  return (typeof w === 'number' && w > 0) ? w : 30;
}

function colorForPerm(pa){
  const THREE = getTHREE();
  const idx = pa[ window.attributeMapping[1] ];
  const val = window.getColor(idx);
  return Array.isArray(val)
    ? new THREE.Color(val[0]/255, val[1]/255, val[2]/255)
    : new THREE.Color(val);
}

function hueWarmth01(h){ // h en 0..1
  // cercanía simultánea a rojo (calor) y alejamiento de cian (frío)
  const dWarm = Math.cos(2*Math.PI*(h - PP_WARM_CENTER)); // [-1..1]
  const dCool = -Math.cos(2*Math.PI*(h - PP_COOL_CENTER)); // [-1..1]
  // mezcla estable y normalizada a [0..1]
  return THREE.MathUtils.clamp(0.5*(dWarm + dCool)*0.5 + 0.5, 0, 1);
}

function addRootRaster({
  center, widthTile, heightTile, tilesX, tilesY, line, join, color, nz, lcht, zSlot
){
  // material núcleo (sólido, opaco en foco)
  const coreMat = new THREE.MeshLambertMaterial({
    color: color.clone(),
    dithering: true,
    flatShading: true,
    transparent: true,
    opacity: LCHT_OFF_OPACITY,
    depthTest: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    toneMapped: true
  });
  coreMat.emissive = color.clone();
  coreMat.emissiveIntensity = LCHT_BASE_EI;

  // material halo (glow aditivo, sin escribir z-buffer)
  const haloMat = new THREE.MeshLambertMaterial({
    color: color.clone(),
    dithering: true,
    flatShading: true,
    transparent: true,
    opacity: HALO_BASE,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true
  });
  haloMat.emissive = color.clone();
  haloMat.emissiveIntensity = LCHT_BASE_EI;

  const [h0,s0,v0] = rgbToHsv(color.r*255, color.g*255, color.b*255);
  const baseHsv = { h: h0, s: Math.min(1, s0*1.04), v: Math.min(1, v0*1.03) };

  const panelW = tilesX * widthTile;
  const panelH = tilesY * heightTile;
  const halfW  = panelW * 0.5;
  const halfH  = panelH * 0.5;

  // Z push determinista por calidez
  const warmth  = hueWarmth01(baseHsv.h); // 0..1, 1 = cálido
  const zPush = (warmth - 0.5) * (PP_Z_PUSH * __lchtStep);

  function place(x, y, isVertical){
    const geoCore = isVertical
      ? new THREE.BoxGeometry(line, panelH + join, line)
      : new THREE.BoxGeometry(panelW + join, line, line);
    const geoHalo = isVertical
      ? new THREE.BoxGeometry(line*HALO_SCALE, panelH + join, line*HALO_SCALE)
      : new THREE.BoxGeometry((panelW + join), line*HALO_SCALE, line*HALO_SCALE);

    // núcleo
    const core = new THREE.Mesh(geoCore, coreMat.clone());
    core.position.set(center.x + x, center.y + y, center.z + zPush);
    if (nz < 0) core.rotateY(Math.PI);
    core.renderOrder = 10 + zSlot;

    // halo
    const halo = new THREE.Mesh(geoHalo, haloMat.clone());
    halo.position.copy(core.position);
    halo.rotation.copy(core.rotation);
    halo.renderOrder = core.renderOrder + 1;

    const baseRGB = [color.r, color.g, color.b];

    // bases absolutas (para evitar acumulaciones)
    core.userData = {
      lcht, baseHsv, baseRGB, baseEI: LCHT_BASE_EI,
      zSlot, isHalo:false
    };
    halo.userData = {
      lcht, baseHsv, baseRGB, baseEI: LCHT_BASE_EI,
      zSlot, isHalo:true
    };

    lichtGroup.add(core);
    lichtGroup.add(halo);
  }

  for (let i=0; i<=tilesX; i++) place(-halfW + i*widthTile, 0, true);
  for (let j=0; j<=tilesY; j++) place(0, -halfH + j*heightTile, false);
}

function build(){
  const THREE = getTHREE();
  const scene = getScene();
  const cubeSize = getCubeSize();

  if (lichtGroup){
    lichtGroup.traverse(o=>{
      if (o.isMesh){
        o.material?.dispose?.();
        o.geometry?.dispose?.();
      }
    });
    scene.remove(lichtGroup);
  }
  lichtGroup = new THREE.Group();
  scene.add(lichtGroup);

  const step = cubeSize / 5;
  __lchtStep = step;  // ← para PP_Z_PUSH
  const SIDE = 0.24 * 1.5;   // ← mitad de grosor
  const JOIN = 0.02 * 1.5;   // ajusta uniones acorde
  const TILE_H = step * 0.92 * 3.0;
  const ROOT_RATIOS = [0, 1.0, Math.SQRT2, Math.sqrt(3), 2.0, Math.sqrt(5)];

  const perms = getPerms();
  if (!perms.length) return;

  const order = perms.map((pa, i)=>({ i, r: window.lehmerRank(pa) }))
                     .sort((a,b)=> a.r - b.r);

  const layers = [];
  for (let z=0; z<5; z++){
    const pick = order[(z + window.sceneSeed + window.S_global) % order.length].i;
    layers.push({ zSlot:z, permIdx: pick });
  }

  const REPEAT = 10;
  const sceneKey = (37*window.sceneSeed + 101*window.S_global) % 360;
  __lchtBgHueSeed = (sceneKey / 360);

  if (!scene.background) scene.background = new THREE.Color();
  scene.background.setHSL(__lchtBgHueSeed % 1, LCHT_BG_S_BASE, LCHT_BG_L_BASE);

  layers.forEach(({zSlot, permIdx})=>{
    const pa      = perms[permIdx];
    const baseCol = colorForPerm(pa);
    const typeIdx = pa[ window.attributeMapping[1] ];
    const ratio   = ROOT_RATIOS[typeIdx];

    const widthTile  = ratio * TILE_H;
    const heightTile = TILE_H;

    const r  = window.lehmerRank(pa);
    const I  = (r + window.sceneSeed + window.S_global) % 125;
    const x0 = Math.floor(I / 25);
    const y0 = Math.floor((I % 25) / 5);
    const cx = (x0 - 2) * step;
    const cy = (y0 - 2) * step;
    const cz = (zSlot - 2) * step * LAYER_Z_SEP;

    const baseTilesX = 4;
    const tilesX     = baseTilesX * REPEAT;
    const tilesY     = Math.max(2, Math.round(tilesX / ratio));

    const sig  = window.computeSignature(pa);
    const rng  = window.computeRange(sig);
    const L    = pa[ window.attributeMapping[0] ];
    const lcht = {
      I0 : 0.35 + 0.65 * Math.sqrt(L / 5),
      amp: 0.05 + 0.10 * rng,
      f  : 0.10 + 0.175 * rng,
      phi: 2 * Math.PI * ((window.lehmerRank(pa) % 360) / 360)
    };

    const faceForward = (((window.lehmerRank(pa) + window.sceneSeed + window.S_global) & 1) === 0);
    const normal = faceForward ? 1 : -1;

    addRootRaster({
      center: new THREE.Vector3(cx, cy, cz),
      widthTile,
      heightTile,
      tilesX,
      tilesY,
      line: SIDE,
      join: JOIN,
      color: baseCol.clone(),
      nz: normal,
      lcht,
      zSlot
    });
  });

  lichtGroup.traverse(o => { if (o.isMesh) o.frustumCulled = false; });

  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
  const sceneRef = scene;
  function loop(ts){
    if (!isOn || !lichtGroup){ rafId = null; return; }
    const t = ts * 0.001;

    // — Fondo: siempre frío y calmado (no compite con los rasters)
    {
      const h = (PP_COOL_CENTER + LCHT_BG_DRIFT_AMP *
                Math.sin(2*Math.PI*LCHT_BG_HUE_SPEED * t)) % 1;
      sceneRef.background.setHSL(h, LCHT_BG_S_BASE, LCHT_BG_L_BASE);
    }

    // — Foco rotativo con softmax gaussiano (continuo, sin saltos)
    const center = (t / LCHT_FOCUS_PERIOD) * 5.0; // 0..5
    const sigma2 = 2.0 * LCHT_FOCUS_SIGMA * LCHT_FOCUS_SIGMA;

    // pesos normalizados por capa (anillo de 5)
    const weights = new Array(5); let sumW = 0;
    for (let z=0; z<5; z++){
      let d = Math.abs(z - center); d = Math.min(d, 5.0 - d);
      const w = Math.exp(-(d*d)/sigma2);
      weights[z] = w; sumW += w;
    }
    for (let z=0; z<5; z++) weights[z] /= sumW;

    lichtGroup.traverse(m=>{
      if (!m.isMesh || !m.material || !m.userData || m.userData.zSlot === undefined) return;

      const base = m.userData;
      const rawW = weights[base.zSlot] ?? 0;
      const wn = Math.pow(Math.max(0, Math.min(1, rawW)), LCHT_FOCUS_SHAPE);

      let r = base.baseRGB[0], g = base.baseRGB[1], b = base.baseRGB[2];
      if (base.lcht && base.baseHsv){
        const P  = base.lcht, bh = base.baseHsv;
        let h = (bh.h + 0.03*Math.sin(2*Math.PI*P.f * (t + 0.0) + P.phi)) % 1;

        // sesgo Hofmann: prota → cálido, no-protas → frío
        h = THREE.MathUtils.lerp(h, PP_WARM_CENTER, WARM_BIAS * wn);
        h = THREE.MathUtils.lerp(h, PP_COOL_CENTER, COOL_BIAS * (1.0 - wn));

        // respiración suave de S y V (como antes)
        const s = THREE.MathUtils.clamp(bh.s * (1.0 + (wn - 0.5)*PP_SAT_PUSH*2), 0, 1);
        const v = THREE.MathUtils.clamp(bh.v * (1.0 + (wn - 0.5)*PP_VAL_PUSH*2), 0, 1);

        const rgb = hsvToRgb(h, s, v);
        r = rgb[0]/255; g = rgb[1]/255; b = rgb[2]/255;
      }

      const gainAbs = Math.max(
        LCHT_GAIN_FLOOR,
        LCHT_OFF_GAIN + (LCHT_FOCUS_GAIN - LCHT_OFF_GAIN) * wn
      );

      const opacityAbs = Math.max(
        LCHT_OPACITY_FLOOR,
        LCHT_OFF_OPACITY + (LCHT_FOCUS_OPACITY - LCHT_OFF_OPACITY) * wn
      );

      const isHalo = !!base.isHalo;
      const warm = base.baseHsv ? hueWarmth01(base.baseHsv.h) : 0.5;

      const P  = base.lcht || { I0:1.0, amp:0.0, f:0.0, phi:0.0 };
      const breath = Math.max(0, P.I0 + P.amp * Math.sin(2*Math.PI*P.f * (t + 0.0) + P.phi));

      if (!isHalo){
        m.material.color.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));
        m.material.emissive.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));

        const ei = base.baseEI * (0.85 + 0.25*wn) * (1.0 + LCHT_PROTAG_EI_BOOST*wn);
        m.material.emissiveIntensity = breath * ei;

        if (!m.material.transparent){ m.material.transparent = true; m.material.needsUpdate = true; }
        m.material.depthWrite = true;
        m.material.opacity    = opacityAbs;
      } else {
        const haloGain = gainAbs * (0.65 + 0.35*wn) * (1.0 - HALO_COOL_CUT*(1.0 - warm));
        m.material.color.setRGB(Math.min(1, r*haloGain), Math.min(1, g*haloGain), Math.min(1, b*haloGain));
        m.material.emissive.setRGB(Math.min(1, r*haloGain), Math.min(1, g*haloGain), Math.min(1, b*haloGain));

        m.material.opacity = THREE.MathUtils.clamp(HALO_BASE*0.25 + HALO_FOCUS_BOOST*wn, 0, 1);
        m.material.emissiveIntensity = base.baseEI * (0.9 + 1.3*wn) * breath;
        m.material.depthWrite = false;
      }
    });

    rafId = requestAnimationFrame(loop);
  }
  rafId = requestAnimationFrame(loop);
}

const LCHT_ENGINE = {
  name: 'LCHT',
  enter(){
    if (isOn) return;
    window.leaveBuildRenderBoost?.();
    const cubeUniverse = getCubeUniverse();
    if (cubeUniverse && !cubeUniverse.userData.prevMat){
      cubeUniverse.userData.prevMat = cubeUniverse.material;
      cubeUniverse.material = new getTHREE().MeshLambertMaterial({
        color: cubeUniverse.userData.prevMat.color,
        transparent: true,
        opacity: cubeUniverse.userData.prevMat.opacity,
        side: cubeUniverse.userData.prevMat.side
      });
    }
    prevBg = getScene().background ? getScene().background.clone() : null;

    build();
    if (lichtGroup) lichtGroup.visible = true;
    if (cubeUniverse) cubeUniverse.visible = false;
    const permGroup = getPermutationGroup();
    if (permGroup) permGroup.visible = false;

    isOn = true;
    if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
  },
  leave(){
    if (!isOn) return;
    const scene = getScene();
    if (lichtGroup){
      lichtGroup.traverse(o=>{ if (o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
      scene.remove(lichtGroup);
      lichtGroup = null;
    }
    const cubeUniverse = getCubeUniverse();
    if (cubeUniverse && cubeUniverse.userData.prevMat){
      cubeUniverse.material.dispose();
      cubeUniverse.material = cubeUniverse.userData.prevMat;
      delete cubeUniverse.userData.prevMat;
    }
    if (prevBg) scene.background = prevBg;
    const permGroup = getPermutationGroup();
    if (permGroup) permGroup.visible = true;
    if (cubeUniverse) cubeUniverse.visible = true;

    isOn = false;
    if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
    if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
  },
  syncFromScene(){
    if (isOn) build();
  }
};

if (window.ENGINE && typeof window.ENGINE.register === 'function'){
  window.ENGINE.register('LCHT', LCHT_ENGINE);
}
export default LCHT_ENGINE;
