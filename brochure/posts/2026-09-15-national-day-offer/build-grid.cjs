// شبكة إنستقرام ثلاثية متصلة (بانوراما ٣٢٤٠×١٤٤٠ تُقسم إلى ثلاث منشورات ٣:٤) بلون طبع الرؤية:
//   يسار = هدية التكييف والسعر · وسط = تصميم طبع الرؤية (قالب الرسوم) · يمين = مواصفات الشقة ومميزاتها + التواصل
// الاتصال: العلامة المائية بنفس حجم التصميم المفرد أسفل كل صورة، والوسطى معكوسة أفقياً فتلتقي خطوطها عند الحدود، وشريط نقش الرؤية يعبر من الوسط إلى الجارتين، شريطا النقش أعلى وأسفل، العلامة المائية ممتدة، أرضية واحدة.
// الحقائق: مواصفات الشقة من البروشور (build-brochure.cjs)، والعرض والمكيفات كما أرسلها أحمد.
// صورة الغرفة src/room.png (compose-room.cjs): إعلان جري بعد إزالة كتابته ومنظر النافذة جبال مكة وبرج الساعة.
// الاستعمال: node build-grid.cjs → grid-1-left.png · grid-2-center.png · grid-3-right.png (٢١٦٠×٢٨٨٠) + grid-preview.jpg
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const sharp = require('C:/Users/ahmed/Semak/rega-registration/node_modules/sharp');
const fs = require('fs');
const path = require('path');
const K = require('../nd-kliche.cjs');
const D = __dirname;
// رمز الريال السعودي الرسمي (SVG من الخط المفتوح @emran-alhaddad/saudi-riyal-font، رخصة OFL)
const RIYAL = fs.readFileSync(path.join(D, 'src', 'riyal.svg'), 'utf8').replace(/<svg[^>]*>/, '<svg class="riyal" viewBox="0 0 1256 1256" fill="currentColor">');
const b64 = (f, m = 'image/png') => `data:${m};base64,` + fs.readFileSync(path.join(D, 'src', f)).toString('base64');

const T = { k: 'vision', color: '#7c5d21', ink: '#7c5d21', accent: '#5aba1c' };

// الغرفة في اليسار: من الأصل x 120→1600 و y 505→1347 بعرض ٩٦٠
const PH = { x: 60, y: 690, w: 960, sx: 120, sy: 505, sw: 1480, sh: 842 };
PH.s = PH.w / PH.sw; PH.h = Math.round(PH.sh * PH.s);

const CHECK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M7 12.5l3.2 3.2L17 9"/></svg>';
const FEATURES = ['غرفة خادمة', 'غرفة غسيل', 'مستودع', 'موقف خاص', 'خزان أرضي وعلوي', 'دخول ذكي ومنزل ذكي'];

