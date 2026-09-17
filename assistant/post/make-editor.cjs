// «محرّر منشورات سماك» — صفحة واحدة فيها كل التصاميم، نصوصها قابلة للتعديل مباشرةً ثم تُحفظ صورةً.
// القالب هو نفسه قالب make-post.cjs (لا تصميم جديد): نأخذ HTML البطاقة من الأداة نفسها عبر POST_EMIT_HTML،
// ثم نجعل العنوان والسطر الذهبي والسطر التوضيحي والوسم قابلة للكتابة، ونصدّر PNG بـhtml2canvas.
// الاستعمال:  node assistant/post/make-editor.cjs <out.html> <spec.json> [spec.json ...]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const A = f => path.join(__dirname, 'assets', f);
const ROOTS = [];
for (let d = path.resolve(__dirname, '..', '..'), i = 0; i < 6; i++, d = path.dirname(d)) {
  if (fs.existsSync(path.join(d, 'package.json'))) ROOTS.push(d);
  if (path.dirname(d) === d) break;
}
function need(mod) {
  for (const t of [mod, ...ROOTS.flatMap(r => [path.join(r, 'node_modules', mod), path.join(r, 'rega-registration', 'node_modules', mod)])]) {
    try { return require(t); } catch (e) { /* التالي */ }
  }
  throw new Error('لم أجد ' + mod);
}
const sharp = need('sharp');

const out = process.argv[2];
const specs = process.argv.slice(3);
if (!out || !specs.length) {
  console.error('الاستعمال: node assistant/post/make-editor.cjs <out.html> <spec.json> [...]');
  process.exit(1);
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// يقسم CSS إلى قواعد ويسبق كل محدِّد بمعرّف البطاقة، مع إبقاء @font-face مرّة واحدة للجميع
function scopeCss(css, id, fontsOnce) {
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === '{') depth++; else if (css[j] === '}') depth--; j++; }
    const sel = css.slice(i, open).trim();
    const body = css.slice(open, j);
    i = j;
    if (!sel) continue;
    if (sel.startsWith('@font-face')) { if (!fontsOnce.done) rules.push(sel + body); continue; }
    if (sel.startsWith('@')) { rules.push(sel + body); continue; }          // @media وغيره كما هو
    if (/^html\s*,\s*body$/.test(sel) || sel === 'html' || sel === 'body') continue;  // أبعاد الصفحة لا تُنسخ
    const scoped = sel.split(',').map(s => {
      s = s.trim();
      if (s === '*') return `#${id} *`;
      return `#${id} ${s}`;
    }).join(',');
    rules.push(scoped + body);
    // قواعد تستهدف <img> تُكرَّر لتستهدف البدائل (.imgx) بعد تحويل الصور إلى خلفيات
    const IMG = /(^|[\s>~+])img(?=[\s>~+.:,[]|$)/g;
    if (IMG.test(scoped)) rules.push(scoped.replace(IMG, '$1.imgx') + body);
  }
  return rules.join('\n');
}

