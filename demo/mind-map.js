// 「流程心智圖」頁：把 A／B 路線與共用後段畫成一張放射式 SVG 心智圖，每個節點標註 AI 在這裡扮演的角色。
// 主分類三種：模擬 AI（Demo 已用本機規則模擬）、規則（純業務邏輯）、人工簽核（人必須決定或簽字）。
// 第二標記「AI 輔助位」：這個節點的輸入、草稿、摘要或抽取可以交給 AI，人最後確認；全部尚未實作，需真實樣本驗證。
const mindMapKinds={
 ai:{label:'模擬 AI（Demo 已做）',short:'模擬 AI',desc:'Demo 用正則與固定示例模擬，輸出可核對、可拒絕；未接真實模型。'},
 assist:{label:'AI 輔助位（設計保留，未實作）',short:'AI 輔助位',desc:'輸入、草稿、摘要、抽取可交給 AI，人確認後才生效；需真實樣本驗證，Demo 未做。'},
 rule:{label:'規則（非 AI）',short:'規則',desc:'業務規則與數字判斷，答案可直接算出，刻意不放 AI。'},
 human:{label:'人工簽核',short:'人工簽核',desc:'必須由人決定或簽字、對客戶負責的環節；AI 只整理不決定。'}
};
const mindMapBranches=[
 {id:'intake',title:'需求進件（客服）',side:'right',nav:'cs',leaves:[
  {title:'Email 需求整理',kind:'ai',note:'正則擷取欄位、逐欄顯示原文依據；多色／多數量不猜。',nav:'new'},
  {title:'既有布料候選',kind:'ai',note:'固定示例兩筆並標示不符原因；自建案不套假推薦。',nav:'cs'},
  {title:'人工核對後送交研發',kind:'human',assist:'草擬「還缺哪些規格、要問客戶什麼」的補充問題清單。',note:'草稿必須勾選核對，修改內容會重啟交接。',nav:'cs'},
  {title:'找到既有布料 → 轉 B 訂單',kind:'rule',assist:'草擬給客戶的「改用既有型號」確認信。',note:'填型號、可用量、數量，勾客戶確認即建 ORD-EX 並鎖定需求。',nav:'cs'}
 ]},
 {id:'b',title:'B 既有型號訂單',side:'right',nav:'b',leaves:[
  {title:'人工確認型號／顏色／數量',kind:'human',note:'缺必要條件不能前進；數量可改、型號鎖定。',nav:'b'},
  {title:'成品 → 胚布 → 經線三層分流',kind:'rule',note:'按足量與否分流，數字直接算出，不需模型猜。',nav:'b'},
  {title:'色卡補寄獨立追蹤',kind:'rule',note:'不阻擋原單；寄出與收到分開登記。',nav:'b'},
  {title:'追加顏色另建關聯訂單',kind:'rule',note:'預設庫存 0，需重新人工確認。',nav:'b'}
 ]},
 {id:'track',title:'追蹤與治理',side:'right',nav:'overview',leaves:[
  {title:'到期與停滯彙整',kind:'rule',assist:'草擬催辦訊息；資料夠了再評估延誤風險模型。',note:'依追蹤日期篩選，明示非 AI 預測。',nav:'overview'},
  {title:'取消與善後清單',kind:'human',assist:'依已發生的採購、外送、排程自動草擬善後清單。',note:'保留取消前狀態與歷史；善後逐項填處理結果。',nav:'overview'},
  {title:'誤建草稿回收筒',kind:'rule',note:'只有未送交、無關聯的草稿可刪；可還原、不永久刪除。',nav:'trash'},
  {title:'事件歷史與等待原因',kind:'rule',assist:'摘要「這個案子為什麼卡住、卡在哪一步」給主管看。',note:'每次推進留原因與追蹤日，停留時間不用來歸責。',nav:'progress'}
 ]},
 {id:'a',title:'A 研發交接',side:'left',nav:'rd',leaves:[
  {title:'完整性／可行性判定',kind:'human',assist:'找出相似歷史需求與當時結論、技術書供參考。',note:'研發按動作鍵決定，退回補充或不可承接都留原因。',nav:'rd'},
  {title:'材料確認（人工核實）',kind:'human',note:'必須勾人工核實；待到料／無合適材料阻擋前進。',nav:'rd'},
  {title:'打樣 → 評估 → 退回循環',kind:'rule',assist:'把研發的退回原因改寫成客戶看得懂的問題。',note:'結果「需調整」回材料確認，紀錄不覆蓋。',nav:'rd'},
  {title:'技術書完成 → 三部門接手',kind:'rule',assist:'從打樣與材料紀錄草擬技術書初稿；產生各部門視角的交接摘要。',note:'生產、採購、品管各自確認接手與完成。',nav:'progress'},
  {title:'建立生產訂單（A→訂單）',kind:'rule',note:'雙向關聯、不覆寫研發案；數量未知在新單補。',nav:'rd'}
 ]},
 {id:'prod',title:'共用生產後段',side:'left',nav:'machines',leaves:[
  {title:'經線缺料 → 採購 → 分批到料',kind:'rule',assist:'從供應商 Email／送貨單抽 kg、批號、到料日期，人工核實。',note:'採購綁訂單；累計到料、防重複與超量。',nav:'b'},
  {title:'機台排程候選',kind:'rule',assist:'機台能力、工時、到料資料齊全後做約束排程建議。',note:'只數各機台已排件數，明示非 AI。',nav:'machines'},
  {title:'織造 → 胚布品管 → 瑕疵登記',kind:'rule',assist:'手寫瑕疵單拍照辨識成結構化紀錄。',note:'瑕疵連回卷號與訂單，隨單保留。',nav:'b'},
  {title:'送染整 → 回廠登記',kind:'rule',assist:'從廠商 Email 抽回廠日期與延誤原因。',note:'帶入技術書廠商與原瑕疵；外送單號與日期人工登記。',nav:'b'},
  {title:'成品複驗逐項 → 不過返工',kind:'human',assist:'把原瑕疵、廠商備註、客戶要求整理成複驗重點清單。',note:'原瑕疵逐項勾選，不通過退同一廠商、紀錄保留。',nav:'b'},
  {title:'揀貨 → 打包 → 出貨',kind:'human',assist:'草擬給客戶的出貨通知。',note:'核對包裝與交運紀錄；寄出不等於收到。',nav:'b'},
  {title:'人工登記客戶收貨結案',kind:'human',note:'填收貨日期與簽收，訂單才結案。',nav:'b'}
 ]}
];
let mindMapFocus='';
function mindMapCounts(){const c={ai:0,rule:0,human:0,assist:0,pureRule:0,humanNoAssist:0,total:0};mindMapBranches.forEach(b=>b.leaves.forEach(l=>{c[l.kind]++;if(l.assist)c.assist++;if(l.kind==='rule'&&!l.assist)c.pureRule++;if(l.kind==='human'&&!l.assist)c.humanNoAssist++;c.total++}));return c}
function mindMapMatch(l){return !mindMapFocus||(mindMapFocus==='assist'?!!l.assist:l.kind===mindMapFocus)}
function mindMapSvg(){
 const W=1010,leafW=220,leafH=46,gap=10,top=24,centerX=W/2,centerW=170,centerH=64,branchW=150,branchH=44;
 const sides={left:mindMapBranches.filter(b=>b.side==='left'),right:mindMapBranches.filter(b=>b.side==='right')};
 const count=s=>sides[s].reduce((n,b)=>n+b.leaves.length,0)*(leafH+gap)+(sides[s].length-1)*18;
 const H=Math.max(count('left'),count('right'))+top*2;
 const nodes=[],links=[];
 ['left','right'].forEach(side=>{let y=top+(H-top*2-count(side))/2;const leafX=side==='right'?W-leafW-6:6;const branchX=side==='right'?centerX+centerW/2+20:centerX-centerW/2-20-branchW;
  sides[side].forEach(b=>{const ys=[];b.leaves.forEach(l=>{ys.push(y);const dim=!mindMapMatch(l);
   nodes.push(`<g class="mm-leaf mm-${l.kind}${l.assist?' mm-has-assist':''}${dim?' mm-dim':''}" data-mind-go="${l.nav}" tabindex="0" role="link"><title>${esc(l.title)}｜${esc(mindMapKinds[l.kind].label)}。${esc(l.note)}${l.assist?' AI 輔助位（未實作）：'+esc(l.assist):''}</title><rect x="${leafX}" y="${y}" width="${leafW}" height="${leafH}" rx="6"/><text x="${leafX+12}" y="${y+19}" class="mm-leaf-title">${esc(l.title)}</text><text x="${leafX+12}" y="${y+36}" class="mm-tag">${esc(mindMapKinds[l.kind].short)}${l.assist?' ・ ✦ AI 輔助位':''}</text></g>`);
   const lx1=side==='right'?branchX+branchW:branchX,lx2=side==='right'?leafX:leafX+leafW;links.push({x1:lx1,x2:lx2,y2:y+leafH/2,branch:b.id});y+=leafH+gap});
   const by=(ys[0]+ys[ys.length-1]+leafH)/2;links.filter(k=>k.branch===b.id&&k.y1===undefined).forEach(k=>k.y1=by);
   nodes.push(`<g class="mm-branch" data-mind-go="${b.nav}" tabindex="0" role="link"><rect x="${branchX}" y="${by-branchH/2}" width="${branchW}" height="${branchH}" rx="8"/><text x="${branchX+branchW/2}" y="${by+5}" text-anchor="middle">${esc(b.title)}</text></g>`);
   const cx=side==='right'?centerX+centerW/2:centerX-centerW/2,bx=side==='right'?branchX:branchX+branchW;
   links.push({x1:cx,y1:H/2,x2:bx,y2:by,trunk:true});y+=18})});
 const path=k=>{const mx=(k.x1+k.x2)/2;return `<path class="${k.trunk?'mm-trunk':'mm-link'}" d="M${k.x1} ${k.y1} C${mx} ${k.y1},${mx} ${k.y2},${k.x2} ${k.y2}"/>`};
 return `<svg class="mm-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="織序流程心智圖，節點標註 AI 角色">${links.map(path).join('')}${nodes.join('')}<g class="mm-center"><rect x="${centerX-centerW/2}" y="${H/2-centerH/2}" width="${centerW}" height="${centerH}" rx="10"/><text x="${centerX}" y="${H/2-6}" text-anchor="middle" class="mm-center-title">織序 流程全貌</text><text x="${centerX}" y="${H/2+16}" text-anchor="middle" class="mm-center-sub">A 研發 ／ B 既有型號 ／ 共用後段</text></g></svg>`}
