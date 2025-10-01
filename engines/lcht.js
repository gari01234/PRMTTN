// ./engines/lcht.js
// LCHT: deterministic light-tubes (extraído del HTML, registrado en ENGINE)
let isOn = false;
let lichtGroup = null;
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

/* ——— Protagonismo rotativo (suave, sin apagados) ——— */
const LCHT_FOCUS_PERIOD = 18.0;

const LCHT_FOCUS_OPACITY = 1.00;  // prota 100% opaca
const LCHT_OFF_OPACITY   = 0.58;  // nunca por debajo de este valor

const LCHT_FOCUS_GAIN    = 1.80;  // color base en prota
const LCHT_OFF_GAIN      = 1.00;  // el resto no pierde color

const LCHT_FOCUS_SIGMA   = 0.55;  // cruce suave
const LCHT_FOCUS_SHAPE   = 0.60;  // 0..1 (0.6 = pico amable)

const LCHT_OPACITY_FLOOR = 0.58;  // pisos duros
const LCHT_GAIN_FLOOR    = 1.00;

/* brillo extra de la protagonista (emissive) */
const LCHT_BASE_EI       = 0.40;  // base
const LCHT_PROTAG_EI_BOOST = 2.50; // × sobre la base cuando wn→1

/* ——— Glow y Push&Pull (Hans Hofmann) ——— */
const LCHT_GLOW_SCALE       = 1.035;  // escalado XY del halo
const LCHT_GLOW_MAX_OPACITY = 0.85;   // opacidad máx del halo
const LCHT_GLOW_EI_MULT     = 3.0;    // multiplicador emissive del halo

const LCHT_PP_Z_FACTOR      = 0.18;   // % del step para avance/retroceso en Z
const LCHT_PP_HUE_SHIFT     = 0.03;   // delta de HUE (calentamiento/enfriamiento)
const LCHT_PP_S_GAIN        = 0.18;   // +S cuando avanza
const LCHT_PP_V_GAIN        = 0.22;   // +V cuando avanza

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

