// core/patterns.js — PATTERNS y constantes asociadas (tal cual)
export const PHI_S = 5;
export const PHI_V = 7;
export const PHI_H = 89;

/* ════════════════════════════════════════════════════════════════
   COLOR CONDITIONER · por patrón (local, determinista, sin hooks)
   — Trabaja en el espacio de ÍNDICES (H_idx, S_idx, V_idx)
   — Mantiene tu discretización original: H:144, S:12, V:12
   — NO altera funciones globales ni motores.
   — Determinismo: usa (patternId, slot, seed, sceneSeed, S_global).
   ════════════════════════════════════════════════════════════════ */

const _SC_PI   = Math.PI;
const _SC_TAU  = Math.PI * 2.0;

/* Índices → valores de tu rejilla HSV */
function _sc_idxToH(hIdx){ return (hIdx % 144) * 2.5; }         // grados
function _sc_idxToS(sIdx){ return 0.25 + 0.72 * ( (sIdx%12) / 11 ); }
function _sc_idxToV(vIdx){ return 0.20 + 0.75 * ( (vIdx%12) / 11 ); }

/* Valores → índices de tu rejilla HSV (con clamp) */
function _sc_HtoIdx(Hdeg){
  let h = Hdeg % 360; if (h < 0) h += 360;
  return Math.round(h / 2.5) % 144;
}
function _sc_StoIdx(S){
  const x = (S - 0.25) / 0.72;                // 0..1 ideal
  return Math.max(0, Math.min(11, Math.round(x * 11)));
}
function _sc_VtoIdx(V){
  const x = (V - 0.20) / 0.75;                // 0..1 ideal
  return Math.max(0, Math.min(11, Math.round(x * 11)));
}

/* HSV → RGB (para ajuste suave de luminancia) */
function _sc_hsv2rgb(Hdeg, S, V){
  const h = ( (Hdeg % 360) + 360 ) % 360 / 60.0;
  const c = V * S;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = V - c;
  let r=0,g=0,b=0;
  if      (h < 1){ r=c; g=x; b=0; }
  else if (h < 2){ r=x; g=c; b=0; }
  else if (h < 3){ r=0; g=c; b=x; }
  else if (h < 4){ r=0; g=x; b=c; }
  else if (h < 5){ r=x; g=0; b=c; }
  else           { r=c; g=0; b=x; }
  return [r+m, g+m, b+m];
}

/* Luma (Rec.709) */
function _sc_lumaRGB(r,g,b){ return 0.2126*r + 0.7152*g + 0.0722*b; }

/* Envuelve diferencia angular en [-180, +180] */
function _sc_angDiff(a, b){
  let d = (a - b) % 360; if (d < -180) d += 360; if (d > 180) d -= 360; return d;
}

/* Semilla determinista suave (0..1) desde escena + patrón + slot */
function _sc_hash01(patternId, slot, seed){
  const sceneSeedVal = (typeof sceneSeed !== 'undefined') ? (sceneSeed|0) : 0;
  const SGlobalVal = (typeof S_global !== 'undefined') ? (S_global|0) : 0;
  const a = sceneSeedVal, b = SGlobalVal;
  let x = ( (a*73856093) ^ (b*19349663) ^ (patternId*83492791) ^ (slot*2971215073) ^ (seed*1664525) ) >>> 0;
  // LCG un paso
  x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
  return (x & 0xFFFFFF) / 0xFFFFFF; // 0..1
}

