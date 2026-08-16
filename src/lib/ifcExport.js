// ════════════════════════════════════════════════════════════════════════════
//  مولّد IFC4 — نقطة بداية BIM للمهندس (يفتحه Revit مباشرة)
//  مساران:
//   A) من DWG: يقرأ خطوط الجدران الحقيقية من طبقات الجدران (A-WALL / WALL...)
//      لكل لوحة/دور → جدران بمواضعها الهندسية الفعلية (بلا تخمين). الأدق.
//   B) من الفراغات فقط (صورة/PDF): مستطيلات الغرف تقريبية — احتياطي.
// ════════════════════════════════════════════════════════════════════════════

let WALL_T = 0.20;     // سماكة الجدار الافتراضية للخطوط المفردة (تُضبط من الخيارات)
const H_DEFAULT = 3.3;
const SLAB_T = 0.30;   // سماكة بلاطة السقف (م)

// ─── مساعدات كتابة IFC ────────────────────────────────────────────────────────
function guid() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let s = ''; for (let i = 0; i < 22; i++) s += chars[Math.floor(Math.random() * 64)];
  return s;
}
const f = (n) => { const s = Number(n).toFixed(4).replace(/\.?0+$/, ''); return s === '' || s === '-0' ? '0' : s; };
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "''");
function ifcText(s) {
  let out = '', run = '';
  const flush = () => { if (run) { out += `\\X2\\${run}\\X0\\`; run = ''; } };
  for (const ch of String(s || '')) {
    const c = ch.codePointAt(0);
    if (c < 128) { flush(); out += esc(ch); }
    else run += c.toString(16).toUpperCase().padStart(4, '0');
  }
  flush(); return out;
}

