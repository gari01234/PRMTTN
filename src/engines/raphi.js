// src/engines/raphi.js
// Motor RAPHI – R.A.P. 1:ϕ:ϕⁿ (n∈{0,1,2,3}) + "King's Chamber" + caso especial 1:1:2
// Colores y estilo acordes a BUiLD/KEPLR.

import * as THREE from 'three';

const PHI = (1 + Math.sqrt(5)) / 2;
const COLORS = {
  edges: 0x111111,
  body: 0xf3f3f3,
  sqrt2: 0x0077ff,  // Azul
  sqrt5: 0xff7700,  // Naranja
  sqrt6: 0x00aa55,  // Verde
  chamber: 0xaa0033 // Rojizo translúcido
};

// Utilidad: sprite de texto sin dependencias externas
function textSprite(text, scale = 0.015) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pad = 16;
  ctx.font = '48px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 64 + pad * 2;
  canvas.width = w; canvas.height = h;
  ctx.font = '48px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillStyle = '#000000'; ctx.globalAlpha = 0.75;
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(w * scale, h * scale, 1);
  spr.renderOrder = 9999;
  return spr;
}

// Crea una caja con aristas y material translúcido
function makeBox(w, h, d) {
  const group = new THREE.Group();
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.body, metalness: 0.0, roughness: 0.9, transparent: true, opacity: 0.16
  });
  const mesh = new THREE.Mesh(geom, mat);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geom),
    new THREE.LineBasicMaterial({ color: COLORS.edges, linewidth: 1 })
  );
  group.add(mesh, edges);
  return { group, mesh, edges };
}

// Línea 3D con color
function makeLine(a, b, color, dashed = false) {
  const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
  const mat = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 0.06, gapSize: 0.03 })
    : new THREE.LineBasicMaterial({ color });
  const line = new THREE.Line(geom, mat);
  if (dashed) line.computeLineDistances();
  return line;
}

// Diagonales de cara para un rectángulo centrado (w × h) en un plano dado
function faceDiagonals(plane, w, h, color) {
  const g = new THREE.Group();
  const x = w / 2, y = h / 2;
  const pts = {
    XY: [new THREE.Vector3(-x, -y, 0), new THREE.Vector3(x, y, 0),
         new THREE.Vector3(-x, y, 0),  new THREE.Vector3(x, -y, 0)],
    XZ: [new THREE.Vector3(-x, 0, -y), new THREE.Vector3(x, 0, y),
         new THREE.Vector3(-x, 0, y),  new THREE.Vector3(x, 0, -y)],
    YZ: [new THREE.Vector3(0, -x, -y), new THREE.Vector3(0, x, y),
         new THREE.Vector3(0, -x, y),  new THREE.Vector3(0, x, -y)]
  };
  const p = pts[plane];
  g.add(makeLine(p[0], p[1], color), makeLine(p[2], p[3], color));
  return g;
}

// Diagonal espacial de una caja centrada
function spaceDiagonal(w, h, d, color) {
  const a = new THREE.Vector3(-w / 2, -h / 2, -d / 2);
  const b = new THREE.Vector3(w / 2, h / 2, d / 2);
  return makeLine(a, b, color);
}

// "King's Chamber" (base 1×2, altura √5/2) embebida y centrada en XZ
function kingsChamber(scale = 1, raise = 0) {
  const A = 1 * scale;
  const baseW = A;           // 1
  const baseD = 2 * A;       // 2
  const baseH = (Math.sqrt(5) / 2) * A; // √5/2 ≈ 1.118
  const grp = new THREE.Group();
  const { group } = makeBox(baseW, baseH, baseD);
  group.traverse(o => {
    if (o.material && o.material.color) {
      o.material.color.setHex(COLORS.chamber);
      o.material.opacity = 0.18;
    }
    if (o.material && o.material.color === undefined && o.material.color !== null) {
      o.material = new THREE.LineBasicMaterial({ color: COLORS.chamber });
    }
  });
  group.position.y = -baseH / 2 + raise; // apoyar en el plano Y=0 si raise=baseH/2
  grp.add(group);

  // Diagonal "grande" DB' = 5/2 (con A=1) – la trazamos y la etiquetamos
  const diag = spaceDiagonal(baseW, baseH, baseD, COLORS.chamber);
  grp.add(diag);
  const tag = textSprite('DB′ = 5/2');
  tag.position.set(0, baseH / 2 + 0.08 * scale, 0);
  grp.add(tag);

  // Rectángulos diagonales característicos
  // ACCA′ = 2 (en cara XZ), A′B′CD′ = 4/3 (en cara XZ perpendicular), AB′C′D = √21/2 (en cara YZ)
  const r1 = faceDiagonals('XZ', baseW, baseD, COLORS.chamber);
  r1.position.y = 0; grp.add(r1);
  const r2 = faceDiagonals('XZ', baseW, baseD, COLORS.chamber);
  r2.rotation.y = Math.PI / 2; grp.add(r2);
  const r3 = faceDiagonals('YZ', baseH, baseD, COLORS.chamber);
  grp.add(r3);

  return { group: grp, dims: { baseW, baseH, baseD } };
}

