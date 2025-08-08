// core/permutations.js
// Utilidades puras de permutaciones y rankings (sin Three.js)

/** Genera todas las permutaciones de un array (recursivo). */
export function getPermutations(arr) {
  if (arr.length === 1) return [arr.slice()];
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    const rem = arr.slice(0, i).concat(arr.slice(i + 1));
    getPermutations(rem).forEach(p => out.push([c].concat(p)));
  }
  return out;
}

/** Permutaciones de [0,1,2,3,4] para mappings de atributos. */
export function getAttributeMappings(base = [0,1,2,3,4]) {
  return getPermutations(base);
}

/** Lehmer rank genérico para una permutación p (valores distintos). */
export function lehmerRank(p) {
  let r = 0;
  const n = p.length;
  // factorial iterativo
  const fact = [1];
  for (let i = 1; i <= n; i++) fact[i] = fact[i - 1] * i;
  for (let i = 0; i < n; i++) {
    let c = 0;
    for (let j = i + 1; j < n; j++) if (p[j] < p[i]) c++;
    r += c * fact[n - 1 - i];
  }
  return r;
}

/** Rank del mapping [m0..m4] usando Lehmer rank sobre [m_i+1] (1..5). */
export function mappingRank(m) {
  const arr = [m[0]+1, m[1]+1, m[2]+1, m[3]+1, m[4]+1];
  return lehmerRank(arr);
}
