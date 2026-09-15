// منشورات الطباع الخمسة الباقية — نفس نسق «عزّنا بهمّتنا» (قالب الرسوم الرسمي، دليل الهوية ٦.٣) بمقاس مربع.
// العناصر كلها من دليل الهوية الرسمي:
//   <طبع>-frame.png  الرسمة بإطارها   · <طبع>-p1/p2/p3.png النقوش الفرعية   ← صفحة «عناصر الهوية البصرية» (٢٥)
//   <طبع>-slogan.png العبارة الداعمة بالخط السعودي                          ← صفحة «العبارات الداعمة» (٢١)
//   ndlogo-v.png     الشعار الرأسي بألوانه                                   ← صفحة «الشعار الفني» (٩)
// قواعد الدليل: شعار المناسبة أعلى الوسط وسماك أسفل الوسط بأقل من نصف عرضه (١.٧)، أرضية بلون الطبع (١.٥)،
// وعلامة سماك المائية مرة واحدة أسفل البطاقة لا تمسّ النقش ولا هامش الشعار.
// الاستعمال: node build.cjs            ← يُخرج الخمسة
//            node build.cjs vision     ← طبع واحد
const puppeteer = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const fs = require('fs');
const path = require('path');
const D = __dirname;
const b64 = f => 'data:image/png;base64,' + fs.readFileSync(path.join(D, 'src', f)).toString('base64');

// اللون من صفحة ٢٥ لكل طبع، والنقش المختار للشريط على غرار لوحات القالب الرسمي
const TRAITS = {
  vision:       { color: '#7c5d21', band: 'p3', name: 'عزّنا برؤيتنا' },
  courage:      { color: '#607c4f', band: 'p3', name: 'عزّنا بشجاعتنا' },
  authenticity: { color: '#5aba1c', band: 'p1', name: 'عزّنا بأصالتنا' },
  generosity:   { color: '#0050af', band: 'p3', name: 'عزّنا بكرمنا' },
  giving:       { color: '#6565e0', band: 'p2', name: 'عزّنا بجودنا' },
};

const ND_W = 340;
const SEMAK_IMG = Math.round(150 / 0.64); // شعار سماك ظاهر بعرض ١٥٠ ≤ نصف ٣٤٠

const page = (k, t) => `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1080px;background:${t.color}}
.card{position:relative;width:1080px;height:1080px;overflow:hidden;background:${t.color}}
.nd{position:absolute;top:40px;left:50%;transform:translateX(-50%);width:${ND_W}px}
.band{position:absolute;left:0;right:0;top:236px;height:450px;background:url('${b64(`${k}-${t.band}.png`)}') center/450px 450px repeat-x}
.framebox{position:absolute;top:226px;left:50%;transform:translateX(-50%);width:470px;height:470px;background:${t.color}}
.wm{position:absolute;left:0;right:0;top:700px;bottom:0;background:url('${b64('semak-wm-bottom.png')}') center bottom/1080px auto no-repeat;opacity:.1;
  -webkit-mask-image:linear-gradient(180deg,transparent 0%,#000 45%);mask-image:linear-gradient(180deg,transparent 0%,#000 45%)}
.frameimg{position:absolute;top:240px;left:50%;transform:translateX(-50%);width:442px;height:442px}
.slogan{position:absolute;top:722px;left:50%;transform:translateX(-50%);width:270px}
.semak{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);width:${SEMAK_IMG}px;filter:brightness(0) invert(1)}
</style></head><body><div class="card">
<div class="band"></div>
<div class="framebox"></div>
<div class="wm"></div>
<img class="frameimg" src="${b64(`${k}-frame.png`)}">
<img class="nd" src="${b64('ndlogo-v.png')}">
<img class="slogan" src="${b64(`${k}-slogan.png`)}">
<img class="semak" src="${b64('semak-logo.png')}">
</div></body></html>`;

(async () => {
  const only = process.argv[2];
  const b = await puppeteer.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true, args: ['--no-sandbox'] });
  for (const [k, t] of Object.entries(TRAITS)) {
    if (only && only !== k) continue;
    const p = await b.newPage();
    await p.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 2 });
    await p.setContent(page(k, t), { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 300));
    await (await p.$('.card')).screenshot({ path: path.join(D, `national-day-${k}.png`) });
    await p.close();
    console.log('✔', k, t.name);
  }
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
