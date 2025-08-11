// ./engines/registry.js
// Registry 1.0 — motor centralizado + configuración del contrato (opcional)
// Sin placeholders: si no hay config de contrato, simplemente no se muestra el bloque NFT.

const READY_CHECK_INTERVAL_MS = 50;

function waitFor(fnNames) {
  return new Promise((resolve) => {
    const ok = () => fnNames.every((n) => typeof window[n] === 'function');
    if (ok()) return resolve();
    const iv = setInterval(() => {
      if (ok()) { clearInterval(iv); resolve(); }
    }, READY_CHECK_INTERVAL_MS);
  });
}

const state = {
  engines: ['BUILD', 'FRBN', 'OFFNNG', 'LCHT', 'TMSL'],
  idx: 0
};

function updateEngineButtonsUIActive(name) {
  try {
    const map = {
      BUILD: 'btn-engine-build',
      FRBN: 'toggleFRBN',
      OFFNNG: 'toggleOFFNNG',
      LCHT: 'toggleLCHT',
      TMSL: 'toggleTMSL'
    };
    for (const key in map) {
      const el = document.getElementById(map[key]);
      if (!el) continue;
      if (key === name) el.classList.add('active');
      else el.classList.remove('active');
    }
  } catch {}
}

async function invokeEngine(name) {
  await waitFor(['switchToBuild', 'toggleFRBN', 'toggleOFFNNG', 'toggleLCHT', 'toggleTMSL']);
  switch (name) {
    case 'BUILD': window.switchToBuild?.(); break;
    case 'FRBN': window.toggleFRBN?.(); break;
    case 'OFFNNG': window.toggleOFFNNG?.(); break;
    case 'LCHT': window.toggleLCHT?.(); break;
    case 'TMSL': window.toggleTMSL?.(); break;
    default: window.switchToBuild?.();
  }
  updateEngineButtonsUIActive(name);
}

export const ENGINE = {
  async enter(name) {
    if (!state.engines.includes(name)) name = 'BUILD';
    state.idx = state.engines.indexOf(name);
    await invokeEngine(name);
  },
  async cycle() {
    state.idx = (state.idx + 1) % state.engines.length;
    await invokeEngine(state.engines[state.idx]);
  }
};

// Expone globalmente para el HTML existente
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