const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:'Saudi';src:url('${b64('Saudi-Bold.ttf', 'font/ttf')}');font-weight:700}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Medium.ttf', 'font/ttf')}');font-weight:500}
@font-face{font-family:'Plex';src:url('${b64('IBMPlexSansArabic-Bold.ttf', 'font/ttf')}');font-weight:700}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:3240px;height:1440px;background:${T.color}}
.pano{position:relative;width:3240px;height:1440px;overflow:hidden;background:${T.color};color:#fff}
.wm{position:absolute;bottom:30px;width:1080px;height:520px;opacity:.09;background-position:center bottom;background-size:1080px auto;background-repeat:no-repeat;-webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 50%);mask-image:linear-gradient(180deg,transparent 0%,#000 50%)}
.wm.w1{left:0;background-image:url('${b64('semak-wm-bottom.png')}')}
.wm.w2{left:1080px;background-image:url('${b64('semak-wm-bottom-flop.png')}')}
.wm.w3{left:2160px;background-image:url('${b64('semak-wm-bottom.png')}')}
.strip{position:absolute;left:0;right:0;height:30px;background:url('${b64('vision-p1.png')}') left center/30px 30px repeat-x}
.strip.t{top:0} .strip.b{bottom:0}

/* الوسط: طبع الرؤية — الشريط يعبر إلى الجارتين */
.band{position:absolute;left:900px;width:1440px;top:330px;height:500px;background:url('${b64('vision-p3.png')}') center/500px 500px repeat-x;
  -webkit-mask-image:linear-gradient(90deg,transparent 0,#000 90px,#000 1350px,transparent 1440px);mask-image:linear-gradient(90deg,transparent 0,#000 90px,#000 1350px,transparent 1440px)}
.nd{position:absolute;top:70px;left:${1620 - 180}px;width:360px}
.framebox{position:absolute;top:310px;left:${1620 - 270}px;width:540px;height:540px;background:${T.color}}
.frame{position:absolute;top:325px;left:${1620 - 255}px;width:510px;height:510px}
.slogan{position:absolute;top:890px;left:${1620 - 150}px;width:300px}
.semak{position:absolute;top:1080px;left:${1620 - 140}px;width:280px;filter:brightness(0) invert(1)}

/* اليسار: هدية التكييف */
.L{position:absolute;right:${3240 - 880}px;text-align:right}
.occ{top:80px;font-family:'Plex';font-weight:700;font-size:36px;opacity:.92}
.buy{top:150px;font-family:'Saudi';font-weight:700;font-size:64px;line-height:1}
.price{top:206px;display:flex;align-items:baseline;gap:18px;direction:rtl}
.price .num{direction:ltr;font-family:'Saudi';font-weight:700;line-height:1;white-space:nowrap}
.price .a{font-size:166px} .price .b{font-size:236px;color:${T.accent};letter-spacing:-3px}
.price .sar{font-family:'Saudi';font-weight:700;font-size:54px;display:flex;align-items:flex-end} .price .sar svg{width:1.5em;height:1.5em;margin-bottom:.12em}
.free{top:500px;font-family:'Saudi';font-weight:700;font-size:112px;line-height:1.05;color:${T.accent}}
.photo{position:absolute;left:${PH.x}px;top:${PH.y}px;width:${PH.w}px;height:${PH.h}px;border-radius:28px;overflow:hidden;
  background:url('${b64('room.png')}') ${-PH.sx * PH.s}px ${-PH.sy * PH.s}px/${1600 * PH.s}px ${1600 * PH.s}px no-repeat;box-shadow:0 22px 46px rgba(0,0,0,.3)}
.ac{position:absolute;left:34px;top:1118px;width:600px;border-radius:24px;background:#fff;color:${T.ink};padding:22px 32px;box-shadow:0 18px 40px rgba(0,0,0,.3)}
.ac div{display:flex;justify-content:space-between;align-items:baseline;font-family:'Plex';font-weight:700;font-size:34px;line-height:1.55}
.ac div span:last-child{font-weight:500;font-size:30px}
.ac hr{border:0;border-top:2px solid ${T.ink};opacity:.18;margin:4px 0}

/* اليمين: مواصفات الشقة */
.R{position:absolute;right:80px;text-align:right}
.ttl{top:80px;font-family:'Saudi';font-weight:700;font-size:66px;line-height:1}
.stats{position:absolute;right:80px;top:190px;width:780px;display:grid;grid-template-columns:1fr 1fr;gap:18px;direction:rtl}
.stat{border:2px solid rgba(255,255,255,.35);border-radius:26px;padding:18px 26px 20px;background:rgba(0,0,0,.08)}
.stat b{display:block;font-family:'Saudi';font-weight:700;font-size:118px;line-height:1;color:${T.accent};direction:ltr;text-align:right}
.stat span{font-family:'Plex';font-weight:700;font-size:34px}
.ft{top:700px;font-family:'Saudi';font-weight:700;font-size:52px;line-height:1}
.feat{position:absolute;right:80px;top:786px;width:780px;display:grid;grid-template-columns:1fr 1fr;row-gap:16px;column-gap:24px;direction:rtl}
.feat div{display:flex;align-items:center;gap:12px;font-family:'Plex';font-weight:700;font-size:34px;white-space:nowrap}
.feat svg{width:36px;height:36px;fill:none;stroke:${T.accent};stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;flex:none}
.qr{position:absolute;right:80px;top:1104px;width:200px;text-align:center}
.qr .c{display:inline-block;background:#fff;border-radius:16px;padding:10px;box-shadow:0 10px 26px rgba(0,0,0,.25)}
.qr img{display:block;width:124px;height:124px}
.qr span{display:block;margin-top:8px;font-family:'Plex';font-weight:700;font-size:22px;white-space:nowrap}
.rule{position:absolute;left:2380px;right:80px;top:1072px;height:2px;background:#fff;opacity:.3}
${K.css}
.k-contacts{left:2380px;top:1180px;bottom:auto;width:600px;display:flex;flex-wrap:wrap;column-gap:26px}
.k-row{height:54px} .k-row span{font-size:28px} .k-row svg{width:28px;height:28px}
</style></head><body><div class="pano">
<div class="wm w1"></div><div class="wm w2"></div><div class="wm w3"></div><div class="strip t"></div><div class="strip b"></div>

<div class="band"></div>
<img class="nd" src="${b64('ndlogo-v.png')}">
<div class="framebox"></div>
<img class="frame" src="${b64('vision-frame.png')}">
<img class="slogan" src="${b64('vision-slogan.png')}">
<img class="semak" src="${b64('semak-logo.png')}">

<div class="L occ">بمناسبة اليوم الوطني السعودي</div>
<div class="L buy">اشترِ وحدتك بـ</div>
<div class="L price"><div class="num"><span class="a">663,5</span><span class="b">96</span></div><div class="sar">${RIYAL}</div></div>
<div class="L free">ومكيفاتك علينا</div>
<div class="photo"></div>
<div class="ac"><div><span>5 مكيفات جري</span><span>18,000 وحدة</span></div><hr><div><span>مكيف جري</span><span>24,000 وحدة</span></div></div>

<div class="R ttl">مواصفات الشقة</div>
<div class="stats">
  <div class="stat"><b>197</b><span>متر مربع</span></div>
  <div class="stat"><b>5</b><span>غرف نوم</span></div>
  <div class="stat"><b>4</b><span>دورات مياه</span></div>
  <div class="stat"><b>15</b><span>دقيقة عن المسجد الحرام</span></div>
</div>
<div class="R ft">المميزات</div>
<div class="feat">${FEATURES.map(f => `<div>${CHECK}<span>${f}</span></div>`).join('')}</div>
<div class="qr"><div class="c"><img src="${b64('qr-brochure.png')}"></div><span>امسح لطلب البروشور</span></div>
<div class="rule"></div>
${K.html}
</div></body></html>`;

(async () => {
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 3240, height: 1440, deviceScaleFactor: 2 });
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 400));
  const buf = await (await p.$('.pano')).screenshot();
  await b.close();
  const names = ['1-left', '2-center', '3-right'];
  const tiles = [];
  for (let i = 0; i < 3; i++) {
    const t = sharp(buf).extract({ left: i * 2160, top: 0, width: 2160, height: 2880 });
    await t.clone().png().toFile(path.join(D, `grid-${names[i]}.png`));
    tiles.push(await sharp(buf).extract({ left: i * 2160, top: 0, width: 2160, height: 2880 }).resize(540, 720).toBuffer());
  }
  await sharp({ create: { width: 540 * 3 + 8, height: 720, channels: 3, background: '#ffffff' } })
    .composite(tiles.map((t2, i) => ({ input: t2, left: i * 544, top: 0 }))).jpeg({ quality: 88 }).toFile(path.join(D, 'grid-preview.jpg'));
  console.log('✔ grid');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
