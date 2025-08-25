// src/engines/keplr.js
// Placeholder Keplr engine used for testing engine selection.
import * as THREE from 'three';

export default class KeplrEngine {
  constructor() {
    this.name = 'KEPLR';
    this.group = new THREE.Group();
  }
  build() { return this.group; }
  tick() {}
  attach(scene) { scene.add(this.group); }
  detach(scene) { scene.remove(this.group); }
}
