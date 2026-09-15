// منشور اليوم الوطني ٣ — «عزّنا بهمّتنا» على «قالب الرسوم» الرسمي (دليل الهوية ٦.٣) بمقاس مربع.
// كل العناصر من ملفات الهوية الرسمية لا من رسمنا:
//   src/ndlogo.png  src/dots.png  src/frame.png  src/slogan.png  ← illustration template.pdf (لوحة الهمّة)
//   src/Saudi-*.ttf  src/IBMPlexSansArabic-*.ttf                  ← Font.zip (الخط السعودي رئيس، IBM Plex ثانوي)
// قواعد الدليل المطبّقة:
//   ١.٦/١.٧ شعار اليوم الوطني أعلى الوسط، وشعار الجهة الأخرى أسفل الوسط، وعرضه نصف عرض شعار المناسبة
//   ١.٣ مسافة هامشية حول الشعار · ١.٤ الشعار بألوانه لا أبيض/أسود · ٣ الألوان: لون طبع الهمّة #971a4d
//   ٤ العبارة الداعمة «عزّنا بهمّتنا» كما كُتبت في القالب · الوسوم المعتمدة في نص المنشور
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const D = __dirname;
const b64 = (f, m) => `data:${m};base64,` + fs.readFileSync(path.join(D, 'src', f)).toString('base64');
const font = (f, w) => `@font-face{font-family:'Saudi';src:url('${b64(f, 'font/ttf')}');font-weight:${w}}`;
const plex = (f, w) => `@font-face{font-family:'Plex';src:url('${b64(f, 'font/ttf')}');font-weight:${w}}`;

const CRIMSON = '#971a4d';       // لون طبع الهمّة من الدليل
const ND_W = 340;                // عرض شعار اليوم الوطني
const SEMAK_VISIBLE = 150;       // عرض شعار سماك الظاهر ≤ نصف شعار المناسبة (340/2)
const SEMAK_IMG = Math.round(SEMAK_VISIBLE / 0.64); // الشعار يشغل ~٦٤٪ من عرض ملفه

const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
${font('Saudi-Bold.ttf', 700)}${font('Saudi-Regular.ttf', 400)}${plex('IBMPlexSansArabic-Medium.ttf', 500)}${plex('IBMPlexSansArabic-Bold.ttf', 700)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;background:${CRIMSON}}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;background:${CRIMSON}}
.nd{position:absolute;top:40px;left:50%;transform:translateX(-50%);width:${ND_W}px}
.band{position:absolute;left:0;right:0;top:236px;height:450px;background:url('${b64('dots.png', 'image/png')}') center/auto 450px repeat-x}
.framebox{position:absolute;top:226px;left:50%;transform:translateX(-50%);width:470px;height:470px;background:${CRIMSON}}
.frameimg{position:absolute;top:240px;left:50%;transform:translateX(-50%);width:442px;height:442px}
.slogan{position:absolute;top:722px;left:50%;transform:translateX(-50%);width:270px}
.semak{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:${SEMAK_IMG}px;filter:brightness(0) invert(1)}
/* علامة سماك المائية: النقش السداسي فاتحاً فوق العنابي وتحت عناصر الهوية */
.wm{position:absolute;inset:0;background:url('${b64('semak-pattern.png', 'image/png')}') center/640px auto repeat;filter:invert(1);mix-blend-mode:screen;opacity:.07}
</style></head><body><div class="card">
<div class="band"></div>
<div class="framebox"></div>
<div class="wm"></div>
<img class="frameimg" src="${b64('frame.png', 'image/png')}">
<img class="nd" src="${b64('ndlogo-t.png', 'image/png')}">
<img class="slogan" src="${b64('slogan-t.png', 'image/png')}">
<img class="semak" src="${b64('semak-logo.png', 'image/png')}">
</div></body></html>`;

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));
  await (await p.$('.card')).screenshot({ path: path.join(D, 'national-day-3.png') });
  await b.close();
  console.log('✔ national-day-3.png');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
