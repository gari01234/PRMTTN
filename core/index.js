// core/index.js — puente de compatibilidad: expone en window
import * as Col from './colors.js';
import * as Perm from './permutations.js';
import * as Scn from './scene.js';
import { PATTERNS, PHI_S, PHI_V, PHI_H } from './patterns.js';

const core = { ...Col, ...Perm, ...Scn, PATTERNS, PHI_S, PHI_V, PHI_H };
window.core = core;

// Compatibilidad “suave”: también colgamos algunos nombres comunes en window
// (no obliga a tocar tu index.html todavía)
[
  'rgbToHsv','hsvToRgb','hsvToHex','hexToRgb','rgbToLab','deltaE','idxToHSV','ensureContrastRGB',
  'getPermutations','getAttributeMappings','lehmerRank','mappingRank','computeSignature','computeRange',
  'computeSceneSeedFrom','computeGlobalS',
].forEach(k => { if (!window[k]) window[k] = core[k]; });

if (!window.PATTERNS) window.PATTERNS = PATTERNS;
if (!window.PHI_S) window.PHI_S = PHI_S;
if (!window.PHI_V) window.PHI_V = PHI_V;
if (!window.PHI_H) window.PHI_H = PHI_H;
