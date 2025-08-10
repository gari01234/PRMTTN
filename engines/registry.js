// engines/registry.js
// Contrato: Engine { id, enter(host), exit(), syncFromScene?, dispose?, controlsVisibility? }

const _engines = new Map();
const _order   = [];
let _activeId  = null;
let _host      = null;

function createStandardHost(){
  const w = window;
  const getSelectedPerms = () =>
    Array.from(document.getElementById('permutationList').selectedOptions)
      .map(o => o.value.split(',').map(Number));

  _host = {
    THREE: w.THREE,
    get scene(){ return w.scene; },
    get camera(){ return w.camera; },
    get renderer(){ return w.renderer; },
    get controls(){ return w.controls; },
    get cubeUniverse(){ return w.cubeUniverse; },
    get permutationGroup(){ return w.permutationGroup; },
    getSelectedPerms,
    invariants: {
      get sceneSeed(){ return w.sceneSeed; },
      get S_global(){ return w.S_global; },
      get attributeMapping(){ return (w.attributeMapping||[]).slice(0,5); },
      get activePatternId(){ return w.activePatternId; }
    },
    utils: {
      computeSignature: w.computeSignature,
      computeRange:     w.computeRange,
      lehmerRank:       w.lehmerRank,
      idxToHSV:         w.idxToHSV,
      hsvToRgb:         w.hsvToRgb,
      rgbToHsv:         w.rgbToHsv,
      hsvToHex:         w.hsvToHex,
      hexToRgb:         w.hexToRgb,
      ensureContrastRGB:w.ensureContrastRGB,
      deltaE:           w.deltaE,
      rgbToLab:         w.rgbToLab,
      toThreeColor:     w.toThreeColor,
      hexFromRgb:       w.hexFromRgb
    }
  };
  return _host;
}

const ENGINE = {
  register(engine){
    if (!engine || !engine.id || typeof engine.enter!=='function' || typeof engine.exit!=='function'){
      console.error('[ENGINE] Engine inválido (id/enter/exit requeridos)'); return;
    }
    if (_engines.has(engine.id)){ console.warn('[ENGINE] Duplicado:', engine.id); return; }
    _engines.set(engine.id, engine);
    _order.push(engine.id);
  },
  enter(id){
    if (!_engines.has(id)){ console.error('[ENGINE] Desconocido:', id); return; }
    if (!_host) createStandardHost();

    if (_activeId && _activeId !== id){
      try { _engines.get(_activeId).exit(); } catch(e){ console.error('[ENGINE] exit error', e); }
    }
    _activeId = id;
    try { _engines.get(id).enter(_host); } catch(e){ console.error('[ENGINE] enter error', e); }
    window.updateEngineButtonsUI?.();
  },
  exit(){
    if (!_activeId) return;
    try { _engines.get(_activeId).exit(); } catch(e){ console.error('[ENGINE] exit error', e); }
    _activeId = null;
    window.updateEngineButtonsUI?.();
  },
  cycle(){
    if (!_order.length) return;
    const i = _activeId ? _order.indexOf(_activeId) : -1;
    const next = _order[(i+1)%_order.length];
    this.enter(next);
  },
  getActive(){ return _activeId ? _engines.get(_activeId) : null; },
  getActiveId(){ return _activeId; },
  syncFromScene(){
    const e = this.getActive();
    if (e && typeof e.syncFromScene === 'function'){
      try { e.syncFromScene(); } catch(err){ console.error('[ENGINE] syncFromScene error', err); }
    }
  }
};

// Registro mínimo de BUILD (fase 1: sólo visibilidad, sin tocar lógica)
ENGINE.register({
  id: 'BUILD',
  enter(host){
    if (!host) return;
    if (host.cubeUniverse)      host.cubeUniverse.visible = true;
    if (host.permutationGroup)  host.permutationGroup.visible = true;
  },
  exit(){},
  syncFromScene(){}
});

window.ENGINE = ENGINE;
export default ENGINE;

