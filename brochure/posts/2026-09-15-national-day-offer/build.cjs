// إعلان اليوم الوطني ٩٦ — «اشترِ وحدتك بـ 663,596 ريال ومكيفاتك علينا» بألوان الطباع الستة.
// الـ٩٦ مدموج في السعر نفسه (663,5|96) ومكبّر بلون مميّز — لا رقم منفصل.
// الخلفية src/room.png: غرفة إعلان جري كاملة بعد إزالة كتابته، ومنظر النافذة جبال مكة وبرج الساعة من صورة البروشور (compose-room.cjs).
// شعار المناسبة أعلى اليمين وسماك أعلى اليسار (١.٧)، الأرضية بلون الطبع (١.٥)، الرسمة والعبارة الداعمة للطبع أسفل اليمين،
// العناوين بالخط السعودي والتفاصيل بـ IBM Plex (٣). المكيف: وحدة جري مقتطعة من صورة زوّدنا بها أحمد.
// الاستعمال: node build.cjs [طبع]
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const K = require('../nd-kliche.cjs');
const D = __dirname;
const b64 = (f, m = 'image/png') => `data:${m};base64,` + fs.readFileSync(path.join(D, 'src', f)).toString('base64');

// لون كل طبع من صفحة ٢٥؛ لون التمييز أخضر الهوية إلا حيث لا يُقرأ
const TRAITS = {
  generosity:    { color: '#0050af', accent: '#5aba1c' },
  determination: { color: '#971a4d', accent: '#5aba1c' },
  vision:        { color: '#7c5d21', accent: '#5aba1c' },
  courage:       { color: '#607c4f', accent: '#bff08f' },
  authenticity:  { color: '#5aba1c', accent: '#002628' },
  giving:        { color: '#6565e0', accent: '#5aba1c' },
};
const PRICE_A = '663,5', PRICE_B = '96';
const UNITS = [['5', 'مكيفات', '18,000'], ['1', 'مكيف', '24,000']];

const page = (k, t) => `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:'Saudi';src:url('${b64('Saudi-Bold.ttf', 'font/ttf')}');font-weight:700}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Medium.ttf', 'font/ttf')}');font-weight:500}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Bold.ttf', 'font/ttf')}');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;background:${t.color}}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;background:${t.color};color:#fff}
/* الخلفية: الغرفة كاملة، مقصوصة بحيث يقع شعار المتجر أسفل اليسار تحت الشريط السفلي */
.photo{position:absolute;inset:0;background:url('${b64('room.png')}') -120px 0/1200px 1200px no-repeat}
.topfade{position:absolute;left:0;right:0;top:0;height:200px;background:linear-gradient(180deg,${t.color}f2 0%,${t.color}b3 45%,${t.color}00 100%)}
.semak{position:absolute;top:22px;left:34px;width:206px;filter:brightness(0) invert(1)}
.nd{position:absolute;top:36px;right:40px;width:340px}
.panel{position:absolute;top:150px;right:30px;width:610px;height:226px;border-radius:22px;background:${t.color}eb;box-shadow:0 14px 34px rgba(0,0,0,.28);text-align:center;padding-top:14px}
.buy{font-family:'Saudi';font-weight:700;font-size:40px;line-height:1.1}
.price{display:flex;justify-content:center;align-items:baseline;gap:14px;direction:rtl;margin-top:-30px}
.num{direction:ltr;font-family:'Saudi';font-weight:700;line-height:1;white-space:nowrap}
.num .a{font-size:118px}
.num .b{font-size:176px;color:${t.accent};letter-spacing:-2px}
.price .sar{font-family:'Saudi';font-weight:700;font-size:38px}
.botfade{position:absolute;left:0;right:0;top:690px;bottom:0;background:linear-gradient(180deg,${t.color}00 0%,${t.color} 26%)}
.strip{position:absolute;left:0;right:0;top:770px;height:46px;background:url('${b64(`${k}-p1.png`)}') center/46px 46px repeat-x}
.wm{position:absolute;left:0;right:0;top:816px;bottom:0;background:url('${b64('semak-wm-bottom.png')}') center bottom/1080px auto no-repeat;opacity:.08}
.free{position:absolute;top:824px;right:40px;font-family:'Saudi';font-weight:700;font-size:60px;color:${t.accent};line-height:1.05}
.spec{position:absolute;top:902px;right:40px;display:flex;gap:10px;direction:rtl}
.spec div{font-family:'Plex';font-weight:700;font-size:21px;padding:4px 14px;border-radius:999px;background:rgba(255,255,255,.12);border:1.5px solid rgba(255,255,255,.45)}
.spec small{font-weight:500;opacity:.9}
.icon{position:absolute;right:40px;bottom:20px;width:104px;height:104px}
.slogan{position:absolute;right:160px;bottom:30px;width:150px}
${K.css}
.k-row{height:40px} .k-row span{font-size:22px} .k-row svg{width:23px;height:23px}
</style></head><body><div class="card">
<div class="photo"></div><div class="topfade"></div><div class="botfade"></div><div class="strip"></div><div class="wm"></div>
<img class="semak" src="${b64('semak-logo.png')}">
<img class="nd" src="${b64('nd-2026-logo.png')}">
<div class="panel"><div class="buy">اشترِ وحدتك بـ</div>
<div class="price"><div class="num"><span class="a">${PRICE_A}</span><span class="b">${PRICE_B}</span></div><div class="sar">ريال</div></div></div>
<div class="free">ومكيفاتك علينا</div>
<div class="spec">${UNITS.map(([n, w, btu]) => `<div>${n} ${w} <small>${btu} وحدة</small></div>`).join('')}<div>جري <small>GREE</small></div></div>
<img class="icon" src="${b64(`${k}-frame.png`)}">
<img class="slogan" src="${b64(`${k}-slogan.png`)}">
${K.html}
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
