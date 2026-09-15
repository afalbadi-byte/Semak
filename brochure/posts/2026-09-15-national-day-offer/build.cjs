// إعلان اليوم الوطني ٩٦ — «اشترِ وحدتك بـ 663,596 ريال ومكيفاتك علينا» (عرض أحمد).
// الهوية الوطنية: شعار المناسبة أعلى اليمين وسماك أعلى اليسار بنصف عرضه (دليل ١.٧)، لون طبع الكرم #0050af،
// نقش الفناجيل ورسمة الدلة والعبارة الداعمة «عزّنا بكرمنا» من الدليل، والعناوين بالخط السعودي والتفاصيل بـ IBM Plex.
// صورة المكيف: وحدة جري (GREE) مقتطعة وحدها من صورة زوّدنا بها أحمد — بلا شعار المتجر ولا نصّه.
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const K = require('../nd-kliche.cjs'); // بيانات تواصل سماك
const D = __dirname;
const b64 = (f, m = 'image/png') => `data:${m};base64,` + fs.readFileSync(path.join(D, 'src', f)).toString('base64');

const BLUE = '#0050af', GREEN = '#5aba1c';
const OFFER = {
  price: '663,596',
  units: [['5', 'مكيفات', '18,000'], ['1', 'مكيف', '24,000']],
};

const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:'Saudi';src:url('${b64('Saudi-Bold.ttf', 'font/ttf')}');font-weight:700}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Medium.ttf', 'font/ttf')}');font-weight:500}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Bold.ttf', 'font/ttf')}');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;background:${BLUE}}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;background:${BLUE};color:#fff}
.semak{position:absolute;top:26px;left:34px;width:234px;filter:brightness(0) invert(1)}
.nd{position:absolute;top:62px;right:46px;width:380px}

.n96{position:absolute;top:196px;left:52px;width:340px;text-align:center}
.n96 b{display:block;font-family:'Saudi';font-weight:700;font-size:250px;line-height:.9;color:${GREEN};letter-spacing:-4px;direction:ltr}
.n96 span{display:block;margin-top:-28px;font-family:'Plex';font-weight:700;font-size:26px;color:#fff}

.price{position:absolute;top:232px;right:60px;width:600px;text-align:right}
.price .k{font-family:'Saudi';font-weight:700;font-size:52px;line-height:1.1}
.price .v{display:flex;align-items:baseline;gap:14px;justify-content:flex-start;margin-top:6px}
.price .v b{font-family:'Saudi';font-weight:700;font-size:132px;line-height:1;direction:ltr}
.price .v span{font-family:'Saudi';font-weight:700;font-size:46px}

.band{position:absolute;left:0;right:0;top:486px;height:280px;background:url('${b64('generosity-p3.png')}') center/280px 280px repeat-x}
.acbox{position:absolute;top:474px;left:50%;transform:translateX(-50%);width:610px;height:304px;background:${BLUE};padding:12px}
.acbox img{display:block;width:100%;height:100%;object-fit:cover;border-radius:18px}

.free{position:absolute;top:780px;left:0;right:0;text-align:center;font-family:'Saudi';font-weight:700;font-size:74px;color:${GREEN};line-height:1.05}
.spec{position:absolute;top:864px;left:0;right:0;display:flex;justify-content:center;gap:14px;direction:rtl}
.spec div{font-family:'Plex';font-weight:700;font-size:24px;padding:6px 18px;border-radius:999px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.45)}
.spec small{font-weight:500;opacity:.9}

.wm{position:absolute;left:0;right:0;top:760px;bottom:0;background:url('${b64('semak-wm-bottom.png')}') center bottom/1080px auto no-repeat;opacity:.09;
  -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 45%);mask-image:linear-gradient(180deg,transparent 0%,#000 45%)}
.dallah{position:absolute;right:40px;bottom:22px;width:128px;height:128px}
.slogan{position:absolute;right:186px;bottom:34px;width:180px}
${K.css}
.k-row{height:40px} .k-row span{font-size:22px} .k-row svg{width:23px;height:23px}
</style></head><body><div class="card">
<div class="wm"></div>
<img class="semak" src="${b64('semak-logo.png')}">
<img class="nd" src="${b64('nd-2026-logo.png')}">
<div class="n96"><b>96</b><span>اليوم الوطني السعودي</span></div>
<div class="price"><div class="k">اشترِ وحدتك بـ</div><div class="v"><b>${OFFER.price}</b><span>ريال</span></div></div>
<div class="band"></div>
<div class="acbox"><img src="${b64('ac.png')}"></div>
<div class="free">ومكيفاتك علينا</div>
<div class="spec">${OFFER.units.map(([n, w, btu]) => `<div>${n} ${w} <small>${btu} وحدة</small></div>`).join('')}<div>جري <small>GREE</small></div></div>
<img class="dallah" src="${b64('generosity-frame.png')}">
<img class="slogan" src="${b64('generosity-slogan.png')}">
${K.html}
</div></body></html>`;

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));
  await (await p.$('.card')).screenshot({ path: path.join(D, 'national-day-offer.png') });
  await b.close();
  console.log('✔ national-day-offer.png');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
