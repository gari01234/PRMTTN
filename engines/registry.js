// engines/registry.js — Runtime registry aligned with types/engine.d.ts
// Drop-in. It exposes window.ENGINE with a stable async API and context injection.

(function(){
  const g = (typeof window !== 'undefined') ? window : globalThis;

  if (g.ENGINE && g.ENGINE.__isEngineRegistry) {
    // Already installed, keep the existing one.
    return;
  }

  const _map = new Map();           // id -> engine
  let   _active = null;             // engine object
  let   _activeName = 'BUILD';      // 'BUILD' | id
  let   _ctx = null;                // injected context object

  const aliases = Object.freeze({
    OFFNNG: 'OFFNNG', OFFNG: 'OFFNNG', // alias both ways
    FRBN: 'FRBN', LCHT: 'LCHT', TMSL: 'TMSL', BUILD: 'BUILD'
  });

  function norm(name){
    if (!name) return null;
    const s = String(name).trim().toUpperCase();
    return aliases[s] || s;
  }

  function ctx(){
    if (_ctx) return _ctx;
    // Safe defaults pulled from globals (do not hard-crash without DOM)
    return {
      getState:     g.getState || (() => null),
      refreshAll:   g.refreshAll || (() => {}),
      scene:        g.scene,
      camera:       g.camera,
      renderer:     g.renderer,
      controls:     g.controls,
      THREE:        g.THREE,
      core:         g.core || {},
    };
  }

  function callOne(obj, names, ...args){
    for (const n of names){
      const fn = obj && obj[n];
      if (typeof fn === 'function'){
        return fn.apply(obj, args);
      }
    }
    return undefined;
  }

  function restoreBaseLoop(){
    try {
      const r = g.renderer;
      if (r && typeof r.setAnimationLoop === 'function') r.setAnimationLoop(null);
      if (r) r.autoClear = true;
      if (g.scene) g.scene.autoUpdate = true;

      // Re-anchor groups if engines moved them
      if (g.scene && g.cubeUniverse && !g.scene.children.includes(g.cubeUniverse)){
        g.scene.add(g.cubeUniverse);
      }
      if (g.scene && g.permutationGroup && !g.scene.children.includes(g.permutationGroup)){
        g.scene.add(g.permutationGroup);
      }
    } catch (_) {}
  }

  async function enterBUILD(){
    _active = null;
    _activeName = 'BUILD';
    restoreBaseLoop();
    await Promise.resolve(ctx().refreshAll?.({rebuild:true}));
    try { g.applyStandardView?.(); } catch(_) {}
    try { g.updateEngineButtonsUI?.(); } catch(_) {}
    return true;
  }

  async function leaveActive(){
    if (!_active) return true;
    await Promise.resolve(callOne(_active, ['leave','exit','stop','unmount','destroy'], ctx()));
    _active = null;
    return true;
  }

  const API = {
    __isEngineRegistry: true,

    // Register either as (id, engine) or (engineWithId)
    register(a, b){
      let id, eng;
      if (typeof a === 'string'){ id = norm(a); eng = b; }
      else if (a && typeof a === 'object'){ id = norm(a.id || a.name); eng = a; }
      else { return false; }

      if (!id || !eng) return false;
      const existed = _map.has(id);
      _map.set(id, eng);
      return !existed;
    },

    // Type-friendly helpers
    ids(){ return Array.from(_map.keys()); },
    get(id){ return _map.get(norm(id)); },
    active(){ return _activeName; },

    // Context injection (optional but recommended)
    context(next){
      if (typeof next !== 'undefined') _ctx = next;
      return _ctx || ctx();
    },

    // Core action: async enter (awaits engine leaves/enters).
    async enter(name){
      const target = norm(name) || 'BUILD';
      if (target === _activeName) return true;

      // Leave current
      await leaveActive();
      restoreBaseLoop();

      if (target === 'BUILD') {
        return enterBUILD();
      }

      // Pick engine (allow late registration)
      let eng = _map.get(target);
      if (!eng){
        // If an engine self-registers later, bounce back to BUILD
        console.warn('[ENGINE] enter(): engine not registered:', target);
        return enterBUILD();
      }

      // Inject context (compatible with various method names)
      await Promise.resolve(callOne(eng, ['setContext','context','ctx'], ctx()));

      // Enter/start/mount
      await Promise.resolve(callOne(eng, ['enter','start','mount','run','init'], ctx()));

      _active = eng;
      _activeName = target;

      try {
        const st = ctx().getState?.();
        if (st) await Promise.resolve(callOne(eng, ['syncFromScene','sync'], st, ctx()));
      } catch(_) {}

      try { g.updateEngineButtonsUI?.(); } catch(_) {}
      return true;
    },

    // Cycle through known engines in a fixed order.
    async cycle(){
      const order = ['BUILD','FRBN','LCHT','OFFNNG','TMSL'];
      const cur = norm(_activeName) || 'BUILD';
      const i = order.indexOf(cur);
      const next = order[(i + 1) % order.length];
      return this.enter(next);
    },

    // Forward sync to active engine (no-op in BUILD).
    async syncFromScene(){
      if (!_active) return;
      const st = ctx().getState?.();
      if (!st) return;
      await Promise.resolve(callOne(_active, ['syncFromScene','sync'], st, ctx()));
    }
  };

  g.ENGINE = API;
})();
