// ════════════════════════════════════════════════════════════════════════════
//  Excel بهويّة — ورقةٌ مصمَّمة لا جدولٌ خام
//  ─────────────────────────────────────────────────────────────────────────
//  يأخذ وصف الكشف نفسه الذي يُطبع منه PDF، ويُلبسه هويّة الجهة:
//  شريط الألوان، الشعار، العنوان، بطاقات الملخّص، رأس جدولٍ ملوّن وصفوفٌ متناوبة،
//  سطر إجماليات، خانات التوقيع، وتذييل العنوان — مع إعداد الطباعة على A4.
//  تستعمله سماك (الموقع وتطبيق المشتريات) وعُهدة، ولكلٍّ منهما هويّته (theme).
//
//  الوصف: { title, subtitle, filename, sheet, meta:[[k,v]], cards:[[k,v,مميّز؟]],
//           columns, rows, foot  — أو tables:[{ title, columns, rows, foot }],
//           note, signature }
//  الخلية: نصّ أو رقم أو { v, href, b }.
// ════════════════════════════════════════════════════════════════════════════

export const SEMAK_THEME = {
    org: 'سماك العقارية', orgEn: 'Semak Real Estate',
    font: 'Cairo', rtl: true,
    primary: '#1a365d', accent: '#c5a059', accentText: '#8a6a2c',
    soft: '#f1f5f9', zebra: '#f8fafc', accentSoft: '#f8f1e3', ink: '#1e293b', muted: '#64748b', line: '#e2e8f0',
    logo: '/images/logo-main.png',
    footer: 'المملكة العربية السعودية، مكة المكرمة، حي البوابة  |  س.ت 7051031099  |  920032842  |  semak.sa  |  info@semak.sa',
    signatures: [['المحاسب', 'سماك العقارية'], ['المهندس/ أحمد البادي', 'المدير التنفيذي']],
    labels: { issued: 'تاريخ الإصدار', page: 'صفحة', of: 'من', sign: 'التوقيع' },
};

const argb = c => 'FF' + String(c || '#000000').replace('#', '').toUpperCase();
const val = c => (c && typeof c === 'object' ? c.v : c);
const num = v => {
    if (v === '' || v === null || v === undefined) return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : null;
};
const MONEY = '#,##0.00;[Red]-#,##0.00';
const safeName = s => String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

// الشعار يُعاد رسمه PNG (أيّاً كانت صيغته) ويُصغَّر، مع أبعاده ليحفظ نسبته
async function loadLogo(url) {
    if (!url) return null;
    try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) return null;
        const blobUrl = URL.createObjectURL(await res.blob());
        const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = blobUrl; });
        const scale = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.naturalWidth * scale));
        c.height = Math.max(1, Math.round(img.naturalHeight * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(blobUrl);
        return { base64: c.toDataURL('image/png'), w: c.width, h: c.height };
    } catch (e) { return null; }
}