function mindMapOutline(){return mindMapBranches.map(b=>`<div class="mm-outline-branch"><h3>${esc(b.title)}</h3><ul>${b.leaves.map(l=>`<li class="mm-${l.kind}${l.assist?' mm-has-assist':''}${mindMapMatch(l)?'':' mm-dim'}"><span class="badge ${l.kind==='ai'?'amber':l.kind==='human'?'dark':''}">${esc(mindMapKinds[l.kind].short)}</span>${l.assist?'<span class="badge mm-assist-badge">✦ AI 輔助位・未實作</span>':''} <strong>${esc(l.title)}</strong><br><small>${esc(l.note)}</small>${l.assist?`<small class="mm-assist-text">AI 輔助位：${esc(l.assist)}</small>`:''} <button class="btn small" data-mind-go="${l.nav}">前往</button></li>`).join('')}</ul></div>`).join('')}
function mindMapView(){const c=mindMapCounts();
 return `<div class="heading"><div><div class="eyebrow">PROCESS MIND MAP</div><h1>流程心智圖</h1><p class="sub">一張圖看完 A／B 路線與共用生產後段。AI 不做決定，但大部分交接點的輸入、草稿、摘要可以交給 AI，人最後確認；已做與保留位分開標。點節點可跳到對應頁面。</p></div><button class="btn" data-nav="ai">查看 AI 放哪／不放哪對照表</button></div>
 <div class="metric-grid"><div class="metric"><small>流程節點</small><strong>${c.total}</strong><small>五條分支，從進件到客戶收貨</small></div><div class="metric"><small>模擬 AI（Demo 已做）</small><strong>${c.ai}</strong><small>Email 整理、固定候選；皆為本機規則</small></div><div class="metric"><small>AI 輔助位（未實作）</small><strong>${c.assist}</strong><small>草稿、摘要、抽取、辨識；人確認後才生效</small></div><div class="metric"><small>刻意不放 AI</small><strong>${c.pureRule+c.humanNoAssist}</strong><small>純規則 ${c.pureRule}、純人工簽字 ${c.humanNoAssist}</small></div></div>
 <section class="card mm-card"><div class="mm-legend" role="group" aria-label="依 AI 角色篩選">${['','ai','assist','rule','human'].map(k=>`<button class="mm-chip mm-chip-${k||'all'} ${mindMapFocus===k?'active':''}" data-mind-focus="${k}" title="${k?esc(mindMapKinds[k].desc):'顯示全部節點'}">${k?esc(mindMapKinds[k].label)+' ('+c[k]+')':'全部 ('+c.total+')'}</button>`).join('')}<span class="mm-legend-hint">琥珀＝Demo 已模擬；虛線外框＋✦＝AI 輔助位（設計保留，未實作）；綠色＝人工簽核。點分類只保留該類節點。</span></div><div class="mm-scroll">${mindMapSvg()}</div></section>
 <section class="card"><h2>節點說明（同一份資料，文字版）</h2><div class="mm-outline">${mindMapOutline()}</div><div class="note">原則：AI 放在輸入雜亂、需要理解語意、結果可被人核對的位置——草稿、摘要、抽取、辨識；分流、庫存、採購防重這類業務規則用規則；判定、核實、放行、收貨由人簽字。「AI 輔助位」全部尚未實作，需要真實樣本驗證後才做；這裡沒有真實模型、效益數據或導入承諾。</div></section>`}
// 節點跳轉：B 頁需要 B 案、A 的三頁需要 A 案；目前案件路線不符時改開第一筆未取消的對應案件，避免用錯路線的畫面渲染。
function mindMapGo(target){const needB=target==='b',needA=['cs','rd','progress'].includes(target);
 if((needB&&state.route!=='B')||(needA&&state.route==='B')){const alt=cases.find(c=>(needB?c.route==='B':c.route!=='B')&&!c.cancelled);if(!alt){toast('目前沒有可開啟的對應案件');return}openCase(alt.id,needA?target:undefined);if(needA){page=target;role=target==='rd'?'研發':target==='cs'?'客服':'跨部門';render()}return}
 page=target;role=target==='b'||target==='cs'?'客服':target==='rd'?'研發':'跨部門';render()}
function bindMindMap(){document.querySelectorAll('[data-mind-focus]').forEach(b=>b.onclick=()=>{mindMapFocus=b.dataset.mindFocus===mindMapFocus?'':b.dataset.mindFocus;render()});document.querySelectorAll('[data-mind-go]').forEach(g=>{g.onclick=()=>mindMapGo(g.dataset.mindGo);g.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();mindMapGo(g.dataset.mindGo)}}})}
