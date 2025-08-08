// core/color.js
// Conversión de color + lattice HSV + contraste (puro, sin Three.js)

export const H_STEPS = 144; // 360/2.5°
export const S_LEVELS = Array.from({length:12}, (_,i)=> 0.25 + 0.72*i/11); // 0.25–0.97
export const V_LEVELS = Array.from({length:12}, (_,i)=> 0.20 + 0.75*i/11); // 0.20–0.95
export const DELTA_E_BG_MIN = 22;

/** RGB(0..255) -> HSV([0..360),0..1,0..1) */
export function rgbToHsv(r, g, b) {
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0;
  if (d) {
    if (max===r) h=((g-b)/d)%6;
    else if (max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h*=60; if (h<0) h+=360;
  }
  const s = max ? d/max : 0, v = max;
  return [h, s, v];
}

/** HSV([0..360),0..1,0..1) -> RGB(0..255) */
export function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs((h/60)%2 - 1));
  const m = v - c;
  let [r,g,b] = [0,0,0];
  if (h < 60)      [r,g,b] = [c,x,0];
  else if (h <120) [r,g,b] = [x,c,0];
  else if (h <180) [r,g,b] = [0,c,x];
  else if (h <240) [r,g,b] = [0,x, c];
  else if (h <300) [r,g,b] = [x,0, c];
  else             [r,g,b] = [c,0, x];
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}

/** {h,s,v} -> "#rrggbb" */
export function hsvToHex({h,s,v}) {
  const [r,g,b] = hsvToRgb(h,s,v);
  return hexFromRgb([r,g,b]);
}

/** "#rrggbb" -> [r,g,b] */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [0,0,0];
  const n = parseInt(m[1], 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}

/** [r,g,b] -> "#rrggbb" */
export function hexFromRgb(rgb) {
  const toHex = n => n.toString(16).padStart(2, '0');
  return '#' + toHex(rgb[0]) + toHex(rgb[1]) + toHex(rgb[2]);
}

/** Lab aproximado desde RGB(0..255) (con linearización estándar). */
export function rgbToLab(r,g,b) {
  let [R,G,B] = [r,g,b].map(v=>{
    v/=255;
    return v>0.04045 ? Math.pow((v+0.055)/1.055, 2.4) : v/12.92;
  });
  R*=100; G*=100; B*=100;
  const x=R*0.4124+G*0.3576+B*0.1805;
  const y=R*0.2126+G*0.7152+B*0.0722;
  const z=R*0.0193+G*0.1192+B*0.9505;
  const [xn,yn,zn]=[95.047,100.0,108.883];
  const f = t => t>0.008856 ? Math.cbrt(t) : (7.787*t)+16/116;
  const [fx,fy,fz] = [x/xn,y/yn,z/zn].map(f);
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}

/** ∆E CIE76 entre dos Lab */
export function deltaE(lab1, lab2) {
  return Math.sqrt(
    (lab1[0]-lab2[0])**2 +
    (lab1[1]-lab2[1])**2 +
    (lab1[2]-lab2[2])**2
  );
}

/** idx discretos -> HSV real del lattice 144×12×12 */
export function idxToHSV(hIdx, sIdx, vIdx) {
  const h = ((hIdx % H_STEPS) + H_STEPS) % H_STEPS;
  const s = S_LEVELS[ ((sIdx % 12) + 12) % 12 ];
  const v = V_LEVELS[ ((vIdx % 12) + 12) % 12 ];
  return { h: h * 360 / H_STEPS, s, v };
}

/**
 * Ajusta V de un RGB hasta alcanzar ∆E >= deltaEMin vs un fondo (bgRgb).
 * rgb/bgRgb: [r,g,b] 0..255. Devuelve [r,g,b] corregido.
 */
export function ensureContrastRGB(rgb, bgRgb, deltaEMin = DELTA_E_BG_MIN) {
  const bgLab = rgbToLab(...bgRgb);
  let [h,s,v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  let tries = 0;
  let out = rgb.slice();
  while (deltaE(rgbToLab(...out), bgLab) < deltaEMin && tries < 24) {
    v = (tries % 2) ? Math.max(0, v - 0.04) : Math.min(1, v + 0.04);
    out = hsvToRgb(h, s, v);
    tries++;
  }
  return out;
}