// ─── A) قراءة قطع الجدران من DWG لكل لوحة ────────────────────────────────────
// يرجع: [{ name, segs:[{x1,y1,x2,y2}], openings:[{x1,y1,x2,y2,kind}], bbox }]
export async function extractWallSheets(file) {
  const { LibreDwg, Dwg_File_Type } = await import('@mlightcad/libredwg-web');
  const lib = await LibreDwg.create('/wasm');
  const buf = new Uint8Array(await file.arrayBuffer());
  const dwg = lib.dwg_read_data(buf, Dwg_File_Type.DWG);
  if (!dwg) throw new Error('تعذر فك ملف DWG');
  const db = lib.convert(dwg);
  try { lib.dwg_free(dwg); } catch { /* اختياري */ }
  const ents = db.entities || [];

  // طبقات الجدران — نستبعد طبقات التهشير (HATCH) لأنها خطوط تزيينية مائلة قصيرة لا جدران
  const isWall = (l) => /(^|[_-])(A-)?WALL(S)?($|[_-])/i.test(l || '') && !/HATCH|LOW|TEXT|DIM|PATT/i.test(l || '');
  // خط تهشير: قصير ومائل (ليس أفقياً/رأسياً) — يُستبعد حتى لو جاء داخل طبقة الجدران
  const isHatchLike = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len >= 0.6) return false;
    const ang = Math.abs(Math.atan2(y2 - y1, x2 - x1)) * 180 / Math.PI;
    const ortho = ang < 6 || ang > 174 || Math.abs(ang - 90) < 6;
    return !ortho;
  };
  const isDoor = (l) => /DOOR/i.test(l || '');
  const isWin  = (l) => /WINDOW|WIN($|[_-])/i.test(l || '');
  // أعمدة إنشائية: مقاطع مغلقة على طبقات COL / COLUMN / ST-*-COL
  const isColSec = (l) => /COL(UMN)?[-_ ]?SEC|(^|[_-])COL(UMN)?S?($|[_-])/i.test(l || '') && !/HATCH/i.test(l || '');
  // تهشير الجدران/الأعمدة: يدل على خرسانة مسلحة — نستخدمه كتصنيف لا كهندسة
  const isHatchLayer = (l) => /HATCH/i.test(l || '');
  const prefixOf = (l) => { const m = String(l || '').match(/^([A-Za-z0-9]+)_/); return m ? m[1] : 'MAIN'; };

  const sheets = {};
  const ensure = (key) => (sheets[key] = sheets[key] || { name: key, segs: [], openings: [], columns: [], hatchPts: [] });
  const seg = (arr, x1, y1, x2, y2, extra = {}) => {
    if (Math.hypot(x2 - x1, y2 - y1) <= 0.05) return;
    if (!extra.kind && isHatchLike(x1, y1, x2, y2)) return; // جدار: تجاهل خطوط التهشير
    arr.push({ x1, y1, x2, y2, ...extra });
  };
  for (const e of ents) {
    const layer = e.layer || '';
    const key = prefixOf(layer);
    // أعمدة: مضلعات مغلقة صغيرة (≤ 3 م) على طبقة مقاطع الأعمدة
    if (isColSec(layer) && (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE')) {
      const v = e.vertices || [];
      const closed = ((e.flag & 1) === 1 || (e.flag & 512) === 512) && v.length >= 4;
      if (closed) {
        const xs = v.map(p => p.x), ys = v.map(p => p.y);
        const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
        if (w > 0.1 && h > 0.1 && w <= 3 && h <= 3) ensure(key).columns.push({ x: Math.min(...xs), y: Math.min(...ys), w, h });
      }
      continue;
    }
    // تهشير: نحتفظ بمراكز خطوطه لتصنيف الجدران القريبة كخرسانة مسلحة
    if (isHatchLayer(layer) && (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE')) {
      const v = e.vertices || [];
      if (v.length >= 2) ensure(key).hatchPts.push([(v[0].x + v[v.length - 1].x) / 2, (v[0].y + v[v.length - 1].y) / 2]);
      continue;
    }
    const kind = isWall(layer) ? 'wall' : isDoor(layer) ? 'door' : isWin(layer) ? 'window' : null;
    if (!kind) continue;
    ensure(key);
    const target = kind === 'wall' ? sheets[key].segs : sheets[key].openings;
    if (e.type === 'LWPOLYLINE' || e.type === 'POLYLINE') {
      const v = e.vertices || [];
      for (let i = 1; i < v.length; i++) seg(target, v[i - 1].x, v[i - 1].y, v[i].x, v[i].y, kind === 'wall' ? {} : { kind });
      const closed = (e.flag & 1) === 1 || (e.flag & 512) === 512;
      if (closed && v.length > 2) seg(target, v[v.length - 1].x, v[v.length - 1].y, v[0].x, v[0].y, kind === 'wall' ? {} : { kind });
    } else if (e.type === 'LINE') {
      seg(target, e.startPoint?.x, e.startPoint?.y, e.endPoint?.x, e.endPoint?.y, kind === 'wall' ? {} : { kind });
    }
  }
  // تصفية اللوحات الفارغة/التالفة + حساب الصندوق
  const out = [];
  for (const s of Object.values(sheets)) {
    if (s.segs.length < 8) continue;
    let minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18;
    for (const g of s.segs) { minX = Math.min(minX, g.x1, g.x2); maxX = Math.max(maxX, g.x1, g.x2); minY = Math.min(minY, g.y1, g.y2); maxY = Math.max(maxY, g.y1, g.y2); }
    if (maxX - minX < 2 || maxY - minY < 2) continue; // لوحة بلا مقاييس حقيقية
    out.push({ ...s, bbox: { minX, minY, maxX, maxY } });
  }
  // ترتيب من الأعلى للأسفل في اللوحة (الأرضي غالباً أعلى) — ثم نعكس ليصير الأرضي أولاً
  out.sort((a, b) => b.bbox.maxY - a.bbox.maxY);
  return out;
}

// ─── تحويل قطع الخطوط لجدران IFC: كل قطعة = بثق مستطيل بسماكة WALL_T ─────────
function wallFromSeg(add, ctxIds, g, H, idx) {
  const { zDir, subCtx, wcs, stP } = ctxIds;
  const T = g.t > 0 ? g.t : WALL_T;
  const label = g.rc ? `RC Wall ${idx} (${Math.round(T * 100)}cm) — خرسانة مسلحة` : `Wall ${idx} (${Math.round(T * 100)}cm) — بلوك`;
  const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
  const dx = (g.x2 - g.x1) / len, dy = (g.y2 - g.y1) / len;
  const p   = add(`IFCCARTESIANPOINT((${f(g.x1)},${f(g.y1)},0.))`);
  const d   = add(`IFCDIRECTION((${f(dx)},${f(dy)},0.))`);
  const ax  = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${d})`);
  const pl  = add(`IFCLOCALPLACEMENT(#${stP},#${ax})`);
  const c2  = add(`IFCCARTESIANPOINT((${f(len / 2)},0.))`);
  const ax2 = add(`IFCAXIS2PLACEMENT2D(#${c2},$)`);
  const prof= add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${ax2},${f(len)},${f(T)})`);
  const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${wcs},#${zDir},${f(H)})`);
  const shp = add(`IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${ext}))`);
  const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shp}))`);
  return add(`IFCWALL('${guid()}',#${ctxIds.ownId},'${ifcText(label)}',$,'${g.rc ? 'RC' : 'Block'}',#${pl},#${pds},$,${g.rc ? '.SHEAR.' : '.STANDARD.'})`);
}

// عمود خرساني: بثق مستطيل من ركنه السفلي الأيسر
function columnFromRect(add, ctxIds, c, H, idx) {
  const { zDir, xDir, subCtx, wcs, stP, ownId } = ctxIds;
  const p   = add(`IFCCARTESIANPOINT((${f(c.x)},${f(c.y)},0.))`);
  const ax  = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${xDir})`);
  const pl  = add(`IFCLOCALPLACEMENT(#${stP},#${ax})`);
  const c2  = add(`IFCCARTESIANPOINT((${f(c.w / 2)},${f(c.h / 2)}))`);
  const ax2 = add(`IFCAXIS2PLACEMENT2D(#${c2},$)`);
  const prof= add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${ax2},${f(c.w)},${f(c.h)})`);
  const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${wcs},#${zDir},${f(H)})`);
  const shp = add(`IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${ext}))`);
  const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shp}))`);
  const label = `Column ${idx} (${Math.round(c.w * 100)}×${Math.round(c.h * 100)}cm) — عمود خرساني`;
  return add(`IFCCOLUMN('${guid()}',#${ownId},'${ifcText(label)}',$,'RC',#${pl},#${pds},$,.COLUMN.)`);
}

