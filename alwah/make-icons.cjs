// يولّد أيقونات ألواح:  node alwah/make-icons.cjs   (يحتاج Chrome والإنترنت لخط «عارف رقعة»)
// لوحٌ فاتح بقمّةٍ مقوّسة وشريطٌ ذهبيّ، مكتوبٌ عليه «ألواح» بخط الرقعة
const p = require('C:/Users/ahmed/Semak/rega-registration/node_modules/puppeteer-core');
const path = require('path');
const W = '\u0623\u0644\u0648\u0627\u062D';

const art = pad => {
    const s = 512, w = s - pad * 2;
    const bw = w * 0.56, bh = w * 0.72, bx = pad + (w - bw) / 2, by = pad + w * 0.16;
    const r = bw / 2;                                   // قمّة اللوح نصف دائرة
    // موضع الكلمة: حيث كانت الأسطر، فوق الشريط الذهبيّ
    const box = { cx: bx + bw * 0.47, cy: by + r * 0.95 + bh * 0.13, w: bw * 0.78, h: bh * 0.44 };
    return {
        box, svg: `
    <path d="M ${bx} ${by + r} A ${r} ${r} 0 0 1 ${bx + bw} ${by + r} L ${bx + bw} ${by + bh} Q ${bx + bw} ${by + bh + w * 0.04} ${bx + bw - w * 0.04} ${by + bh + w * 0.04}
             L ${bx + w * 0.04} ${by + bh + w * 0.04} Q ${bx} ${by + bh + w * 0.04} ${bx} ${by + bh} Z" fill="#f6ecd6" stroke="#d9c59b" stroke-width="${w * 0.012}"/>
    <circle cx="${bx + bw / 2}" cy="${by + r * 0.55}" r="${w * 0.035}" fill="#b8893a"/>
    <text id="t" x="0" y="0" font-family="Aref Ruqaa" font-weight="700" font-size="200" fill="#1f5f4a">${W}</text>
    <path d="M ${bx + bw * 0.74} ${by + bh * 0.62} L ${bx + bw * 0.74} ${by + bh + w * 0.13} L ${bx + bw * 0.82} ${by + bh + w * 0.09} L ${bx + bw * 0.9} ${by + bh + w * 0.13} L ${bx + bw * 0.9} ${by + bh * 0.62} Z" fill="#b8893a"/>`,
    };
};
const page = (pad, rounded) => {
    const a = art(pad);
    return `<html><head><link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@700&display=block" rel="stylesheet">
<style>html,body{margin:0;background:transparent}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a7a5f"/><stop offset="1" stop-color="#123f31"/></linearGradient></defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  ${a.svg}
</svg>
<script>window.fit = async () => {
  await document.fonts.load('700 200px "Aref Ruqaa"');
  const t = document.getElementById('t'), b = t.getBBox(), B = ${JSON.stringify(a.box)};
  const k = Math.min(B.w / b.width, B.h / b.height);
  t.setAttribute('transform', 'translate(' + (B.cx - (b.x + b.width / 2) * k) + ' ' + (B.cy - (b.y + b.height / 2) * k) + ') scale(' + k + ')');
};</script></body></html>`;
};

(async () => {
    const out = path.join(__dirname, 'public');
    const b = await p.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const pg = await b.newPage();
    for (const [f, size, pad, rounded] of [['icon-512.png', 512, 40, true], ['icon-192.png', 192, 40, true], ['icon-180.png', 180, 40, false], ['icon-maskable.png', 512, 96, false]]) {
        await pg.setViewport({ width: 512, height: 512, deviceScaleFactor: size / 512 });
        await pg.setContent(page(pad, rounded), { waitUntil: 'load' });
        await pg.evaluate(() => window.fit());
        await pg.screenshot({ path: path.join(out, f), omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
        console.log('ok', f);
    }
    await b.close();
})();
