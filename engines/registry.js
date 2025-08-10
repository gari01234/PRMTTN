// engines/registry.js
// Contrato 1.0: ENGINE.enter(name), ENGINE.leave(), ENGINE.cycle(), ENGINE.syncFromScene()
// Exclusividad gestionada aquí. Registro provisional de BUILD, FRBN, LCHT, OFFNNG y TMSL.

const REGISTRY = (() => {
  const engines = new Map();
  const order = [];
  let active = null;

  function register(name, impl) {
    engines.set(name, impl);
    if (!order.includes(name)) order.push(name);
  }

  async function leave() {
    if (!active) return;
    const impl = engines.get(active);
    try { if (impl?.leave) await impl.leave(); }
    catch (e) { console.error(`[ENGINE] leave(${active}) error:`, e); }
    active = null;
  }

  async function enter(name) {
    if (active === name) {
      try { await engines.get(name)?.syncFromScene?.(); } catch (_) {}
      return name;
    }
    if (!engines.has(name)) {
      console.warn(`[ENGINE] '${name}' no registrado`);
      return null;
    }
    await leave();
    try { await engines.get(name)?.enter?.(); }
    catch (e) { console.error(`[ENGINE] enter(${name}) error:`, e); }
    active = name;
    if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
    return name;
  }

  async function cycle() {
    if (!order.length) return null;
    const i = active ? order.indexOf(active) : -1;
    const next = order[(i + 1) % order.length];
    return enter(next);
  }

  async function syncFromScene() {
    try { await engines.get(active)?.syncFromScene?.(); }
    catch (e) { console.error('[ENGINE] syncFromScene error:', e); }
  }

  return {
    register, enter, leave, cycle, syncFromScene,
    getActive: () => active,
    list: () => order.slice()
  };
})();

window.ENGINE = REGISTRY;

/* =================== REGISTROS PROVISIONALES =================== */
/* BUILD: delega en switchToBuild() (ya asegura exclusividad) */
REGISTRY.register('BUILD', {
  enter: async () => { if (typeof window.switchToBuild === 'function') window.switchToBuild(); },
  leave: async () => {},
  syncFromScene: async () => {}
});

/* FRBN: usa ensureFRBNLoaded()/toggleFRBN()/frbnOn() definidos en el HTML */
REGISTRY.register('FRBN', {
  enter: async () => {
    if (typeof window.ensureFRBNLoaded === 'function') {
      const ok = await window.ensureFRBNLoaded();
      if (!ok) return;
    }
    if (typeof window.frbnOn === 'function' && !window.frbnOn()) {
      if (typeof window.toggleFRBN === 'function') await window.toggleFRBN();
    } else if (window.FRBN && typeof window.FRBN.syncFromScene === 'function') {
      window.FRBN.syncFromScene();
    }
  },
  leave: async () => {
    if (typeof window.frbnOn === 'function' && window.frbnOn()) {
      if (typeof window.toggleFRBN === 'function') await window.toggleFRBN();
    }
  },
  syncFromScene: async () => {
    if (window.FRBN && typeof window.FRBN.syncFromScene === 'function') window.FRBN.syncFromScene();
  }
});

/* LCHT: passthrough provisional a tus toggles actuales */
REGISTRY.register('LCHT', {
  enter: async () => { if (!window.isLCHT && typeof window.toggleLCHT === 'function') window.toggleLCHT(); },
  leave: async () => { if (window.isLCHT && typeof window.toggleLCHT === 'function') window.toggleLCHT(); },
  syncFromScene: async () => { if (typeof window.rebuildLCHTIfActive === 'function') window.rebuildLCHTIfActive(); }
});

/* OFFNNG: passthrough provisional (usa ensureOnlyOFFNNG / toggleOFFNNG) */
REGISTRY.register('OFFNNG', {
  enter: async () => { if (typeof window.ensureOnlyOFFNNG === 'function') window.ensureOnlyOFFNNG(); },
  leave: async () => { if (window.isOFFNNG && typeof window.toggleOFFNNG === 'function') window.toggleOFFNNG(); },
  syncFromScene: async () => { if (typeof window.syncOFFNNGFromScene === 'function') window.syncOFFNNGFromScene(); }
});

/* TMSL: passthrough provisional */
REGISTRY.register('TMSL', {
  enter: async () => { if (typeof window.ensureOnlyTMSL === 'function') window.ensureOnlyTMSL(); },
  leave: async () => { if (window.isTMSL && typeof window.toggleTMSL === 'function') window.toggleTMSL(); },
  syncFromScene: async () => {}
});

export default REGISTRY;