// دمج القطع المتتالية على نفس الاستقامة (يقلل عدد الجدران في Revit)
function mergeCollinear(segs, tol = 0.03) {
  const out = [];
  const used = new Array(segs.length).fill(false);
  const key = (x, y) => `${Math.round(x / tol)}_${Math.round(y / tol)}`;
  const byEnd = new Map();
  segs.forEach((g, i) => { for (const k of [key(g.x1, g.y1), key(g.x2, g.y2)]) { if (!byEnd.has(k)) byEnd.set(k, []); byEnd.get(k).push(i); } });
  const dir = (g) => { const l = Math.hypot(g.x2 - g.x1, g.y2 - g.y1); return [(g.x2 - g.x1) / l, (g.y2 - g.y1) / l]; };
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let cur = { ...segs[i] };
    let grew = true;
    while (grew) {
      grew = false;
      for (const [ex, ey, endIsStart] of [[cur.x2, cur.y2, false], [cur.x1, cur.y1, true]]) {
        const cands = byEnd.get(key(ex, ey)) || [];
        for (const j of cands) {
          if (used[j]) continue;
          const g = segs[j];
          const [dx1, dy1] = dir(cur), [dx2, dy2] = dir(g);
          if (Math.abs(dx1 * dx2 + dy1 * dy2) < 0.995) continue; // ليس على استقامة
          if (cur.t && g.t && Math.abs(cur.t - g.t) > 0.03) continue; // سماكات مختلفة — لا تدمج
          // الطرف الآخر من g
          const touchesEnd = Math.hypot(g.x1 - ex, g.y1 - ey) < tol * 2;
          const other = touchesEnd ? [g.x2, g.y2] : [g.x1, g.y1];
          if (endIsStart) { cur.x1 = other[0]; cur.y1 = other[1]; } else { cur.x2 = other[0]; cur.y2 = other[1]; }
          used[j] = true; grew = true; break;
        }
        if (grew) break;
      }
    }
    out.push(cur);
  }
  return out;
}

// ─── دمج الوجهين المتوازيين لجدار واحد بسماكته الحقيقية ─────────────────────
// رسومات CAD تمثل الجدار بخطين (وجه داخلي/خارجي). نبحث لكل قطعة عن قرين موازٍ
// قريب (0.08–0.45 م) متراكب طولياً ≥60% → نستبدلهما بجدار واحد على خط الوسط.
function pairParallelFaces(segs, minT = 0.08, maxT = 0.45) {
  const n = segs.length, used = new Array(n).fill(false), out = [];
  const info = segs.map(g => {
    const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    const dx = (g.x2 - g.x1) / len, dy = (g.y2 - g.y1) / len;
    return { g, len, dx, dy, nx: -dy, ny: dx };
  });
  // إسقاط نقطة على محور القطعة (t) وبعدها العمودي (d)
  const proj = (a, x, y) => ({ t: (x - a.g.x1) * a.dx + (y - a.g.y1) * a.dy, d: (x - a.g.x1) * a.nx + (y - a.g.y1) * a.ny });
  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    const a = info[i];
    let best = -1, bestScore = 0, bestT = 0;
    for (let j = i + 1; j < n; j++) {
      if (used[j]) continue;
      const b = info[j];
      if (Math.abs(a.dx * b.dx + a.dy * b.dy) < 0.995) continue;          // ليس موازياً
      const p1 = proj(a, b.g.x1, b.g.y1), p2 = proj(a, b.g.x2, b.g.y2);
      const d = (p1.d + p2.d) / 2;
      if (Math.abs(p1.d - p2.d) > 0.05) continue;                          // ليس موازياً فعلاً
      const t = Math.abs(d);
      if (t < minT || t > maxT) continue;                                   // ليس بسماكة جدار
      const lo = Math.max(0, Math.min(p1.t, p2.t)), hi = Math.min(a.len, Math.max(p1.t, p2.t));
      const overlap = hi - lo;
      if (overlap < 0.6 * Math.min(a.len, b.len)) continue;                 // تراكب طولي غير كافٍ
      const score = overlap / (1 + t);
      if (score > bestScore) { bestScore = score; best = j; bestT = t; }
    }
    if (best >= 0) {
      const b = info[best]; used[i] = used[best] = true;
      // خط الوسط: امتداد اتحاد القطعتين على محور a، مُزاح بنصف السماكة نحو b
      const p1 = proj(a, b.g.x1, b.g.y1), p2 = proj(a, b.g.x2, b.g.y2);
      const sgn = Math.sign((p1.d + p2.d) / 2) || 1;
      const lo = Math.min(0, p1.t, p2.t), hi = Math.max(a.len, p1.t, p2.t);
      const ox = a.nx * sgn * bestT / 2, oy = a.ny * sgn * bestT / 2;
      out.push({ x1: a.g.x1 + a.dx * lo + ox, y1: a.g.y1 + a.dy * lo + oy, x2: a.g.x1 + a.dx * hi + ox, y2: a.g.y1 + a.dy * hi + oy, t: bestT });
    } else { used[i] = true; out.push({ ...a.g, t: WALL_T }); }
  }
  return out;
}

