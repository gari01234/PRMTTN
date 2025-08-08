// core/permutations.js — utilidades puras de permutaciones/ranks
export const FACT=[1,1,2,6,24,120];

export function getPermutations(arr){
  if(arr.length===1) return [arr];
  let res=[]; for(let i=0;i<arr.length;i++){
    const c=arr[i], rem=arr.slice(0,i).concat(arr.slice(i+1));
    for(const p of getPermutations(rem)) res.push([c].concat(p));
  }
  return res;
}

export function getAttributeMappings(a){
  if(a.length===1) return [a];
  let res=[]; for(let i=0;i<a.length;i++){
    const c=a[i], rem=a.slice(0,i).concat(a.slice(i+1));
    for(const m of getAttributeMappings(rem)) res.push([c].concat(m));
  }
  return res;
}

export function lehmerRank(p){
  let r=0;
  for(let i=0;i<p.length;i++){
    let c=0;
    for(let j=i+1;j<p.length;j++) if(p[j]<p[i]) c++;
    r+=c*FACT[p.length-1-i];
  }
  return r;
}

export function mappingRank(m){
  const arr = [m[0]+1, m[1]+1, m[2]+1, m[3]+1, m[4]+1];
  return lehmerRank(arr);
}

export function computeSignature(a){
  let s=[]; for(let i=0;i<a.length;i++) s.push(a[i]+a[(i+1)%a.length]); return s;
}

export function computeRange(sig){
  return Math.max(...sig)-Math.min(...sig);
}
