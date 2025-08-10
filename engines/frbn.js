// engines/frbn.js

const FRBNEngine = (()=>{
  let hostRef = null;
  let skySphere = null;
  let prev = { bg:null, cube:true, perms:true };

  function buildSkySphere(host){
    const THREE = host.THREE;
    const geo = new THREE.SphereGeometry(500, 64, 64);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time:   { value: 0 },
        hueBias:{ value: 0 },
        sat:    { value: 0.60 },
        val:    { value: 0.92 }
      },
      side: THREE.BackSide,
      depthWrite: false,
      transparent: false,
      vertexShader: `
        varying vec3 vPos;
        void main(){
          vPos = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vPos;
        uniform float time, hueBias, sat, val;

        vec3 hsv2rgb(float h, float s, float v){
          float c=v*s, x=c*(1.0-abs(mod(h/60.0,2.0)-1.0)), m=v-c;
          vec3 rgb;
          if(h<60.0) rgb=vec3(c,x,0.0);
          else if(h<120.0) rgb=vec3(x,c,0.0);
          else if(h<180.0) rgb=vec3(0.0,c,x);
          else if(h<240.0) rgb=vec3(0.0,x,c);
          else if(h<300.0) rgb=vec3(x,0.0,c);
          else rgb=vec3(c,0.0,x);
          return rgb + vec3(m);
        }

        void main(){
          float u = (atan(vPos.z, vPos.x) + 3.14159265) / (2.0*3.14159265);
          float v = vPos.y * 0.5 + 0.5;
          float h = mod(hueBias + 360.0*u + 20.0*sin(time*0.20) + 10.0*sin(time*0.07 + u*6.2831), 360.0);
          float s = clamp(sat * (0.85 + 0.15*sin(time*0.11 + v*6.2831)), 0.0, 1.0);
          float vv= clamp(val * (0.92 + 0.08*cos(time*0.09 + u*3.1415)), 0.0, 1.0);
          gl_FragColor = vec4(hsv2rgb(h,s,vv), 1.0);
        }
      `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'FRBN_skySphere';
    return mesh;
  }

  return {
    id: 'FRBN',
    enter(host){
      hostRef = host;

      // guardar estado previo
      if (host.scene) {
        prev.bg = host.scene.background ? host.scene.background.clone() : null;
      }
      if (host.cubeUniverse){ prev.cube = host.cubeUniverse.visible; host.cubeUniverse.visible = false; }
      if (host.permutationGroup){ prev.perms = host.permutationGroup.visible; host.permutationGroup.visible = false; }

      if (!skySphere) skySphere = buildSkySphere(host);
      if (host.scene && skySphere.parent !== host.scene) host.scene.add(skySphere);

      // hue de base acoplado a escena
      if (skySphere.material?.uniforms?.hueBias && host.invariants){
        skySphere.material.uniforms.hueBias.value = (host.invariants.sceneSeed || 0) % 360;
      }

      // Shim de compatibilidad para tu animate(): no se usa para leer globals
      try {
        window.FRBN = {
          isFRBN: true,
          skySphere,
          syncFromScene: ()=> this.syncFromScene(),
          controlsVisibility: ({cube, perms})=>{
            if (hostRef?.cubeUniverse)      hostRef.cubeUniverse.visible = !!cube;
            if (hostRef?.permutationGroup)  hostRef.permutationGroup.visible = !!perms;
          }
        };
      } catch(_) {}
    },
    exit(){
      if (!hostRef) return;
      if (skySphere && hostRef.scene) hostRef.scene.remove(skySphere);

      if (hostRef.cubeUniverse)      hostRef.cubeUniverse.visible     = prev.cube;
      if (hostRef.permutationGroup)  hostRef.permutationGroup.visible = prev.perms;
      if (prev.bg && hostRef.scene)  hostRef.scene.background         = prev.bg;

      try { if (window.FRBN) window.FRBN.isFRBN = false; } catch(_) {}
    },
    syncFromScene(){
      if (!hostRef) return;
      if (skySphere?.material?.uniforms?.hueBias && hostRef.invariants){
        skySphere.material.uniforms.hueBias.value = (hostRef.invariants.sceneSeed || 0) % 360;
      }
    }
  };
})();

// Auto-registro en ENGINE
if (window.ENGINE && typeof window.ENGINE.register === 'function'){
  window.ENGINE.register(FRBNEngine);
}

// Exports
export const FRBN = FRBNEngine;
export default FRBNEngine;

