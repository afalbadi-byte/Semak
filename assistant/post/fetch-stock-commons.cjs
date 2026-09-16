// صور من ويكيميديا كومنز — ملك عام / CC0 فقط (تجاري بلا نسبة إلزامية)
const fs=require('fs'),path=require('path'),https=require('https');
const OUT='C:/Users/ahmed/Semak/.claude/worktrees/post-push/assistant/post/assets/stock';
const UA='semak-post-tool/1.0 (https://semak.sa)';
const Q=[
 ['makkah-haram','Masjid al-Haram Mecca'],
 ['makkah-city','Mecca city view'],
 ['kaaba','Kaaba'],
 ['makkah-hist','Mecca historical photograph'],
 ['madinah','Al-Masjid an-Nabawi Medina'],
 ['makkah-modern','Makkah Royal Clock Tower'],['makkah-night','Mecca night'],['jabal-omar','Jabal Omar Mecca'],['hajj','Hajj pilgrims Mecca 2019'],
 
 ['jeddah-old','Al-Balad Jeddah historic'],
 ['najdi','Najdi architecture Saudi'],
 ['saudi-city','Saudi Arabia modern architecture'],
];
const get=(u,n=0)=>new Promise((res,rej)=>{if(n>5)return rej(new Error('redir'));https.get(u,{headers:{'User-Agent':UA}},r=>{
 if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return get(r.headers.location,n+1).then(res,rej);}
 if(r.statusCode!==200){r.resume();return rej(new Error('HTTP '+r.statusCode));}
 const c=[];r.on('data',d=>c.push(d));r.on('end',()=>res({buf:Buffer.concat(c),type:r.headers['content-type']||''}));}).on('error',rej);});
const OK=/^(public domain|cc0|pd|cc pd)/i;
(async()=>{
 const man=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'),'utf8'));
 for(const [slug,q] of Q){
  const api=`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent('filetype:bitmap '+q)}&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=2200`;
  let pages;try{pages=JSON.parse((await get(api)).buf.toString()).query?.pages||{};}catch(e){console.log('✗',slug,e.message);continue;}
  let n=0;
  for(const k of Object.keys(pages)){
   if(n>=3)break;
   const p=pages[k],i=p.imageinfo?.[0];if(!i)continue;
   const lic=i.extmetadata?.LicenseShortName?.value||'';
   if(!OK.test(lic))continue;
   if(i.width<1200)continue;
   const url=i.thumburl||i.url;
   const name=`${slug}-${n+1}.jpg`;
   try{const img=await get(url);
    if(!/image\/(jpeg|png)/.test(img.type)||img.buf.length<100000)continue;
    fs.writeFileSync(path.join(OUT,name),img.buf);
    man.push({file:name,query:q,title:p.title,creator:(i.extmetadata?.Artist?.value||'').replace(/<[^>]*>/g,'').trim(),license:lic,license_url:i.extmetadata?.LicenseUrl?.value||'https://commons.wikimedia.org/wiki/Commons:Licensing',source:i.descriptionurl,provider:'wikimedia commons',w:i.width,h:i.height});
    console.log('✔',name,i.width+'x'+i.height,'|',lic,'|',p.title.slice(5,55));n++;
   }catch(e){}
  }
  if(!n)console.log('—',slug,'لا ملك عام');
 }
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(man,null,2),'utf8');
})();
