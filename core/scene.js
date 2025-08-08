// core/scene.js
// Invariantes globales puros para la escena

import { lehmerRank, mappingRank } from './permutations.js';

/**
 * sceneSeed = (37·sumR + 101·sumR2 + 53·mRank) mod 360
 * perms: array de arrays [P1..P5]; m: mapping [m0..m4]
 */
export function computeSceneSeedFrom(perms, m) {
  let sumR = 0, sumR2 = 0;
  perms.forEach(pa => {
    const r = lehmerRank(pa);
    sumR  += r;
    sumR2 += r * r;
  });
  const mRank = mappingRank(m);
  return (37 * sumR + 101 * sumR2 + 53 * mRank) % 360;
}

/**
 * S = ( Σ (P_{mx}+P_{my}+P_{mz}) ) mod 125
 * m: mapping [forma,color,x,y,z]
 */
export function computeGlobalS(perms, m) {
  const mx = m[2], my = m[3], mz = m[4];
  let S = 0;
  perms.forEach(p => { S += p[mx] + p[my] + p[mz]; });
  return S % 125;
}
