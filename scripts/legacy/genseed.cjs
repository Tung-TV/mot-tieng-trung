// Cập nhật src/data/seed.json theo bản HTML mới; ảnh nhúng → public/assets
const fs=require('fs'),acorn=require('acorn'),vm=require('vm'),path=require('path');
const s=fs.readFileSync('/tmp/claude-0/new/x/s2.js','utf8');const ast=acorn.parse(s,{ecmaVersion:'latest'});
const CTX={};const get=(name)=>{for(const st of ast.body)if(st.type==='VariableDeclaration')for(const d of st.declarations)if(d.id.name===name)return vm.runInNewContext('('+s.slice(d.init.start,d.init.end)+')',CTX);};
CTX.AFFU=get('AFFU');
const R='/home/claude/repo-mot/';const o=JSON.parse(fs.readFileSync(R+'src/data/seed.json','utf8'));
const save=(du,name)=>{const m=du.match(/^data:image\/(\w+);base64,(.*)$/);const ext=m[1]==='jpeg'?'jpg':m[1];const f='assets/'+name+'.'+ext;fs.writeFileSync(R+'public/'+f,Buffer.from(m[2],'base64'));return f};
const ST=get('ST');
ST.forEach((x,i)=>{if(x.cover&&x.cover.startsWith('data:'))x.cover=save(x.cover,'cover-stage-'+i);});
const TOOLS=get('TOOLS');const tn=['tool-giaotrinh','tool-but','tool-vo'];TOOLS.forEach((t,i)=>{if(t.img&&t.img.startsWith('data:'))t.img=save(t.img,tn[i])});
let k=0;const APPS=get('APPS').map((a)=>({...a,h:a.h.replace(/data:image\/[^"\\]+/g,(du)=>save(du,'app-'+(k++)))}));
const DOCS=get('DOCS').map(({i,...d})=>d);
const out={...o,ST,TOOLS,APPS,AFF:get('AFF'),DOCS,DL:get('DL'),ARTS:get('ARTS'),CC:get('CC'),CE:get('CE'),KWS:get('KWS'),PR:get('PR')};
fs.writeFileSync(R+'src/data/seed.json',JSON.stringify(out));
console.log('ok',DOCS.length,out.DL.length,out.ARTS.length,ST.map(x=>x.cover).join(' '),k);