// ─── تنظيف شبكي للجدران المتعامدة (أغلب المخططات السكنية) ───────────────────
// 1) قصر (snap) الإحداثيات على شبكة 2 سم  2) دمج كل ما يقع على نفس الخط ولو بينها
// فجوات ≤ 25 سم  3) تمديد الأطراف لتلتقي بالجدار العمودي القريب (زوايا مغلقة)
// 4) حذف القطع القصيرة العائمة التي لا تلامس أي جدار آخر
function cleanOrthoWalls(segs, opts = {}) {
  const grid = opts.grid ?? 0.02, gap = opts.gap ?? 0.25, reach = opts.reach ?? 0.35, minLen = opts.minLen ?? 0.6;
  const sn = (v) => Math.round(v / grid) * grid;
  const H = [], V = [], other = [];
  for (const g of segs) {
    const dx = Math.abs(g.x2 - g.x1), dy = Math.abs(g.y2 - g.y1);
    if (dx >= dy * 8) H.push({ pos: sn((g.y1 + g.y2) / 2), a: sn(Math.min(g.x1, g.x2)), b: sn(Math.max(g.x1, g.x2)), t: g.t, rc: g.rc });
    else if (dy >= dx * 8) V.push({ pos: sn((g.x1 + g.x2) / 2), a: sn(Math.min(g.y1, g.y2)), b: sn(Math.max(g.y1, g.y2)), t: g.t, rc: g.rc });
    else other.push(g); // مائل — يبقى كما هو
  }
  // دمج على نفس الخط (نفس pos ضمن سماكة) مع تجسير الفجوات
  const mergeLine = (arr) => {
    arr.sort((p, q) => p.pos - q.pos || p.a - q.a);
    const out = [];
    for (const s of arr) {
      const last = out[out.length - 1];
      if (last && Math.abs(last.pos - s.pos) <= 0.06 && s.a <= last.b + gap) {
        last.b = Math.max(last.b, s.b); last.rc = last.rc || s.rc; last.t = Math.max(last.t || 0, s.t || 0) || last.t;
      } else out.push({ ...s });
    }
    return out;
  };
  let h = mergeLine(H), v = mergeLine(V);
  // تمديد الأطراف للالتقاء بالعمودي القريب
  const extend = (lines, cross) => {
    for (const s of lines) {
      for (const end of ['a', 'b']) {
        const x = s[end];
        // أقرب جدار عمودي يمر قرب هذا الطرف ويغطي pos
        let best = null, bd = reach + 1;
        for (const c of cross) {
          if (c.a - reach > s.pos || c.b + reach < s.pos) continue;
          const d = Math.abs(c.pos - x);
          if (d <= reach && d < bd) { bd = d; best = c; }
        }
        // نمدّ حتى محور الجدار العمودي بالضبط — Revit يوصل الزاوية تلقائياً
        if (best) s[end] = best.pos;
      }
    }
  };
  extend(h, v); extend(v, h);
  h = mergeLine(h); v = mergeLine(v);
  // حذف القطع القصيرة العائمة:
  // اتصال حقيقي = أحد طرفي القطعة ينتهي عند جدار عمودي يمر بذلك الطرف (وصلة T أو L)
  const endsOn = (s, cross) => cross.some(c => c.a - 0.05 <= s.pos && c.b + 0.05 >= s.pos && (Math.abs(c.pos - s.a) <= 0.05 || Math.abs(c.pos - s.b) <= 0.05));
  // اتصال من الطرفين = قطعة تربط جدارين (وصلة حقيقية) — نبقيها مهما قصرت
  const bothEnds = (s, cross) => cross.some(c => c.a - 0.05 <= s.pos && c.b + 0.05 >= s.pos && Math.abs(c.pos - s.a) <= 0.05)
                              && cross.some(c => c.a - 0.05 <= s.pos && c.b + 0.05 >= s.pos && Math.abs(c.pos - s.b) <= 0.05);
  const keep = (s, cross) => {
    const len = s.b - s.a;
    if (len >= 1.2) return true;                 // جدار طويل — يبقى
    if (bothEnds(s, cross)) return true;         // يربط جدارين — يبقى
    if (len >= minLen && endsOn(s, cross)) return true; // متوسط ومتصل من طرف — يبقى
    return false;                                // قصير معزول أو متصل من طرف فقط — يُحذف
  };
  h = h.filter(s => keep(s, v));
  v = v.filter(s => keep(s, h));
  h = h.filter(s => s.b - s.a >= 0.2); v = v.filter(s => s.b - s.a >= 0.2);
  // الجدران المائلة: تبقى فقط إن كان طرفاها ينتهيان عند جدران متعامدة (جدار حقيقي مشطوف).
  // رموز الدرج/الأسهم/التهشير القاطع تمر عبر الفراغ بلا اتصال → تُحذف.
  const nearWall = (x, y) => h.some(s => Math.abs(s.pos - y) <= 0.12 && x >= s.a - 0.12 && x <= s.b + 0.12)
                          || v.some(s => Math.abs(s.pos - x) <= 0.12 && y >= s.a - 0.12 && y <= s.b + 0.12);
  // افتراضياً لا نُصدّر المائل إطلاقاً (رمز الدرج يمتد جداراً-لجدار داخل بيت الدرج فيخدع اختبار الاتصال).
  // opts.keepDiagonal = true يبقي المائل الطويل المتصل من طرفيه (لمشاريع فيها جدران مشطوفة فعلاً).
  const diag = opts.keepDiagonal ? other.filter(g => nearWall(g.x1, g.y1) && nearWall(g.x2, g.y2) && Math.hypot(g.x2 - g.x1, g.y2 - g.y1) >= 1.5) : [];
  return [
    ...h.map(s => ({ x1: s.a, y1: s.pos, x2: s.b, y2: s.pos, t: s.t, rc: s.rc })),
    ...v.map(s => ({ x1: s.pos, y1: s.a, x2: s.pos, y2: s.b, t: s.t, rc: s.rc })),
    ...diag,
  ];
}

