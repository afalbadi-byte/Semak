// جالب صور Pixabay (رخصة محتوى Pixabay: استعمال تجاري بلا نسبة إلزامية)
// المفتاح من متغيّر البيئة PIXABAY_KEY. الاستعمال: PIXABAY_KEY=... node assistant/post/fetch-stock-pixabay.cjs
const fs=require('fs'),path=require('path'),https=require('https');
const KEY=process.env.PIXABAY_KEY;
if(!KEY){console.error('ضع المفتاح في PIXABAY_KEY');process.exit(1);}
const OUT='C:/Users/ahmed/Semak/.claude/worktrees/post-push/assistant/post/assets/stock';
const Q=[
 ['saudi-man','saudi man thobe'],['gulf-man','arab man kandura'],['arab-business','arab businessman'],
 ['saudi-family','arab family'],['family-home','arab family home'],['majlis','arabic majlis'],
 ['coffee','arabic coffee dallah'],['makkah-color','mecca kaaba'],['makkah-tower','makkah clock tower'],
 ['render-living','living room 3d render'],['render-interior','interior render modern'],
 ['render-kitchen','kitchen 3d render'],['render-bedroom','bedroom 3d render'],
 ['render-empty','empty room interior'],['render-lobby','lobby interior design'],
];
const get=(u,n=0)=>new Promise((res,rej)=>{if(n>5)return rej(new Error('redir'));https.get(u,{headers:{'User-Agent':'semak-post-tool/1.0'}},r=>{
 if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return get(r.headers.location,n+1).then(res,rej);}
 if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode));}
 const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res({buf:Buffer.concat(c),type:r.headers['content-type']||''}));}).on('error',rej);});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const mf=path.join(OUT,'manifest.json');
 const man=JSON.parse(fs.readFileSync(mf,'utf8'));
 for(const [slug,q] of Q){
  const api=`https://pixabay.com/api/?key=${KEY}&q=${encodeURIComponent(q)}&image_type=photo&safesearch=true&min_width=1200&per_page=20&order=popular`;
  let d;try{d=JSON.parse((await get(api)).buf.toString());}catch(e){console.log('✗',slug,e.message);await sleep(1200);continue;}
  let n=0;
  for(const h of (d.hits||[])){
   if(n>=4)break;
   const url=h.fullHDURL||h.largeImageURL;
   const name=`${slug}-${n+1}.jpg`;
   try{const img=await get(url);
    if(!/image\/(jpeg|png)/.test(img.type)||img.buf.length<80000)continue;
    fs.writeFileSync(path.join(OUT,name),img.buf);
    man.push({file:name,query:q,title:h.tags,creator:h.user,license:'Pixabay Content License',license_url:'https://pixabay.com/service/license-summary/',source:h.pageURL,provider:'pixabay',w:h.imageWidth,h:h.imageHeight});
    console.log('✔',name,h.tags.slice(0,42));n++;
   }catch(e){}
   await sleep(300);
  }
  if(!n)console.log('—',slug);
  await sleep(800);
 }
 const seen=new Set();
 fs.writeFileSync(mf,JSON.stringify(man.filter(r=>{if(seen.has(r.file))return false;seen.add(r.file);return true;}),null,2),'utf8');
})();
