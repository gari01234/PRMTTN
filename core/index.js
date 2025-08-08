// core/index.js
import * as permutations from './permutations.js';
import * as signature    from './signature.js';
import * as scene        from './scene.js';
import * as color        from './color.js';

export * from './permutations.js';
export * from './signature.js';
export * from './scene.js';
export * from './color.js';

const core = { ...permutations, ...signature, ...scene, ...color };

// Exponer también como ventana global defensiva (sin romper módulos).
if (typeof window !== 'undefined') {
  window.core = core;
}
