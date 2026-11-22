// 案例頁共用：章節目錄捲動高亮＋點目錄跳到章節。
// 手機上目錄是橫向一排：只橫向捲動那一排（ol.scrollTo），不用 scrollIntoView，
// 否則 iPhone Safari 會中斷正在進行的頁面捲動，點了章節卻跳不過去。
(function(){
  const links=[...document.querySelectorAll('.cs-toc a[href^="#c"]')];
  const chapters=[...document.querySelectorAll('.cs-chapter')];
  if(!links.length||!chapters.length)return;
  const toc=document.querySelector('.cs-toc');
  const map=new Map(links.map(a=>[a.getAttribute('href').slice(1),a]));
  let ticking=false,lockUntil=0,lastId='';
  const offset=()=>{const s=toc&&getComputedStyle(toc);return s&&s.position==='sticky'&&toc.getBoundingClientRect().width>=innerWidth*.9?toc.offsetHeight+12:88};
  function mark(id){
    if(id===lastId)return;lastId=id;
    links.forEach(a=>a.removeAttribute('aria-current'));
    const a=map.get(id);if(!a)return;a.setAttribute('aria-current','true');
    const ol=a.closest('ol');
    if(ol&&ol.scrollWidth>ol.clientWidth){ol.scrollTo({left:a.offsetLeft-(ol.clientWidth-a.offsetWidth)/2,behavior:'smooth'})}
  }
  function update(){
    ticking=false;if(performance.now()<lockUntil)return;
    const line=scrollY+innerHeight*0.35;let cur=chapters[0];
    for(const c of chapters){if(c.getBoundingClientRect().top+scrollY<=line)cur=c}
    mark(cur.id);
  }
  links.forEach(a=>a.addEventListener('click',e=>{
    const id=a.getAttribute('href').slice(1),el=document.getElementById(id);if(!el)return;
    e.preventDefault();
    const top=el.getBoundingClientRect().top+scrollY-offset();
    const smooth=!matchMedia('(prefers-reduced-motion: reduce)').matches;
    lockUntil=performance.now()+(smooth?900:0);mark(id);
    window.scrollTo({top:Math.max(0,top),behavior:smooth?'smooth':'auto'});
    history.replaceState(null,'','#'+id);
  }));
  addEventListener('scroll',()=>{if(!ticking){ticking=true;setTimeout(update,60)}},{passive:true});
  addEventListener('resize',update);
  update();
})();
