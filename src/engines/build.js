// src/engines/build.js
// Placeholder Build engine used for testing engine selection.
import * as THREE from 'three';

export default class BuildEngine {
  constructor() {
    this.name = 'BUILD';
    this.group = new THREE.Group();
  }
  build() { return this.group; }
  tick() {}
  attach(scene) { scene.add(this.group); }
  detach(scene) { scene.remove(this.group); }
}
