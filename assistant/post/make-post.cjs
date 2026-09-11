// أداة «منشور سماك» — القالب الثابت: الشعار أعلى اليسار · العنوان (سطر كحلي/أبيض + سطر ذهبي) ·
// عمود التواصل أسفل اليسار · رمز طلب البروشور أسفل اليمين. يُصدَّر ٢١٦٠×٢١٦٠ (يُنشر ١٠٨٠).
// الاستعمال:  node assistant/post/make-post.cjs <مسار spec.json>
// المخرجات بجانب spec.json:  <name>.png · caption.txt · preview.html (صفحة الحفظ من الجوال)
const fs = require('fs');
const path = require('path');

// أصول الهوية (الشعار والخط والنقش والرمز) داخل assets/ — الأداة مكتفية بنفسها على أي جهاز.
// الصور والمكتبات تُطلب من المستودع صعوداً (يعمل من الجذر أو من نسخة عمل داخله).
const A = f => path.join(__dirname, 'assets', f);
const ROOTS = [];
for (let d = path.resolve(__dirname, '..', '..'), i = 0; i < 6; i++, d = path.dirname(d)) {
  if (fs.existsSync(path.join(d, 'package.json'))) ROOTS.push(d);
  if (path.dirname(d) === d) break;
}
function need(mod) {
  for (const t of [mod, ...ROOTS.flatMap(r => [path.join(r, 'node_modules', mod), path.join(r, 'rega-registration', 'node_modules', mod)])]) {
    try { return require(t); } catch (e) { /* جرّب المسار التالي */ }
  }
  throw new Error('لم أجد ' + mod + ' — ثبّته مرة واحدة: npm i --no-save ' + mod);
}
const puppeteer = need('puppeteer-core');
const sharp = need('sharp');
const CHROME = [process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].filter(Boolean).find(p => fs.existsSync(p));

if (!process.argv[2] || !fs.existsSync(process.argv[2])) {
  console.error('الاستعمال: node assistant/post/make-post.cjs <spec.json>');
  process.exit(1);
}
const specPath = path.resolve(process.argv[2]);
const S = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const DIR = path.dirname(specPath);
const NAME = S.name || path.basename(DIR);

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const find = f => [f, path.join(DIR, f), ...ROOTS.map(r => path.join(r, f))].find(p => path.isAbsolute(p) && fs.existsSync(p));
const uri = f => {
  const p = find(f);
  if (!p) throw new Error('الصورة غير موجودة: ' + f);
  return 'data:' + (MIME[path.extname(p).toLowerCase()] || 'image/png') + ';base64,' + fs.readFileSync(p).toString('base64');
};
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── ثوابت الهوية — لا تُغيَّر من المنشور ─────────────────────────────────
// الرمز منسوخ بكسلاً بكسلاً من منشورات سماك المنشورة (رمز طلب البروشور)
const QR = A('qr-brochure.png');
const CONTACTS = [['ig', 'info.semak'], ['x', 'semak_sa'], ['web', 'semak.sa'], ['mail', 'info@semak.sa'], ['tel', '920 032 842']];
const ICON = {
  ig: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r=".9" fill="currentColor" stroke="none"/>',
  x: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><path d="M8 7.5l8 9M16 7.5l-8 9"/>',
  web: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5s-1.3 6.7-3.9 9.5c-2.6-2.8-3.9-6-3.9-9.5s1.3-6.7 3.9-9.5z"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 6.5l9 6.5 9-6.5"/>',
  tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
};
const THEME = {
  light: { base: '#f4efe6', ink: '#1a365d', gold: '#b08a45', sub: '#1a365d', logo: A('logo-navy-hd.png'), logoFilter: 'none' },
  dark: { base: '#0a0f1e', ink: '#ffffff', gold: '#c5a059', sub: '#e6eaf1', logo: A('logo-gold-hd.png'), logoFilter: 'brightness(0) invert(1)' },
};

const theme = S.theme === 'dark' ? 'dark' : 'light';
const T = THEME[theme];
const layout = S.layout === 'bottom' ? 'bottom' : 'full';           // bottom = الصورة في النصف السفلي وأعلاه أرضية سادة
const textPos = S.textPos || (theme === 'dark' ? 'bottom' : 'top');  // مكان العنوان
const brackets = S.brackets ?? (theme === 'light');
const wash = Math.max(0, Math.min(1.2, S.wash ?? 1));                // قوة التفتيح/التعتيم فوق الصورة
const a = v => Math.min(0.98, v * wash).toFixed(3);

