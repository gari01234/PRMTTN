// ./engines/lcht.js
// LCHT: deterministic light-tubes (extraído del HTML, registrado en ENGINE)
let isOn = false;
let lichtGroup = null;
/* H por capa para sincronizar fondo ↔ foco */
let __lchtLayerHue = new Array(5).fill(0);
/* step actual (para z push) */
let __lchtStep = 1;
let prevBg = null;
let rafId = null;
const { hsvToRgb, rgbToHsv } = window;

/* ——— Fondo animado (rotación completa de hue, sin llegar a blanco) ——— */
let __lchtBgBaseHSV = null;
// 1 vuelta de color cada ~70 s (ajusta a gusto)
const LCHT_BG_ROT_SPEED = 0.014;  // vueltas de hue por segundo (0.014 ≈ 71 s/vuelta)
const LCHT_BG_S_MIN     = 0.20;   // evita desaturar (no gris/blanco)
const LCHT_BG_S_MAX     = 0.34;
const LCHT_BG_V_MIN     = 0.86;   // evita blanco brillante
const LCHT_BG_V_MAX     = 0.92;
// pequeñas ondulaciones (suaves) de S y V para que “respire” el fondo
const LCHT_BG_S_WOBBLE_AMP   = 0.05;
const LCHT_BG_S_WOBBLE_SPEED = 0.023;  // Hz
const LCHT_BG_V_WOBBLE_AMP   = 0.025;
const LCHT_BG_V_WOBBLE_SPEED = 0.017;  // Hz

/* ——— Protagonismo + PUSH & PULL (Hofmann) ——— */
const LCHT_FOCUS_PERIOD = 18.0;   // s por vuelta (5 capas)
const LCHT_FOCUS_SIGMA  = 0.55;   // suavidad gaussiana
const LCHT_FOCUS_SHAPE  = 0.60;   // curva del pico

/* pisos altos (nadie desaparece) */
const LCHT_FOCUS_OPACITY = 1.00;  // prota 100% opaca
const LCHT_OFF_OPACITY   = 0.58;  // resto
const LCHT_OPACITY_FLOOR = 0.58;

const LCHT_FOCUS_GAIN  = 1.80;    // boost color prota
const LCHT_OFF_GAIN    = 1.00;    // base resto
const LCHT_GAIN_FLOOR  = 1.00;

/* Emissive / brillo */
const LCHT_BASE_EI          = 0.40;  // base visible
const LCHT_PROTAG_EI_BOOST  = 3.20;  // × sobre base cuando wn→1

/* — Push & Pull cromático (Hofmann) — 
   “Lo cálido avanza” (rojos/amarillos), “lo frío retrocede” (cian/azules).
   Usamos el H (0..1) en HSL/HSV para calcular ‘calidez’ y derivar:
   - z micro-parallax (desplazamiento ligero en Z)
   - grosor (más grueso si avanza)
   - saturación/valor extra (más saturado si avanza)
   Todo determinista en función del color base del raster. */
const PP_WARM_CENTER = 0.00;      // H = 0 (rojo) como centro cálido
const PP_COOL_CENTER = 0.55;      // H ≈ 0.55 (cian/verde-azulado)
const PP_Z_PUSH      = 0.12;      // desplazamiento Z relativo al step
const PP_THICK_PUSH  = 0.20;      // % de grosor extra por calidez
const PP_GAIN_PUSH   = 0.25;      // +ganancia por calidez
const PP_SAT_PUSH    = 0.12;      // +saturación por calidez (respiración)
const PP_VAL_PUSH    = 0.06;      // +valor por calidez

/* Glow (halo aditivo) */
const HALO_SCALE      = 1.55;     // grosor del halo vs núcleo
const HALO_BASE       = 0.08;     // opacidad mínima halo
const HALO_FOCUS_BOOST= 0.85;     // extra de opacidad halo con foco
const HALO_COOL_CUT   = 0.35;     // los fríos tienen menos halo (retroceden)

