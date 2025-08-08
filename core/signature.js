// core/signature.js
// Firma y rango (puras)

/** Firma determinista F=[f1..f5] donde fi = a[i] + a[i+1 mod n]. */
export function computeSignature(a) {
  const s = [];
  for (let i = 0; i < a.length; i++) s.push(a[i] + a[(i + 1) % a.length]);
  return s;
}

/** Rango (max - min) de una firma. */
export function computeRange(sig) {
  return Math.max(...sig) - Math.min(...sig);
}
