// 首頁：把 1280 寬的 Demo 預覽 iframe 依容器寬度縮放（純預覽，操作請用按鈕開新分頁）。
function fitShots(){document.querySelectorAll('.shot').forEach(box=>{const f=box.querySelector('iframe');if(!f)return;const s=box.clientWidth/1280;f.style.transform=`scale(${s})`;box.style.minHeight=Math.round(860*s)+'px'})}
fitShots();addEventListener('resize',fitShots);addEventListener('load',fitShots);
