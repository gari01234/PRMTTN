// core/colors.js — utilidades puras de color (sin Three.js)
export function rgbToHsv(r,g,b){
  r/=255; g/=255; b/=255;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0;
  if(d){
    if(max===r) h=((g-b)/d)%6;
    else if(max===g) h=(b-r)/d+2;
    else h=(r-g)/d+4;
    h*=60; if(h<0) h+=360;
  }
  const s=max?d/max:0, v=max;
  return [h,s,v];
}

export function hsvToRgb(h,s,v){
  h = h % 360;
  const c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c;
  let [r,g,b]=[0,0,0];
  if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;}
  else if(h<180){g=c;b=x;} else if(h<240){g=x;b=c;}
  else if(h<300){r=x;b=c;} else {r=c;b=x;}
  return [(r+m)*255,(g+m)*255,(b+m)*255].map(v=>Math.round(v));
}

export function hsvToHex({h,s,v}){
  const [r,g,b] = hsvToRgb(h,s,v);
  const toHex = (n)=>'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);
  // usamos THREE fuera; aquí devolvemos string #rrggbb sin depender de THREE
  return toHex();
}

export function hexToRgb(hex){
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = parseInt(m[1],16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}

// Lab rápido + ΔE CIE76 — idénticos a tu código
export function rgbToLab(r,g,b){
  const xyz=[r/255,g/255,b/255].map(v=>{
    v=v>0.04045?((v+0.055)/1.055)**2.4:v/12.92;
    return v*100;
  });
  const x=xyz[0]*0.4124+xyz[1]*0.3576+xyz[2]*0.1805;
  const y=xyz[0]*0.2126+xyz[1]*0.7152+xyz[2]*0.0722;
  const z=xyz[0]*0.0193+xyz[1]*0.1192+xyz[2]*0.9505;
  const xyzN=[95.047,100.0,108.883];
  const f= t=> t>0.008856 ? t**(1/3) : (7.787*t)+16/116;
  const [fx,fy,fz]=[x,y,z].map((v,i)=>f(v/xyzN[i]));
  return [116*fy-16, 500*(fx-fy), 200*(fy-fz)];
}

export function deltaE(lab1,lab2){
  return Math.sqrt(
    (lab1[0]-lab2[0])**2+
    (lab1[1]-lab2[1])**2+
    (lab1[2]-lab2[2])**2
  );
}

// Lattice HSV 144×12×12 — índices → HSV reales
export const H_STEPS  = 144;
export const S_LEVELS = [...Array(12)].map((_,i)=>0.25 + 0.72*i/11);
export const V_LEVELS = [...Array(12)].map((_,i)=>0.20 + 0.75*i/11);

export function idxToHSV(hIdx,sIdx,vIdx){
  const h = ((hIdx%H_STEPS)+H_STEPS)%H_STEPS;
  return {
    h: h * 360 / H_STEPS,
    s: S_LEVELS[((sIdx%12)+12)%12],
    v: V_LEVELS[((vIdx%12)+12)%12]
  };
}

// Contraste mínimo contra fondo — misma lógica que tu ensureContrastRGB
export const ΔE_BG_MIN = 22;
export function ensureContrastRGB(rgb, bgRgb, deltaEMin = ΔE_BG_MIN){
  let [h,s,v] = rgbToHsv(...rgb);
  let tries = 0;
  while (deltaE(rgbToLab(...rgb), rgbToLab(...bgRgb)) < deltaEMin && tries < 24){
    v = (tries % 2) ? Math.max(0, v - 0.04) : Math.min(1, v + 0.04);
    rgb = hsvToRgb(h, s, v);
    tries++;
  }
  return rgb;
}
