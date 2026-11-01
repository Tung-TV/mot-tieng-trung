// Tách script gốc của mottiengtrung.html thành engine + các gói dữ liệu tải khi cần
const acorn=require('acorn'),fs=require('fs'),path=require('path');
const [,,xdir,outdir,htmlFile]=process.argv;
const rd=f=>fs.readFileSync(path.join(xdir,f),'utf8');
const s2=rd('s2.js');
const ast=acorn.parse(s2,{ecmaVersion:'latest'});
const chunks={},engine=[];
const add=(c,code)=>{(chunks[c]=chunks[c]||[]).push(code)};
const range=(a,b,c)=>{const m={};for(let i=a;i<=b;i++)m[i]=c;return m};
const byIdx={163:'ex1',...range(171,181,'ex1'),...range(185,195,'ex2'),...range(196,209,'ex3'),...range(210,220,'ex4'),...range(221,228,'ex5'),...range(229,237,'ex6'),283:'wr123',284:'wr123',286:'wr4',288:'wr5',290:'wr6'};
const byName={EXIM:'ex1',VCW:'vocab',VCW1:'vocab',VCW2:'vocab',VCW3:'vocab',VCW4:'vocab',VCW5:'vocab',VCW6:'vocab',WCH:'wr123',WCH2:'wr123',WCH3:'wr123',WCH4:'wr4',WCH5:'wr5',WCH6:'wr6',GMD2:'gram',GMD3:'gram',G4D:'gram',G5D:'gram',G6D:'gram'};
const predecl=new Set();
ast.body.forEach((st,i)=>{
  const code=s2.slice(st.start,st.end);
  if(byIdx[i]){add(byIdx[i],code);if(i===163)predecl.add('EXD');return}
  if(st.type==='VariableDeclaration'&&st.declarations.some(d=>byName[d.id.name]||d.id.name==='BANK')){
    st.declarations.forEach(d=>{const n=d.id.name,dc=s2.slice(d.start,d.end);
      if(n==='BANK'){engine.push('var BANK=window.__MOT_BANK||{name:"",number:"",owner:"",qr:""};');return}
      if(byName[n]){predecl.add(n);
        if(n==='WCH')add('wr123','Object.assign(WCH,'+s2.slice(d.init.start,d.init.end)+');');
        else add(byName[n],'var '+dc+';');}
      else engine.push('var '+dc+';')});
    return}
  engine.push(code);
});
let eng=engine.join('\n');
// --- vá ---
const rep=(a,b,all)=>{if(!eng.includes(a))throw new Error('miss: '+a.slice(0,60));eng=all?eng.split(a).join(b):eng.replace(a,b)};
rep('document.body.classList','LGR.classList',true);
rep('function route(){','function route0(){');
rep('document.querySelectorAll(".nv")','document.querySelectorAll("#lg .nv")');
rep('function viewId(h){','function viewId(h){if(h==="#kho"||h==="#lo-trinh"||/^#\\//.test(h)||h===""||h==="#")return "none";');
rep('function goLib(i){','function goLib(i){if(window.__motLib){window.__motLib(KWS[i<0?ST[cur].tab:i]||"");return}');
rep('function khReg(){','function khReg(){if(window.__motUpgrade){window.__motUpgrade();return}');
rep('function lrOpenM(){','window.__lgOpenLr=function(){lrOpenM()};function lrOpenM(){');
rep('document.addEventListener("click",function(e){var b=e.target.closest("[data-nav]");if(b){e.preventDefault();location.hash=b.dataset.nav}});','document.addEventListener("click",function(e){var b=e.target.closest("#lg [data-nav]");if(b){e.preventDefault();location.hash=b.dataset.nav}});');
// tiện ích tải gói
const pre=`var LGR=document.getElementById("lg");var ${[...predecl].join(',')};EXD={};WCH={};
var LG_V=window.__LG_V||"",LG_OK={},LG_WAIT={};
function lgNeed(h){var m;if(m=h.match(/^#de-thi-(\\d+)-/))return["ex"+m[1]];if(h==="#lam-bai"&&typeof EX!=="undefined"&&EX&&EX.lv)return["ex"+EX.lv];if(m=h.match(/^#bai-hoc-(\\d)-/)){var l=+m[1];return["vocab","gram",l<=3?"wr123":"wr"+l]}if(h==="#luyen-go")return["vocab"];return[]}
function lgLoad(list,cb){var miss=list.filter(function(x){return!LG_OK[x]});if(!miss.length){cb();return}LGR.classList.add("lg-busy");var k=0;function nx(){if(k>=miss.length){LGR.classList.remove("lg-busy");cb();return}var c=miss[k++];if(LG_WAIT[c]){LG_WAIT[c].push(nx);return}LG_WAIT[c]=[nx];var s=document.createElement("script");s.src=(window.__LG_BASE||"legacy/")+"c-"+c+".js?v="+LG_V;s.onload=function(){LG_OK[c]=1;var w=LG_WAIT[c];LG_WAIT[c]=null;w.forEach(function(f){f()})};s.onerror=function(){LGR.classList.remove("lg-busy");toast("Không tải được dữ liệu, kiểm tra mạng rồi thử lại nhé.");LG_WAIT[c]=null};document.head.appendChild(s)}nx()}
function route(){lgLoad(lgNeed(location.hash),route0)}
window.__lgRoute=function(){route()};
`;
// script 1 tuần audio đề 1
fs.mkdirSync(path.join(outdir,'audio'),{recursive:true});
fs.writeFileSync(path.join(outdir,'audio','hsk1-de1.mp3'),Buffer.from(rd('s1.js').trim(),'base64'));
rep('var t=document.getElementById("exAud");if(t)au.src="data:audio/mpeg;base64,"+t.textContent.trim()','au.src=(window.__LG_BASE||"legacy/")+"audio/hsk1-de1.mp3"');
let s3=rd('s3.js').replace('if(location.hash==="#luyen-go")R();','');
let s4=rd('s4.js'), s5=rd('s5.js');
// body gốc → root
const html=fs.readFileSync(htmlFile,'utf8');
let body=html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g,'');
body=body.replace('class="avatar" id="meBtn"','class="lg-avatar" id="meBtn"').replace('<div class="menu" id="meMenu"','<div class="lg-menu" id="meMenu"').replace(/<img src="data:image\/jpeg;base64,[^"]*" alt="Mọt Tiếng Trung - Kho tài liệu tự học">/,'<img src="assets/logo.jpg" alt="Mọt Tiếng Trung">').replace(/src="data:image\/png;base64,[^"]*"/g,'src=""');
const boot=`(function(){var r=document.getElementById("lg");if(!r){r=document.createElement("div");r.id="lg";document.body.appendChild(r)}r.innerHTML=${JSON.stringify(body)};})();\n`;
const out=boot+rd('s0.js')+'\n;'+pre+eng+'\n;'+s3+'\n;'+s4+'\n;'+s5+'\n;window.__lgReady=1;if(window.__lgOnReady)window.__lgOnReady();';
fs.writeFileSync(path.join(outdir,'engine.js'),out);
for(const [c,arr] of Object.entries(chunks))fs.writeFileSync(path.join(outdir,'c-'+c+'.js'),arr.join('\n;\n'));
console.log('engine',out.length,Object.entries(chunks).map(([c,a])=>c+':'+a.join('').length).join(' '),[...predecl].join(','));