// ─── الملف الكامل ─────────────────────────────────────────────────────────────
// ─── محاذاة الأدوار بمطابقة الجدران ──────────────────────────────────────────
// الجدران الإنشائية (الخارجية، الأعمدة، الدرج) تستمر بين الأدوار. نبحث عن الإزاحة
// (dx,dy) التي تجعل أكبر طول من جدران الدور العلوي ينطبق على جدران الأرضي.
// بحث خشن (10 سم) ثم دقيق (1 سم) حول الأفضل. يعيد الإزاحة ودرجة التطابق بالمتر.
function orthoLines(walls) {
  const h = [], v = [];
  for (const g of walls) {
    if (Math.abs(g.y1 - g.y2) < 0.02) h.push({ pos: g.y1, a: Math.min(g.x1, g.x2), b: Math.max(g.x1, g.x2) });
    else if (Math.abs(g.x1 - g.x2) < 0.02) v.push({ pos: g.x1, a: Math.min(g.y1, g.y2), b: Math.max(g.y1, g.y2) });
  }
  return { h, v };
}
function overlapScore(base, up, dx, dy, tol = 0.06) {
  let s = 0;
  for (const g of up.h) for (const b of base.h) if (Math.abs(b.pos - (g.pos + dy)) <= tol) { const ov = Math.min(b.b, g.b + dx) - Math.max(b.a, g.a + dx); if (ov > 0.3) s += ov; }
  for (const g of up.v) for (const b of base.v) if (Math.abs(b.pos - (g.pos + dx)) <= tol) { const ov = Math.min(b.b, g.b + dy) - Math.max(b.a, g.a + dy); if (ov > 0.3) s += ov; }
  return s;
}
export function findStoreyOffset(baseWalls, upWalls, baseBox, upBox) {
  const B = orthoLines(baseWalls), U = orthoLines(upWalls);
  const dxMin = baseBox.minX - upBox.maxX - 1, dxMax = baseBox.maxX - upBox.minX + 1;
  const dyMin = baseBox.minY - upBox.maxY - 1, dyMax = baseBox.maxY - upBox.minY + 1;
  let best = { s: -1, dx: 0, dy: 0 };
  for (let dx = dxMin; dx <= dxMax; dx += 0.10) for (let dy = dyMin; dy <= dyMax; dy += 0.10) {
    const s = overlapScore(B, U, dx, dy, 0.08); if (s > best.s) best = { s, dx, dy };
  }
  const c = { ...best };
  for (let dx = c.dx - 0.12; dx <= c.dx + 0.12; dx += 0.01) for (let dy = c.dy - 0.12; dy <= c.dy + 0.12; dy += 0.01) {
    const s = overlapScore(B, U, dx, dy, 0.04); if (s > best.s) best = { s, dx, dy };
  }
  return best;
}