const CREAM = '244,239,230', NIGHT = '10,15,30';
const veil = theme === 'light'
  ? (layout === 'bottom'
      ? `linear-gradient(180deg, rgba(${CREAM},1) 0%, rgba(${CREAM},1) 41%, rgba(${CREAM},.25) 50%, rgba(${CREAM},.12) 75%, rgba(${CREAM},.35) 100%)`
      : `linear-gradient(180deg, rgba(${CREAM},${a(.94)}) 0%, rgba(${CREAM},${a(.8)}) 36%, rgba(${CREAM},${a(.22)}) 62%, rgba(${CREAM},${a(.45)}) 100%)`)
    + `, radial-gradient(ellipse at 0% 100%, rgba(${CREAM},${a(.85)}) 0%, rgba(${CREAM},0) 52%)`
  : `linear-gradient(180deg, rgba(${NIGHT},${a(.55)}) 0%, rgba(${NIGHT},${a(.15)}) 30%, rgba(${NIGHT},${a(.55)}) 60%, rgba(${NIGHT},${a(.9)}) 100%), radial-gradient(ellipse at 0% 100%, rgba(${NIGHT},${a(.6)}) 0%, rgba(${NIGHT},0) 50%)`;

// «سماك البوابة|مكة المكرمة» → الشطر الأول بلون النص والثاني ذهبي؛ tagBar يضع «|» بينهما
const [tagA, tagB] = S.tag ? String(S.tag).split('|').map(s => s.trim()) : [];
const tagHtml = tagA
  ? `<div class="tag"><span>${esc(tagA)}</span>${tagB ? `${S.tagBar ? '<span> | </span>' : ' '}<span class="g">${esc(tagB)}</span>` : ''}</div>`
  : '';
const hasQr = S.qr !== false;