(async () => {
  const cards = [];
  let css = '';
  const fontsOnce = { done: false };

  for (const [n, sp] of specs.entries()) {
    const spec = JSON.parse(fs.readFileSync(sp, 'utf8'));
    const name = spec.name || path.basename(path.dirname(path.resolve(sp)));
    const id = 'card' + n;
    const html = execFileSync(process.execPath, [path.join(__dirname, 'make-post.cjs'), sp],
      { env: { ...process.env, POST_EMIT_HTML: '1' }, maxBuffer: 1 << 28 }).toString();

    const styleBody = html.slice(html.indexOf('<style>') + 7, html.indexOf('</style>'));
    let card = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));

    // صورة أخفّ للمحرّر (العرض ١٠٨٠ والتصدير ٢١٦٠): نستبدل الـdata URI الضخم بنسخة ١٦٠٠ بكسل
    let style = styleBody;
    const m = style.match(/\.photo\{[^}]*url\('(data:image\/[a-z]+;base64,[^']+)'\)/);
    if (m) {
      const buf = Buffer.from(m[1].split(',')[1], 'base64');
      const small = await sharp(buf).resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
      style = style.replace(m[1], 'data:image/jpeg;base64,' + small.toString('base64'));
    }

    css += scopeCss(style, id, fontsOnce) + '\n';
    fontsOnce.done = true;

    // html2canvas لا يرسم <img> ذات data: — نحوّل كل صورة إلى خلفية CSS (وهذه يرسمها بلا مشاكل)
    const imgs = [...card.matchAll(/<img([^>]*?)src="(data:image\/[a-z]+;base64,[^"]+)"([^>]*?)>/g)];
    for (const g of imgs) {
      const [whole, pre, src, post] = g;
      const meta = await sharp(Buffer.from(src.split(',')[1], 'base64')).metadata();
      let attrs = (pre + ' ' + post).trim();
      attrs = /class="/.test(attrs) ? attrs.replace(/class="/, 'class="imgx ') : (attrs + ' class="imgx"');
      card = card.replace(whole, `<div ${attrs} style="background-image:url('${src}');background-size:contain;`
        + `background-repeat:no-repeat;background-position:center;aspect-ratio:${meta.width}/${meta.height}"></div>`);
    }

    // سكربت تصغير الخط داخل البطاقة يُحذف — يُدار مركزياً في الصفحة (وإلا تكرّرت متغيّراته)
    card = card.replace(/<script>[\s\S]*?<\/script>/g, '');

    // النصوص القابلة للتعديل
    card = card.replace(/<div class="l1">/,'<div class="l1" contenteditable="true" spellcheck="false" data-ph="السطر الأول">')
               .replace(/<div class="l2">/, '<div class="l2" contenteditable="true" spellcheck="false" data-ph="السطر الذهبي">')
               .replace(/<div class="sub">/, '<div class="sub" contenteditable="true" spellcheck="false" data-ph="السطر التوضيحي">')
               .replace(/<div class="tag">/, '<div class="tag" contenteditable="true" spellcheck="false">');

    const caption = Array.isArray(spec.caption) ? spec.caption.join('\n') : (spec.caption || '');
    cards.push(`<section class="post">
  <div class="ttl">${esc(spec.line1 || '')} ${esc(spec.line2 || '')}</div>
  <div class="stage"><div class="frame" id="${id}">${card}</div></div>
  <div class="bar">
    <button class="dl" data-id="${id}" data-name="${esc(name)}">حفظ الصورة (2160×2160)</button>
    <button class="rs" data-id="${id}">إرجاع النص الأصلي</button>
  </div>
  ${caption ? `<details class="cap"><summary>نص المنشور</summary><div class="capbox" contenteditable="true" spellcheck="false">${esc(caption)}</div><button class="cp">نسخ النص</button></details>` : ''}
</section>`);
  }

  const page = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>محرّر منشورات سماك</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<style>