// نمط الإخراج:
//  - mergedWalls: كل جدران الدور في عنصر IfcWall واحد (مجسم واحد لكل دور) — افتراضي
//  - محاذاة الأدوار: بمطابقة الجدران المشتركة مع الدور الأرضي (فوق بعض بالضبط)
export function buildIfcFromSheets({ sheets, projectName = 'مشروع سماك', defaultH = H_DEFAULT, floorNames = [], rooms = [], includeOpenings = false, mergedWalls = true, slabT = SLAB_T, wallT = 0.20, includeSlabs = true, includeColumns = true, groundElev = 0, keepDiagonal = false }) {
  const H = Number(defaultH) > 0 ? Number(defaultH) : H_DEFAULT;
  const ST = Number(slabT) > 0 ? Number(slabT) : SLAB_T;
  WALL_T = Number(wallT) > 0 ? Number(wallT) : 0.20;
  const FLOOR_H = H + (includeSlabs ? ST : 0); // ارتفاع الدور الكامل: جدران + بلاطة
  const G0 = Number(groundElev) || 0;           // منسوب الدور الأرضي
  const L = []; let id = 100;
  const add = (line) => { L.push(`#${id}=${line};`); return id++; };

  const orgId  = add(`IFCORGANIZATION($,'Semak Real Estate',$,$,$)`);
  const appId  = add(`IFCAPPLICATION(#${orgId},'2.0','Semak QS BIM Export','SEMAK_QS')`);
  const perId  = add(`IFCPERSON($,'Semak',$,$,$,$,$,$)`);
  const poId   = add(`IFCPERSONANDORGANIZATION(#${perId},#${orgId},$)`);
  const ownId  = add(`IFCOWNERHISTORY(#${poId},#${appId},$,.ADDED.,$,$,$,${Math.floor(Date.now() / 1000)})`);
  const lenU   = add(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const areaU  = add(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const volU   = add(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  const angU   = add(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const units  = add(`IFCUNITASSIGNMENT((#${lenU},#${areaU},#${volU},#${angU}))`);
  const origin = add(`IFCCARTESIANPOINT((0.,0.,0.))`);
  const zDir   = add(`IFCDIRECTION((0.,0.,1.))`);
  const xDir   = add(`IFCDIRECTION((1.,0.,0.))`);
  const wcs    = add(`IFCAXIS2PLACEMENT3D(#${origin},#${zDir},#${xDir})`);
  const ctx    = add(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#${wcs},$)`);
  const subCtx = add(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,#${ctx},$,.MODEL_VIEW.,$)`);
  const proj   = add(`IFCPROJECT('${guid()}',#${ownId},'${ifcText(projectName)}',$,$,$,$,(#${ctx}),#${units})`);
  const siteP  = add(`IFCLOCALPLACEMENT($,#${wcs})`);
  const site   = add(`IFCSITE('${guid()}',#${ownId},'Site',$,$,#${siteP},$,$,.ELEMENT.,$,$,$,$,$)`);
  const bldgP  = add(`IFCLOCALPLACEMENT(#${siteP},#${wcs})`);
  const bldg   = add(`IFCBUILDING('${guid()}',#${ownId},'${ifcText(projectName)}',$,$,#${bldgP},$,$,.ELEMENT.,$,$,$)`);
  add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${proj},(#${site}))`);
  add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${site},(#${bldg}))`);

  const storeyIds = [];
  const stats = { storeys: 0, walls: 0, openings: 0, height: H };
  const defaultNames = ['الدور الأرضي', 'الدور الأول', 'الدور الثاني', 'الملحق العلوي', 'السطح'];

  // ── تنظيف جدران كل دور أولاً (بإحداثيات الرسم الأصلية) ──
  const cleanedPer = sheets.map(sh => {
    const merged = mergeCollinear(sh.segs.map(g => ({ ...g })));
    const paired = pairParallelFaces(merged);
    return cleanOrthoWalls(mergeCollinear(paired).filter(g => Math.hypot(g.x2 - g.x1, g.y2 - g.y1) >= 0.35), { keepDiagonal });
  });
  // ── محاذاة: الأرضي يبدأ من الأصل، وكل دور أعلى يُزاح بمطابقة جدرانه على الأرضي ──
  const base = sheets[0];
  const offsets = sheets.map((sh, si) => {
    if (si === 0) return { dx: -base.bbox.minX, dy: -base.bbox.minY, score: null };
    const r = findStoreyOffset(cleanedPer[0], cleanedPer[si], base.bbox, sh.bbox);
    // إن كان التطابق ضعيفاً (< 8 م) نسقط لمحاذاة المركز ونعلّم ذلك
    if (r.s < 8) {
      const cdx = (base.bbox.minX + base.bbox.maxX) / 2 - (sh.bbox.minX + sh.bbox.maxX) / 2;
      const cdy = (base.bbox.minY + base.bbox.maxY) / 2 - (sh.bbox.minY + sh.bbox.maxY) / 2;
      return { dx: cdx - base.bbox.minX, dy: cdy - base.bbox.minY, score: r.s, weak: true };
    }
    return { dx: r.dx - base.bbox.minX, dy: r.dy - base.bbox.minY, score: r.s };
  });
  stats.alignment = offsets.map((o, i) => i === 0 ? 'base' : (o.weak ? `weak(${o.score.toFixed(1)}m)` : `matched(${o.score.toFixed(1)}m)`));

  sheets.forEach((sh, si) => {
    // كل لوحة = طابق بمنسوب si*(H+بلاطة). الإزاحة المحسوبة تجعل الجدران المشتركة تنطبق
    const ox = -offsets[si].dx, oy = -offsets[si].dy;
    const elev = G0 + si * FLOOR_H;
    const stOrigin = add(`IFCCARTESIANPOINT((0.,0.,${f(elev)}))`);
    const stAx  = add(`IFCAXIS2PLACEMENT3D(#${stOrigin},#${zDir},#${xDir})`);
    const stP   = add(`IFCLOCALPLACEMENT(#${bldgP},#${stAx})`);
    const name  = floorNames[si] || sh.floorName || defaultNames[si] || `الدور ${si + 1}`;
    const storey = add(`IFCBUILDINGSTOREY('${guid()}',#${ownId},'${ifcText(name)}',$,$,#${stP},$,$,.ELEMENT.,${f(elev)})`);
    storeyIds.push(storey);
    const ctxIds = { zDir, xDir, subCtx, wcs, stP, ownId };

    // الجدران المنظفة مسبقاً، منقولة بإزاحة المحاذاة
    const segs = cleanedPer[si].map(g => ({ ...g, x1: g.x1 - ox, y1: g.y1 - oy, x2: g.x2 - ox, y2: g.y2 - oy }));

    // تصنيف: جدار قريب من كثافة تهشير (≥ 3 خطوط تهشير ضمن نصف سماكته + 10 سم) = خرسانة مسلحة
    const hp = (sh.hatchPts || []).map(([x, y]) => [x - ox, y - oy]);
    if (hp.length) {
      for (const g of segs) {
        const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
        const dx = (g.x2 - g.x1) / len, dy = (g.y2 - g.y1) / len;
        const tol = (g.t || WALL_T) / 2 + 0.10;
        let hits = 0;
        for (const [x, y] of hp) {
          const t = (x - g.x1) * dx + (y - g.y1) * dy;
          if (t < -0.05 || t > len + 0.05) continue;
          const d = Math.abs((x - g.x1) * -dy + (y - g.y1) * dx);
          if (d <= tol && ++hits >= 3) { g.rc = true; break; }
        }
      }
    }
    const cleaned = segs;
    let wallIds;
    if (mergedWalls) {
      // مجسم واحد لكل دور: كل الجدران صلبات داخل IfcWall واحد (تمثيل مركّب)
      const solids = cleaned.map(g => {
        const T = g.t > 0 ? g.t : WALL_T;
        const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
        const dx = (g.x2 - g.x1) / len, dy = (g.y2 - g.y1) / len;
        const p   = add(`IFCCARTESIANPOINT((${f(g.x1)},${f(g.y1)},0.))`);
        const d   = add(`IFCDIRECTION((${f(dx)},${f(dy)},0.))`);
        const ax  = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${d})`);
        const c2  = add(`IFCCARTESIANPOINT((${f(len / 2)},0.))`);
        const ax2 = add(`IFCAXIS2PLACEMENT2D(#${c2},$)`);
        const prof= add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${ax2},${f(len)},${f(T)})`);
        return add(`IFCEXTRUDEDAREASOLID(#${prof},#${ax},#${zDir},${f(H)})`);
      });
      const rcCount = cleaned.filter(g => g.rc).length;
      const pl  = add(`IFCLOCALPLACEMENT(#${stP},#${wcs})`);
      const shp = add(`IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(${solids.map(i => '#' + i).join(',')}))`);
      const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shp}))`);
      const label = `${name} — شبكة الجدران (${cleaned.length} قطعة، ${rcCount} خرسانة مسلحة)`;
      wallIds = solids.length ? [add(`IFCWALL('${guid()}',#${ownId},'${ifcText(label)}',$,'WallGrid',#${pl},#${pds},$,.STANDARD.)`)] : [];
      stats.walls += cleaned.length;
      stats.rcWalls = (stats.rcWalls || 0) + rcCount;
    } else {
      wallIds = cleaned.map((g, i) => wallFromSeg(add, ctxIds, g, H, i + 1));
      stats.walls += wallIds.length;
      stats.rcWalls = (stats.rcWalls || 0) + cleaned.filter(g => g.rc).length;
    }

    // الأعمدة الخرسانية من طبقة مقاطع الأعمدة
    const colIds = includeColumns ? (sh.columns || []).map((c, i) => columnFromRect(add, ctxIds, { ...c, x: c.x - ox, y: c.y - oy }, H, i + 1)) : [];
    stats.columns = (stats.columns || 0) + colIds.length;

    // بلاطة سقف الدور: مستطيل يغطي كل جدران الدور (+10 سم حافة) على أعلى الجدران بسماكة ST
    let slabId = null;
    if (includeSlabs && cleaned.length) {
      let sMinX = 1e18, sMinY = 1e18, sMaxX = -1e18, sMaxY = -1e18;
      for (const g of cleaned) {
        const t = (g.t || WALL_T) / 2;
        sMinX = Math.min(sMinX, g.x1 - t, g.x2 - t); sMaxX = Math.max(sMaxX, g.x1 + t, g.x2 + t);
        sMinY = Math.min(sMinY, g.y1 - t, g.y2 - t); sMaxY = Math.max(sMaxY, g.y1 + t, g.y2 + t);
      }
      const edge = 0.10;
      const sw = (sMaxX - sMinX) + 2 * edge, sd = (sMaxY - sMinY) + 2 * edge;
      const p   = add(`IFCCARTESIANPOINT((${f(sMinX - edge)},${f(sMinY - edge)},${f(H)}))`);
      const ax  = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${xDir})`);
      const pl  = add(`IFCLOCALPLACEMENT(#${stP},#${ax})`);
      const c2  = add(`IFCCARTESIANPOINT((${f(sw / 2)},${f(sd / 2)}))`);
      const ax2 = add(`IFCAXIS2PLACEMENT2D(#${c2},$)`);
      const prof= add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${ax2},${f(sw)},${f(sd)})`);
      const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${wcs},#${zDir},${f(ST)})`);
      const shp = add(`IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${ext}))`);
      const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shp}))`);
      const label = `${name} — بلاطة السقف ${Math.round(ST * 100)} سم (${sw.toFixed(1)}×${sd.toFixed(1)} م)`;
      slabId = add(`IFCSLAB('${guid()}',#${ownId},'${ifcText(label)}',$,'RC Slab',#${pl},#${pds},$,.FLOOR.)`);
      stats.slabs = (stats.slabs || 0) + 1;
      stats.slabArea = (stats.slabArea || 0) + sw * sd;
    }

    // الفتحات كعناصر مرجعية (اختياري — افتراضياً مطفأ: فجوات الجدران تحدد الفتحات بدقة
    // والمهندس يضع الأبواب من مكتبة Revit؛ الرسم الخام للأبواب يعطي عناصر مشوّشة)
    const openIds = [];
    for (const o of includeOpenings ? mergeCollinear((sh.openings || []).map(g => ({ ...g, x1: g.x1 - ox, y1: g.y1 - oy, x2: g.x2 - ox, y2: g.y2 - oy }))) : []) {
      const len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1);
      if (len < 0.5 || len > 4) continue; // فتحات منطقية فقط
      const isWin = /win/i.test(o.kind || '');
      const zBase = isWin ? 1.0 : 0.0, hh = isWin ? 1.2 : 2.1;
      const dx = (o.x2 - o.x1) / len, dy = (o.y2 - o.y1) / len;
      const p   = add(`IFCCARTESIANPOINT((${f(o.x1)},${f(o.y1)},${f(zBase)}))`);
      const d   = add(`IFCDIRECTION((${f(dx)},${f(dy)},0.))`);
      const ax  = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${d})`);
      const pl  = add(`IFCLOCALPLACEMENT(#${stP},#${ax})`);
      const c2  = add(`IFCCARTESIANPOINT((${f(len / 2)},0.))`);
      const ax2 = add(`IFCAXIS2PLACEMENT2D(#${c2},$)`);
      const prof= add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${ax2},${f(len)},${f(0.05)})`);
      const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${wcs},#${zDir},${f(hh)})`);
      const shp = add(`IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${ext}))`);
      const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shp}))`);
      openIds.push(add(`IFCBUILDINGELEMENTPROXY('${guid()}',#${ownId},'${isWin ? 'Window' : 'Door'} ref',$,$,#${pl},#${pds},$,$)`));
    }
    stats.openings += openIds.length;

    // الفراغات المسماة (من التمتير) كـIfcSpace بلا هندسة — تظهر في جدول Rooms للمهندس
    const spaceIds = [];
    for (const r of rooms.filter(r => (r.img || 1) === si + 1)) {
      const label = `${r.n ? '#' + r.n + ' ' : ''}${r.name}`;
      spaceIds.push(add(`IFCSPACE('${guid()}',#${ownId},'${ifcText(label)}','${ifcText(`${r.L || ''}×${r.W || ''} م`)}',$,#${stP},$,$,.ELEMENT.,.INTERNAL.,$)`));
    }

    const contained = [...wallIds, ...colIds, ...(slabId ? [slabId] : []), ...openIds];
    if (contained.length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',#${ownId},$,$,(${contained.map(i => '#' + i).join(',')}),#${storey})`);
    if (spaceIds.length) add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${storey},(${spaceIds.map(i => '#' + i).join(',')}))`);
    stats.storeys++;
  });
  add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${bldg},(${storeyIds.map(i => '#' + i).join(',')}))`);

  const ts = new Date().toISOString().slice(0, 19);
  const header = [
    'ISO-10303-21;', 'HEADER;',
    `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`,
    `FILE_NAME('${esc(projectName)}.ifc','${ts}',('Semak'),('Semak Real Estate'),'Semak QS','Semak QS BIM Export','');`,
    `FILE_SCHEMA(('IFC4'));`, 'ENDSEC;', 'DATA;',
  ];
  return { text: [...header, ...L, 'ENDSEC;', 'END-ISO-10303-21;'].join('\n'), stats };
}