/* Tabla de “intenciones” por patrón (resumen de tu teoría)
   spanH:   compresión/expansión del abanico angular (1=sin cambio)
   sMean/vMean: medias objetivo
   sTight/vTight: 0..1 (0 = no mover, 1 = llevar a la media)
   luma:   luminancia objetivo (0..1, ajuste leve)
   mode:   estrategia de separación (none | altHiLo | jitter | narrow)
*/
const _SC_POLICY = {
  1:  { spanH:0.75, sMean:0.62, vMean:0.78, sTight:0.35, vTight:0.35, luma:0.68, mode:'narrow' },        // Contención estructural
  2:  { spanH:1.40, sMean:0.70, vMean:0.72, sTight:0.15, vTight:0.10, luma:0.64, mode:'altHiLo' },       // Contraste & Disonancia
  3:  { spanH:1.00, sMean:0.55, vMean:0.72, sTight:0.30, vTight:0.30, luma:0.66, mode:'none' },          // Disposición no semántica
  4:  { spanH:0.85, sMean:0.58, vMean:0.74, sTight:0.30, vTight:0.30, luma:0.67, mode:'jitter' },        // Ambigüedad estructurada
  5:  { spanH:0.60, sMean:0.52, vMean:0.76, sTight:0.45, vTight:0.35, luma:0.68, mode:'narrow' },        // Campo sin centro
  6:  { spanH:1.10, sMean:0.64, vMean:0.80, sTight:0.25, vTight:0.25, luma:0.70, mode:'none' },          // Presencia autosuficiente
  7:  { spanH:0.95, sMean:0.60, vMean:0.76, sTight:0.25, vTight:0.25, luma:0.68, mode:'altHiLo' },       // Asimetría asociativa
  8:  { spanH:1.20, sMean:0.66, vMean:0.78, sTight:0.20, vTight:0.25, luma:0.69, mode:'jitter' },        // Dinámica irregular
  9:  { spanH:0.80, sMean:0.56, vMean:0.74, sTight:0.35, vTight:0.30, luma:0.67, mode:'narrow' },        // Habitable sin traducción
  10: { spanH:0.90, sMean:0.60, vMean:0.78, sTight:0.25, vTight:0.30, luma:0.69, mode:'jitter' },        // Resonancia
  11: { spanH:0.95, sMean:0.48, vMean:0.86, sTight:0.40, vTight:0.30, luma:0.75, mode:'none' }           // Transparencia activa
};

/* Acondicionador principal: recibe índices crudos del patrón y devuelve
   NUEVOS índices (H_idx, S_idx, V_idx) ya ajustados al patrón. */
function conditionHSV(hIdx, sIdx, vIdx, patternId, slot, seed){
  const pol = _SC_POLICY[patternId] || _SC_POLICY[1];

  // 1) Índices → valores
  let H = _sc_idxToH(hIdx);   // grados
  let S = _sc_idxToS(sIdx);
  let V = _sc_idxToV(vIdx);

  // 2) Ancla y span de H (determinista por escena / patrón / slot)
  const sceneSeedVal = (typeof sceneSeed !== 'undefined') ? (sceneSeed|0) : 0;
  const SGlobalVal = (typeof S_global !== 'undefined') ? (S_global|0) : 0;
  const baseAnchor = ((37*sceneSeedVal + 53*SGlobalVal + 11*patternId + 7*(slot|0)) % 144) * 2.5; // deg
  const d = _sc_angDiff(H, baseAnchor);            // [-180,180]
  H = baseAnchor + d * pol.spanH;

  // 3) Ajuste de S/V hacia medias (mezcla controlada)
  S = S + (pol.sMean - S) * pol.sTight;
  V = V + (pol.vMean - V) * pol.vTight;

  // 4) Separación/variación determinista por “modo”
  const r = _sc_hash01(patternId, slot, seed) - 0.5;   // [-0.5,0.5]
  if (pol.mode === 'altHiLo'){
    const sign = (slot % 2 === 0) ? +1 : -1;
    S = Math.max(0.25, Math.min(0.97, S + sign * (0.08 + 0.04*r)));
    V = Math.max(0.20, Math.min(0.98, V + sign * (0.05 + 0.03*r)));
    // empujón extra en H para ΔH grande
    H += sign * (18 + 8*r); // grados
  }else if (pol.mode === 'jitter'){
    // irregularidad leve, sin crear foco
    H += (8 * r);
    S = Math.max(0.25, Math.min(0.97, S + 0.04*r));
    V = Math.max(0.20, Math.min(0.98, V + 0.03*r));
  }else if (pol.mode === 'narrow'){
    // span ya lo hace; micro-variación para evitar coincidencias exactas
    H += (4 * r);
  }

  // 5) Luma objetivo (ajuste MUY leve sobre V manteniendo S/H)
  //    — calculamos luma actual y acercamos a pol.luma
  {
    const [rC,gC,bC] = _sc_hsv2rgb(H, Math.max(0,Math.min(1,S)), Math.max(0,Math.min(1,V)));
    const Y = _sc_lumaRGB(rC, gC, bC);
    const dY = pol.luma - Y;
    // ganancia pequeña para no “romper” la paleta (máx ±0.06 aprox)
    V = Math.max(0.20, Math.min(0.98, V + 0.20 * dY));
  }

  // 6) Volver a ÍNDICES (clamp a tu rejilla discreta)
  const Hn = _sc_HtoIdx(H);
  const Sn = _sc_StoIdx(S);
  const Vn = _sc_VtoIdx(V);
  return [Hn, Sn, Vn];
}

