// مكتبة صور بترخيص حر (CC0 / Public Domain) — المصادر: StockSnap و Rawpixel و Flickr(PDM) عبر Openverse
// شرط: العرض والارتفاع ≥ 1400 بكسل. كل صورة مع مصدرها وترخيصها في manifest.json
const fs=require('fs'),path=require('path'),https=require('https');
const OUT='C:/Users/ahmed/Semak/.claude/worktrees/post-push/assistant/post/assets/stock';
const Q=[
 ['living','luxury modern living room interior'],
 ['living-warm','beige minimal living room'],
 ['kitchen','modern kitchen interior design'],
 ['bedroom','modern bedroom interior design'],
 ['bathroom','modern bathroom interior marble'],
 ['dining','dining room interior modern'],
 ['lobby','hotel lobby interior marble'],
 ['stairs','staircase modern interior'],
 ['facade','modern apartment building facade'],
 ['facade-night','building exterior night lights'],
 ['balcony','balcony terrace view'],
 ['window-light','sunlight window curtains interior'],
 ['keys','house keys'],
 ['family','family together home'],
 ['handshake','handshake business deal'],
 ['blueprint','architecture blueprint drawing'],
 ['construction','construction crane building site'],
 ['marble','marble texture stone'],
 ['skyline','city skyline night'],
 ['desert-mountain','desert mountain landscape'],
 ['mosque','mosque architecture'],
 ['smart-home','smart home technology'],
];
const get=(u,n=0)=>new Promise((res,rej)=>{if(n>4)return rej(new Error('redirects'));https.get(u,{headers:{'User-Agent':'semak-post-tool/1.0'}},r=>{
 if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return get(r.headers.location,n+1).then(res,rej);}
 if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode));}
 const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res({buf:Buffer.concat(c),type:r.headers['content-type']||''}));}).on('error',rej);});
(async()=>{
 const man=[];
 for(const [slug,q] of Q){
  const api=`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,pdm&source=stocksnap,rawpixel,flickr&size=large&page_size=20`;
  let d;try{d=JSON.parse((await get(api)).buf.toString());}catch(e){console.log('✗',slug,e.message);continue;}
  let n=0;
  for(const r of (d.results||[])){
   if(n>=3)break;
   if(!(r.width>=1400&&r.height>=1400)&&!(r.width>=1800||r.height>=1800))continue;
   const name=`${slug}-${n+1}.jpg`;
   try{
    const img=await get(r.url);
    if(!/image\/(jpeg|png|webp)/.test(img.type)||img.buf.length<120000)continue;
    fs.writeFileSync(path.join(OUT,name),img.buf);
    man.push({file:name,query:q,title:r.title||'',creator:r.creator||'',license:`${r.license} ${r.license_version||''}`.trim(),license_url:r.license_url||'',source:r.foreign_landing_url||r.url,provider:r.provider||'',w:r.width,h:r.height});
    console.log('✔',name,r.width+'x'+r.height,r.provider);n++;
   }catch(e){}
  }
  if(!n)console.log('—',slug,'لا نتائج مناسبة');
 }
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(man,null,2),'utf8');
 console.log('المجموع',man.length);
})();
