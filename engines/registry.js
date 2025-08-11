// ./engines/registry.js
// PRMTTN – Engine Registry (v2)
// Objetivo: entradas fiables para LCHT/OFFNNG/TMSL y retorno estable a BUILD.

const NAME_ALIAS = { OFFNG: 'OFFNNG', Offnng: 'OFFNNG', offng: 'OFFNNG' };
const ORDER = ['BUILD', 'FRBN', 'LCHT', 'OFFNNG', 'TMSL'];

const _engines = new Map();   // name -> api
let _active = null;
let _activeName = 'BUILD';

// ————— helpers —————
const norm = (n) => NAME_ALIAS[n] || String(n || '').toUpperCase();

function ctx() {
  return {
    THREE:   window.THREE,
    scene:   window.scene,
    renderer:window.renderer,
    camera:  window.camera,
    controls:window.controls,
    cubeUniverse:      window.cubeUniverse,
    permutationGroup:  window.permutationGroup,
    getState: () => (typeof window.getState === 'function' ? window.getState() : null),
    refreshAll: window.refreshAll
  };
}

function callOne(obj, names, ...args){
  for (const key of names){
    const fn = obj && obj[key];
    if (typeof fn === 'function') {
      try { return fn.apply(obj, args); } catch(e){ console.warn(`[registry] ${key}() lanzó error:`, e); }
    }
  }
  return undefined;
}

function restoreBaseLoop(){
  const { renderer, scene, cubeUniverse, permutationGroup } = ctx();
  try { renderer?.setAnimationLoop?.(null); } catch(_){}
  if (renderer) renderer.autoClear = true;
  if (scene)    scene.autoUpdate  = true;

  // Reanclar grupos por si el motor activo los retiró
  if (scene && cubeUniverse && !scene.children.includes(cubeUniverse)) scene.add(cubeUniverse);
  if (scene && permutationGroup && !scene.children.includes(permutationGroup)) scene.add(permutationGroup);
}

function autodetect(name){
  const N = norm(name);
  if (N === 'OFFNNG') return window.OFFNNG || window.OFFNG || null;
  return window[N] || null; // FRBN, LCHT, TMSL…
}

function ensureRegistered(name){
  const N = norm(name);
  if (_engines.has(N)) return _engines.get(N);
  const obj = autodetect(N);
  if (obj) {
    // si exportó default, preferimos el objeto completo, no la función
    const api = obj && obj.default ? obj.default : obj;
    _engines.set(N, api);
    return api;
  }
  return null;
}

// ————— API pública —————
function register(name, api){
  const N = norm(name);
  if (!api) return;
  _engines.set(N, api);
}

function enter(name){
  const target = norm(name);
  // alias transparente
  const finalName = NAME_ALIAS[target] || target;

  if (finalName === _activeName) return true;

  // 1) salir del motor anterior (si lo hay)
  if (_active){
    callOne(_active, ['leave','stop','unmount','destroy'], ctx());
  }
  // 2) saneo del renderer/escena por si el motor tocó el loop
  restoreBaseLoop();

  // 3) BUILD es la base: no necesita montar nada especial
  if (finalName === 'BUILD'){
    _active = null;
    _activeName = 'BUILD';
    // reconstrucción segura de escena base
    try { ctx().refreshAll?.({rebuild:true}); } catch(_){ }
    return true;
  }

  // 4) localizar/registrar el motor
  const engine = ensureRegistered(finalName);
  if (!engine){
    console.warn(`[registry] Motor no disponible: ${finalName}`);
    _active = null; _activeName = 'BUILD';
    try { ctx().refreshAll?.({rebuild:true}); } catch(_){ }
    return false;
  }

  // 5) inyectar contexto (si la API lo acepta)
  callOne(engine, ['setContext','context','ctx'], ctx());

  // 6) montar/entrar
  callOne(engine, ['enter','start','mount','run','init'], ctx());

  // 7) marcar activo y sincronizar estado desde BUILD → motor
  _active = engine;
  _activeName = finalName;

  try {
    // Primer sync inmediato
    const st = ctx().getState?.();
    if (st) callOne(engine, ['syncFromScene','sync'], st, ctx());
    // y un “late sync” en el siguiente frame, útil cuando el motor crea nodos asíncronos
    requestAnimationFrame(()=>{
      const st2 = ctx().getState?.();
      if (st2) callOne(engine, ['syncFromScene','sync'], st2, ctx());
    });
  } catch(_){ }

  return true;
}

function cycle(){
  const idx = Math.max(0, ORDER.indexOf(_activeName));
  const next = ORDER[(idx + 1) % ORDER.length];
  return enter(next);
}

function syncFromScene(){
  if (!_active) return false;
  const st = ctx().getState?.();
  if (!st) return false;
  callOne(_active, ['syncFromScene','sync'], st, ctx());
  return true;
}

// Compat: algunos sitios miran ENGINE.state.active
const ENGINE = {
  register,
  enter,
  cycle,
  syncFromScene,
  get activeName(){ return _activeName; },
  state: { get active(){ return _activeName; } }
};

// ——— Autodescubrimiento “perezoso”: intenta registrar si los motores ya viven en window
function tryAutodiscover(){
  ['FRBN','LCHT','OFFNNG','OFFNG','TMSL'].forEach(n => ensureRegistered(n));
}
if (typeof window !== 'undefined'){
  // disponible muy pronto para que otros módulos puedan usarlo
  window.ENGINE = ENGINE;
  // detectar motores cuando el DOM está listo
  window.addEventListener('load', tryAutodiscover, { once:true });
}

// Mint: mantenemos la UI de Mint oculta devolviendo null (stub seguro)
export function getContractConfig(){ return null; }

// Exports
export { register, enter, cycle, syncFromScene };
export default ENGINE;

