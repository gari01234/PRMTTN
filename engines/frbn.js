// engines/frbn.js
// Motor FRBN (deterministic Ganzfeld) como módulo aislado.
// No requiere imports: usa THREE y el estado desde window.* para no romper nada existente.

(function(){
  const THREE = window.THREE;

  class FRBNEngine {
    constructor(){
      this.skySphere = null;
      this.isFRBN = false;
    }

    /** Crea el full-screen quad con el shader (idéntico al original, con micro-dither). */
    initSkySphere(){
      if (this.skySphere || !THREE || !window.scene) return;

      const geo = new THREE.PlaneGeometry(2, 2);
      const mat = new THREE.ShaderMaterial({
        uniforms : {
          u_count     : { value: 0 },
          u_colors    : { value: Array(12).fill(new THREE.Color(0x000000)) },
          time        : { value: 0 },
          u_rate      : { value: 0.04 },
          u_ditherAmp : { value: 0.00095 } // ~1/1024
        },
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest : false,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
          }`,
        fragmentShader: `
          #ifdef GL_ES
          precision highp float;
          #endif

          uniform int   u_count;
          uniform vec3  u_colors[12];
          uniform float time;
          uniform float u_rate;
          uniform float u_ditherAmp;
          varying vec2  vUv;

          float ign(vec2 p, float t){
            const vec3 a = vec3(0.06711056, 0.00583715, 52.9829189);
            return fract(a.z * fract(dot(p, a.xy) + t * a.y));
          }
          vec3 blueNoise(vec2 pix, float t){
            float n1 = ign(pix,           t);
            float n2 = ign(pix + vec2(113.1,  1.7), t + 17.0);
            float n3 = ign(pix + vec2( 27.0, 61.7), t + 31.0);
            n1 = (n1 + ign(pix*1.07+3.1, t*1.3)) * 0.5;
            return vec3(n1, n2, n3) - 0.5;
          }

          void main() {
            float t = time * u_rate;
            float idx = fract(t) * float(u_count);
            int   i   = int(floor(idx)) % u_count;
            int   j   = (i + 1) % u_count;
            float f   = fract(idx);

            vec3 col = mix(u_colors[i], u_colors[j], f);

            vec2 cUv = vUv - 0.5;
            float d  = length(cUv) * 2.0;
            float fog = pow(1.0 - smoothstep(0.0, 1.0, d), 2.0);
            col += 0.10 * fog;

            vec3 dither = blueNoise(gl_FragCoord.xy, time * 60.0);
            col += u_ditherAmp * dither;

            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
          }`
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      mesh.visible = false;

      this.skySphere = mesh;
      window.scene.add(this.skySphere);
    }

    /** Recoge y normaliza colores deterministas desde permutationGroup (idéntico a tu lógica). */
    collectSceneColors(){
      const pg = window.permutationGroup;
      if (!pg || !THREE) return [new THREE.Color(0xffffff)];

      // 1) Colores base de los meshes
      const raw = [];
      pg.traverse(o => { if (o.isMesh && o.material && o.material.color) raw.push(o.material.color.clone()); });

      // 2) Empuja a S≥0.60 y V≥0.80
      const boosted = raw.map(c=>{
        const [h,s0,v0] = window.rgbToHsv(c.r*255, c.g*255, c.b*255);
        const s = Math.max(s0, 0.60);
        const v = Math.max(v0, 0.80);
        const [R,G,B] = window.hsvToRgb(h,s,v);
        return new THREE.Color(R/255,G/255,B/255);
      });

      // 3) Uniq por ΔH≥18°
      const uniq = [];
      boosted.forEach(c=>{
        const [h] = window.rgbToHsv(c.r*255,c.g*255,c.b*255);
        if(!uniq.some(u=>{
          const [hu] = window.rgbToHsv(u.r*255,u.g*255,u.b*255);
          return Math.abs(hu-h) < 18;
        })){
          uniq.push(c);
        }
      });

      // 4) Completa con rueda de color si faltan
      const fallback = [0,60,120,180,240,300].map(h=>{
        const [R,G,B] = window.hsvToRgb(h,0.75,0.85);
        return new THREE.Color(R/255,G/255,B/255);
      });
      while(uniq.length < 6) uniq.push( fallback[uniq.length] );

      return uniq.slice(0,8);
    }

    /** Actualiza los uniforms del shader según la escena (paleta + velocidad media). */
    buildGanzfeld(){
      if (!this.skySphere) this.initSkySphere();
      if (!this.skySphere) return;

      const cols = this.collectSceneColors();
      const n    = cols.length;
      const mat  = this.skySphere.material;
      mat.uniforms.u_count.value = n;
      for(let i=0;i<12;i++){
        mat.uniforms.u_colors.value[i] = cols[i % n];
      }

      // velocidad promedio de rotación
      let sum=0, cnt=0;
      const pg = window.permutationGroup;
      if (pg) {
        pg.traverse(o=>{
          if(o.isMesh && o.userData && o.userData.rotationSpeed){
            sum += o.userData.rotationSpeed;
            cnt ++;
          }
        });
      }
      const avg = cnt ? sum/cnt : 0.002;
      mat.uniforms.u_rate.value = avg * 1;
    }

    enter(){
      if (!this.skySphere) this.initSkySphere();
      if (!this.skySphere) return;

      // exclusividad (como en tu código original)
      if (!this.isFRBN && window.isOFFNNG && typeof window.toggleOFFNNG === 'function') window.toggleOFFNNG();
      if (!this.isFRBN && window.isLCHT  && typeof window.toggleLCHT   === 'function') window.toggleLCHT();

      this.isFRBN = true;
      this.buildGanzfeld();

      this.skySphere.visible = true;
      if (window.cubeUniverse)      window.cubeUniverse.visible = false;
      if (window.permutationGroup)  window.permutationGroup.visible = false;
      if (window.lichtGroup)        window.lichtGroup.visible = false;

      const ib = document.getElementById('frbnInfoButton');
      if (ib) ib.style.display = 'inline-block';
    }

    exit(){
      this.isFRBN = false;
      if (this.skySphere) this.skySphere.visible = false;

      if (window.cubeUniverse)     window.cubeUniverse.visible = true;
      if (window.permutationGroup) window.permutationGroup.visible = true;
      if (window.isLCHT && window.lichtGroup) window.lichtGroup.visible = true;

      // reconstruye escena normal (sigues usando tu función global)
      if (typeof window.refreshAll === 'function') window.refreshAll({ keepManual: true });

      const ib = document.getElementById('frbnInfoButton');
      if (ib) ib.style.display = 'none';
    }

    toggle(){
      if (this.isFRBN) this.exit(); else this.enter();
      // mantén variable espejo global (otros trozos del código la consultan)
      window.isFRBN = this.isFRBN;
    }

    /** Llamar si cambia la escena (perms, mapping, etc.) con FRBN activo */
    syncFromScene(){
      if (this.isFRBN) this.buildGanzfeld();
    }

    dispose(){
      if (!this.skySphere) return;
      if (this.skySphere.material) this.skySphere.material.dispose();
      if (this.skySphere.geometry) this.skySphere.geometry.dispose();
      if (window.scene) window.scene.remove(this.skySphere);
      this.skySphere = null;
      this.isFRBN = false;
    }
  }

  // Exponer en window para uso directo desde index.html
  window.FRBNEngine = FRBNEngine;
  window.FRBN = new FRBNEngine();

  // No forzamos init aquí: se hace lazy al togglear o al sincronizar
})();