const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
${fs.readFileSync(A('cairo-embedded.css'), 'utf8')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1080px;background:${T.base}}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;font-family:'Cairo',Tahoma,sans-serif;background:${T.base}}
.photo{position:absolute;left:0;right:0;bottom:0;top:${layout === 'bottom' ? '40%' : '0'};background:url('${uri(S.photo)}') ${S.photoPos || 'center'}/cover no-repeat}
.veil{position:absolute;inset:0;background:${veil}}
.pattern{position:absolute;inset:0;background:url('${uri(A('pattern-tile.png'))}') -40px -20px/700px auto repeat-x;opacity:${theme === 'light' ? (S.pattern ?? 0.05) : 0};mix-blend-mode:multiply;
  -webkit-mask-image:linear-gradient(175deg,#000 0%,#000 28%,rgba(0,0,0,.4) 42%,transparent 53%);mask-image:linear-gradient(175deg,#000 0%,#000 28%,rgba(0,0,0,.4) 42%,transparent 53%)}
.logo{position:absolute;left:43px;top:40px;width:270px;filter:${T.logoFilter}}
.tag{position:absolute;top:52px;right:78px;font-size:31px;font-weight:800;color:${T.ink}}
.tag .g{color:${T.gold}}
.block{position:absolute;right:78px;${textPos === 'bottom' ? 'bottom:292px' : 'top:' + (tagA ? 150 : 132) + 'px'};text-align:right;max-width:${textPos === 'bottom' ? 930 : 660}px}
.in{position:relative;display:inline-block}
.l1,.l2{font-weight:900;line-height:1.3;white-space:nowrap;font-size:${S.size || 76}px}
.l1{color:${T.ink}} .l2{color:${T.gold}}
.sub{margin-top:10px;font-size:${S.subSize || 30}px;font-weight:700;color:${T.sub};white-space:nowrap}
${theme === 'dark' ? '.l1,.l2,.sub,.tag,.note{text-shadow:0 3px 18px rgba(0,0,0,.55)}' : ''}
${brackets ? `.in::before{content:"";position:absolute;top:-24px;right:-34px;width:58px;height:58px;border-top:3px solid ${T.gold};border-right:3px solid ${T.gold}}
.in::after{content:"";position:absolute;left:-30px;bottom:-40px;width:58px;height:58px;border-bottom:3px solid ${T.gold};border-left:3px solid ${T.gold}}` : ''}
.note{position:absolute;right:${hasQr ? 190 : 78}px;bottom:${hasQr ? 250 : 60}px;font-size:28px;font-weight:800;color:${T.ink}}
.contacts{position:absolute;left:50px;bottom:36px;direction:ltr}
.row{display:flex;align-items:center;gap:18px;height:48px}
.row svg{width:30px;height:30px;fill:none;stroke:${T.gold};stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
.row span{font-size:29px;font-weight:800;color:${T.ink};letter-spacing:.2px}
.qr{position:absolute;right:44px;bottom:26px;width:130px;text-align:center}
.qr .c{display:inline-block;background:#fff;border-radius:14px;padding:10px;box-shadow:0 6px 18px rgba(10,15,30,.2)}
.qr img{display:block;width:100px;height:100px}
.qr .t{margin-top:10px;font-size:23px;font-weight:800;line-height:1.3;color:${T.ink}}
</style></head><body><div class="card">
<div class="photo"></div><div class="veil"></div><div class="pattern"></div>
<img class="logo" src="${uri(T.logo)}">
${tagHtml}
<div class="block"><div class="in">
  ${S.line1 ? `<div class="l1">${esc(S.line1)}</div>` : ''}
  ${S.line2 ? `<div class="l2">${esc(S.line2)}</div>` : ''}
  ${S.sub ? `<div class="sub">${esc(S.sub)}</div>` : ''}
</div></div>
${S.note ? `<div class="note">${esc(S.note)}</div>` : ''}
<div class="contacts">${CONTACTS.map(([k, v]) => `<div class="row"><svg viewBox="0 0 24 24">${ICON[k]}</svg><span>${v}</span></div>`).join('')}</div>
${hasQr ? `<div class="qr"><div class="c"><img src="${uri(QR)}"></div><div class="t">امسح لطلب<br>البروشور</div></div>` : ''}
</div>
<script>
// إن طال سطر عن عرضه صغّرناه حتى يتّسع — لا قصّ ولا التفاف
const MAX = parseFloat(getComputedStyle(document.querySelector('.block')).maxWidth);
for (const el of document.querySelectorAll('.l1,.l2,.sub')) {
  let size = parseFloat(getComputedStyle(el).fontSize);
  while (el.scrollWidth > MAX && size > 20) { size -= 2; el.style.fontSize = size + 'px'; }
}
</script></body></html>`;

(async () => {
  if (!CHROME) throw new Error('لم أجد Chrome ولا Edge — عيّن CHROME_PATH');
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load', timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 600));
  const shrunk = await p.evaluate(() => [...document.querySelectorAll('.l1,.l2,.sub')]
    .filter(e => e.style.fontSize && parseFloat(e.style.fontSize) < (e.className === 'sub' ? 24 : 54))
    .map(e => e.textContent.trim()));
  const png = path.join(DIR, NAME + '.png');
  await (await p.$('.card')).screenshot({ path: png });
  await b.close();

  const caption = Array.isArray(S.caption) ? S.caption.join('\n') : (S.caption || '');
  fs.writeFileSync(path.join(DIR, 'caption.txt'), caption, 'utf8');
  const img = 'data:image/png;base64,' + fs.readFileSync(png).toString('base64');
  fs.writeFileSync(path.join(DIR, 'preview.html'), `<title>منشور سماك</title>
<style>
:root{--bg:#f6f1e7;--card:#fff;--ink:#1a365d;--soft:#5b6472;--gold:#c5a059;--line:rgba(197,160,89,.35);--sh:rgba(26,54,93,.18)}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0a0f1e;--card:#141b2e;--ink:#f1ede2;--soft:#a9b2c3;--line:rgba(197,160,89,.4);--sh:rgba(0,0,0,.5)}}
:root[data-theme="dark"]{--bg:#0a0f1e;--card:#141b2e;--ink:#f1ede2;--soft:#a9b2c3;--line:rgba(197,160,89,.4);--sh:rgba(0,0,0,.5)}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:Cairo,Tahoma,sans-serif;display:flex;justify-content:center;padding:26px 16px 56px}
.p{width:100%;max-width:560px;display:flex;flex-direction:column;gap:20px}
.e{color:var(--gold);font-weight:800;font-size:13px;letter-spacing:.14em;text-align:center}
h1{margin:0;text-align:center;font-size:clamp(22px,5vw,28px);font-weight:900}
.i{color:var(--soft);font-weight:700;text-align:center;line-height:1.9;margin:0}
.i b{color:var(--ink)}
.f{border-radius:22px;overflow:hidden;border:1px solid var(--line);box-shadow:0 18px 44px var(--sh)}
.f img{display:block;width:100%;height:auto}
.c{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
.c small{color:var(--gold);font-weight:800}
.c div{white-space:pre-wrap;line-height:1.9;font-weight:600}
button{align-self:flex-start;background:var(--gold);color:#1a1206;border:0;border-radius:12px;padding:10px 22px;font:800 14px Cairo,Tahoma,sans-serif;cursor:pointer}
</style>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet">
<div class="p" dir="rtl">
<div class="e">سماك العقارية</div>
<h1>الصورة جاهزة للحفظ</h1>
<p class="i">اضغط ضغطة <b>مطوّلة</b> على الصورة، ثم اختر <b>«حفظ الصورة»</b> — بعدها افتح إنستقرام وارفعها من المعرض.</p>
<div class="f"><img src="${img}" alt="${esc(S.line1)} ${esc(S.line2)}"></div>
${caption ? `<div class="c"><small>نص المنشور</small><div id="cap">${esc(caption)}</div><button id="cp">نسخ النص</button></div>` : ''}
</div>
<script>
const b = document.getElementById('cp');
if (b) b.onclick = async () => {
  const t = document.getElementById('cap').innerText;
  try { await navigator.clipboard.writeText(t); }
  catch (e) { const r = document.createRange(); r.selectNodeContents(document.getElementById('cap')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand('copy'); }
  b.textContent = 'تم النسخ ✓'; setTimeout(() => { b.textContent = 'نسخ النص'; }, 1800);
};
</script>`, 'utf8');

  const m = await sharp(png).metadata();
  console.log('✔', png, m.width + '×' + m.height);
  console.log('✔', path.join(DIR, 'preview.html'));
  if (shrunk.length) console.log('⚠ صُغِّر الخط كثيراً لطول السطر — اختصره:', shrunk.join(' / '));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