export async function brandedExcel(d, th) {
    const m = await import('exceljs');                  // تُحمَّل عند الحاجة فقط
    const ExcelJS = m.default || m;
    const L = th.labels || SEMAK_THEME.labels;
    const tables = d.tables || [{ columns: d.columns || [], rows: d.rows || [], foot: d.foot }];
    const span = Math.max(6, ...tables.map(t => t.columns.length));
    const align = { vertical: 'middle', readingOrder: th.rtl ? 'rtl' : 'ltr' };
    const F = (o = {}) => ({ name: th.font, size: 10, color: { argb: argb(th.ink) }, ...o });
    const fill = c => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: argb(c) } });
    const thin = c => ({ style: 'thin', color: { argb: argb(c) } });

    const wb = new ExcelJS.Workbook();
    wb.creator = th.org; wb.company = th.org; wb.created = new Date();
    wb.title = d.title || '';
    const ws = wb.addWorksheet(String(d.sheet || d.title || 'Sheet').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), {
        views: [{ rightToLeft: !!th.rtl, showGridLines: false }],
        pageSetup: {
            paperSize: 9, orientation: span > 7 ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            horizontalCentered: true, margins: { left: 0.35, right: 0.35, top: 0.45, bottom: 0.6, header: 0.2, footer: 0.3 },
        },
        headerFooter: { oddFooter: '&C&8' + L.page + ' &P ' + L.of + ' &N' + '&R&8' + String(th.org).replace(/&/g, '&&') },
    });

    // عرض الأعمدة: الأعرض بين جداول الورقة
    for (let c = 1; c <= span; c++) {
        let w = 0;
        tables.forEach(t => { const col = t.columns[c - 1]; if (col) w = Math.max(w, col.width || (col.type === 'money' ? 15 : col.type === 'date' ? 13 : 24)); });
        ws.getColumn(c).width = w || 13;
    }

    let r = 1;
    const merge = (row, c1, c2) => { if (c2 > c1) ws.mergeCells(row, c1, row, c2); return ws.getCell(row, c1); };
    const bar = row => {
        ws.getRow(row).height = 7;
        const cut = Math.ceil(span * 0.75);
        for (let c = 1; c <= span; c++) ws.getCell(row, c).fill = fill(c <= cut ? th.primary : th.accent);
    };

    // ── الترويسة: شريط الهويّة، الشعار، العنوان ──
    bar(r++);
    const logo = await loadLogo(th.logo);
    const top = r;
    ws.getRow(r).height = 32; ws.getRow(r + 1).height = 22; ws.getRow(r + 2).height = 18;
    const tStart = logo ? 3 : 1;
    Object.assign(merge(r, tStart, span), { value: d.title || '', font: F({ size: 18, bold: true, color: { argb: argb(th.primary) } }), alignment: align });
    Object.assign(merge(r + 1, tStart, span), { value: d.subtitle || '', font: F({ size: 12, bold: true, color: { argb: argb(th.accentText || th.accent) } }), alignment: align });
    Object.assign(merge(r + 2, tStart, span), {
        value: [th.org, L.issued + ': ' + new Date().toISOString().slice(0, 10)].filter(Boolean).join('   ·   '),
        font: F({ size: 9, color: { argb: argb(th.muted) } }), alignment: align,
    });
    if (logo) {
        const h = 78, w = Math.min(190, Math.round(logo.w * h / logo.h));
        const id = wb.addImage({ base64: logo.base64, extension: 'png' });
        ws.addImage(id, { tl: { col: 0.1, row: top - 1 + 0.08 }, ext: { width: w, height: h }, editAs: 'oneCell' });
    }
    r += 3;
    ws.getRow(r).height = 6;
    for (let c = 1; c <= span; c++) ws.getCell(r, c).border = { bottom: { style: 'medium', color: { argb: argb(th.accent) } } };
    r += 2;

    // ── بيانات الكشف: زوجان في كل سطر ──
    const meta = (d.meta || []).filter(x => x && x[1] !== '' && x[1] !== null && x[1] !== undefined);
    if (meta.length) {
        const half = Math.floor(span / 2);
        for (let i = 0; i < meta.length; i += 2) {
            [meta[i], meta[i + 1]].forEach((pair, k) => {
                if (!pair) return;
                const c0 = 1 + k * half;
                Object.assign(ws.getCell(r, c0), { value: pair[0], font: F({ size: 9, bold: true, color: { argb: argb(th.muted) } }), alignment: align });
                Object.assign(merge(r, c0 + 1, k ? span : half), { value: String(pair[1]), font: F({ bold: true }), alignment: align });
            });
            ws.getRow(r).height = 18; r++;
        }
        r++;
    }

    // ── بطاقات الملخّص: أربعٌ في كل صفّ، الإطار الأبيض يفصل بينها ──
    const cards = d.cards || [];
    for (let i = 0; i < cards.length; i += 4) {
        const part = cards.slice(i, i + 4);
        part.forEach(([k, v, gold], j) => {
            const c1 = 1 + Math.round(j * span / part.length), c2 = Math.round((j + 1) * span / part.length);
            const edge = { style: 'medium', color: { argb: 'FFFFFFFF' } };
            const box = { top: edge, left: edge, right: edge };
            const a = merge(r, c1, c2);
            Object.assign(a, { value: k, font: F({ size: 9, color: { argb: argb(gold ? th.accentText || th.accent : th.muted) } }), alignment: { ...align, horizontal: 'center' } });
            const b = merge(r + 1, c1, c2);
            const n = num(v);
            Object.assign(b, {
                value: n === null ? v : n, numFmt: MONEY,
                font: F({ size: 15, bold: true, color: { argb: argb(gold ? th.accentText || th.accent : th.primary) } }),
                alignment: { ...align, horizontal: 'center' },
            });
            for (let c = c1; c <= c2; c++) {
                ws.getCell(r, c).fill = fill(gold ? th.accentSoft : th.soft);
                ws.getCell(r + 1, c).fill = fill(gold ? th.accentSoft : th.soft);
                ws.getCell(r, c).border = box;
                ws.getCell(r + 1, c).border = { left: edge, right: edge, bottom: gold ? { style: 'thick', color: { argb: argb(th.accent) } } : edge };
            }
        });
        ws.getRow(r).height = 20; ws.getRow(r + 1).height = 30;
        r += 2;
    }
    if (cards.length) r++;

    // ── الجداول ──
    let head1 = 0, last1 = 0;
    tables.forEach((t, ti) => {
        const cols = t.columns;
        if (t.title) {
            Object.assign(merge(r, 1, span), { value: t.title, font: F({ size: 12, bold: true, color: { argb: argb(th.primary) } }), alignment: align });
            ws.getRow(r).height = 22; r++;
        }
        const hr = r;
        if (ti === 0) head1 = hr;
        cols.forEach((col, i) => Object.assign(ws.getCell(r, i + 1), {
            value: col.label, fill: fill(th.primary),
            font: F({ bold: true, color: { argb: 'FFFFFFFF' } }),
            alignment: { ...align, horizontal: 'center', wrapText: true },
            border: { left: thin('#ffffff'), right: thin('#ffffff'), bottom: { style: 'medium', color: { argb: argb(th.accent) } } },
        }));
        ws.getRow(r).height = 26; r++;

        const put = (cell, c, col, extra) => {
            const x = ws.getCell(r, c);
            const v = val(cell);
            if (cell && typeof cell === 'object' && cell.href) {
                x.value = { text: String(v || '↗'), hyperlink: cell.href, tooltip: cell.href };
                x.font = F({ color: { argb: 'FF1D4ED8' }, underline: true });
                x.alignment = { ...align, horizontal: 'center' };
            } else if (col.type === 'money') {
                const n = num(v);
                x.value = n; x.numFmt = MONEY;
                x.font = F({ bold: !!(extra.bold || (cell && cell.b)) });
                x.alignment = { vertical: 'middle' };
            } else {
                x.value = v === null || v === undefined ? '' : typeof v === 'number' ? v : String(v);
                x.font = F({ bold: !!(extra.bold || (cell && cell.b)) });
                x.alignment = { ...align, horizontal: col.type === 'date' ? 'center' : (th.rtl ? 'right' : 'left'), wrapText: col.type !== 'date' };
            }
            return x;
        };
        (t.rows || []).forEach((row, ri) => {
            cols.forEach((col, i) => {
                const x = put(row[i], i + 1, col, {});
                if (ri % 2) x.fill = fill(th.zebra);
                x.border = { bottom: thin(th.line) };
            });
            ws.getRow(r).height = 20; r++;
        });
        if (t.foot) {
            cols.forEach((col, i) => {
                const x = put(t.foot[i], i + 1, col, { bold: true });
                x.fill = fill(th.accentSoft);
                x.border = { top: { style: 'medium', color: { argb: argb(th.primary) } }, bottom: { style: 'double', color: { argb: argb(th.primary) } } };
            });
            ws.getRow(r).height = 24; r++;
        }
        if (ti === 0) last1 = r - 1;
        r++;
    });

    if (tables.length === 1 && head1) {
        ws.views = [{ rightToLeft: !!th.rtl, showGridLines: false, state: 'frozen', ySplit: head1 }];
        ws.autoFilter = { from: { row: head1, column: 1 }, to: { row: Math.max(head1, last1 - (tables[0].foot ? 1 : 0)), column: tables[0].columns.length } };
        ws.pageSetup.printTitlesRow = head1 + ':' + head1;
    }

    // ── ملاحظة ──
    if (d.note) {
        Object.assign(merge(r, 1, span), { value: d.note, font: F({ size: 9, italic: true, color: { argb: argb(th.muted) } }), alignment: { ...align, wrapText: true } });
        ws.getRow(r).height = 30; r += 2;
    }

    // ── التوقيعات ──
    const sigs = d.signature ? (Array.isArray(d.signature) ? d.signature : th.signatures || []) : [];
    if (sigs.length) {
        r++;
        const w = Math.floor(span / sigs.length);
        sigs.forEach(([who, role], j) => {
            const c1 = 1 + j * w, c2 = j === sigs.length - 1 ? span : (j + 1) * w - (sigs.length > 1 ? 1 : 0);
            Object.assign(merge(r, c1, c2), { value: who || '', font: F({ bold: true, color: { argb: argb(th.primary) } }), alignment: { ...align, horizontal: 'center' } });
            Object.assign(merge(r + 1, c1, c2), { value: role || '', font: F({ size: 9, color: { argb: argb(th.muted) } }), alignment: { ...align, horizontal: 'center' } });
            Object.assign(merge(r + 3, c1, c2), { value: L.sign, font: F({ size: 8, color: { argb: argb(th.muted) } }), alignment: { ...align, horizontal: 'center' } });
            for (let c = c1; c <= c2; c++) ws.getCell(r + 2, c).border = { bottom: { style: 'thin', color: { argb: argb(th.ink) } } };
        });
        ws.getRow(r + 2).height = 34;
        r += 5;
    }

    // ── التذييل: شريط الهويّة وعنوان الجهة ──
    bar(r++);
    if (th.footer) {
        Object.assign(merge(r, 1, span), { value: th.footer, font: F({ size: 8, color: { argb: argb(th.muted) } }), alignment: { ...align, horizontal: 'center', wrapText: true } });
        ws.getRow(r).height = 20;
    }
    ws.pageSetup.printArea = 'A1:' + ws.getColumn(span).letter + r;

    const buf = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url; a.download = safeName(d.filename || d.title || 'statement') + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
}