function addRootRaster({
  center, widthTile, heightTile, tilesX, tilesY, line, join, color, nz, lcht, zSlot,
  ppBias, ppZAmp
}){
  // material base (core)
  const matCore = new THREE.MeshLambertMaterial({
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
  matCore.emissive = color.clone();
  matCore.emissiveIntensity = LCHT_BASE_EI;

  // material glow (aditivo)
  const matGlow = new THREE.MeshLambertMaterial({
    color: color.clone(),
    dithering: true,
    flatShading: true,
    transparent: true,
    opacity: 0.0,                             // se anima
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false                         // aditivo puro
  });
  matGlow.emissive = color.clone();
  matGlow.emissiveIntensity = LCHT_BASE_EI * LCHT_GLOW_EI_MULT;

  // HSV base
  const [h0,s0,v0] = rgbToHsv(color.r*255, color.g*255, color.b*255);
  const baseHsv = { h: h0, s: Math.min(1, s0*1.04), v: Math.min(1, v0*1.03) };

  const panelW = tilesX * widthTile;
  const panelH = tilesY * heightTile;
  const halfW  = panelW * 0.5;
  const halfH  = panelH * 0.5;

  function place(x, y, isVertical){
    const geo  = isVertical
      ? new THREE.BoxGeometry(line, panelH + join, line)
      : new THREE.BoxGeometry(panelW + join, line, line);

    // CORE
    const core = new THREE.Mesh(geo, matCore.clone());
    core.position.set(center.x + x, center.y + y, center.z);
    if (nz < 0) core.rotateY(Math.PI);
    core.renderOrder = 10 + zSlot;
    core.userData = {
      kind   : 'core',
      lcht,
      baseHsv,
      baseRGB: [color.r, color.g, color.b],
      baseEI : LCHT_BASE_EI,
      baseZ  : center.z,
      zSlot,
      pp     : { bias: ppBias, zAmp: ppZAmp }
    };
    lichtGroup.add(core);

    // GLOW (mismo geo, aditivo, un pelín más grande)
    const glow = new THREE.Mesh(geo.clone(), matGlow.clone());
    glow.position.copy(core.position);
    glow.scale.set(
      isVertical ? 1.0 : LCHT_GLOW_SCALE,
      isVertical ? LCHT_GLOW_SCALE : 1.0,
      1.0
    );
    if (nz < 0) glow.rotateY(Math.PI);
    glow.renderOrder = 11 + zSlot;
    glow.userData = {
      kind   : 'glow',
      lcht,
      baseHsv,
      baseRGB: [color.r, color.g, color.b],
      baseEI : LCHT_BASE_EI * LCHT_GLOW_EI_MULT,
      baseZ  : center.z,
      zSlot,
      pp     : { bias: ppBias, zAmp: ppZAmp }
    };
    lichtGroup.add(glow);
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
  const PP_Z_AMP = step * LCHT_PP_Z_FACTOR;
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

    // sesgo determinista por capa ([-1,1])
    const ppBias = (((window.lehmerRank(pa)*31 + zSlot*97 + window.sceneSeed*53 + window.S_global*71) % 200) / 100) - 1;

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
      zSlot,
      ppBias,
      ppZAmp: PP_Z_AMP
    });
  });

  lichtGroup.traverse(o => { if (o.isMesh) o.frustumCulled = false; });

  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
  const t0 = (window.sceneSeed*13 + window.S_global*31) * 0.01745329252;

  const sceneRef = scene;
  function loop(ts){
    if (!isOn || !lichtGroup){ rafId = null; return; }
    const t = ts * 0.001;

    if (__lchtBgBaseHSV){
      // — Fondo animado: hue rota 360° de forma continua; S y V “respiran” suave
      {
        // hue gira a velocidad constante → recorre todo el círculo de color
        const h = (__lchtBgBaseHSV[0] + (t * LCHT_BG_ROT_SPEED)) % 1;

        // punto medio de S y V dentro de sus bandas seguras (no blanco)
        const sMid = (LCHT_BG_S_MIN + LCHT_BG_S_MAX) * 0.5;
        const vMid = (LCHT_BG_V_MIN + LCHT_BG_V_MAX) * 0.5;
        const sAmp = Math.max(0, Math.min((LCHT_BG_S_MAX - LCHT_BG_S_MIN) * 0.5 - 0.001, LCHT_BG_S_WOBBLE_AMP));
        const vAmp = Math.max(0, Math.min((LCHT_BG_V_MAX - LCHT_BG_V_MIN) * 0.5 - 0.001, LCHT_BG_V_WOBBLE_AMP));

        const s = THREE.MathUtils.clamp(
          sMid + sAmp * Math.sin(2*Math.PI*LCHT_BG_S_WOBBLE_SPEED * t + Math.PI/7),
          LCHT_BG_S_MIN, LCHT_BG_S_MAX
        );
        const v = THREE.MathUtils.clamp(
          vMid + vAmp * Math.cos(2*Math.PI*LCHT_BG_V_WOBBLE_SPEED * t + Math.PI/5),
          LCHT_BG_V_MIN, LCHT_BG_V_MAX
        );

        const rgb = hsvToRgb(h, s, v);
        sceneRef.background.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
      }
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

      // — color base con respiración (siempre desde ABSOLUTO)
      let r = base.baseRGB[0], g = base.baseRGB[1], b = base.baseRGB[2];
      let h = base.baseHsv.h,   s = base.baseHsv.s,   v = base.baseHsv.v;

      if (base.lcht){
        const P = base.lcht;
        const hBreath = (h + 0.03*Math.sin(2*Math.PI*P.f*(t+t0) + P.phi)) % 1;
        const rgb = hsvToRgb(hBreath, s, v);
        r = rgb[0]/255; g = rgb[1]/255; b = rgb[2]/255;
        h = hBreath;
      }

      // — peso “protagonismo” de esta capa (ya normalizado y estable)
      const wn = Math.pow(Math.max(0, Math.min(1, weights[base.zSlot])), LCHT_FOCUS_SHAPE);

      // — PUSH & PULL: calienta/satura/ilumina al avanzar; enfría al retroceder
      const sign = Math.sign(base.pp.bias) || 1;  // sesgo determinista
      const advance = wn * Math.abs(base.pp.bias); // 0..1

      const hueShift = LCHT_PP_HUE_SHIFT * sign * advance;         // calentar/enfriar
      const sGain    = 1.0 + LCHT_PP_S_GAIN * advance;             // +S
      const vGain    = 1.0 + LCHT_PP_V_GAIN * advance;             // +V

      const rgbPP = hsvToRgb((h + hueShift + 1) % 1, Math.min(1, s*sGain), Math.min(1, v*vGain));
      r = rgbPP[0]/255; g = rgbPP[1]/255; b = rgbPP[2]/255;

      // — ganancia/opacity absolutas con pisos (no desaparecen)
      const gainAbs    = Math.max(LCHT_GAIN_FLOOR,
                       LCHT_OFF_GAIN + (LCHT_FOCUS_GAIN - LCHT_OFF_GAIN) * wn);
      const opacityAbs = Math.max(LCHT_OPACITY_FLOOR,
                       LCHT_OFF_OPACITY + (LCHT_FOCUS_OPACITY - LCHT_OFF_OPACITY) * wn);

      // — aplica PUSH& PULL en Z (avance = se acerca a cámara)
      const zOff = base.pp.zAmp * base.pp.bias * wn;
      m.position.z = base.baseZ - zOff; // mantiene determinismo por frame

      if (base.kind === 'core'){
        // CORE: color y emissive “sólidos”
        m.material.color.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));
        m.material.emissive.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));

        const P  = base.lcht || { I0:1.0, amp:0.0, f:0.0, phi:0.0 };
        const breath = Math.max(0, P.I0 + P.amp * Math.sin(2*Math.PI*P.f*(t+t0) + P.phi));
        const ei = base.baseEI * (0.85 + 0.25*wn) * (1.0 + LCHT_PROTAG_EI_BOOST*wn);
        m.material.emissiveIntensity = breath * ei;

        if (!m.material.transparent){ m.material.transparent = true; m.material.needsUpdate = true; }
        m.material.depthWrite = true;
        m.material.opacity    = Math.min(1, Math.max(0.0, opacityAbs));
      } else {
        // GLOW: aditivo, depende mucho de wn (sólo la prota “arde”)
        const glowAlpha = LCHT_GLOW_MAX_OPACITY * wn;
        m.material.opacity = Math.min(1, Math.max(0.0, glowAlpha));

        m.material.color.setRGB(r, g, b);
        m.material.emissive.setRGB(r, g, b);

        const P  = base.lcht || { I0:1.0, amp:0.0, f:0.0, phi:0.0 };
        const breath = Math.max(0, P.I0 + P.amp * Math.sin(2*Math.PI*P.f*(t+t0) + P.phi));
        m.material.emissiveIntensity = base.baseEI * (0.8 + 0.4*wn) * breath;
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
