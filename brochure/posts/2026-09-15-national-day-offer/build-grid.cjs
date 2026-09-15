// إعلان العرض لشبكة إنستقرام: ثلاث منشورات ٣:٤ في صف واحد تُقرأ صورةً واحدة متصلة (بانوراما ٣٢٤٠×١٤٤٠ تُقسم ثلاثاً).
//   يسار = العرض · وسط = الأساسية (الغرفة + شعار المناسبة) · يمين = المواصفات والتواصل
// عناصر تعبر الحدود عمداً: الصورة تمتد داخل الجارتين، وبطاقة «ومكيفاتك علينا» تعبر إلى الوسط (وتغطي شعار المتجر)،
// وشريطا نقش الطبع أعلى وأسفل على كامل العرض، والعلامة المائية ممتدة.
// الهوية: شعار المناسبة أعلى الوسط وسماك أسفل الوسط بأقل من نصف عرضه (١.٧)، أرضية لون الطبع (١.٥)، الخط السعودي وIBM Plex (٣).
// الاستعمال: node build-grid.cjs [طبع]   → grid-<طبع>-1-left.png · -2-center.png · -3-right.png (٢١٦٠×٢٨٨٠)
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const sharp = require('C:/Users/ahmed/Semak/rega-registration/node_modules/sharp');
const fs = require('fs');
const path = require('path');
const K = require('../nd-kliche.cjs');
const D = __dirname;
const b64 = (f, m = 'image/png') => `data:${m};base64,` + fs.readFileSync(path.join(D, 'src', f)).toString('base64');

const TRAITS = {
  generosity:    { color: '#0050af', ink: '#0050af', accent: '#5aba1c', text: '#ffffff' },
  determination: { color: '#971a4d', ink: '#971a4d', accent: '#5aba1c', text: '#ffffff' },
  vision:        { color: '#7c5d21', ink: '#7c5d21', accent: '#5aba1c', text: '#ffffff' },
  courage:       { color: '#607c4f', ink: '#4c6640', accent: '#5aba1c', text: '#ffffff' },
  authenticity:  { color: '#5aba1c', ink: '#002628', accent: '#002628', text: '#002628' },
  giving:        { color: '#6565e0', ink: '#4f4fc4', accent: '#5aba1c', text: '#ffffff' },
};

// الغرفة: من الأصل x 120→1600 و y 505→1347 داخل ١٣٨٠ عرضاً، ممتدة ١٥٠ داخل كل جارة
const PH = { x: 930, y: 210, w: 1380, sx: 120, sy: 505, sw: 1480, sh: 842 };
PH.s = PH.w / PH.sw; PH.h = Math.round(PH.sh * PH.s);

