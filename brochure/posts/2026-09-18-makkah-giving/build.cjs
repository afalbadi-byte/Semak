// «في أطهر البقاع» — روحانية مكة + تملّك بمواصفات وضمانات، بهوية طبع «الجود» من اليوم الوطني.
// عناصر الجود من دليل الهوية الرسمي (صفحة ٢٥): اللون #6565e0 والرسمة giving-frame والنقش giving-p2.
// شعار المناسبة الرسمي لا يُستعمل هنا لأن المنشور ليس مناسبةً وطنية — اللون والنقش والرسمة فقط.
// الحقائق كلها من البروشور: داخل حدود الحرم · 15 دقيقة عن المسجد الحرام · 197 م² و5 غرف ·
// ضمانات 50/25/10/3. الصورة من مكتبة الصور الحرة (ملك عام) ولا تُنسب للمشروع.
// الاستعمال: node build.cjs
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const K = require('../nd-kliche.cjs');
const D = __dirname;
const R = path.resolve(D, '..', '..', '..');                    // جذر المستودع
const TR = path.join(R, 'brochure/posts/2026-09-15-national-day-traits/src');
const ND3 = path.join(R, 'brochure/posts/2026-09-15-national-day-3/src');
const STOCK = path.join(R, 'assistant/post/assets/stock');

const b64 = (p, m = 'image/png') => `data:${m};base64,` + fs.readFileSync(p).toString('base64');
const GIVING = '#6565e0';

const page = () => `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:'Saudi';src:url('${b64(path.join(ND3, 'Saudi-Bold.ttf'), 'font/ttf')}');font-weight:700}
@font-face{font-family:'Plex';src:url('${b64(path.join(ND3, 'IBMPlexSansArabic-Medium.ttf'), 'font/ttf')}');font-weight:500}
@font-face{font-family:'Plex';src:url('${b64(path.join(ND3, 'IBMPlexSansArabic-Bold.ttf'), 'font/ttf')}');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;background:${GIVING}}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;background:${GIVING};color:#fff}

/* نقش الجود شريطاً علوياً خلف الصورة */
.band{position:absolute;left:0;right:0;top:0;height:430px;background:url('${b64(path.join(TR, 'giving-p2.png'))}') center/430px 430px repeat-x;opacity:.55}

/* الصورة: الحرم — إطار مستدير يطفو على النقش */
.photo{position:absolute;left:60px;right:60px;top:196px;height:424px;border-radius:32px;overflow:hidden;
  background:url('${b64(path.join(STOCK, 'makkah-color-2.jpg'), 'image/jpeg')}') center 42%/cover no-repeat;
  box-shadow:0 26px 60px rgba(0,0,0,.35)}
.photo::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.15) 0%,rgba(0,0,0,0) 40%,rgba(101,101,224,.55) 100%)}

/* رسمة الجود من الدليل — ختمٌ صغير على زاوية الصورة */
.motif{position:absolute;top:44px;right:56px;width:136px;height:136px;z-index:3;
  filter:drop-shadow(0 8px 18px rgba(0,0,0,.35))}

.semak{position:absolute;top:44px;left:56px;width:188px;filter:brightness(0) invert(1);z-index:3}

.wm{position:absolute;left:0;right:0;top:640px;bottom:0;background:url('${b64(path.join(TR, 'semak-wm-bottom.png'))}') center bottom/1080px auto no-repeat;opacity:.09;
  -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 45%);mask-image:linear-gradient(180deg,transparent 0%,#000 45%)}

.h1{position:absolute;right:60px;top:648px;font-family:'Saudi';font-weight:700;font-size:70px;line-height:1.15;color:#fff}
.h2{position:absolute;right:60px;top:726px;font-family:'Saudi';font-weight:700;font-size:70px;line-height:1.15;color:#ffe9a8}
.sub{position:absolute;right:60px;top:818px;font-family:'Plex';font-weight:500;font-size:25px;line-height:38px;color:rgba(255,255,255,.92);max-width:640px}
.sub b{font-weight:700;color:#ffe9a8}

/* الحقائق: أربع شارات من البروشور */
.facts{position:absolute;left:60px;top:656px;width:322px;display:flex;flex-direction:column;gap:12px}
.fact{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:16px;padding:9px 14px}
.fact .v{font-family:'Saudi';font-weight:700;font-size:27px;line-height:1.1;color:#ffe9a8}
.fact .k{font-family:'Plex';font-weight:500;font-size:16px;color:rgba(255,255,255,.88);margin-top:2px}

.rule{position:absolute;left:60px;right:60px;top:952px;height:1.5px;background:rgba(255,255,255,.3)}
${K.css}
.k-contacts{left:60px;bottom:40px;width:640px;display:flex;flex-wrap:wrap;column-gap:26px}
.k-row{height:34px} .k-row span{font-size:19px;color:#fff} .k-row svg{width:20px;height:20px;stroke:#fff}
</style></head><body><div class="card">
<div class="band"></div>
<div class="photo"></div>
<img class="motif" src="${b64(path.join(TR, 'giving-frame.png'))}">
<img class="semak" src="${b64(path.join(TR, 'semak-logo.png'))}">
<div class="wm"></div>

<div class="h1">في أطهر البقاع</div>
<div class="h2">سكنٌ يليق بالجوار</div>
<div class="sub">مكة المكرمة تسكن عندها القلوب طمأنينة — و<b>سماك البوابة</b> في حي البوابة
<b>داخل حدود الحرم</b>، بتشطيبٍ عصري وضماناتٍ موثّقة.</div>

<div class="facts">
  <div class="fact"><div class="v">15 دقيقة</div><div class="k">عن المسجد الحرام</div></div>
  <div class="fact"><div class="v">197 م² · 5 غرف</div><div class="k">مساحة الوحدة وغرفها</div></div>
  <div class="fact"><div class="v">تصل إلى 50 سنة</div><div class="k">ضمانات موثّقة على الوحدة</div></div>
</div>

<div class="rule"></div>
${K.html}
</div></body></html>`;

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
  await p.setContent(page(), { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));
  await (await p.$('.card')).screenshot({ path: path.join(D, 'makkah-giving.png') });
  await b.close();
  console.log('✔', path.join(D, 'makkah-giving.png'));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
