/* Display-only localisation. Business keys, option values and saved records stay unchanged. */
(function(){
'use strict';
const dictionary=window.WEAVE_EN||{},han=/[\u3400-\u9fff]/;
const keys=Object.keys(dictionary).sort((a,b)=>b.length-a.length);
const pattern=new RegExp(keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
let language='zh';try{language=new URLSearchParams(location.search).get('lang')||localStorage.getItem('weave-language')||'zh'}catch{}if(language!=='en')language='zh';
const sources=new WeakMap(),attributes=new WeakMap();
function translate(text){if(typeof text!=='string'||!han.test(text))return text;const trimmed=text.trim();if(Object.prototype.hasOwnProperty.call(dictionary,trimmed))return text.replace(trimmed,dictionary[trimmed]);return text.replace(pattern,key=>dictionary[key]);}
function sourceText(node){let s=sources.get(node);if(!s||node.nodeValue!==s.output){s={input:node.nodeValue,output:node.nodeValue};sources.set(node,s)}return s}
function applyText(node){if(!node.parentElement||node.parentElement.closest('script,style,textarea,[translate="no"],#language-control'))return;const s=sourceText(node),next=language==='en'?translate(s.input):s.input;if(node.nodeValue!==next)node.nodeValue=next;s.output=next;}
function applyAttribute(el,name){if(!el.hasAttribute(name)||el.closest('[translate="no"]'))return;let a=attributes.get(el);if(!a){a={};attributes.set(el,a)}const current=el.getAttribute(name);if(!a[name]||current!==a[name].output)a[name]={input:current,output:current};const value=language==='en'?translate(a[name].input):a[name].input;if(value!==current)el.setAttribute(name,value);a[name].output=value;}
let observer;
function refresh(){
 if(observer)observer.disconnect();
 // An option without an explicit value inherits its label. Freeze the business value before translating.
 document.querySelectorAll('option').forEach(el=>{if(!el.hasAttribute('value'))el.setAttribute('value',el.textContent)});
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())applyText(node);
 document.querySelectorAll('[placeholder],[aria-label],[title],[data-label]').forEach(el=>['placeholder','aria-label','title','data-label'].forEach(k=>applyAttribute(el,k)));
 document.documentElement.lang=language==='en'?'en':'zh-Hant';document.title=language==='en'?'WEAVE | Fabric workflow demo':'織序｜布料需求與研發交接';
 const bar=document.getElementById('language-control');if(bar){bar.querySelector('select').value=language;bar.querySelector('.language-note').textContent=language==='en'?'Demo · No live AI. Customer text and saved input values remain in their original language.':'示範系統 · 無真實 AI。客戶原文與已填資料保留原語言。'}
 const avatar=document.querySelector('.avatar');if(avatar){const roleSelect=document.querySelector('#role');avatar.textContent=roleSelect?(language==='en'?translate(roleSelect.value):roleSelect.value).slice(0,1):'W'}
 document.querySelectorAll('input[name="warp"][readonly]').forEach(el=>{let display=el.nextElementSibling;if(!display||!display.classList.contains('locale-readonly')){display=document.createElement('span');display.className='locale-readonly';el.after(display)}display.textContent=translate(el.value);display.hidden=language!=='en';el.hidden=language==='en'});
 document.querySelectorAll('.mm-leaf-title').forEach(el=>{if(language==='en'&&el.textContent.length>33){el.setAttribute('textLength','190');el.setAttribute('lengthAdjust','spacingAndGlyphs')}else{el.removeAttribute('textLength');el.removeAttribute('lengthAdjust')}});
 if(observer)observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','data-label']});
}
const samplesZh={...intakeExamples};const samplesEn={A:'Hello, we are looking for black, 100% linen fabric for spring/summer shirts, around 150–170 g/m². Quantity is still to be confirmed.\nCompany: Heguang Apparel\nContact: Ms Lin\nEmail: demo@example.com\nUse: Spring/summer shirts\nSpecial requirements: Breathable, soft handle; shrinkage and width to confirm.',B:'Hello, please reorder model LN-180 in black, 500 metres. Please send a replacement colour card; additional colours will be ordered separately.\nCompany: North River Apparel\nContact: Mr Chen\nEmail: orders@example.com\nPO number: PO-DEMO-18\nRequested date: 2026-12-18'};
function setSamples(){Object.assign(intakeExamples,language==='en'?samplesEn:samplesZh)}
function changeLanguage(next){language=next==='en'?'en':'zh';try{localStorage.setItem('weave-language',language)}catch{}setSamples();refresh()}
const nativeConfirm=window.confirm.bind(window);window.confirm=message=>nativeConfirm(language==='en'?translate(String(message)):message);
window.WEAVE_LOCALE={translate,refresh,setLanguage:changeLanguage,get language(){return language}};
const bar=document.createElement('div');bar.id='language-control';bar.innerHTML='<span class="language-note"></span><label>Language / 語言 <select aria-label="Interface language"><option value="en">English</option><option value="zh">繁體中文</option></select></label>';document.body.prepend(bar);bar.querySelector('select').addEventListener('change',e=>changeLanguage(e.target.value));setSamples();refresh();observer=new MutationObserver(()=>refresh());observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label','data-label']});
})();
