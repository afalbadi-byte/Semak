// ════════════════════════════════════════════════════════════════════════════
//  فك ملفات DWG في المتصفح (libredwg WASM) واستخراج بيانات التمتير
//  مساران:
//  1) نصوص + ديمنشنات حقيقية → تُرسل كبيانات CAD نصية لـClaude
//  2) رسمة «مفجّرة النصوص» (كل الكتابة خطوط) → نرسم كل لوحة إلى صورة PNG
//     عبر Canvas وتُقرأ بصرياً (مسار الرؤية)
// ════════════════════════════════════════════════════════════════════════════

const r2 = (n) => Math.round((n || 0) * 100) / 100;

// ─── فك الملف وجمع الكيانات ──────────────────────────────────────────────────
export async function parseDwg(file) {
  const { LibreDwg, Dwg_File_Type } = await import('@mlightcad/libredwg-web');
  const lib = await LibreDwg.create('/wasm');
  const buf = new Uint8Array(await file.arrayBuffer());
  const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
  if (!dwg) throw new Error('تعذر فك ملف DWG');
  const db = lib.convert(dwg);
  try { lib.dwg_free(dwg); } catch { /* اختياري */ }

  const texts = [], dims = [];
  for (const e of db.entities || []) {
    if ((e.type === 'TEXT' || e.type === 'MTEXT') && e.text && String(e.text).trim().length >= 2) {
      const p = e.startPoint || e.insertionPoint || {};
      texts.push({ t: String(e.text).trim().slice(0, 80), x: r2(p.x), y: r2(p.y) });
      if (texts.length >= 600) break;
    }
  }
  for (const e of db.entities || []) {
    if (e.type === 'DIMENSION' && e.measurement > 0) {
      const p = e.textPoint || e.insertionPoint || e.definitionPoint || {};
      dims.push({ m: Math.round(e.measurement * 1000) / 1000, x: r2(p.x), y: r2(p.y) });
      if (dims.length >= 600) break;
    }
  }
  return { db, texts, dims };
}

// ─── نقاط تمثيلية لكل كيان (للحدود وكشف الجزر) ───────────────────────────────
function entityPoints(e) {
  const pts = [];
  const add = (x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]); };
  if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') for (const v of e.vertices || []) add(v.x, v.y);
  else if (e.type === 'LINE') { add(e.startPoint?.x, e.startPoint?.y); add(e.endPoint?.x, e.endPoint?.y); }
  else if (e.type === 'ARC' || e.type === 'CIRCLE') { add(e.center?.x - e.radius, e.center?.y - e.radius); add(e.center?.x + e.radius, e.center?.y + e.radius); }
  else if (e.type === 'SPLINE') for (const p of (e.controlPoints?.length ? e.controlPoints : e.fitPoints) || []) add(p.x, p.y);
  else if (e.type === 'SOLID') { add(e.corner1?.x, e.corner1?.y); add(e.corner2?.x, e.corner2?.y); add(e.corner3?.x, e.corner3?.y); }
  else if (e.type === 'TEXT' || e.type === 'MTEXT') { const p = e.startPoint || e.insertionPoint || {}; add(p.x, p.y); }
  else if (e.type === 'INSERT') { const p = e.insertionPoint || {}; add(p.x, p.y); }
  return pts;
}

