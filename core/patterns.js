// core/patterns.js — PATTERNS y constantes asociadas (tal cual)
export const PHI_S = 5;
export const PHI_V = 7;
export const PHI_H = 89;

export const PATTERNS = {
  1:(s,seed,i)=>{const b=(s.reduce((a,v)=>a+v,0)+seed*7)%144; const h=(b+(i%12)*6)%144; return [h,(s[3]+seed+i)%12,(s[1]+s[4]+i)%12];},
  2:(s,seed,i)=>{const b=(s[0]*17+seed*5)%144; const h=(b+((i%12)*48))%144; return [h,(s[1]+i*3+seed)%12,(s[2]*2+i+seed)%12];},
  3:(s,seed,i)=>{const b=(s[2]*13+seed*5+i*11)%144; return [(b+i*89)%144,(s[0]+i*2+seed)%12,(s[1]+s[3]+i)%12];},
  4:(s,seed,i)=>{const b=(s[1]*15+seed*3+i*7)%144;  return [(b+i*89)%144,(s[0]+seed+i)%12,(s[2]+s[4]+seed+i)%12];},
  5:(s,seed,i)=>{const b=(i*31+s[3]*13+seed*5)%144; return [(b+i*89)%144,(s[1]+seed+i)%12,(s[2]+seed+i)%12];},
  6:(s,seed,i)=>{const b=(s[1]*31+seed*13+i*7)%144; return [(b+i*89)%144,(s[2]+seed+i)%12,(s[3]+s[4]+seed+i)%12];},
  7:(s,seed,i)=>{const b=(s[0]*11+seed*3+i*37)%144; return [(b+i*89)%144,(s[2]+seed+i*2)%12,(s[4]+s[1]*2+seed+i)%12];},
  8:(s,seed,i)=>{const r=Math.abs(s[4]-s[0])+Math.abs(s[3]-s[1])+s[2]; const b=(r*13+seed*7)%144;
                 return [(b+i*89)%144,(s[1]*3+seed+i*2)%12,(s[3]+i*5+seed*3)%12];},
  9:(s,seed,i)=>{const b=(s[4]*12+seed*7+i*11)%144; return [(b+i*89)%144,(s[2]+seed+i)%12,(s[1]+seed+i*2)%12];},
 10:(s,seed,i)=>{const b=(seed*5+s.reduce((a,v)=>a+v,0)*3+i*7)%144;
                 return [(b+i*89)%144,(s[2]+seed+i)%12,(s[4]*2+seed+i*3)%12];},
 11:(s,seed,i)=>{const b=(s[3]*13+seed*11+i*7)%144; return [(b+i*89)%144,(s[0]+seed+i)%12,(s[1]+seed+i*2)%12];}
};