:root{--bg:#f6f1e7;--panel:#fff;--ink:#1a365d;--soft:#5b6472;--gold:#c5a059;--line:rgba(197,160,89,.35);--sh:rgba(26,54,93,.16)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0a0f1e;--panel:#141b2e;--ink:#f1ede2;--soft:#a9b2c3;--line:rgba(197,160,89,.4);--sh:rgba(0,0,0,.5)}}
:root[data-theme="dark"]{--bg:#0a0f1e;--panel:#141b2e;--ink:#f1ede2;--soft:#a9b2c3;--line:rgba(197,160,89,.4);--sh:rgba(0,0,0,.5)}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Cairo,Tahoma,sans-serif;padding:22px 14px 60px}
.wrap{max-width:620px;margin:0 auto;display:flex;flex-direction:column;gap:30px}
h1{margin:0;text-align:center;font-size:clamp(21px,5vw,27px);font-weight:900}
.note{margin:0;text-align:center;color:var(--soft);font-weight:700;line-height:1.9;font-size:14px}
.note b{color:var(--ink)}
.post{display:flex;flex-direction:column;gap:12px}
.ttl{color:var(--gold);font-weight:800;font-size:14px;text-align:center}
.stage{width:100%;aspect-ratio:1/1;border-radius:20px;overflow:hidden;border:1px solid var(--line);box-shadow:0 16px 40px var(--sh);position:relative}
.frame{position:absolute;top:0;right:0;width:1080px;height:1080px;transform-origin:top right}
.bar{display:flex;gap:10px;flex-wrap:wrap}
button{background:var(--gold);color:#1a1206;border:0;border-radius:12px;padding:11px 20px;font:800 14px Cairo,Tahoma,sans-serif;cursor:pointer}
button.rs,button.cp{background:transparent;color:var(--ink);border:1.5px solid var(--line)}
[contenteditable]{outline:none;border-radius:6px;transition:background .15s}
[contenteditable]:hover{background:rgba(197,160,89,.14)}
[contenteditable]:focus{background:rgba(197,160,89,.22);box-shadow:0 0 0 2px rgba(197,160,89,.55)}
.cap{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 16px}
.cap summary{color:var(--gold);font-weight:800;cursor:pointer}
.capbox{white-space:pre-wrap;line-height:1.9;font-weight:600;margin:10px 0;outline:none}
.saving{opacity:.55;pointer-events:none}
.frame .qr .t{white-space:nowrap}
</style></head><body>
<div class="wrap">
<h1>محرّر منشورات سماك</h1>
<p class="note">اضغط على أي سطر داخل التصميم و<b>اكتب نصّك مباشرة</b>، ثم اضغط <b>«حفظ الصورة»</b>.<br>الشعار وبيانات التواصل ورمز البروشور ثوابت لا تُعدَّل.</p>
${cards.join('\n')}
</div>
<style id="scoped">${css}</style>
<script>
// تصغير السطر الطويل حتى يتّسع — نفس منطق الأداة، ويُعاد عند كل تعديل
function shrink(frame){
  const block=frame.querySelector('.block');if(!block)return;
  const MAX=parseFloat(getComputedStyle(block).maxWidth);
  frame.querySelectorAll('.l1,.l2,.sub').forEach(el=>{
    const base=el.dataset.base||(el.dataset.base=getComputedStyle(el).fontSize);
    el.style.fontSize=base;let s=parseFloat(base);
    while(el.scrollWidth>MAX&&s>18){s-=2;el.style.fontSize=s+'px';}
  });
}
function shrinkAll(){document.querySelectorAll('.frame').forEach(shrink);}
document.addEventListener('input',e=>{const f=e.target.closest&&e.target.closest('.frame');if(f)shrink(f);});

// ملاءمة البطاقة (١٠٨٠) لعرض الشاشة
function fit(){document.querySelectorAll('.stage').forEach(s=>{const f=s.querySelector('.frame');f.style.transform='scale('+(s.clientWidth/1080)+')';});}
addEventListener('resize',fit);addEventListener('load',()=>{fit();shrinkAll();});fit();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{fit();shrinkAll();});

// النص الأصلي لكل حقل
const orig=new Map();
document.querySelectorAll('.frame [contenteditable]').forEach(e=>orig.set(e,e.innerHTML));
document.querySelectorAll('.rs').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('#'+b.dataset.id+' [contenteditable]').forEach(e=>{if(orig.has(e))e.innerHTML=orig.get(e);});
});

// لصق نصّاً عادياً فقط حتى لا تتسرّب تنسيقات غريبة إلى التصميم
document.addEventListener('paste',ev=>{
  const t=ev.target;if(!t.closest||!t.closest('[contenteditable]'))return;
  ev.preventDefault();document.execCommand('insertText',false,(ev.clipboardData||window.clipboardData).getData('text'));
});

