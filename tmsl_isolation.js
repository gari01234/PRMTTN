/* ────────── TMSL · aislamiento duro de BUILD + pared/fondo siempre visible ────────── */
(() => {
  const ROOM_W=60, ROOM_H=60, ROOM_D=60, G=4;

  let __tmslGroup=null;

  function lambert(hex){
    const c=new THREE.Color(hex);
    const m=new THREE.MeshLambertMaterial({color:c,dithering:true});
    m.emissive=c.clone(); m.emissiveIntensity=0.08;
    return m;
  }
  function lambertFromBg(){
    const c=(scene.background && scene.background.isColor)? scene.background.clone()
                                                         : new THREE.Color(0xf0f2f4);
    const m=new THREE.MeshLambertMaterial({color:c,dithering:true});
    m.emissive=c.clone(); m.emissiveIntensity=0.06;
    return m;
  }

  function buildTMSLBox(){
    destroyTMSLBox();
    const g=new THREE.Group();

    // 4 blancos distintos (para que se lea el cuarto)
    const CEIL  = 0xf6f6f7;
    const FLOOR = 0xeeeeef;
    const LEFT  = 0xf2f2f3;
    const RIGHT = 0xeaeaec;

    const left  = new THREE.Mesh(new THREE.BoxGeometry(G,ROOM_H,ROOM_D), lambert(LEFT));
    left.position.set(-ROOM_W/2+G/2,0,0);
    const right = new THREE.Mesh(new THREE.BoxGeometry(G,ROOM_H,ROOM_D), lambert(RIGHT));
    right.position.set( ROOM_W/2-G/2,0,0);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W,G,ROOM_D), lambert(FLOOR));
    floor.position.set(0,-ROOM_H/2+G/2,0);
    const ceil  = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W,G,ROOM_D), lambert(CEIL));
    ceil.position.set(0, ROOM_H/2-G/2,0);

    // PARED DE FONDO en el KANTE (no en medio)
    const back  = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W,ROOM_H,G), lambertFromBg());
    back.position.set(0,0,-ROOM_D/2+G/2);

    g.add(left,right,floor,ceil,back);
    g.traverse(o=>o.frustumCulled=false);
    scene.add(g);
    __tmslGroup=g;
  }

  function destroyTMSLBox(){
    if(!__tmslGroup) return;
    __tmslGroup.traverse(o=>{
      if(o.isMesh){ o.geometry?.dispose?.(); o.material?.dispose?.(); }
    });
    scene.remove(__tmslGroup);
    __tmslGroup=null;
  }

  function hideBUILD(){
    try{ if (typeof cubeUniverse     !== 'undefined') cubeUniverse.visible=false; }catch(_){ }
    try{ if (typeof permutationGroup !== 'undefined') permutationGroup.visible=false; }catch(_){ }
    try{ if (typeof lichtGroup       !== 'undefined') lichtGroup.visible=false; }catch(_){ }
  }
  function showBUILD(){
    try{ if (typeof cubeUniverse     !== 'undefined') cubeUniverse.visible=true; }catch(_){ }
    try{ if (typeof permutationGroup !== 'undefined') permutationGroup.visible=true; }catch(_){ }
    try{ if (typeof lichtGroup       !== 'undefined' && window.isLCHT) lichtGroup.visible=true; }catch(_){ }
  }

  function setCamera(){
    try{
      camera.up.set(0,1,0);
      camera.fov=60; camera.near=0.1; camera.far=2000; camera.updateProjectionMatrix();
      if(controls&&controls.target) controls.target.set(0,0,0);
      camera.position.set(0,0,42);
      if(controls){
        controls.enabled=true; controls.enableRotate=true; controls.enablePan=true; controls.enableZoom=true;
        controls.minPolarAngle=0; controls.maxPolarAngle=Math.PI; controls.update();
      }
    }catch(_){ }
  }

  // Envoltura del toggleTMSL para garantizar el comportamiento correcto
  (function wrap(){
    const orig=window.toggleTMSL;
    if (typeof orig!=='function' || orig.__tmsl_isolated) return;
    window.toggleTMSL=function(...args){
      const was=!!window.isTMSL;
      const ret=orig.apply(this,args);
      const on =!!window.isTMSL;

      // Evita “flash” negro: fija clearColor al color de fondo actual
      try{
        if(on && renderer?.setClearColor){
          const bg=(scene.background && scene.background.isColor)?scene.background:new THREE.Color(0xf0f2f4);
          renderer.setClearColor(bg,1);
        }
      }catch(_){ }

      if(on){
        hideBUILD();         // BUILD NUNCA visible en TMSL
        buildTMSLBox();      // pared/fondo TMSL siempre presente
        setCamera();
        // reconstruye contenido del motor TMSL si existe
        try{ if (typeof requestTMSLRebuild==='function'){ requestTMSLRebuild(); requestAnimationFrame(requestTMSLRebuild); } }catch(_){ }
      }else{
        destroyTMSLBox();    // limpiar TODO TMSL al salir
        showBUILD();         // restaura BUILD si toca
      }
      return ret;
    };
    window.toggleTMSL.__tmsl_isolated=true;
  })();

  // Watchdog breve: primeros frames tras entrar garantizan cuarto + rebuild
  (function watchdog(){
    let f=0; function tick(){
      if(window.isTMSL){
        if(f<30){ try{ if(!__tmslGroup) buildTMSLBox(); }catch(_){ }
          try{ if (typeof requestTMSLRebuild==='function') requestTMSLRebuild(); }catch(_){ }
          f++; }
      }else{ f=0; }
      requestAnimationFrame(tick);
    } requestAnimationFrame(tick);
  })();
})();
