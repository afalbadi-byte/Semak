// ════════════════════════════════════════════════════════════════════════════
//  مولّد IFC4 من فراغات التمتير — نقطة بداية BIM للمهندس (يفتحه Revit مباشرة)
//  المدخل: قائمة فراغات {n,name,L,W,H,px,py,floor} + ارتفاع افتراضي + اسم المشروع
//  المخرج: نص ملف .ifc فيه: مشروع → موقع → مبنى → طابق → جدران (IfcWall) + فراغات (IfcSpace)
//  ملاحظة صريحة: يبني الجدران الرئيسية للفراغات المستطيلة فقط — الأبواب والنوافذ
//  والتشطيبات يكملها المهندس في Revit.
// ════════════════════════════════════════════════════════════════════════════

const WALL_T = 0.20;   // سماكة الجدار (م)
const SNAP   = 0.15;   // تسامح دمج الجدران المشتركة (م)

// ─── تحويل مواضع الصورة (px/py %) إلى أمتار: نقدّر مقياس المخطط من الغرف نفسها ─
// الفكرة: مجموع مساحات الغرف ≈ مساحة الصندوق المحيط بمراكزها موسّعاً بمتوسط الأبعاد.
function layoutRooms(rooms) {
  const withPos = rooms.filter(r => r.px != null && r.py != null && r.L > 0 && r.W > 0);
  if (withPos.length < 2) return gridLayout(rooms);
  const xs = withPos.map(r => r.px), ys = withPos.map(r => r.py);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  // مقياس: عرض المسقط ≈ مجموع أطوال الغرف على صف "افتراضي" — نأخذ الجذر التربيعي للمساحة الكلية كتقدير للبعد
  const totalArea = withPos.reduce((a, r) => a + r.L * r.W, 0);
  const side = Math.sqrt(totalArea) * 1.15;             // بعد المسقط التقريبي بالمتر
  const sx = side / spanX, sy = side / spanY;           // متر لكل 1% (تقريبي)
  const minX = Math.min(...xs), maxY = Math.max(...ys);
  return rooms.map(r => {
    if (r.px == null || r.py == null || !(r.L > 0) || !(r.W > 0)) return null;
    // مركز الغرفة بالمتر (py يزيد للأسفل في الصورة → نقلبه)
    const cx = (r.px - minX) * sx;
    const cy = (maxY - r.py) * sy;
    return { ...r, x0: cx - r.L / 2, y0: cy - r.W / 2 };
  }).filter(Boolean);
}

// ترتيب شبكي احتياطي لو لا مواضع
function gridLayout(rooms) {
  const out = []; let x = 0, y = 0, rowH = 0; const maxW = 20;
  for (const r of rooms) {
    if (!(r.L > 0) || !(r.W > 0)) continue;
    if (x + r.L > maxW) { x = 0; y += rowH + WALL_T; rowH = 0; }
    out.push({ ...r, x0: x, y0: y });
    x += r.L + WALL_T; rowH = Math.max(rowH, r.W);
  }
  return out;
}

// ─── استخراج قطع الجدران من مستطيلات الغرف مع دمج المشتركة ───────────────────
function wallSegments(rooms) {
  const segs = []; // {x1,y1,x2,y2,axis:'h'|'v',pos}
  const push = (x1, y1, x2, y2) => segs.push({ x1, y1, x2, y2, axis: y1 === y2 ? 'h' : 'v', pos: y1 === y2 ? y1 : x1 });
  for (const r of rooms) {
    const { x0, y0, L, W } = r;
    push(x0, y0, x0 + L, y0);           // أسفل
    push(x0, y0 + W, x0 + L, y0 + W);   // أعلى
    push(x0, y0, x0, y0 + W);           // يسار
    push(x0 + L, y0, x0 + L, y0 + W);   // يمين
  }
  // دمج القطع المتراكبة على نفس الخط (جدار مشترك بين غرفتين)
  const merged = [];
  for (const axis of ['h', 'v']) {
    const lines = segs.filter(s => s.axis === axis).sort((a, b) => a.pos - b.pos);
    const groups = [];
    for (const s of lines) {
      const g = groups.find(gg => Math.abs(gg.pos - s.pos) <= SNAP);
      if (g) g.items.push(s); else groups.push({ pos: s.pos, items: [s] });
    }
    for (const g of groups) {
      // اتحاد الفترات على المحور
      const iv = g.items.map(s => axis === 'h' ? [Math.min(s.x1, s.x2), Math.max(s.x1, s.x2)] : [Math.min(s.y1, s.y2), Math.max(s.y1, s.y2)])
        .sort((a, b) => a[0] - b[0]);
      let cur = null;
      for (const [a, b] of iv) {
        if (!cur || a > cur[1] + SNAP) { if (cur) merged.push({ axis, pos: g.pos, a: cur[0], b: cur[1] }); cur = [a, b]; }
        else cur[1] = Math.max(cur[1], b);
      }
      if (cur) merged.push({ axis, pos: g.pos, a: cur[0], b: cur[1] });
    }
  }
  return merged.filter(m => m.b - m.a > 0.3);
}

// ─── مساعدات كتابة IFC ────────────────────────────────────────────────────────
function guid() {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
  let s = ''; for (let i = 0; i < 22; i++) s += chars[Math.floor(Math.random() * 64)];
  return s;
}
const f = (n) => Number(n).toFixed(4).replace(/\.?0+$/, '') || '0';
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "''");
// نص عربي بترميز IFC (X2 unicode)
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

