// ./engines/lcht.js
// LCHT: deterministic light-tubes (extraído del HTML, registrado en ENGINE)
let isOn = false;
let lichtGroup = null;
let prevBg = null;
let rafId = null;
let __lchtBgBaseHSV = null;

const { hsvToRgb } = window;

/* ——— Fondo animado (deriva de hue, sin llegar a blanco) ——— */
const LCHT_BG_DRIFT_AMP   = 0.18;  // amplitud de hue (0..1) — visible
const LCHT_BG_DRIFT_SPEED = 0.08;  // Hz — deriva suave
const LCHT_BG_S_MIN       = 0.18;  // evita desaturar (no blanco)
const LCHT_BG_S_MAX       = 0.32;
const LCHT_BG_V_MIN       = 0.86;  // evita blanco brillante
const LCHT_BG_V_MAX       = 0.93;
const LCHT_BG_S_DRIFT     = 0.06;  // pequeña oscilación de S
const LCHT_BG_V_DRIFT     = 0.03;  // pequeña oscilación de V

/* ——— Protagonismo rotativo (una capa a la vez, MUY suave) ——— */
const LCHT_FOCUS_PERIOD   = 18.0;  // s por vuelta completa (5 capas)
const LCHT_FOCUS_OPACITY  = 0.90;  // capa en foco
const LCHT_OFF_OPACITY    = 0.22;  // opacidad mínima del resto (↑)
const LCHT_FOCUS_GAIN     = 1.50;  // “presencia” en foco
const LCHT_OFF_GAIN       = 0.45;  // presencia del resto
const LCHT_FOCUS_SIGMA    = 0.55;  // anchura Gauss (suavidad)

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

function addRootRaster({ THREE, center, widthTile, heightTile, tilesX, tilesY, line, join, color, nz, lcht, zSlot }){
  const matBase = new THREE.MeshLambertMaterial({
    color: color.clone(),
    dithering: true,
    flatShading: true,
    transparent: true,
    opacity: LCHT_OFF_OPACITY         // opacidad base más alta
  });
  matBase.color.multiplyScalar(1.14);  // leve “tinta” extra
  matBase.emissive = matBase.color.clone();
  matBase.emissiveIntensity = 0.18;    // auto-brillo base ↑

  const [h0,s0,v0] = window.rgbToHsv(color.r*255, color.g*255, color.b*255);
  const baseHsv = { h: h0, s: Math.min(1, s0*1.04), v: Math.min(1, v0*1.03) };

  const panelW = tilesX * widthTile;
  const panelH = tilesY * heightTile;
  const halfW  = panelW * 0.5;
  const halfH  = panelH * 0.5;

  for (let i=0; i<=tilesX; i++){
    const x = -halfW + i*widthTile;
    const geo  = new THREE.BoxGeometry(line, panelH + join, line);
    const mesh = new THREE.Mesh(geo, matBase.clone());
    mesh.position.set(center.x + x, center.y, center.z);
    if (nz < 0) mesh.rotateY(Math.PI);
    mesh.userData.lcht     = lcht;
    mesh.userData.baseHsv  = baseHsv;
    mesh.userData.zSlot    = zSlot;
    lichtGroup.add(mesh);
  }
  for (let j=0; j<=tilesY; j++){
    const y = -halfH + j*heightTile;
    const geo  = new THREE.BoxGeometry(panelW + join, line, line);
    const mesh = new THREE.Mesh(geo, matBase.clone());
    mesh.position.set(center.x, center.y + y, center.z);
    if (nz < 0) mesh.rotateY(Math.PI);
    mesh.userData.lcht     = lcht;
    mesh.userData.baseHsv  = baseHsv;
    mesh.userData.zSlot    = zSlot;
    lichtGroup.add(mesh);
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
  const SIDE = 0.28;          // trazo un poco más grueso
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
      // — Fondo animado (hue + s/v con pequeña oscilación; nunca blanco)
      {
        const h = (__lchtBgBaseHSV[0] + LCHT_BG_DRIFT_AMP *
                  Math.sin(2*Math.PI*LCHT_BG_DRIFT_SPEED * t)) % 1;

        const sBase = THREE.MathUtils.clamp(__lchtBgBaseHSV[1], LCHT_BG_S_MIN, LCHT_BG_S_MAX);
        const vBase = THREE.MathUtils.clamp(__lchtBgBaseHSV[2], LCHT_BG_V_MIN, LCHT_BG_V_MAX);

        const s = THREE.MathUtils.clamp(
          sBase + LCHT_BG_S_DRIFT * Math.sin(2*Math.PI*LCHT_BG_DRIFT_SPEED * t + Math.PI/3),
          LCHT_BG_S_MIN, LCHT_BG_S_MAX
        );
        const v = THREE.MathUtils.clamp(
          vBase + LCHT_BG_V_DRIFT * Math.cos(2*Math.PI*LCHT_BG_DRIFT_SPEED * t + Math.PI/5),
          LCHT_BG_V_MIN, LCHT_BG_V_MAX
        );

        const rgb = hsvToRgb(h, s, v);
        sceneRef.background.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
      }
    }

    // — Foco rotativo suave con ventana Gauss y refuerzo de legibilidad
    const center = (t / LCHT_FOCUS_PERIOD) * 5.0; // 0..5
    const sigma2 = 2.0 * LCHT_FOCUS_SIGMA * LCHT_FOCUS_SIGMA;

    lichtGroup.traverse(m=>{
      if (!m.isMesh || !m.material || !m.userData || m.userData.zSlot === undefined) return;

      // respiración (igual que antes)
      if (m.userData.lcht){
        const P = m.userData.lcht;
        const k = P.I0 + P.amp * Math.sin(2*Math.PI*P.f * (t + t0) + P.phi);
        m.material.emissiveIntensity = Math.max(0, k);
        if (m.userData.baseHsv){
          const bh  = m.userData.baseHsv;
          const h   = (bh.h + 0.03*Math.sin(2*Math.PI*P.f * (t + t0) + P.phi)) % 1;
          const rgb = hsvToRgb(h, bh.s, bh.v);
          m.material.color.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
          m.material.emissive.copy(m.material.color);
        }
      }

      // peso Gaussiano 0..1 en el espacio cíclico de 5 capas
      let d = Math.abs(m.userData.zSlot - center);
      d = Math.min(d, 5.0 - d);
      const w = Math.exp(-(d*d)/sigma2);

      // mezcla de opacidad y ganancia
      const opacity = LCHT_OFF_OPACITY + (LCHT_FOCUS_OPACITY - LCHT_OFF_OPACITY) * w;
      const gain    = LCHT_OFF_GAIN    + (LCHT_FOCUS_GAIN   - LCHT_OFF_GAIN)    * w;

      m.material.opacity = opacity;
      m.material.emissiveIntensity *= 0.55 + 0.45*gain;
      m.material.color.multiplyScalar(gain);
      m.material.emissive.multiplyScalar(gain);

      // — refuerzo: aseguramos luminancia mínima para que las líneas nunca se pierdan
      const r = m.material.color.r, g = m.material.color.g, b = m.material.color.b;
      const luma = 0.2126*r + 0.7152*g + 0.0722*b;
      if (luma < LCHT_MIN_LINE_LUMA){
        const s = LCHT_MIN_LINE_LUMA / Math.max(luma, 0.0001);
        m.material.color.multiplyScalar(s);
        m.material.emissive.multiplyScalar(0.5*s);
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
