// core/scene.js — invariantes de escena y helpers numéricos
import { lehmerRank, mappingRank } from './permutations.js';

export function computeSceneSeedFrom(perms, m){
  let sumR = 0, sumR2 = 0;
  perms.forEach(pa=>{
    const r = lehmerRank(pa);
    sumR  += r;
    sumR2 += r*r;
  });
  const mRank = mappingRank(m);
  return (37*sumR + 101*sumR2 + 53*mRank) % 360;
}

export function computeGlobalS(perms, m){
  const mx = m[2], my = m[3], mz = m[4];
  let S = 0;
  perms.forEach(p=>{
    S += p[mx] + p[my] + p[mz];
  });
  return S % 125;
}

export function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
export function mapRangeToSpeed(r,mn,mx){return 0.001 + (r-mn)*(0.005-0.001)/(mx-mn);}
