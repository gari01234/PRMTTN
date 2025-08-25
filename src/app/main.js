// src/app/main.js
import * as THREE from 'three';
import { state } from './state.js';
import { createEngine } from '../engines/index.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
const renderer = new THREE.WebGLRenderer();
const clock = new THREE.Clock();

let engine = createEngine(state.engine);
engine.attach(scene);

export function selectEngine(name) {
  engine.detach(scene);
  engine = createEngine(name);
  engine.attach(scene);
  state.engine = name;
}

function render() {
  if (engine.build) engine.build(state.H);
  if (engine.tick) engine.tick(clock.getDelta());
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
render();

export { scene };
