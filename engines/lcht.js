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

/* ——— Protagonismo rotativo (una capa a la vez, MUY suave) ——— */
const LCHT_FOCUS_PERIOD = 18.0;   // s por vuelta (5 capas)
const LCHT_FOCUS_OPACITY = 1.00;  // prota sin transparencia
const LCHT_OFF_OPACITY   = 0.28;  // el resto nunca baja de esto
const LCHT_FOCUS_GAIN    = 1.35;  // boost del color/emisivo en foco
const LCHT_OFF_GAIN      = 0.85;  // el resto sigue visible
const LCHT_FOCUS_SIGMA   = 0.55;  // anchura Gauss (suavidad)
const LCHT_FOCUS_SHAPE   = 0.60;  // 0..1 (0.6 = pico amable)
const LCHT_OPACITY_FLOOR = 0.22;  // piso duro de opacidad
const LCHT_GAIN_FLOOR    = 0.80;  // piso duro de ganancia

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

function addRootRaster({ center, widthTile, heightTile, tilesX, tilesY, line, join, color, nz, lcht, zSlot }){
  const matBase = new THREE.MeshLambertMaterial({
    color: color.clone(),
    dithering: true,
    flatShading: true,
    transparent: true,
    opacity: LCHT_OFF_OPACITY,
    depthWrite: true,                          // ← evita lavados por blending
    blending: THREE.NormalBlending,
    toneMapped: true
  });
  matBase.emissive = color.clone();
  matBase.emissiveIntensity = 0.28;            // base más visible

  const [h0,s0,v0] = rgbToHsv(color.r*255, color.g*255, color.b*255);
  const baseHsv = { h: h0, s: Math.min(1, s0*1.04), v: Math.min(1, v0*1.03) };

  const panelW = tilesX * widthTile;
  const panelH = tilesY * heightTile;
  const halfW  = panelW * 0.5;
  const halfH  = panelH * 0.5;

  function mkVert(x, y, isVertical){
    const geo  = isVertical
      ? new THREE.BoxGeometry(line, panelH + join, line)
      : new THREE.BoxGeometry(panelW + join, line, line);
    const mesh = new THREE.Mesh(geo, matBase.clone());
    mesh.position.set(center.x + x, center.y + y, center.z);
    if (nz < 0) mesh.rotateY(Math.PI);

    // —— bases absolutas para animación (nada se “acumula” con el tiempo)
    mesh.userData.lcht     = lcht;
    mesh.userData.baseHsv  = baseHsv;
    mesh.userData.zSlot    = zSlot;
    mesh.userData.baseRGB  = [
      mesh.material.color.r,
      mesh.material.color.g,
      mesh.material.color.b
    ];
    mesh.userData.baseEI   = mesh.material.emissiveIntensity;

    // —— orden de pintado estable por Z (evita popping con transparencias)
    mesh.renderOrder = 10 + zSlot;

    lichtGroup.add(mesh);
  }

  for (let i=0; i<=tilesX; i++){
    const x = -halfW + i*widthTile;
    mkVert(x, 0, true);
  }
  for (let j=0; j<=tilesY; j++){
    const y = -halfH + j*heightTile;
    mkVert(0, y, false);
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
  const SIDE = 0.32;   // antes 0.24
  const JOIN = 0.02;
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
      THREE,
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

    // — Foco rotativo suave con GAUSSIAN SOFTMAX (continuo, sin flips)
    const center = (t / LCHT_FOCUS_PERIOD) * 5.0; // 0..5
    const sigma2 = 2.0 * LCHT_FOCUS_SIGMA * LCHT_FOCUS_SIGMA;

    // 1) pesos 0..1 normalizados por capa en anillo de 5
    const weights = new Array(5);
    let sumW = 0;
    for (let z=0; z<5; z++){
      let d = Math.abs(z - center);
      d = Math.min(d, 5.0 - d);
      const w = Math.exp(-(d*d)/sigma2);
      weights[z] = w; sumW += w;
    }
    for (let z=0; z<5; z++) weights[z] /= sumW;

    // 2) aplica pesos ABSOLUTOS por malla (no *=)
    lichtGroup.traverse(m=>{
      if (!m.isMesh || !m.material || !m.userData || m.userData.zSlot === undefined) return;

      // — color “respirando” desde HSV base (absoluto cada frame)
      let r = m.userData.baseRGB ? m.userData.baseRGB[0] : m.material.color.r;
      let g = m.userData.baseRGB ? m.userData.baseRGB[1] : m.material.color.g;
      let b = m.userData.baseRGB ? m.userData.baseRGB[2] : m.material.color.b;

      if (m.userData.lcht && m.userData.baseHsv){
        const P  = m.userData.lcht;
        const bh = m.userData.baseHsv;
        const h  = (bh.h + 0.03*Math.sin(2*Math.PI*P.f * (t + t0) + P.phi)) % 1;
        const rgb = hsvToRgb(h, bh.s, bh.v);
        r = rgb[0]/255; g = rgb[1]/255; b = rgb[2]/255;
      }

      // — peso de protagonismo suavizado y con “pico” configurable
      const wn = Math.pow(weights[m.userData.zSlot], LCHT_FOCUS_SHAPE);

      // — ganancia/opacity con pisos (nunca desaparecen)
      const gainAbs = Math.max(LCHT_GAIN_FLOOR,
                       LCHT_OFF_GAIN + (LCHT_FOCUS_GAIN - LCHT_OFF_GAIN) * wn);
      const opacityAbs = Math.max(LCHT_OPACITY_FLOOR,
                          LCHT_OFF_OPACITY + (LCHT_FOCUS_OPACITY - LCHT_OFF_OPACITY) * wn);

      // — aplica en valor absoluto (sin acumulaciones)
      m.material.color.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));
      m.material.emissive.setRGB(Math.min(1, r*gainAbs), Math.min(1, g*gainAbs), Math.min(1, b*gainAbs));

      const P  = m.userData.lcht || { I0:1.0, amp:0.0, f:0.0, phi:0.0 };
      const breath = Math.max(0, P.I0 + P.amp * Math.sin(2*Math.PI*P.f * (t + t0) + P.phi));
      const baseEI = (m.userData.baseEI != null) ? m.userData.baseEI : 0.28;
      m.material.emissiveIntensity = baseEI * breath * (0.85 + 0.25*wn);

      if (!m.material.transparent){ m.material.transparent = true; m.material.needsUpdate = true; }
      m.material.depthWrite = true;             // ← clave para no “lavar” las líneas
      m.material.opacity = opacityAbs;
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
