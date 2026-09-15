// صورة الغرفة: نزيل كتابة إعلان جري، ونستبدل منظر الرياض في النافذة بجبال مكة وبرج الساعة (من صورة البروشور)
const sharp = require('C:/Users/ahmed/Semak/rega-registration/node_modules/sharp');
const SRC = 'C:/Users/ahmed/Downloads/قري.jpeg';
const MK = 'C:/Users/ahmed/Semak/brochure/lite/makkah.jpg';
const OUT = __dirname + '/room-makkah.png';

(async () => {
  const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const px = Buffer.from(data);
  const lum = (i) => data[i] * .3 + data[i + 1] * .59 + data[i + 2] * .11;

  // ── ١) النافذة ──
  const GX1 = 553, GYB = 1035;
  const topY = x => 457 + 0.135 * x;
  const mull = [[104, 122], [309, 327], [494, 512]];
  // منظر مكة: الجزء العلوي من الصورة (قبل جسر البوابة) مكبّراً ليغطي الزجاج
  const mkH = 545, crop = { left: 0, top: 0, width: 488, height: 248 };
  const scale = mkH / crop.height;
  const mkW = Math.round(crop.width * scale);
  const mk = await sharp(MK).extract(crop).resize(mkW, mkH, { kernel: 'lanczos3' }).sharpen({ sigma: 0.8 })
    .modulate({ brightness: 1.02 }).removeAlpha().raw().toBuffer();
  const offX = Math.round((mkW - GX1) / 2) - 200; // البرج في اللوح الأيمن
  // المقدّمة أسفل النافذة: كتل كبيرة غير زرقاء (وسائد ونبات) — نحذف الكتل الصغيرة (أضواء ومبانٍ الرياض)
  const fg = new Uint8Array(W * H);
  for (let y = 945; y < GYB; y++) for (let x = 0; x < GX1; x++) { const i = (y * W + x) * 3; const r = data[i], b = data[i + 2];
    if (!(b >= r + 3 || lum(i) < 70)) fg[y * W + x] = 1; }
  const seen = new Uint8Array(W * H);
  for (let y = 945; y < GYB; y++) for (let x = 0; x < GX1; x++) { const k0 = y * W + x; if (!fg[k0] || seen[k0]) continue;
    const comp = [k0], st = [k0]; seen[k0] = 1; let touchesBottom = false;
    while (st.length) { const k = st.pop(); const cy = (k / W) | 0, cx = k % W; if (cy >= GYB - 2) touchesBottom = true;
      for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || nx >= GX1 || ny < 945 || ny >= GYB) continue;
        const nk = ny * W + nx; if (fg[nk] && !seen[nk]) { seen[nk] = 1; st.push(nk); comp.push(nk); } } }
    if (comp.length < 1500 && !touchesBottom) for (const k of comp) fg[k] = 0; }
  for (let y = 440; y < GYB; y++) for (let x = 0; x < GX1; x++) {
    if (y < topY(x)) continue;
    if (mull.some(([a, b]) => x >= a && x <= b)) continue;
    const i = (y * W + x) * 3, r = data[i], g = data[i + 1], b = data[i + 2];
    // المقدّمة (الوسائد والنبات والمصباح) دافئة أو ساطعة — تبقى
    if (fg[y * W + x]) continue;
    const my = Math.min(mkH - 1, y - 455); if (my < 0) continue;
    const mx = x + offX; if (mx < 0 || mx >= mkW) continue;
    const j = (my * mkW + mx) * 3;
    // حافة ناعمة قرب إطار النافذة العلوي
    const t = Math.min(1, (y - topY(x)) / 3);
    for (let c = 0; c < 3; c++) px[i + c] = Math.round(mk[j + c] * t + data[i + c] * (1 - t));
  }

  // ── ٢) إزالة كتابة جري: قناع الأبيض فوق الجدار ثم تعبئة من الجوار ──
  const mask = new Uint8Array(W * H);
  const acTop = x => 568 - 0.097 * (x - 680) - 6;
  for (let y = 80; y < 540; y++) for (let x = 700; x < 1450; x++) {
    if (x > 660 && x < 1360 && y > acTop(x)) continue;
    const i = (y * W + x) * 3;
    if (data[i] > 205 && data[i + 1] > 200 && data[i + 2] > 190) mask[y * W + x] = 1;
  }
  const D = 7, dil = new Uint8Array(W * H);
  for (let y = 80; y < 545; y++) for (let x = 700; x < 1455; x++) {
    if (!mask[y * W + x]) continue;
    for (let dy = -D; dy <= D; dy++) for (let dx = -D; dx <= D; dx++) {
      const yy = y + dy, xx = x + dx;
      if (xx > 660 && xx < 1360 && yy > acTop(xx) - 2) continue;
      dil[yy * W + xx] = 1;
    }
  }
  // تعبئة تدريجية: كل بكسل مقنّع يأخذ متوسط جيرانه المعروفين، حتى يمتلئ
  let known = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) known[k] = dil[k] ? 0 : 1;
  for (let pass = 0; pass < 80; pass++) {
    let left = 0; const nk = known.slice();
    for (let y = 70; y < 555; y++) for (let x = 690; x < 1465; x++) {
      const k = y * W + x; if (known[k]) continue;
      let s0 = 0, s1 = 0, s2 = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const kk = (y + dy) * W + x + dx; if (!known[kk]) continue;
        const ii = kk * 3; s0 += px[ii]; s1 += px[ii + 1]; s2 += px[ii + 2]; n++;
      }
      if (n >= 3) { const ii = k * 3; px[ii] = s0 / n; px[ii + 1] = s1 / n; px[ii + 2] = s2 / n; nk[k] = 1; } else left++;
    }
    known = nk; if (!left) break;
  }
  // حبيبات خفيفة كي لا تبدو الرقعة ملساء
  for (let k = 0; k < W * H; k++) if (dil[k]) { const n = (Math.random() - .5) * 10; for (let c = 0; c < 3; c++) px[k * 3 + c] = Math.max(0, Math.min(255, px[k * 3 + c] + n)); }

  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png().toFile(OUT);
  await sharp(OUT).resize(900).jpeg().toFile(__dirname + '/room-preview.jpg');
  console.log('ok');
})();
