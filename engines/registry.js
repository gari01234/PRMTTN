// ./engines/registry.js
// Simple engine registry with enter/leave/sync and optional contract config

export const ENGINE = (() => {
  const engines = {};
  const order = ['BUILD'];
  let activeName = 'BUILD';

  async function leaveCurrent(){
    const cur = engines[activeName];
    if (cur && typeof cur.leave === 'function'){
      try{ await cur.leave(); }catch(e){ console.error(e); }
    }
  }

  return {
    register(name, engine){
      if (!engines[name]){
        engines[name] = engine;
        order.push(name);
      }
    },
    get activeName(){ return activeName; },
    async enter(name){
      if (!name) name = 'BUILD';
      if (activeName === name) return;
      await leaveCurrent();
      activeName = name;
      if (name === 'BUILD'){
        if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
        return;
      }
      const eng = engines[name];
      if (eng && typeof eng.enter === 'function'){
        try{ await eng.enter(); }catch(e){ console.error(e); }
      }
      if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
    },
    async cycle(){
      const idx = order.indexOf(activeName);
      const next = order[(idx + 1) % order.length];
      await this.enter(next);
    },
    syncFromScene(){
      const eng = engines[activeName];
      if (eng && typeof eng.syncFromScene === 'function'){
        try{ eng.syncFromScene(); }catch(e){ console.error(e); }
      }
    }
  };
})();

window.ENGINE = ENGINE;

// ---- Contrato (infra) ----
// Devuelve null si no hay config (no placeholders). Cuando haya dirección/ABI reales,
// se añadirá aquí en un PR posterior sin tocar el HTML.
export function getContractConfig() {
  // Sin placeholders: por ahora no hay contrato configurado.
  // Retorna null y el front ocultará el bloque NFT de forma segura.
  return null;

  // Ejemplo futuro (NO incluir ahora):
  // return {
  //   chainId: 137, // Polygon mainnet
  //   address: "0x....",
  //   abi: [ ...ABI... ]
  // };
}

// === FRBN · registro nativo en ENGINE (enter/leave/sync) ===================
(() => {
  if (!window.ENGINE || window.ENGINE.__frbnRegistered) return;

  async function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  function buildFRBNHost(){
    const getSelectedPerms = () =>
      Array.from(document.getElementById('permutationList').selectedOptions)
        .map(o => o.value.split(',').map(Number));

    return {
      THREE      : window.THREE,
      scene      : window.scene,
      camera     : window.camera,
      renderer   : window.renderer,
      controls   : window.controls,
      cubeUniverse,
      permutationGroup,
      getSelectedPerms,
      invariants : {
        get sceneSeed(){ return window.sceneSeed; },
        get S_global(){ return window.S_global; },
        get activePatternId(){ return window.activePatternId; }
      },
      utils : {
        computeSignature : window.computeSignature,
        computeRange     : window.computeRange,
        lehmerRank       : window.lehmerRank,
        idxToHSV         : window.idxToHSV,
        hsvToRgb         : window.hsvToRgb,
        rgbToHsv         : window.rgbToHsv,
        hsvToHex         : window.hsvToHex,
        ensureContrastRGB: window.ensureContrastRGB,
        deltaE           : window.deltaE,
        rgbToLab         : window.rgbToLab
      }
    };
  }

  async function ensureFRBNReady(){
    // 1) ya está cargado
    if (window.FRBN && (typeof window.FRBN.toggle === 'function')) {
      if (!window.FRBN.__wired){
        const host = buildFRBNHost();
        try {
          if (typeof window.FRBN.wire === 'function') await window.FRBN.wire(host);
          else if (typeof window.FRBN.init === 'function') await window.FRBN.init(host);
          else if (typeof window.FRBN.setup === 'function') await window.FRBN.setup(host);
          else if (typeof window.FRBN.acceptHost === 'function') await window.FRBN.acceptHost(host);
          else window.FRBN.host = host;
          window.FRBN.__wired = true;
        } catch(e){
          console.error('FRBN wire failed:', e);
        }
      }
      return true;
    }

    // 2) import dinámico defensivo (por si el <script> aún no terminó)
    try {
      const mod = await import('./frbn.js');
      if (!window.FRBN) window.FRBN = mod.default || mod.FRBN || mod;
    } catch(_) { /* continúa al polling */ }

    // 3) espera corta
    const t0 = performance.now();
    while (performance.now() - t0 < 1500){
      if (window.FRBN && typeof window.FRBN.toggle === 'function'){
        if (!window.FRBN.__wired){
          const host = buildFRBNHost();
          try {
            if (typeof window.FRBN.wire === 'function') await window.FRBN.wire(host);
            else if (typeof window.FRBN.init === 'function') await window.FRBN.init(host);
            else if (typeof window.FRBN.setup === 'function') await window.FRBN.setup(host);
            else if (typeof window.FRBN.acceptHost === 'function') await window.FRBN.acceptHost(host);
            else window.FRBN.host = host;
            window.FRBN.__wired = true;
          } catch(e){
            console.error('FRBN wire failed:', e);
          }
        }
        return true;
      }
      await wait(50);
    }
    console.error('FRBN no disponible (engines/frbn.js)');
    return false;
  }

  const FRBN_ENGINE = {
    name: 'FRBN',
    async enter(){
      const ok = await ensureFRBNReady();
      if (!ok) return;
      if (!window.FRBN.isFRBN) await window.FRBN.toggle();
      // UI
      if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
    },
    async leave(){
      if (window.FRBN?.isFRBN) { try { await window.FRBN.toggle(); } catch(_){} }
      if (typeof window.updateEngineButtonsUI === 'function') window.updateEngineButtonsUI();
    },
    syncFromScene(){
      try { window.FRBN?.syncFromScene?.(); } catch(_){}
    }
  };

  // Registrar
  if (typeof window.ENGINE.register === 'function') {
    window.ENGINE.register('FRBN', FRBN_ENGINE);
    window.ENGINE.__frbnRegistered = true;
  }
})();

export default ENGINE;
