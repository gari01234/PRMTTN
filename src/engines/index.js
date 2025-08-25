// src/engines/index.js
// Registry of available engines.
import KeplrEngine from './keplr.js';
import BuildEngine from './build.js';
import RaphiEngine from './raphi.js';

export const ENGINES = {
  KEPLR: KeplrEngine,
  BUILD: BuildEngine,
  RAPHI: RaphiEngine
};

export function createEngine(name) {
  const Table = { KEPLR: KeplrEngine, BUILD: BuildEngine, RAPHI: RaphiEngine };
  return new (Table[name] || KeplrEngine)();
}