// ─── B) احتياطي: من مستطيلات الفراغات فقط (بلا DWG) ──────────────────────────
export function buildIfcFromRooms({ rooms, projectName = 'مشروع سماك', defaultH = H_DEFAULT }) {
  // ترتيب شبكي بسيط — تقريبي، للمهندس كمرجع أبعاد فقط
  const laid = []; let x = 0, y = 0, rowH = 0;
  for (const r of rooms) {
    if (!(r.L > 0) || !(r.W > 0)) continue;
    if (x + r.L > 24) { x = 0; y += rowH + 1; rowH = 0; }
    laid.push({ ...r, x0: x, y0: y }); x += r.L + 1; rowH = Math.max(rowH, r.W);
  }
  const segs = [];
  for (const r of laid) {
    segs.push({ x1: r.x0, y1: r.y0, x2: r.x0 + r.L, y2: r.y0 }, { x1: r.x0, y1: r.y0 + r.W, x2: r.x0 + r.L, y2: r.y0 + r.W },
              { x1: r.x0, y1: r.y0, x2: r.x0, y2: r.y0 + r.W }, { x1: r.x0 + r.L, y1: r.y0, x2: r.x0 + r.L, y2: r.y0 + r.W });
  }
  let minX = 1e18, minY = 1e18, maxX = -1e18, maxY = -1e18;
  for (const g of segs) { minX = Math.min(minX, g.x1, g.x2); maxX = Math.max(maxX, g.x1, g.x2); minY = Math.min(minY, g.y1, g.y2); maxY = Math.max(maxY, g.y1, g.y2); }
  return buildIfcFromSheets({ sheets: [{ name: 'MAIN', segs, openings: [], bbox: { minX, minY, maxX, maxY } }], projectName, defaultH, rooms: rooms.map(r => ({ ...r, img: 1 })) });
}

export function downloadIfc(ifcText, filename = 'semak-project.ifc') {
  const blob = new Blob([ifcText], { type: 'application/x-step' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}