document.querySelectorAll('.dl').forEach(b=>b.onclick=async()=>{
  const frame=document.getElementById(b.dataset.id),card=frame.querySelector('.card');
  const old=b.textContent;b.textContent='جارٍ الحفظ…';b.classList.add('saving');
  const t=frame.style.transform;frame.style.transform='scale(1)';
  // html2canvas أحياناً لا يرسم صور data: — نستبدل كل صورة بلوحة canvas مرسومة منها ثم نُرجعها
  await Promise.all([...card.querySelectorAll('img')].map(i=>i.decode?i.decode().catch(()=>{}):null));
  const swaps=[];
  card.querySelectorAll('img').forEach(img=>{
    const r=img.getBoundingClientRect(),sc=parseFloat(frame.style.transform.replace(/[^0-9.]/g,''))||1;
    const w=Math.max(1,Math.round(r.width/sc)),h=Math.max(1,Math.round(r.height/sc));
    const cv=document.createElement('canvas');cv.width=img.naturalWidth||w;cv.height=img.naturalHeight||h;
    try{cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);}catch(e){return;}
    cv.className=img.className;cv.style.cssText=getComputedStyle(img).cssText;
    cv.style.width=w+'px';cv.style.height=h+'px';cv.style.display='block';
    img.replaceWith(cv);swaps.push([cv,img]);
  });
  try{
    const cv=await html2canvas(card,{scale:2,useCORS:true,allowTaint:true,imageTimeout:0,backgroundColor:null,width:1080,height:1080,windowWidth:1080,windowHeight:1080});
    // html2canvas يتعثّر أحياناً في رسم الصور المضمّنة — نرسمها فوق اللوحة بأنفسنا بنفس موضعها ومقاسها
    const cr=card.getBoundingClientRect(),ctx=cv.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0);   // html2canvas يترك تحويلاً على السياق — نصفّره قبل الرسم
    for(const el of card.querySelectorAll('.imgx')){
      const u=(getComputedStyle(el).backgroundImage.match(/url\\("?(data:[^")]+)"?\\)/)||[])[1];
      if(!u)continue;
      const im=new Image();im.src=u;try{await im.decode();}catch(e){continue;}
      const r=el.getBoundingClientRect();
      const bx=(r.left-cr.left)*2,by=(r.top-cr.top)*2,bw=r.width*2,bh=r.height*2;
      const s=Math.min(bw/im.naturalWidth,bh/im.naturalHeight);
      const dw=im.naturalWidth*s,dh=im.naturalHeight*s;
      ctx.drawImage(im,bx+(bw-dw)/2,by+(bh-dh)/2,dw,dh);
    }
    const a=document.createElement('a');a.download=b.dataset.name+'.png';a.href=cv.toDataURL('image/png');a.click();
    b.textContent='تم الحفظ ✓';
  }catch(e){b.textContent='تعذّر الحفظ — جرّب لقطة شاشة';}
  swaps.forEach(([cv,img])=>cv.replaceWith(img));
  frame.style.transform=t;b.classList.remove('saving');
  setTimeout(()=>{b.textContent=old;},2200);
});

document.querySelectorAll('.cp').forEach(b=>b.onclick=async()=>{
  const box=b.previousElementSibling;
  try{await navigator.clipboard.writeText(box.innerText);}catch(e){const r=document.createRange();r.selectNodeContents(box);const s=getSelection();s.removeAllRanges();s.addRange(r);document.execCommand('copy');}
  b.textContent='تم النسخ ✓';setTimeout(()=>{b.textContent='نسخ النص';},1800);
});
</script></body></html>`;

  fs.writeFileSync(out, page, 'utf8');
  console.log('✔', out, (fs.statSync(out).size / 1e6).toFixed(1) + 'MB', '·', specs.length, 'تصميم');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
