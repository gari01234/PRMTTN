// ./engines/lcht.js
// LCHT: deterministic light-tubes (extraído del HTML, registrado en ENGINE)
let isOn = false;
let group = null;
let prevBg = null;
let rafId = null;
let avgSceneRange = 0;

function getTHREE(){ return window.THREE; }
function getPerms(){
  const sel = document.getElementById('permutationList');
  if (!sel) return [];
  return Array.from(sel.selectedOptions).map(o => o.value.split(',').map(Number));
}
function getCubeSize(){
  const w = window.cubeUniverse?.geometry?.parameters?.width;
  return (typeof w === 'number' && w > 0) ? w : 30;
}
function colorFromVolume(p){
  const THREE = getTHREE();
  const cubeSize = getCubeSize();
  const HALF = cubeSize/2, HX=144, HY=12, HZ=12;
  const ix = ((Math.floor((p.x + HALF) / cubeSize * HX) % HX) + HX) % HX;
  const iy = ((Math.floor((p.y + HALF) / cubeSize * HY) % HY) + HY) % HY;
  const iz = ((Math.floor((p.z + HALF) / cubeSize * HZ) % HZ) + HZ) % HZ;
  const {h,s,v} = window.idxToHSV(ix, iy, iz);
  const [R,G,B] = window.hsvToRgb(h,s,v);
  return new THREE.Color(R/255, G/255, B/255);
}
function tubeKey(x1, y1, z1, x2, y2, z2) {
  const a = `${x1},${y1},${z1}`, b = `${x2},${y2},${z2}`;
  return (a < b) ? `${a}|${b}` : `${b}|${a}`;
}
function meshColorForPermStr(permStr){
  const THREE = getTHREE();
  const m = window.permutationGroup?.children?.find(o => o.userData?.permStr === permStr);
  if (m && m.material && m.material.color) {
    return m.material.color.clone();
  }
  return new THREE.Color(0x000000);
}
function build(){
  const THREE = getTHREE();
  const cubeSize = getCubeSize();
  const step = cubeSize / 5;

  if (group) {
    group.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    window.scene.remove(group);
  }
  group = new THREE.Group();
  window.scene.add(group);

  const litInfo = new Map();
  const perms = getPerms();

  // rango medio (2..6)
  {
    const rgs = perms.map(p => window.computeRange(window.computeSignature(p)));
    avgSceneRange = rgs.reduce((a,b)=>a+b,0) / (rgs.length||1);
  }

  perms.forEach((pa) => {
    const sig = window.computeSignature(pa);
    const rng = window.computeRange(sig);
    const r   = window.lehmerRank(pa);
    const I   = (r + window.sceneSeed + window.S_global) % 125;
    const x0  = Math.floor(I / 25);
    const y0  = Math.floor((I % 25) / 5);
    const z0  = I % 5;

    const color = meshColorForPermStr(pa.join(','));
    const lcht = {
      I0 : 0.35 + 0.65 * Math.sqrt(pa[ window.attributeMapping ? window.attributeMapping[0] : 0 ] / 5),
      amp: 0.05 + 0.10 * rng,
      f  : 0.10 + 0.175 * rng,
      phi: 2 * Math.PI * ((r % 360) / 360)
    };
    const seen = new Set();

    function addEdge(x1, y1, z1, x2, y2, z2){
      const key = tubeKey(x1,y1,z1,x2,y2,z2);
      if (seen.has(key)) return; seen.add(key);
      if (!litInfo.has(key)) litInfo.set(key, { color: color.clone(), lcht: { ...lcht } });
    }
    function addCube(cx, cy, cz){
      const v = [
        [cx,     cy,     cz],
        [cx + 1, cy,     cz],
        [cx + 1, cy + 1, cz],
        [cx,     cy + 1, cz],
        [cx,     cy,     cz + 1],
        [cx + 1, cy,     cz + 1],
        [cx + 1, cy + 1, cz + 1],
        [cx,     cy + 1, cz + 1]
      ];
      const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
      E.forEach(([a,b]) => addEdge(...v[a], ...v[b]));
    }

    // torre central + cruz
    const L = pa[ window.attributeMapping ? window.attributeMapping[0] : 0 ];
    for (let s=0; s<L; s++){
      const y = y0 + s;
      addCube(x0, y, z0);
      addCube(x0+1, y, z0); addCube(x0-1, y, z0);
      addCube(x0,   y, z0+1); addCube(x0,   y, z0-1);
    }
    // brazos horizontales
    const dirs = [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1]];
    [y0, y0+L].forEach(yy=>{
      dirs.forEach(([dx,_,dz])=>{
        for(let s=0;s<L;s++) addCube(x0+dx*s, yy, z0+dz*s);
      });
    });
  });

  // genera geometría final
  litInfo.forEach((info, key) => {
    const [a, b] = key.split('|');
    const [x1,y1,z1] = a.split(',').map(Number);
    const [x2,y2,z2] = b.split(',').map(Number);

    const p1  = new THREE.Vector3((x1 - 2) * step, (y1 - 2) * step, (z1 - 2) * step);
    const p2  = new THREE.Vector3((x2 - 2) * step, (y2 - 2) * step, (z2 - 2) * step);
    const dir = new THREE.Vector3().subVectors(p2, p1);
    const len = dir.length();
    const dN  = dir.clone().normalize();

    const SEG  = Math.max(1, Math.ceil(len / step));
    const hSeg = len / SEG;

    const [h,s,v] = window.rgbToHsv(info.color.r*255, info.color.g*255, info.color.b*255);

    for(let i=0;i<SEG;i++){
      const mid = p1.clone().addScaledVector(dN, (i + 0.5) * hSeg);
      const col = colorFromVolume(mid);
      const SIDE = 0.2, JOIN = 0.02;
      const geo = new THREE.BoxGeometry(SIDE, hSeg + JOIN, SIDE);
      const mat = new THREE.MeshPhongMaterial({ color: col, shininess: 0, dithering: true, flatShading: true });
      const tube = new THREE.Mesh(geo, mat);
      tube.position.copy(mid);
      tube.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dN);
      tube.userData.baseHsv = { h, s, v };
      tube.userData.lcht    = info.lcht;
      group.add(tube);
    }
  });
}