// ─── كشف الجزر (اللوحات المنفصلة) على شبكة كثافة ─────────────────────────────
export function findIslands(entities) {
  const pts = [];
  for (const e of entities) for (const p of entityPoints(e)) pts.push(p);
  if (!pts.length) return [];
  let minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18;
  for (const [x, y] of pts) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  const W = maxX - minX || 1, H = maxY - minY || 1;
  const G = 48; // دقة الشبكة
  const grid = Array.from({ length: G }, () => Array(G).fill(0));
  for (const [x, y] of pts) {
    const cx = Math.min(G - 1, Math.floor((x - minX) / W * G));
    const cy = Math.min(G - 1, Math.floor((y - minY) / H * G));
    grid[cy][cx]++;
  }
  const thresh = Math.max(3, pts.length / (G * G) * 0.05);
  const seen = Array.from({ length: G }, () => Array(G).fill(false));
  const islands = [];
  for (let sy = 0; sy < G; sy++) for (let sx = 0; sx < G; sx++) {
    if (seen[sy][sx] || grid[sy][sx] < thresh) continue;
    // اتساع بالفيض (BFS) مع سماحية خليّة فارغة واحدة بين الأجزاء
    let q = [[sx, sy]], cMinX = sx, cMaxX = sx, cMinY = sy, cMaxY = sy, weight = 0;
    seen[sy][sx] = true;
    while (q.length) {
      const [cx, cy] = q.pop();
      weight += grid[cy][cx];
      if (cx < cMinX) cMinX = cx; if (cx > cMaxX) cMaxX = cx;
      if (cy < cMinY) cMinY = cy; if (cy > cMaxY) cMaxY = cy;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G || seen[ny][nx] || grid[ny][nx] < thresh) continue;
        seen[ny][nx] = true; q.push([nx, ny]);
      }
    }
    islands.push({
      minX: minX + cMinX / G * W, maxX: minX + (cMaxX + 1) / G * W,
      minY: minY + cMinY / G * H, maxY: minY + (cMaxY + 1) / G * H,
      weight,
    });
  }
  // الأثقل أولاً + هامش 2%
  islands.sort((a, b) => b.weight - a.weight);
  return islands.slice(0, 8).map(i => {
    const mx = (i.maxX - i.minX) * 0.03, my = (i.maxY - i.minY) * 0.03;
    return { minX: i.minX - mx, maxX: i.maxX + mx, minY: i.minY - my, maxY: i.maxY + my };
  });
}

// ─── رسم منطقة إلى PNG ───────────────────────────────────────────────────────
// أقواس البولي-لاين (bulge) تُقسَّم لقطع مستقيمة؛ السبلاين يُقرَّب بنقاط التحكم.
function bulgeSegments(p1, p2, bulge, out) {
  const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
  const chord = Math.hypot(dx, dy);
  if (!chord || !bulge) { out.push(p2); return; }
  const theta = 4 * Math.atan(bulge);          // زاوية القوس (موجبة = عكس عقارب الساعة)
  // قمة القوس: السهم = b·(الوتر)/2 باتجاه يمين الوتر (مشتق من تعريف DXF)
  const sag = bulge * chord / 2;
  const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
  const ax = mx + (dy / chord) * sag, ay = my - (dx / chord) * sag;
  // مركز الدائرة المارّة بالنقاط الثلاث p1، القمة، p2
  const d = 2 * (p1[0] * (ay - p2[1]) + ax * (p2[1] - p1[1]) + p2[0] * (p1[1] - ay));
  if (Math.abs(d) < 1e-12) { out.push(p2); return; }
  const s1 = p1[0] * p1[0] + p1[1] * p1[1], s2 = ax * ax + ay * ay, s3 = p2[0] * p2[0] + p2[1] * p2[1];
  const ccx = (s1 * (ay - p2[1]) + s2 * (p2[1] - p1[1]) + s3 * (p1[1] - ay)) / d;
  const ccy = (s1 * (p2[0] - ax) + s2 * (p1[0] - p2[0]) + s3 * (ax - p1[0])) / d;
  const r = Math.hypot(p1[0] - ccx, p1[1] - ccy);
  const a1 = Math.atan2(p1[1] - ccy, p1[0] - ccx);
  let a2 = Math.atan2(p2[1] - ccy, p2[0] - ccx);
  if (bulge > 0 && a2 < a1) a2 += 2 * Math.PI;   // عكس عقارب الساعة
  if (bulge < 0 && a2 > a1) a2 -= 2 * Math.PI;   // مع عقارب الساعة
  const steps = Math.max(4, Math.ceil(Math.abs(theta) / 0.3));
  for (let s = 1; s <= steps; s++) {
    const a = a1 + (a2 - a1) * (s / steps);
    out.push([ccx + r * Math.cos(a), ccy + r * Math.sin(a)]);
  }
}