// Selección discreta por H (mismo patrón que KEPLR)
function pickVariant(H) {
  const bins = ['1:phi:1', '1:phi:phi', '1:phi:phi2', '1:phi:phi3', '1:1:2'];
  const i = Math.min(bins.length - 1, Math.max(0, Math.floor(H * bins.length)));
  return bins[i];
}

export default class RaphiEngine {
  constructor() {
    this.name = 'RAPHI';
    this.group = new THREE.Group();
    this._variant = null;
    this._dims = null;
  }

  // Construye o actualiza en función de H∈[0,1].
  build(H = 0.0) {
    const variant = pickVariant(H);
    if (variant === this._variant) return this.group;

    // limpiar grupo
    while (this.group.children.length) this.group.remove(this.group.children[0]);

    // dimensiones según variante (lado corto = 1)
    let w = 1, h = PHI, d = 1;
    if (variant === '1:phi:1') { w = 1; h = PHI; d = 1; }
    if (variant === '1:phi:phi') { w = 1; h = PHI; d = PHI; }
    if (variant === '1:phi:phi2') { w = 1; h = PHI; d = PHI * PHI; }
    if (variant === '1:phi:phi3') { w = 1; h = PHI; d = PHI * PHI * PHI; }
    if (variant === '1:1:2') { w = 1; h = 1; d = 2; }

    // Caja base
    const { group: box } = makeBox(w, h, d);
    this.group.add(box);

    // Activaciones según el preset
    if (variant === '1:phi:1') {
      // Cuadrado 1×1 → √2 en cara XZ
      const diags = faceDiagonals('XZ', w, d, COLORS.sqrt2);
      this.group.add(diags);
      const tag = textSprite('√2');
      tag.position.set(0, -h / 2 - 0.08, 0);
      this.group.add(tag);

      // Diagonal de cara 1×ϕ
      const diag14 = faceDiagonals('XY', w, h, COLORS.sqrt5);
      diag14.rotation.z = 0;
      this.group.add(diag14);
    }

    if (variant === '1:phi:phi') {
      // Cara ϕ×ϕ (cuadrado áureo) → diagonales √2·ϕ en plano YZ
      const dphi = faceDiagonals('YZ', h, d, COLORS.sqrt2);
      this.group.add(dphi);
      const tag = textSprite('√2 · ϕ');
      tag.position.set(0, 0, d / 2 + 0.08);
      this.group.add(tag);
    }

    if (variant === '1:phi:phi2') {
      // "Golden Solid" + Cámara del Rey embebida
      const kc = kingsChamber(1, h / 2); // apoyar en la base interior (Y= -h/2) → raise=h/2 centra en el volumen
      this.group.add(kc.group);
    }

    if (variant === '1:phi:phi3') {
      // Subdivisiones áureas internas (Fig. 53): planos a razón ϕ a lo largo de Z
      const grp = new THREE.Group();
      const t = d / PHI; // corte 1/ϕ a partir del borde posterior
      const z1 = -d / 2 + t, z2 = d / 2 - t;
      grp.add(makeLine(new THREE.Vector3(-w / 2, -h / 2, z1), new THREE.Vector3(w / 2, -h / 2, z1), COLORS.sqrt5, true));
      grp.add(makeLine(new THREE.Vector3(-w / 2, h / 2, z1), new THREE.Vector3(w / 2, h / 2, z1), COLORS.sqrt5, true));
      grp.add(makeLine(new THREE.Vector3(-w / 2, -h / 2, z2), new THREE.Vector3(w / 2, -h / 2, z2), COLORS.sqrt5, true));
      grp.add(makeLine(new THREE.Vector3(-w / 2, h / 2, z2), new THREE.Vector3(w / 2, h / 2, z2), COLORS.sqrt5, true));
      this.group.add(grp);
    }

    if (variant === '1:1:2') {
      // Diagonales notables explícitas: √2 (caras 1×1), √5 (caras 1×2), √6 (diagonal espacial)
      const d1 = faceDiagonals('XY', w, h, COLORS.sqrt2);
      this.group.add(d1);
      const d2 = faceDiagonals('XZ', w, d, COLORS.sqrt5);
      this.group.add(d2);
      const d3 = spaceDiagonal(w, h, d, COLORS.sqrt6);
      this.group.add(d3);

      const t1 = textSprite('√2'); t1.position.set(0, h / 2 + 0.08, -d / 2); this.group.add(t1);
      const t2 = textSprite('√5'); t2.position.set(0, -h / 2 - 0.08, 0); this.group.add(t2);
      const t3 = textSprite('√6'); t3.position.set(w / 2 + 0.08, 0, d / 2 + 0.08); this.group.add(t3);

      // Toggle de "Cámara del Rey (derivada)": colocamos también la cámara dentro, porque encaja exactamente
      const kc = kingsChamber(1, h / 2);
      this.group.add(kc.group);
    }

    this._variant = variant;
    this._dims = { w, h, d };
    return this.group;
  }

  // Animación suave (igual criterio que KEPLR/BUiLD)
  tick(dt = 0.016) {
    this.group.rotation.y += 0.25 * dt;
    this.group.rotation.x += 0.12 * dt;
  }

  // API homogénea con el resto de motores
  attach(scene) { scene.add(this.group); }
  detach(scene) { scene.remove(this.group); }
}

