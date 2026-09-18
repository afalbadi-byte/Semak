// يولّد أيقونات عُهدة من رسمٍ متّجه واحد — شغّله مرّة عند تغيير الشعار:
//   node ohda/make-icons.cjs
const sharp = require('C:/Users/ahmed/Semak/rega-registration/node_modules/sharp');
const path = require('path');

// إيصالٌ بحافّة مسنّنة وعملةٌ كهرمانية: ما يُسجَّل هنا مالٌ ومستندُه
const art = (pad) => {
    const s = 512, i = pad;                    // i: هامش المنطقة الآمنة
    const w = s - i * 2;
    const rx = i + w * 0.22, ry = i + w * 0.14, rw = w * 0.5, rh = w * 0.66;
    const teeth = 7, tw = rw / teeth;
    let zig = '';
    for (let k = 0; k < teeth; k++) {
        const x0 = rx + rw - k * tw;
        zig += ` L ${x0 - tw / 2} ${ry + rh + w * 0.045} L ${x0 - tw} ${ry + rh}`;
    }
    const line = (y, len) => `<rect x="${rx + w * 0.07}" y="${y}" width="${len}" height="${w * 0.034}" rx="${w * 0.017}" fill="#0f6b61" opacity=".55"/>`;
    return `
    <path d="M ${rx} ${ry} L ${rx + rw} ${ry} L ${rx + rw} ${ry + rh}${zig} Z" fill="#fffdf9"/>
    ${line(ry + w * 0.1, rw * 0.62)}
    ${line(ry + w * 0.19, rw * 0.72)}
    ${line(ry + w * 0.28, rw * 0.5)}
    <rect x="${rx + w * 0.07}" y="${ry + w * 0.42}" width="${rw * 0.34}" height="${w * 0.05}" rx="${w * 0.02}" fill="#0f6b61"/>
    <circle cx="${rx + rw + w * 0.02}" cy="${ry + rh - w * 0.02}" r="${w * 0.19}" fill="#e2a33b" stroke="#0f6b61" stroke-width="${w * 0.035}"/>
    <circle cx="${rx + rw + w * 0.02}" cy="${ry + rh - w * 0.02}" r="${w * 0.1}" fill="none" stroke="#fffdf9" stroke-width="${w * 0.03}" opacity=".85"/>`;
};

const svg = (pad, rounded) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#138074"/><stop offset="1" stop-color="#0a4f47"/></linearGradient></defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#g)"/>
  ${art(pad)}
</svg>`);

(async () => {
    const out = path.join(__dirname, 'public');
    await sharp(svg(40, true)).resize(512).png().toFile(path.join(out, 'icon-512.png'));
    await sharp(svg(40, true)).resize(192).png().toFile(path.join(out, 'icon-192.png'));
    // iOS يقصّ الزوايا بنفسه، والمقنَّعة يقصّها أندرويد: كلاهما يريد مربّعاً ملآناً
    await sharp(svg(40, false)).resize(180).png().toFile(path.join(out, 'icon-180.png'));
    await sharp(svg(96, false)).resize(512).png().toFile(path.join(out, 'icon-maskable.png'));
    console.log('icons ok');
})();