export function renderRegionToBlob(entities, region, maxPx = 2000) {
  const W = region.maxX - region.minX, H = region.maxY - region.minY;
  if (W <= 0 || H <= 0) return Promise.resolve(null);
  const s = Math.min(maxPx / W, maxPx / H);
  const cw = Math.max(64, Math.round(W * s)), ch = Math.max(64, Math.round(H * s));
  const canvas = document.createElement('canvas');
  canvas.width = cw; canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = '#000'; ctx.fillStyle = '#000';
  ctx.lineWidth = Math.max(0.6, s * 0.012);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  const X = (x) => (x - region.minX) * s;
  const Y = (y) => (region.maxY - y) * s;
  const inR = (x, y) => x >= region.minX - W && x <= region.maxX + W && y >= region.minY - H && y <= region.maxY + H;

  for (const e of entities) {
    try {
      if (e.type === 'LINE') {
        if (!inR(e.startPoint?.x, e.startPoint?.y) && !inR(e.endPoint?.x, e.endPoint?.y)) continue;
        ctx.beginPath(); ctx.moveTo(X(e.startPoint.x), Y(e.startPoint.y)); ctx.lineTo(X(e.endPoint.x), Y(e.endPoint.y)); ctx.stroke();
      } else if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
        const vs = e.vertices || [];
        if (!vs.length || !inR(vs[0].x, vs[0].y)) continue;
        const pts = [[vs[0].x, vs[0].y]];
        for (let i = 1; i < vs.length; i++) {
          const prev = vs[i - 1];
          if (prev.bulge) bulgeSegments([prev.x, prev.y], [vs[i].x, vs[i].y], prev.bulge, pts);
          else pts.push([vs[i].x, vs[i].y]);
        }
        const closed = (e.flag & 1) === 1 || (e.flag & 512) === 512;
        if (closed && vs.length > 2) {
          const last = vs[vs.length - 1];
          if (last.bulge) bulgeSegments([last.x, last.y], [vs[0].x, vs[0].y], last.bulge, pts);
          else pts.push([vs[0].x, vs[0].y]);
        }
        ctx.beginPath(); ctx.moveTo(X(pts[0][0]), Y(pts[0][1]));
        for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i][0]), Y(pts[i][1]));
        ctx.stroke();
      } else if (e.type === 'ARC') {
        if (!inR(e.center?.x, e.center?.y)) continue;
        let a1 = e.startAngle, a2 = e.endAngle;
        if (a2 < a1) a2 += Math.PI * 2;
        const steps = Math.max(6, Math.ceil((a2 - a1) / 0.2));
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const a = a1 + (a2 - a1) * (i / steps);
          const px = X(e.center.x + e.radius * Math.cos(a)), py = Y(e.center.y + e.radius * Math.sin(a));
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (e.type === 'CIRCLE') {
        if (!inR(e.center?.x, e.center?.y)) continue;
        ctx.beginPath(); ctx.arc(X(e.center.x), Y(e.center.y), Math.max(0.4, e.radius * s), 0, Math.PI * 2); ctx.stroke();
      } else if (e.type === 'SPLINE') {
        const cp = (e.controlPoints?.length ? e.controlPoints : e.fitPoints) || [];
        if (cp.length < 2 || !inR(cp[0].x, cp[0].y)) continue;
        ctx.beginPath(); ctx.moveTo(X(cp[0].x), Y(cp[0].y));
        for (let i = 1; i < cp.length - 1; i++) {
          const xc = (cp[i].x + cp[i + 1].x) / 2, yc = (cp[i].y + cp[i + 1].y) / 2;
          ctx.quadraticCurveTo(X(cp[i].x), Y(cp[i].y), X(xc), Y(yc));
        }
        ctx.lineTo(X(cp[cp.length - 1].x), Y(cp[cp.length - 1].y));
        ctx.stroke();
      } else if (e.type === 'SOLID') {
        if (!inR(e.corner1?.x, e.corner1?.y)) continue;
        ctx.beginPath();
        ctx.moveTo(X(e.corner1.x), Y(e.corner1.y));
        ctx.lineTo(X(e.corner2.x), Y(e.corner2.y));
        ctx.lineTo(X(e.corner4?.x ?? e.corner3.x), Y(e.corner4?.y ?? e.corner3.y));
        ctx.lineTo(X(e.corner3.x), Y(e.corner3.y));
        ctx.closePath(); ctx.fill();
      } else if ((e.type === 'TEXT' || e.type === 'MTEXT') && e.text) {
        const p = e.startPoint || e.insertionPoint;
        if (!p || !inR(p.x, p.y)) continue;
        const hpx = Math.max(6, (e.textHeight || e.height || 0.25) * s);
        ctx.font = `${hpx}px Arial`;
        ctx.fillText(String(e.text).slice(0, 120), X(p.x), Y(p.y));
      }
    } catch { /* كيان تالف — تجاهل */ }
  }
  return new Promise((res) => canvas.toBlob(res, 'image/png'));
}

