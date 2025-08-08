// state/store.js — estado serializable mínimo (adopción gradual)
export const state = {
  perms: [],             // lista de strings "1,2,3,4,5"
  mapping: { forma:0, color:1, x:2, y:3, z:4 },
  pattern: 1,
  sceneSeed: 0,
  S_global: 0,
  overrides: {
    colors: {},          // {1:"#rrggbb",...}
    bg: null,
    cube: null
  }
};

// utilidades
export function setPerms(perms){ state.perms = perms.slice(); }
export function setMapping(m){ state.mapping = {...m}; }
export function setPattern(p){ state.pattern = p|0; }
export function setOverrides(o){ state.overrides = {...state.overrides, ...o}; }

export function serialize(){
  return {
    perms: state.perms.slice(),
    mapping: {...state.mapping},
    colors: {...state.overrides.colors},
    bg: state.overrides.bg,
    cube: state.overrides.cube,
    pattern: state.pattern,
    sceneSeed: state.sceneSeed,
    S_global: state.S_global,
    view: "front",
    frbnK: 144
  };
}
