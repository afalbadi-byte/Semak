// يولّد أيقونات ألواح من رسمٍ متّجه واحد:  node alwah/make-icons.cjs
// لوحٌ خشبيّ فاتح بقمّةٍ مقوّسة، عليه أسطر، وشريطٌ ذهبيّ: ما يُحفظ اليوم ويُراجع غداً
const sharp = require('C:/Users/ahmed/Semak/rega-registration/node_modules/sharp');
const path = require('path');

const art = pad => {
    const s = 512, w = s - pad * 2;
    const bw = w * 0.56, bh = w * 0.72, bx = pad + (w - bw) / 2, by = pad + w * 0.16;
    const r = bw / 2;                                   // قمّة اللوح نصف دائرة
    const line = (i, len) => `<rect x="${bx + bw * 0.14}" y="${by + r * 0.95 + i * bh * 0.13}" width="${bw * len}" height="${w * 0.028}" rx="${w * 0.014}" fill="#1f5f4a" opacity="${i === 0 ? 0.9 : 0.55}"/>`;
    return `
    <path d="M ${bx} ${by + r} A ${r} ${r} 0 0 1 ${bx + bw} ${by + r} L ${bx + bw} ${by + bh} Q ${bx + bw} ${by + bh + w * 0.04} ${bx + bw - w * 0.04} ${by + bh + w * 0.04}
             L ${bx + w * 0.04} ${by + bh + w * 0.04} Q ${bx} ${by + bh + w * 0.04} ${bx} ${by + bh} Z" fill="#f6ecd6" stroke="#d9c59b" stroke-width="${w * 0.012}"/>
    <circle cx="${bx + bw / 2}" cy="${by + r * 0.55}" r="${w * 0.035}" fill="#b8893a"/>
    ${line(0, 0.72)}${line(1, 0.6)}${line(2, 0.72)}${line(3, 0.48)}
    <path d="M ${bx + bw * 0.74} ${by + bh * 0.62} L ${bx + bw * 0.74} ${by + bh + w * 0.13} L ${bx + bw * 0.82} ${by + bh + w * 0.09} L ${bx + bw * 0.9} ${by + bh + w * 0.13} L ${bx + bw * 0.9} ${by + bh * 0.62} Z" fill="#b8893a"/>`;
};
const svg = (pad, rounded) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a7a5f"/><stop offset="1" stop-color="#123f31"/></linearGradient></defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  ${art(pad)}
</svg>`);

(async () => {
    const out = path.join(__dirname, 'public');
    await sharp(svg(40, true)).resize(512).png().toFile(path.join(out, 'icon-512.png'));
    await sharp(svg(40, true)).resize(192).png().toFile(path.join(out, 'icon-192.png'));
    await sharp(svg(40, false)).resize(180).png().toFile(path.join(out, 'icon-180.png'));
    await sharp(svg(96, false)).resize(512).png().toFile(path.join(out, 'icon-maskable.png'));
    console.log('✔ icons');
})();