export const PATTERNS = {
  1: (sig, seed, i) => {
    const base = (sig.reduce((a,v)=>a+v,0) + seed*7) % 144;
    const hIdx = (base + (i%12)*6) % 144;
    const sIdx = (sig[3] + seed + i) % 12;
    const vIdx = (sig[1] + sig[4] + i) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 1, i, seed);
  },

  2: (sig, seed, i) => {
    const base = (sig[0]*17 + seed*5) % 144;
    const hIdx = (base + ((i%12)*48)) % 144;
    const sIdx = (sig[1] + i*3 + seed) % 12;
    const vIdx = (sig[2]*2 + i + seed) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 2, i, seed);
  },

  3: (s,seed,i) => {
    const b = (s[2]*13 + seed*5 + i*11) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[0] + i*2 + seed) % 12;
    const vIdx = (s[1] + s[3] + i)   % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 3, i, seed);
  },

  4: (s,seed,i) => {
    const b = (s[1]*15 + seed*3 + i*7) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[0] + seed + i) % 12;
    const vIdx = (s[2] + s[4] + seed + i) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 4, i, seed);
  },

  5: (s,seed,i) => {
    const b = (i*31 + s[3]*13 + seed*5) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[1] + seed + i) % 12;
    const vIdx = (s[2] + seed + i) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 5, i, seed);
  },

  6: (s,seed,i) => {
    const b = (s[1]*31 + seed*13 + i*7) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[2] + seed + i) % 12;
    const vIdx = (s[3] + s[4] + seed + i) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 6, i, seed);
  },

  7: (s,seed,i) => {
    const b = (s[0]*11 + seed*3 + i*37) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[2] + seed + i*2) % 12;
    const vIdx = (s[4] + s[1]*2 + seed + i) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 7, i, seed);
  },

  8: (s,seed,i) => {
    const r = Math.abs(s[4]-s[0]) + Math.abs(s[3]-s[1]) + s[2];
    const b = (r*13 + seed*7) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[1]*3 + seed + i*2) % 12;
    const vIdx = (s[3] + i*5 + seed*3) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 8, i, seed);
  },

  9: (s,seed,i) => {
    const b = (s[4]*12 + seed*7 + i*11) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[2] + seed + i) % 12;
    const vIdx = (s[1] + seed + i*2) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 9, i, seed);
  },

 10: (s,seed,i) => {
    const b = (seed*5 + s.reduce((a,v)=>a+v,0)*3 + i*7) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[2] + seed + i) % 12;
    const vIdx = (s[4]*2 + seed + i*3) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 10, i, seed);
  },

 11: (s,seed,i) => {
    const b = (s[3]*13 + seed*11 + i*7) % 144;
    const hIdx = (b + i*PHI_H) % 144;
    const sIdx = (s[0] + seed + i)   % 12;
    const vIdx = (s[1] + seed + i*2) % 12;
    return conditionHSV(hIdx, sIdx, vIdx, 11, i, seed);
  }
};
