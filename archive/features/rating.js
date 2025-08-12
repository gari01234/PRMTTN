document.querySelectorAll('.ratingBtn').forEach(el=>{
  const r=+el.getAttribute('data-rating');
  el.addEventListener('click',()=>{
    userRating=r;
    const cols={1:"#8B0000",2:"#FF4500",3:"#FFA500",4:"#9ACD32",5:"#008000"};
    document.querySelectorAll('.ratingBtn').forEach((b,i)=>{
      b.style.color=(i<r?cols[r]:"#000");
    });
    updateTopRightDisplay();
  });
  el.addEventListener('mouseenter',()=>showPopup(`Calificación: ${r}`,1000));
});
