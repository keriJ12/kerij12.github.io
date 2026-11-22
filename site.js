// 首頁：把 1280 寬的 Demo 預覽 iframe 依容器寬度縮放（純預覽，操作請用按鈕開新分頁）。
function fitShots(){document.querySelectorAll('.shot').forEach(box=>{const f=box.querySelector('iframe');if(!f)return;const s=box.clientWidth/1280;f.style.transform=`scale(${s})`;box.style.minHeight=Math.round(860*s)+'px'})}
fitShots();addEventListener('resize',fitShots);addEventListener('load',fitShots);

// 首屏背景：後方幾團柔光（極光）慢慢飄，下半部一片有透視的織布像被風吹般起伏，迎光處亮起；滑鼠左右移改變光的方向。
// 顏色讀主題變數；畫面不可見或分頁切走時暫停；prefers-reduced-motion 只畫一張靜態圖。
(function heroFabric(){
  const hero=document.querySelector('.hero');if(!hero)return;
  const cv=document.createElement('canvas');cv.className='hero-canvas';cv.setAttribute('aria-hidden','true');
  hero.prepend(cv);hero.classList.add('has-canvas');
  const ctx=cv.getContext('2d');if(!ctx)return;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgb=c=>{const m=c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!m)return[168,217,197];let h=m[1];if(h.length===3)h=h.replace(/./g,x=>x+x);return[0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
  const rgba=(c,a)=>`rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const AMBER=[232,183,92],TEAL=[52,128,160],VIOLET=[96,92,180];
  let W=0,H=0,dpr=1,A=[168,217,197],INK=[237,242,246],grain=null,visible=true,raf=0,hz=.5,mob=false;
  const mouse={x:.7,y:.45,tx:.7,ty:.45};
  function size(){
    const r=hero.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(devicePixelRatio||1,W<700?1:1.5);
    // 手機上首屏很高、流程卡片在下半部：織布改從按鈕下方開始，才看得到
    mob=W<700;hz=.5;
    if(mob){const a=hero.querySelector('.actions');if(a)hz=Math.min(.7,Math.max(.3,(a.getBoundingClientRect().bottom-r.top+10)/H))}
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    A=rgb(css('--blue'));INK=rgb(css('--ink'));
    if(!grain){grain=document.createElement('canvas');grain.width=grain.height=180;const g=grain.getContext('2d'),id=g.createImageData(180,180);
      for(let i=0;i<id.data.length;i+=4){const v=Math.random()*255|0;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=255}g.putImageData(id,0,0)}
  }
  // 極光：幾團柔光沿慢速軌跡飄動，疊加混色
  const blobs=[
    {c:()=>A,r:.55,x:.74,y:.34,ax:.10,ay:.12,sx:.00013,sy:.00019,p:0,a:.55},
    {c:()=>TEAL,r:.62,x:.40,y:.78,ax:.16,ay:.08,sx:.00009,sy:.00014,p:2,a:.62},
    {c:()=>VIOLET,r:.48,x:.92,y:.80,ax:.10,ay:.12,sx:.00011,sy:.00008,p:4,a:.48},
    {c:()=>AMBER,r:.26,x:.60,y:.18,ax:.12,ay:.06,sx:.00016,sy:.00012,p:1,a:.26}
  ];
  function aurora(t,k){
    ctx.globalCompositeOperation='lighter';
    for(const b of blobs){
      const x=(b.x+b.ax*Math.sin(t*b.sx+b.p)+(mouse.x-.5)*.06)*W,y=(b.y+b.ay*Math.cos(t*b.sy+b.p)+(mouse.y-.5)*.05)*H,r=b.r*Math.max(W,H);
      const g=ctx.createRadialGradient(x,y,0,x,y,r),c=b.c();
      g.addColorStop(0,rgba(c,b.a*k));g.addColorStop(.45,rgba(c,b.a*k*.35));g.addColorStop(1,rgba(c,0));
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    }
    ctx.globalCompositeOperation='source-over';
  }
  // 織布：透視投影的經緯線，依坡度與光線方向決定亮度
  function fabric(t,horizonF,alphaK){
    const f=H,zmin=1,zmax=7,horizon=H*horizonF,camH=(H*1.06-horizon)/f*zmin;
    const farHalf=W*.42,nearHalf=W*.62,b=farHalf/f,a=(nearHalf-farHalf)*zmin/f;
    const rows=W<700?34:54,cols=W<700?60:104;
    const ht=(x,z)=>.20*Math.sin(x*1.5+t*.00055+z*.85)+.13*Math.sin(z*1.25-t*.0004+x*.55)+.05*Math.sin((x*1.7+z)*2.6+t*.0008);
    const L=(()=>{const v=[(mouse.x-.5)*1.6,.75,-.55],n=Math.hypot(...v);return v.map(c=>c/n)})();
    const pts=[];
    for(let i=0;i<rows;i++){
      const z=zmax-(zmax-zmin)*i/(rows-1),row=[],xr=a+b*z,s=f/z;
      for(let j=0;j<=cols;j++){
        const x=(j/cols*2-1)*xr,y=ht(x,z),e=.02,hx=(ht(x+e,z)-y)/e,hz=(ht(x,z+e)-y)/e;
        const lit=Math.max(0,(-hx*L[0]+L[1]-hz*L[2])/Math.hypot(hx,1,hz));
        row.push([W/2+x*s,horizon+(camH-y)*s,lit]);
      }
      pts.push({row,fog:Math.pow((i+1)/rows,.9)});
    }
    const CH=6;
    for(const {row,fog} of pts){
      ctx.lineWidth=.6+fog*.8;
      for(let j=0;j<cols;j+=CH){
        let lit=0;ctx.beginPath();ctx.moveTo(row[j][0],row[j][1]);
        for(let k=j+1;k<=Math.min(cols,j+CH);k++){ctx.lineTo(row[k][0],row[k][1]);lit+=row[k][2]}
        lit/=CH;ctx.strokeStyle=rgba(lit>.82?A:INK,(.07+lit*lit*.85)*fog*alphaK);ctx.stroke();
      }
    }
    ctx.lineWidth=.6;
    for(let j=0;j<=cols;j+=2)for(let i=0;i<rows-1;i+=4){
      ctx.beginPath();ctx.moveTo(pts[i].row[j][0],pts[i].row[j][1]);
      for(let k=i+1;k<=Math.min(rows-1,i+4);k++)ctx.lineTo(pts[k].row[j][0],pts[k].row[j][1]);
      ctx.strokeStyle=rgba(INK,.09*pts[i].fog*alphaK);ctx.stroke();
    }
  }
  function draw(t){
    ctx.clearRect(0,0,W,H);
    mouse.x+=(mouse.tx-mouse.x)*.05;mouse.y+=(mouse.ty-mouse.y)*.05;
    aurora(t,mob?.45:.75);fabric(t,hz,mob?1:.9);
    if(!mob){ctx.globalAlpha=.04;ctx.fillStyle=ctx.createPattern(grain,'repeat');ctx.fillRect(0,0,W,H);ctx.globalAlpha=1}
  }
  // 手機：每秒約 30 張、捲動中暫停重畫，讓滑動優先；桌機照常
  let lastDraw=0,lastScroll=-1e9;
  addEventListener('scroll',()=>{lastScroll=performance.now()},{passive:true});
  function tick(t){
    raf=0;if(!visible||document.hidden)return;
    const busy=mob&&(t-lastScroll<220||t-lastDraw<32);
    if(!busy){draw(t);lastDraw=t}
    raf=requestAnimationFrame(tick);
  }
  const start=()=>{if(reduce){draw(0);return}if(!raf)raf=requestAnimationFrame(tick)};
  hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect();mouse.tx=(e.clientX-r.left)/W;mouse.ty=(e.clientY-r.top)/H});
  // iPhone 捲動時網址列伸縮會一直觸發 resize：只有寬度或首屏高度真的變了才重建畫布
  addEventListener('resize',()=>{const r=hero.getBoundingClientRect();if(Math.abs(r.width-W)<1&&Math.abs(r.height-H)<2)return;size();start()});
  document.addEventListener('visibilitychange',start);
  if('IntersectionObserver'in window)new IntersectionObserver(es=>{visible=es[0].isIntersecting;start()}).observe(hero);
  size();start();
})();
