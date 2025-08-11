// engines/registry.js
// Engine Registry — runtime alineado con el .d.ts
// - API pública: register(name, engine), enter(id): Promise<boolean>, ids(), get(), active()
// - Extras compatibles: cycle(), syncFromScene(state?), context(obj), activeName, state.active
// - enter() es async y espera leave() del saliente y enter() del entrante.

const REG = new Map();
let _active = null;          // objeto del motor activo
let _activeName = 'BUILD';   // string ('BUILD' cuando no hay motor)
let _ctx = null;             // contexto compartido para todos los motores

function norm(name) {
  return String(name || '').trim().toUpperCase();
}

// Llama al primer método existente de la lista y retorna su resultado
function callOne(target, candidates, ...args) {
  for (const k of candidates) {
    const fn = target && target[k];
    if (typeof fn === 'function') return fn.apply(target, args);
  }
  return undefined;
}

// Contexto que reciben los motores
function ctx() {
  // Construimos perezosamente con helpers del host, si existen
  const base = _ctx || {};
  return {
    // core puro (inyectado desde la página host)
    core: (typeof window !== 'undefined' && window.core) || base.core || null,
    // estado y utilidades del host (si existen)
    getState: (typeof window !== 'undefined' && window.getState) || base.getState || null,
    refreshAll: (typeof window !== 'undefined' && window.refreshAll) || base.refreshAll || null,
    three: (typeof window !== 'undefined' && window.THREE) || base.three || null,
    scene: (typeof window !== 'undefined' && window.scene) || base.scene || null,
    camera: (typeof window !== 'undefined' && window.camera) || base.camera || null,
    renderer: (typeof window !== 'undefined' && window.renderer) || base.renderer || null,
    controls: (typeof window !== 'undefined' && window.controls) || base.controls || null,
    permutationGroup:
      (typeof window !== 'undefined' && window.permutationGroup) || base.permutationGroup || null,
  };
}

const ENGINE = {
  // Registra un motor. Devuelve true si se registra/actualiza correctamente.
  register(name, engine) {
    const id = norm(name);
    if (!id) { console.warn('[ENGINE.register] id vacío'); return false; }

    // Soporta default export y factories
    let api = engine && (engine.default || engine);
    if (typeof api === 'function') {
      try { api = api(ctx()); } catch (e) { console.warn('[ENGINE.register] factory falló:', e); }
    }
    if (!api || typeof api !== 'object') {
      console.warn('[ENGINE.register] api inválida para', id);
      return false;
    }
    REG.set(id, api);
    return true;
  },

  // Entra en un motor; espera a leave/exit del saliente y enter/start del entrante.
  async enter(name) {
    const target = norm(name);
    if (!target) return false;

    if (target === _activeName) return true;

    // Salida del motor previo
    if (_active) {
      try {
        await Promise.resolve(
          callOne(_active, ['leave', 'exit', 'stop', 'unmount', 'destroy'], ctx())
        );
      } catch (e) {
        console.warn('[ENGINE.enter] leave del motor saliente falló:', e);
      }
    }

    // BUILD = escena base (sin motor)
    if (target === 'BUILD') {
      _active = null;
      _activeName = 'BUILD';
      // Devolvemos control al host para reconstruir
      try { await Promise.resolve(ctx().refreshAll?.({ rebuild: true })); } catch (_) {}
      ENGINE.state.active = _activeName;
      return true;
    }

    // Buscar motor y entrar
    const engine = REG.get(target);
    if (!engine) {
      console.warn('[ENGINE.enter] motor no registrado:', target);
      _active = null;
      _activeName = 'BUILD';
      try { await Promise.resolve(ctx().refreshAll?.({ rebuild: true })); } catch (_) {}
      ENGINE.state.active = _activeName;
      return false;
    }

    // Inyectar contexto (si el motor lo acepta)
    try {
      await Promise.resolve(callOne(engine, ['setContext', 'context', 'ctx'], ctx()));
    } catch (e) {
      console.warn('[ENGINE.enter] setContext/context/ctx falló en', target, e);
    }

    // Enter real
    try {
      await Promise.resolve(callOne(engine, ['enter', 'start', 'mount', 'run', 'init'], ctx()));
    } catch (e) {
      console.warn('[ENGINE.enter] enter/start falló en', target, e);
      return false;
    }

    _active = engine;
    _activeName = target;
    ENGINE.state.active = _activeName;

    // Primer sync (si hay estado del host)
    try {
      const st = ctx().getState?.();
      if (st) await Promise.resolve(callOne(engine, ['syncFromScene', 'sync'], st, ctx()));
      // Un segundo sync en el siguiente frame (post-layout)
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => {
          try {
            const st2 = ctx().getState?.();
            if (st2) callOne(engine, ['syncFromScene', 'sync'], st2, ctx());
          } catch (_) {}
        });
      }
    } catch (_) {}

    return true;
  },

  // Cicla entre motores registrados + BUILD (siempre incluye BUILD)
  cycle() {
    const all = ['BUILD', ...Array.from(REG.keys())];
    const i = Math.max(0, all.indexOf(_activeName));
    const next = all[(i + 1) % all.length];
    return ENGINE.enter(next);
  },

  // Reenvía el estado actual al motor activo
  syncFromScene(state) {
    if (!_active) return;
    try {
      const st = state || ctx().getState?.();
      if (st) return callOne(_active, ['syncFromScene', 'sync'], st, ctx());
    } catch (e) {
      console.warn('[ENGINE.syncFromScene] falló:', e);
    }
  },

  // Exponer/actualizar contexto (opcional)
  context(obj) {
    _ctx = Object.assign({}, _ctx || {}, obj || {});
  },

  // === API pedida por el .d.ts ===
  ids() { return Array.from(REG.keys()); },
  get(id) { return REG.get(norm(id)); },
  active() { return _active; },

  // Campos de compat
  get activeName() { return _activeName; },
  state: { active: _activeName },
};

// Exponer global y exportar módulo
if (typeof window !== 'undefined') window.ENGINE = ENGINE;
export default ENGINE;

// (Opcional) Config de contrato para el mint (el host la consulta si existe)
export function getContractConfig() {
  // Devuelve null por defecto; si tienes datos reales, expórtalos aquí.
  return null;
}

