function applyEvolution(){
  const mr=parseFloat(document.getElementById('mutationRate').value),
        th=parseFloat(document.getElementById('threshold').value),
        cf=0.02;
  let log="";
  permutationGroup.children.forEach(o=>{
    const rf=(Math.random()-0.5)*mr;
    o.rotation.y+=rf;
    const sf=1+(Math.random()-0.5)*th;
    o.scale.set(sf,sf,sf);
    o.material.color.offsetHSL(
      (Math.random()-0.5)*cf,
      (Math.random()-0.5)*cf,
      (Math.random()-0.5)*cf
    );
    log+=`(${o.userData.permStr}): Rot ${rf.toFixed(3)}, Esc ${sf.toFixed(3)}<br>`;
  });
  document.getElementById('evolutionInfo').innerHTML=log;
}