export function buildIfc({ rooms, projectName = 'مشروع سماك', defaultH = 3.3, floorName = 'الدور الأرضي' }) {
  const laid = layoutRooms(rooms);
  const walls = wallSegments(laid);
  const H = Number(defaultH) > 0 ? Number(defaultH) : 3.3;

  const L = []; let id = 100;
  const add = (line) => { L.push(`#${id}=${line};`); return id++; };

  // ── رأس + سياق ──
  const orgId  = add(`IFCORGANIZATION($,'Semak Real Estate',$,$,$)`);
  const appId  = add(`IFCAPPLICATION(#${orgId},'1.0','Semak QS BIM Export','SEMAK_QS')`);
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

  // ── التسلسل المكاني ──
  const siteP  = add(`IFCLOCALPLACEMENT($,#${wcs})`);
  const site   = add(`IFCSITE('${guid()}',#${ownId},'Site',$,$,#${siteP},$,$,.ELEMENT.,$,$,$,$,$)`);
  const bldgP  = add(`IFCLOCALPLACEMENT(#${siteP},#${wcs})`);
  const bldg   = add(`IFCBUILDING('${guid()}',#${ownId},'${ifcText(projectName)}',$,$,#${bldgP},$,$,.ELEMENT.,$,$,$)`);
  const stP    = add(`IFCLOCALPLACEMENT(#${bldgP},#${wcs})`);
  const storey = add(`IFCBUILDINGSTOREY('${guid()}',#${ownId},'${ifcText(floorName)}',$,$,#${stP},$,$,.ELEMENT.,0.)`);
  add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${proj},(#${site}))`);
  add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${site},(#${bldg}))`);
  add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${bldg},(#${storey}))`);

  // ── الجدران: كل قطعة = بثق مستطيل (طول × سماكة) بارتفاع H ──
  const wallIds = [];
  walls.forEach((w, i) => {
    const len = w.b - w.a;
    // نقطة البداية واتجاه الجدار
    const px = w.axis === 'h' ? w.a : w.pos;
    const py = w.axis === 'h' ? w.pos : w.a;
    const dirX = w.axis === 'h' ? 1 : 0, dirY = w.axis === 'h' ? 0 : 1;
    const p   = add(`IFCCARTESIANPOINT((${f(px)},${f(py)},0.))`);
    const d   = add(`IFCDIRECTION((${f(dirX)},${f(dirY)},0.))`);
    const ax  = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${d})`);
    const pl  = add(`IFCLOCALPLACEMENT(#${stP},#${ax})`);
    // مقطع مستطيل متمركز على المحور: الطول على X المحلي، السماكة على Y
    const c2  = add(`IFCCARTESIANPOINT((${f(len / 2)},0.))`);
    const ax2 = add(`IFCAXIS2PLACEMENT2D(#${c2},$)`);
    const prof= add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${ax2},${f(len)},${f(WALL_T)})`);
    const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${wcs},#${zDir},${f(H)})`);
    const shp = add(`IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${ext}))`);
    const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shp}))`);
    const wid = add(`IFCWALL('${guid()}',#${ownId},'Wall ${i + 1}',$,$,#${pl},#${pds},$,.STANDARD.)`);
    wallIds.push(wid);
  });

  // ── الفراغات (IfcSpace) بأسمائها العربية وأبعادها ──
  const spaceIds = [];
  laid.forEach((r) => {
    const p   = add(`IFCCARTESIANPOINT((${f(r.x0)},${f(r.y0)},0.))`);
    const ax  = add(`IFCAXIS2PLACEMENT3D(#${p},#${zDir},#${xDir})`);
    const pl  = add(`IFCLOCALPLACEMENT(#${stP},#${ax})`);
    const c2  = add(`IFCCARTESIANPOINT((${f(r.L / 2)},${f(r.W / 2)}))`);
    const ax2 = add(`IFCAXIS2PLACEMENT2D(#${c2},$)`);
    const prof= add(`IFCRECTANGLEPROFILEDEF(.AREA.,$,#${ax2},${f(r.L)},${f(r.W)})`);
    const ext = add(`IFCEXTRUDEDAREASOLID(#${prof},#${wcs},#${zDir},${f(H)})`);
    const shp = add(`IFCSHAPEREPRESENTATION(#${subCtx},'Body','SweptSolid',(#${ext}))`);
    const pds = add(`IFCPRODUCTDEFINITIONSHAPE($,$,(#${shp}))`);
    const label = `${r.n ? '#' + r.n + ' ' : ''}${r.name}`;
    const sid = add(`IFCSPACE('${guid()}',#${ownId},'${ifcText(label)}','${ifcText(`${r.L}×${r.W} م`)}',$,#${pl},#${pds},$,.ELEMENT.,.INTERNAL.,$)`);
    spaceIds.push(sid);
  });

  if (wallIds.length) add(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${guid()}',#${ownId},$,$,(${wallIds.map(i => '#' + i).join(',')}),#${storey})`);
  if (spaceIds.length) add(`IFCRELAGGREGATES('${guid()}',#${ownId},$,$,#${storey},(${spaceIds.map(i => '#' + i).join(',')}))`);

  const ts = new Date().toISOString().slice(0, 19);
  const header = [
    'ISO-10303-21;',
    'HEADER;',
    `FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');`,
    `FILE_NAME('${esc(projectName)}.ifc','${ts}',('Semak'),('Semak Real Estate'),'Semak QS','Semak QS BIM Export','');`,
    `FILE_SCHEMA(('IFC4'));`,
    'ENDSEC;',
    'DATA;',
  ];
  return {
    text: [...header, ...L, 'ENDSEC;', 'END-ISO-10303-21;'].join('\n'),
    stats: { walls: walls.length, spaces: laid.length, height: H },
  };
}

export function downloadIfc(ifcText, filename = 'semak-project.ifc') {
  const blob = new Blob([ifcText], { type: 'application/x-step' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
}
