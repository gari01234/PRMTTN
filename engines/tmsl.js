// engines/tmsl.js
// TMSL: frontal white wall + cámara bloqueada (extraído)
let isOn = false;
let group = null;
let prevBg = null;
let prevControls = true;

function getTHREE(){ return window.THREE; }
function getCubeSize(){
  const w = window.cubeUniverse?.geometry?.parameters?.width;
  return (typeof w === 'number' && w > 0) ? w : 30;
}

function build(){
  const THREE = getTHREE();
  const cubeSize = getCubeSize();
  if (group){
    group.traverse(o => { if (o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
    window.scene.remove(group);
  }
  group = new THREE.Group();
  const DEPTH = 2;
  const wallGeo = new THREE.BoxGeometry(cubeSize*3, cubeSize*3, DEPTH);
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 0, (cubeSize/2) + DEPTH/2);
  group.add(wall);
  window.scene.add(group);
}

const TMSL_ENGINE = {
  name: 'TMSL',
  enter(){
    if (isOn) return;
    // exclusividad la maneja el registry
    build();

    window.cubeUniverse.visible = false;
    window.permutationGroup.visible = false;

    prevBg = window.scene.background ? window.scene.background.clone() : null;
    if (typeof window.updateBackground === 'function') window.updateBackground(false);

    prevControls = window.controls.enabled;
    window.controls.enabled = false;
    if (typeof window.applyStandardView === 'function') {
      const sel = document.getElementById('standardView');
      if (sel) sel.value = 'front';
      window.applyStandardView();
    }
    isOn = true;
    if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
  },
  leave(){
    if (!isOn) return;
    if (group){
      group.traverse(o => { if (o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
      window.scene.remove(group);
      group = null;
    }
    if (prevBg) window.scene.background = prevBg; else if (typeof window.updateBackground === 'function') window.updateBackground(false);
    window.controls.enabled = prevControls;

    window.cubeUniverse.visible = true;
    window.permutationGroup.visible = true;

    isOn = false;
    if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
  },
  syncFromScene(){ /* no-op */ }
};

if (window.ENGINE && typeof window.ENGINE.register === 'function'){
  window.ENGINE.register('TMSL', TMSL_ENGINE);
}
export default TMSL_ENGINE;
