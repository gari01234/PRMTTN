// src/input/keyboard.js
import { selectEngine } from '../app/main.js';
import { state } from '../app/state.js';

window.addEventListener('keydown', (ev) => {
  // Motores
  if (ev.code === 'Digit1') selectEngine('BUILD');
  if (ev.code === 'Digit2') selectEngine('KEPLR');
  if (ev.code === 'Digit3') selectEngine('KEPLR');
  if (ev.code === 'Digit4') selectEngine('RAPHI');

  // Control H (0..1)
  if (ev.code === 'BracketLeft') { state.H = Math.max(0, state.H - 0.2); }
  if (ev.code === 'BracketRight') { state.H = Math.min(1, state.H + 0.2); }
});
