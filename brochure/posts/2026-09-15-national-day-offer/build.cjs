// إعلان اليوم الوطني ٩٦ — «اشترِ وحدتك بـ 663,596 ريال ومكيفاتك علينا» بألوان الطباع الستة.
// تخطيط شبكي بهامش ٤٨: رأس (الشعاران) · صورة الغرفة كاملة بلا طبقات فوقها · بطاقة السعر تتراكب على زاويتها السفلى
// (وتغطي شعار المتجر) · العرض والمواصفات · تذييل التواصل والطبع · شريط نقش الطبع.
// الـ٩٦ مدموجة في السعر (663,5|96). الخلفية src/room.png: غرفة إعلان جري بعد إزالة كتابته ومنظر مكة (compose-room.cjs).
// الهوية: شعار المناسبة يميناً وسماك يساراً (١.٧)، أرضية بلون الطبع (١.٥)، الخط السعودي للعناوين وIBM Plex للتفاصيل (٣).
// الاستعمال: node build.cjs [طبع]
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const K = require('../nd-kliche.cjs');
const D = __dirname;
// رمز الريال السعودي الرسمي (SVG من الخط المفتوح @emran-alhaddad/saudi-riyal-font، رخصة OFL)
const RIYAL = fs.readFileSync(path.join(D, 'src', 'riyal.svg'), 'utf8').replace(/<svg[^>]*>/, '<svg class="riyal" viewBox="0 0 1256 1256" fill="currentColor">');
const b64 = (f, m = 'image/png') => `data:${m};base64,` + fs.readFileSync(path.join(D, 'src', f)).toString('base64');

// color: أرضية الطبع (صفحة ٢٥) · ink: لون السعر على البطاقة البيضاء · accent: لون الـ96 وسطر العرض
const TRAITS = {
  generosity:    { color: '#0050af', ink: '#0050af', accent: '#5aba1c', free: '#ffffff' },
  determination: { color: '#971a4d', ink: '#971a4d', accent: '#5aba1c', free: '#ffffff' },
  vision:        { color: '#7c5d21', ink: '#7c5d21', accent: '#5aba1c', free: '#ffffff' },
  courage:       { color: '#607c4f', ink: '#4c6640', accent: '#5aba1c', free: '#ffffff' },
  authenticity:  { color: '#5aba1c', ink: '#002628', accent: '#3f8f10', free: '#002628' },
  giving:        { color: '#6565e0', ink: '#4f4fc4', accent: '#5aba1c', free: '#ffffff' },
};
const PRICE_A = '663,5', PRICE_B = '96';

// قصّ صورة الغرفة: x 120→1600 و y 505→1347 من الأصل (١٦٠٠×١٦٠٠) داخل إطار ٩٨٤×٥٦٠
const PH = { x: 48, y: 160, w: 984, h: 560, sx: 120, sy: 505 };
const S = PH.w / 1480;

const page = (k, t) => `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:'Saudi';src:url('${b64('Saudi-Bold.ttf', 'font/ttf')}');font-weight:700}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Medium.ttf', 'font/ttf')}');font-weight:500}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Bold.ttf', 'font/ttf')}');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;background:${t.color}}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;background:${t.color};color:#fff}
.wm{position:absolute;left:0;right:0;top:700px;bottom:0;background:url('${b64('semak-wm-bottom.png')}') center bottom/1080px auto no-repeat;opacity:.07}

.semak{position:absolute;top:14px;left:34px;width:176px;filter:brightness(0) invert(1)}
.nd{position:absolute;top:48px;right:48px;width:320px}

.photo{position:absolute;left:${PH.x}px;top:${PH.y}px;width:${PH.w}px;height:${PH.h}px;border-radius:26px;overflow:hidden;
  background:url('${b64('room.png')}') ${-PH.sx * S}px ${-PH.sy * S}px/${1600 * S}px ${1600 * S}px no-repeat;box-shadow:0 18px 40px rgba(0,0,0,.25)}

.price{position:absolute;left:48px;top:580px;width:560px;height:178px;border-radius:24px;background:#fff;color:${t.ink};
  box-shadow:0 18px 40px rgba(0,0,0,.28);padding:22px 34px 0;text-align:right}
.price .k{font-family:'Saudi';font-weight:700;font-size:34px;line-height:1}
.price .v{display:flex;align-items:baseline;justify-content:flex-start;gap:12px;margin-top:-30px}
.price .num{direction:ltr;font-family:'Saudi';font-weight:700;line-height:1;white-space:nowrap}
.price .a{font-size:104px}
.price .b{font-size:142px;color:${t.accent};letter-spacing:-2px}
.price .sar{font-family:'Saudi';font-weight:700;font-size:32px;display:flex;align-items:flex-end} .price .sar svg{width:1.5em;height:1.5em;margin-bottom:.12em}

.free{position:absolute;right:48px;top:742px;font-family:'Saudi';font-weight:700;font-size:58px;line-height:1;color:${t.free}}
.spec{position:absolute;right:48px;top:818px;text-align:right;font-family:'Plex';font-weight:500;font-size:23px;line-height:36px;color:${t.free};opacity:.95}
.spec b{font-weight:700}
.loc{position:absolute;left:48px;top:826px;font-family:'Plex';font-weight:500;font-size:22px;color:${t.free};opacity:.9}

.rule{position:absolute;left:48px;right:48px;top:912px;height:1.5px;background:${t.free};opacity:.3}
${K.css}
.k-contacts{left:48px;bottom:44px;width:600px;display:flex;flex-wrap:wrap;column-gap:24px}
.k-row{height:34px} .k-row span{font-size:19px;color:${t.free}} .k-row svg{width:20px;height:20px;stroke:${t.free}}
.icon{position:absolute;right:48px;bottom:40px;width:88px;height:88px}
.slogan{position:absolute;right:150px;bottom:52px;width:118px}

.strip{position:absolute;left:0;right:0;bottom:0;height:24px;background:url('${b64(`${k}-p1.png`)}') center/24px 24px repeat-x}
</style></head><body><div class="card">
<div class="wm"></div>
<img class="semak" src="${b64('semak-logo.png')}">
<img class="nd" src="${b64('nd-2026-logo.png')}">
<div class="photo"></div>
<div class="price"><div class="k">اشترِ وحدتك بـ</div>
  <div class="v"><div class="num"><span class="a">${PRICE_A}</span><span class="b">${PRICE_B}</span></div><div class="sar">${RIYAL}</div></div></div>
<div class="free">ومكيفاتك علينا</div>
<div class="spec"><b>5 مكيفات</b> جري 18,000 وحدة<br><b>مكيف</b> جري 24,000 وحدة</div>
<div class="loc">سماك البوابة · حي البوابة، مكة المكرمة</div>
<div class="rule"></div>
${K.html}
<img class="icon" src="${b64(`${k}-frame.png`)}">
<img class="slogan" src="${b64(`${k}-slogan.png`)}">
<div class="strip"></div>
</div></body></html>`;

(async () => {
  const only = process.argv[2];
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  for (const [k, t] of Object.entries(TRAITS)) {
    if (only && only !== k) continue;
    const p = await b.newPage();
    await p.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
    await p.setContent(page(k, t), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 300));
    await (await p.$('.card')).screenshot({ path: path.join(D, `offer-${k}.png`) });
    await p.close();
    console.log('✔', k);
  }
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