function animate(){
  if (!isOn || !group) return;
  const t = performance.now() * 0.001;
  const vHz = 0.05 + 0.02 * (avgSceneRange - 2);
  group.children.forEach(o=>{
    const d = o.userData.lcht;
    if (d) {
      const I = d.I0 * (1 - d.amp * (1 + Math.cos(2*Math.PI*d.f*t + d.phi)) / 2);
      o.material.emissive = o.material.color.clone();
      o.material.emissiveIntensity = I * 0.15;
    }
    if (o.userData.baseHsv){
      const { h, s, v } = o.userData.baseHsv;
      const hShift = (h + t * vHz * 360) % 360;
      const rgb    = window.hsvToRgb(hShift, s, v);
      o.material.color.setRGB(rgb[0]/255, rgb[1]/255, rgb[2]/255);
    }
  });
  rafId = requestAnimationFrame(animate);
}

const LCHT_ENGINE = {
  name: 'LCHT',
  enter(){
    if (isOn) return;
    // material del cubo → lambert para captar luz
    if (!window.cubeUniverse.userData.prevMat){
      window.cubeUniverse.userData.prevMat = window.cubeUniverse.material;
      window.cubeUniverse.material = new getTHREE().MeshLambertMaterial({
        color: window.cubeUniverse.userData.prevMat.color,
        transparent: true,
        opacity: window.cubeUniverse.userData.prevMat.opacity,
        side: window.cubeUniverse.userData.prevMat.side
      });
    }
    prevBg = window.scene.background ? window.scene.background.clone() : null;
    window.scene.background = new getTHREE().Color(0xf4f4f4);

    build();
    group.visible = true;
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
      group = null;
    }
    // restaurar material del cubo
    if (window.cubeUniverse.userData.prevMat){
      window.cubeUniverse.material.dispose();
      window.cubeUniverse.material = window.cubeUniverse.userData.prevMat;
      delete window.cubeUniverse.userData.prevMat;
    }
    if (prevBg) window.scene.background = prevBg;
    window.cubeUniverse.visible = true;
    window.permutationGroup.visible = true;

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
