// state/store.js
// Estado único serializable + setters simples (sin dependencias de Three.js)

export const state = {
  perms: [],                                // array de strings "1,2,3,4,5"
  mapping: { forma:0, color:1, x:2, y:3, z:4 },
  pattern: 1,                                // 1..11
  sceneSeed: 0,
  S_global: 0,
  overrides: {
    colors: {},                              // {1:"#rrggbb",..5:"#rrggbb"}
    bg: null,                                // "#rrggbb" | null
    cube: null                               // "#rrggbb" | null
  }
};

// ——— helpers internos ———
function isInt(n){ return Number.isInteger(n); }
function clampPattern(p){ p = +p; return (p>=1 && p<=11) ? p : 1; }

// ——— acciones ———
export function setPerms(arrayOfStrings){
  if (!Array.isArray(arrayOfStrings)) return;
  state.perms = arrayOfStrings.slice();
}

export function setMapping(obj){
  if (!obj) return;
  const { forma, color, x, y, z } = obj;
  const ok = [forma, color, x, y, z].every(v => isInt(v) && v>=0 && v<=4);
  if (!ok) return;
  state.mapping = { forma, color, x, y, z };
}

export function setPattern(num){
  state.pattern = clampPattern(num);
}

export function setOverrides(obj){
  if (!obj || typeof obj !== 'object') return;
  const next = { ...state.overrides };
  if (obj.colors && typeof obj.colors === 'object') next.colors = { ...obj.colors };
  if (typeof obj.bg === 'string' || obj.bg === null)   next.bg   = obj.bg ?? null;
  if (typeof obj.cube === 'string' || obj.cube === null) next.cube = obj.cube ?? null;
  state.overrides = next;
}

/**
 * Reemplaza todo el estado de golpe (validando shape).
 * Espera un objeto {perms, mapping, pattern, sceneSeed, S_global, overrides}
 */
export function replaceAll(obj){
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj.perms)) state.perms = obj.perms.slice();

  if (obj.mapping){
    const { forma, color, x, y, z } = obj.mapping;
    const ok = [forma,color,x,y,z].every(v => isInt(v) && v>=0 && v<=4);
    if (ok) state.mapping = { forma, color, x, y, z };
  }

  if (isInt(obj.pattern)) state.pattern = clampPattern(obj.pattern);
  if (isInt(obj.sceneSeed)) state.sceneSeed = obj.sceneSeed|0;
  if (isInt(obj.S_global))  state.S_global  = obj.S_global|0;

  if (obj.overrides && typeof obj.overrides === 'object') {
    const o = obj.overrides;
    state.overrides = {
      colors: (o.colors && typeof o.colors==='object') ? { ...o.colors } : {},
      bg: (typeof o.bg === 'string') ? o.bg : null,
      cube: (typeof o.cube === 'string') ? o.cube : null
    };
  }
}
