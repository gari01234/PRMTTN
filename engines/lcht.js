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

/* ——— Densidad, escala de panel y marco cálido/interior frío ——— */
const DENSITY_MULT       = 3;     // ← 3× más denso
const PANEL_SCALE_W      = 1.06;  // ← un poco más ancho
const PANEL_SCALE_H      = 1.06;  // ← un poco más alto (base)
const PANEL_EXTRA_H_WIDE = 1.08;  // ← extra de altura si ratio > 1 (√2, √3, 2, √5)

// ==== Apertura y escalado (REEMPLAZA) ====
const APERTURE_UNITS    = 4.05;  // tamaño interno aprox. en múltiplos de step
const APERTURE_OVERSCAN = 1.03;  // 3% de respiración

// Encaja SIEMPRE por ambos ejes con un único factor uniforme:
const SAFE_FIT_X = 0.98;         // no exceder 98% del ancho útil
const SAFE_FIT_Y = 0.98;         // no exceder 98% del alto útil
const FILL_BOOST = 1.015;        // pequeño “empuje” para llenar sin tocar bisel
const SCALE_MIN  = 0.80, SCALE_MAX = 1.40; // límites de seguridad

// Eliminamos la dependencia del “GRID_SCALE” para el tamaño final del panel:
const GRID_SCALE = 1.00; // ← déjalo neutro; el tamaño vendrá del fit

// ==== RAUM: marco cálido / interior frío (REEMPLAZA) ====
const FRAME_LINES       = 2;     // nº de líneas exteriores que cuentan como “marco”
const FRAME_WARM_BIAS   = 0.72;  // empuje de tono hacia cálido en marco
const FRAME_COOL_BIAS   = 0.60;  // empuje de tono hacia frío en interior
const FRAME_SAT_ADD     = 0.14;  // +S en marco
const FRAME_VAL_ADD     = 0.08;  // +V en marco
const INNER_SAT_CUT     = 0.10;  // −S en interior
const INNER_VAL_CUT     = 0.06;  // −V en interior
const FRAME_EI_BOOST    = 0.60;  // +60% emissive en marco
const INNER_EI_CUT      = 0.30;  // −30% emissive en interior

// ligera respiración según calidez (igual que backup)
const PP_SAT_PUSH = 0.12;
const PP_VAL_PUSH = 0.06;

// separación Z entre capas (↑) y micro-push
const LAYER_Z_SEP = 1.85;      // ← MÁS separación entre rasters
const PP_Z_PUSH   = 0.12;      // micro-parallax por calidez (conservar)

/* ——— Escalado del grid y tamaño del rectángulo raíz ——— */
const TILE_H_SHRINK = 2.40;  // ↓ hace cada rectángulo raíz más pequeño (antes 3.0)

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

/* Construye panel de líneas que SOLO delinean cada tile raíz
   Ahora acepta escalas de panel y etiqueta cada línea como marco/interior */
