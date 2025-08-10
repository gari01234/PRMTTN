// ./engines/registry.js
const ORDER = ['FRBN','LCHT','OFFNNG','TMSL','BUILD'];
const REG   = new Map();
let active  = null;

function register(engine){
  if (!engine || !engine.id) return;
  REG.set(engine.id, engine);
}

async function enter(id){
  if (!REG.has(id)) return false;
  const next = REG.get(id);

  // Apaga el anterior si cambia
  if (active && active !== id){
    const prev = REG.get(active);
    try{ await prev?.exit?.(); }catch(e){ console.warn('[ENGINE prev.exit]', e); }
  }

  // Entra al nuevo
  try{
    await next.enter?.();
    active = id;
    // UI de botones (si existe en el entorno actual)
    try{ window.updateEngineButtonsUI?.(); }catch(_){ }
    return true;
  }catch(e){
    console.error('[ENGINE enter]', id, e);
    return false;
  }
}

async function cycle(){
  const i = Math.max(0, ORDER.indexOf(active ?? 'BUILD'));
  const nextId = ORDER[(i + 1) % ORDER.length];
  return enter(nextId);
}

function ids(){ return Array.from(REG.keys()); }
function get(id){ return REG.get(id); }
function activeId(){ return active; }

/* ───── Wrappers sobre los motores existentes en el runtime actual ───── */

const FRBN = {
  id:'FRBN',
  async enter(){
    // ensureFRBNLoaded/toggleFRBN existen en el scope global del HTML
    if (!window.FRBN?.isFRBN){
      await window.ensureFRBNLoaded?.();
      if (!window.FRBN?.isFRBN) await window.toggleFRBN?.();
    }
  },
  async exit(){
    if (window.FRBN?.isFRBN) await window.toggleFRBN?.();
  },
  syncFromScene(){ try{ window.FRBN?.syncFromScene?.(); }catch(_){ } },
  dispose(){ /* noop */ }
};

const LCHT = {
  id:'LCHT',
  enter(){ if (!window.isLCHT) window.toggleLCHT?.(); },
  exit(){  if (window.isLCHT)  window.toggleLCHT?.(); },
  syncFromScene(){ try{ window.rebuildLCHTIfActive?.(); }catch(_){ } },
  dispose(){ /* noop */ }
};

const OFFNNG = {
  id:'OFFNNG',
  enter(){ if (!window.isOFFNNG) window.toggleOFFNNG?.(); },
  exit(){  if (window.isOFFNNG)  window.toggleOFFNNG?.(); },
  syncFromScene(){ try{ window.syncOFFNNGFromScene?.(); }catch(_){ } },
  dispose(){ /* noop */ }
};

const TMSL = {
  id:'TMSL',
  enter(){ if (!window.isTMSL) window.toggleTMSL?.(); },
  exit(){  if (window.isTMSL)  window.toggleTMSL?.(); },
  dispose(){ /* noop */ }
};

// BUILD (fase 1): con la escena base actual; solo garantiza exclusividad
const BUILD = {
  id:'BUILD',
  enter(){ window.switchToBuild?.(); },
  exit(){ /* no-op: BUILD es el baseline */ },
  dispose(){ /* noop */ }
};

// Registro inicial
register(FRBN);
register(LCHT);
register(OFFNNG);
register(TMSL);
register(BUILD);

// API global
window.ENGINE = { register, enter, cycle, ids, get, active: activeId };
export {};