/* Fondo: acompaña push & pull (el fondo tiende a complementar al foco) */
const BG_COOL_OFFSET  = 0.58;     // +H ≈ complementario fresco
const BG_S_COOL       = 0.32;     // saturación cuando enfría
const BG_L_COOL       = 0.90;     // luminosidad cuando enfría

/* ——— Refuerzos de legibilidad de líneas ——— */
const LCHT_MIN_LINE_LUMA  = 0.42;  // luminancia mínima 0..1

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
  const warmth  = hueWarmth01(baseHsv.h); // 0..1, 1 = cálido

  const panelW = tilesX * widthTile;
  const panelH = tilesY * heightTile;
  const halfW  = panelW * 0.5;
  const halfH  = panelH * 0.5;

  // Z push determinista por calidez
  const zPush = (warmth - 0.5) * (PP_Z_PUSH * __lchtStep);
  const gPush = 1.0 + (warmth - 0.5) * PP_THICK_PUSH; // grosor
  const gainP = 1.0 + (warmth - 0.5) * PP_GAIN_PUSH;  // ganancia base

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
    core.scale.set(gPush, 1, gPush);
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
      zSlot, warmth, isHalo:false, gainP
    };
    halo.userData = {
      lcht, baseHsv, baseRGB, baseEI: LCHT_BASE_EI,
      zSlot, warmth, isHalo:true,  gainP
    };

    lichtGroup.add(core);
    lichtGroup.add(halo);
  }

  for (let i=0; i<=tilesX; i++) place(-halfW + i*widthTile, 0, true);
  for (let j=0; j<=tilesY; j++) place(0, -halfH + j*heightTile, false);

  // guardar H base de esta capa (para fondo sincronizado)
  if (typeof __lchtLayerHue[zSlot] === 'number') __lchtLayerHue[zSlot] = baseHsv.h;
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
  __lchtLayerHue = new Array(5).fill(0);

  const step = cubeSize / 5;
  __lchtStep = step;  // ← para PP_Z_PUSH
  const SIDE = 0.24 * 3.0;  // ← grosor ×3
  const JOIN = 0.02 * 3.0;  // uniones acordes
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
  const baseH = ((sceneKey*37 + 113) % 360) / 360;
  const baseS = LCHT_BG_S_MIN + ((sceneKey*19 + 71) % 100)/100 * (LCHT_BG_S_MAX - LCHT_BG_S_MIN);
  const baseV = LCHT_BG_V_MIN + ((sceneKey*53 + 29) % 100)/100 * (LCHT_BG_V_MAX - LCHT_BG_V_MIN);
  __lchtBgBaseHSV = [baseH, baseS, baseV];

  const rgb = window.hsvToRgb(__lchtBgBaseHSV[0], __lchtBgBaseHSV[1], __lchtBgBaseHSV[2]);
  scene.background = new THREE.Color(rgb[0]/255, rgb[1]/255, rgb[2]/255);

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
    const cz = (zSlot - 2) * step;

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

    // — Fondo: se “opone” al foco para ayudar el push&pull
    {
      // centro del foco (0..5) y pesos normalizados (más abajo calculamos ‘weights’ también)
      const center = (t / LCHT_FOCUS_PERIOD) * 5.0;
      const sigma2 = 2.0 * LCHT_FOCUS_SIGMA * LCHT_FOCUS_SIGMA;

      const wTmp = new Array(5); let sumWtmp = 0;
      for (let z=0; z<5; z++){
        let d = Math.abs(z - center); d = Math.min(d, 5.0 - d);
        const w = Math.exp(-(d*d)/sigma2);
        wTmp[z] = w; sumWtmp += w;
      }
      for (let z=0; z<5; z++) wTmp[z] /= sumWtmp;

      // hue “promedio” del foco
      let hFocus = 0;
      for (let z=0; z<5; z++) hFocus += __lchtLayerHue[z] * wTmp[z];
      hFocus = (hFocus + 1) % 1;

      // Fondo se enfría/complementa
      const hBg = (hFocus + BG_COOL_OFFSET) % 1;
      sceneRef.background.setHSL(hBg, BG_S_COOL, BG_L_COOL);
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
      const wn = Math.pow(weights[base.zSlot], LCHT_FOCUS_SHAPE); // foco 0..1
      const warm = base.warmth; // 0..1

      // — Color base “respirando” SIN acumulaciones
      let r = base.baseRGB[0], g = base.baseRGB[1], b = base.baseRGB[2];
      if (base.lcht && base.baseHsv){
        const P  = base.lcht, bh = base.baseHsv;
        // push&pull: calidez aumenta S y V ligeramente
        const sBoost = 1.0 + (warm - 0.5)*PP_SAT_PUSH;
        const vBoost = 1.0 + (warm - 0.5)*PP_VAL_PUSH;
        const h  = (bh.h + 0.03*Math.sin(2*Math.PI*P.f * (t + 0.0) + P.phi)) % 1;
        const s  = THREE.MathUtils.clamp(bh.s * sBoost, 0, 1);
        const v  = THREE.MathUtils.clamp(bh.v * vBoost, 0, 1);
        const rgb = hsvToRgb(h, s, v);
        r = rgb[0]/255; g = rgb[1]/255; b = rgb[2]/255;
      }

      // — Ganancias absolutas por foco y por calidez (push)
      const gainF = LCHT_OFF_GAIN + (LCHT_FOCUS_GAIN - LCHT_OFF_GAIN) * wn;
      const gainP = base.gainP; // definido en build: 1 + (warm-0.5)*PP_GAIN_PUSH
      const gainAbs = Math.max(LCHT_GAIN_FLOOR, gainF * gainP);

      // — Opacidad absoluta (con piso alto)
      const opacityAbs = Math.max(
        LCHT_OPACITY_FLOOR,
        LCHT_OFF_OPACITY + (LCHT_FOCUS_OPACITY - LCHT_OFF_OPACITY) * wn
      );

      // — Aplicar a cada tipo: núcleo vs halo
      const isHalo = !!base.isHalo;

      // núcleo: color normal + emisivo fuerte en foco
      if (!isHalo){
        m.material.color.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));
        m.material.emissive.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));

        const P  = base.lcht || { I0:1.0, amp:0.0, f:0.0, phi:0.0 };
        const breath = Math.max(0, P.I0 + P.amp * Math.sin(2*Math.PI*P.f * (t + 0.0) + P.phi));
        const ei = base.baseEI * (0.85 + 0.25*wn) * (1.0 + LCHT_PROTAG_EI_BOOST*wn);
        m.material.emissiveIntensity = breath * ei;

        if (!m.material.transparent){ m.material.transparent = true; m.material.needsUpdate = true; }
        m.material.depthWrite = true;
        m.material.opacity    = opacityAbs;
      } else {
        // halo: aditivo, más fuerte en foco y en cálidos (warm) — los fríos retroceden
        const haloGain = gainAbs * (0.65 + 0.35*wn) * (1.0 - HALO_COOL_CUT*(1.0 - warm));
        m.material.color.setRGB(Math.min(1, r*haloGain), Math.min(1, g*haloGain), Math.min(1, b*haloGain));
        m.material.emissive.setRGB(Math.min(1, r*haloGain), Math.min(1, g*haloGain), Math.min(1, b*haloGain));

        const P  = base.lcht || { I0:1.0, amp:0.0, f:0.0, phi:0.0 };
        const breath = Math.max(0, P.I0 + P.amp * Math.sin(2*Math.PI*P.f * (t + 0.0) + P.phi));
        m.material.emissiveIntensity = base.baseEI * (1.2 + 1.1*wn) * breath;

        m.material.opacity = THREE.MathUtils.clamp(HALO_BASE + HALO_FOCUS_BOOST*wn, 0, 1);
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