function addRootRaster({
  center, widthTile, heightTile, tilesX, tilesY, line, join, color, nz, lcht, zSlot,
  scaleW=1.0, scaleH=1.0
}){
  const matBase = new THREE.MeshLambertMaterial({
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
  matBase.emissive = color.clone();
  matBase.emissiveIntensity = LCHT_BASE_EI;

  const [h0,s0,v0] = rgbToHsv(color.r*255, color.g*255, color.b*255);
  const baseHsv = { h: h0, s: Math.min(1, s0*1.04), v: Math.min(1, v0*1.03) };

  // Tamaño del panel CON escala
  const panelW = tilesX * widthTile * scaleW;
  const panelH = tilesY * heightTile * scaleH;
  const halfW  = panelW * 0.5;
  const halfH  = panelH * 0.5;

  // --- helpers para decidir si es “marco” por CONTEO de líneas ---
  const isFrameIndexX = (i) => (i < FRAME_LINES) || (i > tilesX - FRAME_LINES);
  const isFrameIndexY = (j) => (j < FRAME_LINES) || (j > tilesY - FRAME_LINES);

  function place(x, y, isVertical, isOuter){
    const geo  = isVertical
      ? new THREE.BoxGeometry(line, panelH + join, line)
      : new THREE.BoxGeometry(panelW + join, line, line);

    const mesh = new THREE.Mesh(geo, matBase.clone());
    mesh.position.set(center.x + x, center.y + y, center.z);
    if (nz < 0) mesh.rotateY(Math.PI);

    mesh.userData = {
      lcht,
      baseHsv,
      baseRGB: [color.r, color.g, color.b],
      baseEI : LCHT_BASE_EI,
      zSlot,
      isOuter
    };
    mesh.renderOrder = 10 + zSlot;
    lichtGroup.add(mesh);
  }

  // Verticales
  for (let i = 0; i <= tilesX; i++){
    const x = -halfW + i*(panelW/tilesX);
    place(x, 0, true, isFrameIndexX(i));
  }
  // Horizontales
  for (let j = 0; j <= tilesY; j++){
    const y = -halfH + j*(panelH/tilesY);
    place(0, y, false, isFrameIndexY(j));
  }
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
  const TILE_H = step * 0.92 * TILE_H_SHRINK;  // rectángulo raíz más pequeño
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

    // ---------- DERIVA LOS TILES DESDE LA ABERTURA (nuevo) ----------
    const baseTilesX = 4 * DENSITY_MULT;     // densidad base por “familia”
    const safeRatio  = ratio > 0 ? ratio : 1.0;

    // Priorizamos contar tiles para que el panel “nazca” del hueco:
    const apertureW = (APERTURE_UNITS * step) * APERTURE_OVERSCAN;
    const apertureH = (APERTURE_UNITS * step) * APERTURE_OVERSCAN;

    // altura de tile fija, ancho = ratio * altura
    const widthTile  = ratio * TILE_H;
    const heightTile = TILE_H;

    // número de tiles aproximado que cabrían, con un ligero over para no quedar corto
    const tilesX = Math.max(3, Math.round((apertureW / widthTile)  * 1.05));
    const tilesY = Math.max(3, Math.round((apertureH / heightTile) * 1.05));

    // tamaño del panel sin escalado
    const panelW0 = tilesX * widthTile  * PANEL_SCALE_W;
    const panelH0 = tilesY * heightTile * (PANEL_SCALE_H * (ratio > 1.0 ? PANEL_EXTRA_H_WIDE : 1.0));

    // factor **uniforme**: llenamos sin sobrepasar ninguno de los dos ejes
    let s = Math.min(
      (apertureW * SAFE_FIT_X) / Math.max(1e-6, panelW0),
      (apertureH * SAFE_FIT_Y) / Math.max(1e-6, panelH0)
    ) * FILL_BOOST;

    s = THREE.MathUtils.clamp(s, SCALE_MIN, SCALE_MAX);

    // En apaisados, estrecha 2–3% para evitar “asomar” por los laterales.
    const WIDE_X_TIGHTEN = 0.975;

    const scaleW = s * (ratio > 1.0 ? WIDE_X_TIGHTEN : 1.0);
    const scaleH = s;

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
      zSlot,
      scaleW,
      scaleH
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

        // sesgo Hofmann por foco (prota → cálido, otras → frío)
        h = THREE.MathUtils.lerp(h, PP_WARM_CENTER, WARM_BIAS * wn);
        h = THREE.MathUtils.lerp(h, PP_COOL_CENTER, COOL_BIAS * (1.0 - wn));

        // respiración suave de S y V (como antes)
        let s = THREE.MathUtils.clamp(bh.s * (1.0 + (wn - 0.5)*PP_SAT_PUSH*2), 0, 1);
        let v = THREE.MathUtils.clamp(bh.v * (1.0 + (wn - 0.5)*PP_VAL_PUSH*2), 0, 1);

        // RAUM: marco cálido / interior frío con refuerzo de S/V
        if (base.isOuter) {
          h = THREE.MathUtils.lerp(h, PP_WARM_CENTER, FRAME_WARM_BIAS);
          s = THREE.MathUtils.clamp(s + FRAME_SAT_ADD, 0, 1);
          v = THREE.MathUtils.clamp(v + FRAME_VAL_ADD, 0, 1);
        } else {
          h = THREE.MathUtils.lerp(h, PP_COOL_CENTER, FRAME_COOL_BIAS);
          s = THREE.MathUtils.clamp(s * (1.0 - INNER_SAT_CUT), 0, 1);
          v = THREE.MathUtils.clamp(v * (1.0 - INNER_VAL_CUT), 0, 1);
        }

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

        let ei = base.baseEI * (0.85 + 0.25*wn) * (1.0 + LCHT_PROTAG_EI_BOOST*wn);
        // refuerzo RAUM
        ei *= base.isOuter ? (1.0 + FRAME_EI_BOOST) : (1.0 - INNER_EI_CUT);
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