const page = (k, t) => `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:'Saudi';src:url('${b64('Saudi-Bold.ttf', 'font/ttf')}');font-weight:700}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Medium.ttf', 'font/ttf')}');font-weight:500}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Bold.ttf', 'font/ttf')}');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:3240px;height:1440px;background:${t.color}}
.pano{position:relative;width:3240px;height:1440px;overflow:hidden;background:${t.color};color:${t.text}}
.wm{position:absolute;left:0;right:0;bottom:0;height:900px;background:url('${b64('semak-wm-bottom.png')}') left bottom/1620px auto repeat-x;opacity:.07}
.strip{position:absolute;left:0;right:0;height:30px;background:url('${b64(`${k}-p1.png`)}') left center/30px 30px repeat-x}
.strip.t{top:0} .strip.b{bottom:0}

/* الوسط */
.nd{position:absolute;top:66px;left:${1620 - 210}px;width:420px}
.photo{position:absolute;left:${PH.x}px;top:${PH.y}px;width:${PH.w}px;height:${PH.h}px;border-radius:30px;overflow:hidden;
  background:url('${b64('room.png')}') ${-PH.sx * PH.s}px ${-PH.sy * PH.s}px/${1600 * PH.s}px ${1600 * PH.s}px no-repeat;box-shadow:0 24px 50px rgba(0,0,0,.28)}
.trait{position:absolute;top:1066px;left:1620px;transform:translateX(-50%);display:flex;align-items:center;gap:22px;direction:rtl}
.trait img.i{width:132px;height:132px} .trait img.s{width:190px}
.semak{position:absolute;bottom:40px;left:${1620 - 130}px;width:260px;filter:${t.text === '#ffffff' ? 'brightness(0) invert(1)' : 'brightness(0)'}}

/* اليسار: العرض */
.occ{position:absolute;top:250px;right:${3240 - 880}px;font-family:'Plex';font-weight:700;font-size:34px;opacity:.92}
.buy{position:absolute;top:330px;right:${3240 - 880}px;font-family:'Saudi';font-weight:700;font-size:64px;line-height:1}
.price{position:absolute;top:392px;right:${3240 - 880}px;display:flex;align-items:baseline;gap:18px;direction:rtl}
.price .num{direction:ltr;font-family:'Saudi';font-weight:700;line-height:1;white-space:nowrap}
.price .a{font-size:188px} .price .b{font-size:266px;color:${t.accent};letter-spacing:-3px}
.price .sar{font-family:'Saudi';font-weight:700;font-size:56px}
.gift{position:absolute;left:90px;top:850px;width:1110px;height:260px;border-radius:30px;background:#fff;color:${t.ink};box-shadow:0 24px 50px rgba(0,0,0,.28)}
.gift span{position:absolute;right:${1110 - 800}px;top:50%;transform:translateY(-50%);font-family:'Saudi';font-weight:700;font-size:112px;line-height:1;white-space:nowrap}
.loc{position:absolute;bottom:92px;right:${3240 - 880}px;font-family:'Plex';font-weight:500;font-size:32px;opacity:.9}

/* اليمين: المواصفات */
.st{position:absolute;right:80px;top:236px;font-family:'Saudi';font-weight:700;font-size:62px;line-height:1}
.row{position:absolute;right:80px;display:flex;align-items:center;gap:30px;direction:rtl}
.row b{font-family:'Saudi';font-weight:700;font-size:190px;line-height:.9;color:${t.accent};min-width:130px;text-align:center}
.row div{font-family:'Saudi';font-weight:700;font-size:56px;line-height:1.15}
.row small{display:block;font-family:'Plex';font-weight:700;font-size:40px;opacity:.92}
.rule{position:absolute;left:${2310 + 60}px;right:80px;top:1010px;height:2px;background:${t.text};opacity:.3}
${K.css}
.k-contacts{left:${2310 + 70}px;top:1052px;bottom:auto}
.k-row{height:52px} .k-row span{font-size:30px;color:${t.text}} .k-row svg{width:30px;height:30px;stroke:${t.text}}
</style></head><body><div class="pano">
<div class="wm"></div><div class="strip t"></div><div class="strip b"></div>

<div class="occ">بمناسبة اليوم الوطني السعودي</div>
<div class="buy">اشترِ وحدتك بـ</div>
<div class="price"><div class="num"><span class="a">663,5</span><span class="b">96</span></div><div class="sar">ريال</div></div>
<div class="loc">سماك البوابة · حي البوابة، مكة المكرمة</div>

<img class="nd" src="${b64('nd-2026-logo.png')}">
<div class="photo"></div>
<div class="gift"><span>ومكيفاتك علينا</span></div>
<div class="trait"><img class="i" src="${b64(`${k}-frame.png`)}"><img class="s" src="${b64(`${k}-slogan.png`)}"></div>
<img class="semak" src="${b64('semak-logo.png')}">

<div class="st">المكيفات</div>
<div class="row" style="top:340px"><b>5</b><div>مكيفات جري<small>18,000 وحدة</small></div></div>
<div class="row" style="top:640px"><b>1</b><div>مكيف جري<small>24,000 وحدة</small></div></div>
<div class="rule"></div>
${K.html}
</div></body></html>`;

(async () => {
  const only = process.argv[2] || 'generosity';
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  for (const [k, t] of Object.entries(TRAITS)) {
    if (only !== 'all' && only !== k) continue;
    const p = await b.newPage();
    await p.setViewport({ width: 3240, height: 1440, deviceScaleFactor: 2 });
    await p.setContent(page(k, t), { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await new Promise(r => setTimeout(r, 400));
    const buf = await (await p.$('.pano')).screenshot();
    await p.close();
    const names = ['1-left', '2-center', '3-right'];
    for (let i = 0; i < 3; i++) await sharp(buf).extract({ left: i * 2160, top: 0, width: 2160, height: 2880 }).png().toFile(path.join(D, `grid-${k}-${names[i]}.png`));
    // معاينة الشبكة كما تظهر في الحساب (فواصل رفيعة)
    const tiles = await Promise.all([0, 1, 2].map(i => sharp(buf).extract({ left: i * 2160, top: 0, width: 2160, height: 2880 }).resize(540, 720).toBuffer()));
    await sharp({ create: { width: 540 * 3 + 8, height: 720, channels: 3, background: '#ffffff' } })
      .composite(tiles.map((t2, i) => ({ input: t2, left: i * 544, top: 0 }))).jpeg({ quality: 88 }).toFile(path.join(D, `grid-${k}-preview.jpg`));
    console.log('✔', k);
  }
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