// ─── رسم لوحات DWG إلى صور (للعرض البصري في الأداة) ──────────────────────────
export async function renderDwgSheets(file, onStage, maxSheets = 4) {
  const { db } = await parseDwg(file);
  const ents = db.entities || [];
  const islands = findIslands(ents);
  const out = [];
  for (let i = 0; i < islands.length && out.length < maxSheets; i++) {
    onStage?.(`جارٍ رسم اللوحة ${i + 1}…`);
    const blob = await renderRegionToBlob(ents, islands[i], 1800);
    if (!blob || blob.size < 4000) continue;
    const url = await new Promise((res, rej) => {
      const rd = new FileReader();
      rd.onload = () => res(String(rd.result));
      rd.onerror = rej;
      rd.readAsDataURL(blob);
    });
    out.push(url);
  }
  return out;
}

// ─── المسار الكامل: DWG → إما بيانات CAD أو صور لوحات ────────────────────────
export async function extractFromDwg(file, onStage) {
  onStage?.('جارٍ فك ملف DWG…');
  const { db, texts, dims } = await parseDwg(file);
  // نصوص وديمنشنات كافية → المسار النصي (أدق وأرخص)
  if (texts.length >= 15 && dims.length >= 10) {
    return { kind: 'cad', cad: JSON.stringify({ texts, dims }) };
  }
  // نصوص مفجّرة → الرسم إلى صور
  onStage?.('النصوص مفجّرة — جارٍ رسم اللوحات…');
  const ents = db.entities || [];
  const islands = findIslands(ents);
  if (!islands.length) throw new Error('الملف لا يحتوي رسماً قابلاً للقراءة');
  const images = [];
  for (let i = 0; i < islands.length && images.length < 6; i++) {
    onStage?.(`جارٍ رسم اللوحة ${i + 1} من ${islands.length}…`);
    const blob = await renderRegionToBlob(ents, islands[i], 2000);
    if (!blob || blob.size < 4000) continue; // لوحة فارغة
    const b64 = await new Promise((res, rej) => {
      const rd = new FileReader();
      rd.onload = () => res(String(rd.result).split(',')[1]);
      rd.onerror = rej;
      rd.readAsDataURL(blob);
    });
    images.push({ data: b64, media_type: 'image/png' });
  }
  if (!images.length) throw new Error('تعذر رسم لوحات من الملف');
  return { kind: 'images', images, texts, dims };
}
