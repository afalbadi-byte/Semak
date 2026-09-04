// نسخة احتياطية يومية لبيانات دفترة إلى قوقل درايف
// تُشغَّل بمهمة مجدولة: node backup-daftra.cjs
const fs = require('fs');
const path = require('path');

const API  = 'https://semak.sa/api.php';
const DEST = 'G:/My Drive/سماك-المستندات/نسخ-احتياطية';
const KEEP = 30;                       // عدد النسخ المحفوظة
const CONC = 4;                        // طلبات متوازية

const stamp = () => new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
const log = m => console.log(`[${new Date().toISOString().slice(11,19)}] ${m}`);

const getJson = async (url, tries = 3) => {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (r.ok) return await r.json();
    } catch (e) { if (i === tries) throw e; }
    await new Promise(s => setTimeout(s, 2000 * i));
  }
  throw new Error('فشل الجلب: ' + url);
};

(async () => {
  if (!fs.existsSync(DEST)) { console.error('مجلد الدرايف غير متاح — تأكد أن Google Drive يعمل'); process.exit(1); }

  log('جلب قائمة المشتريات...');
  const list = (await getJson(`${API}?action=daftra_purchases_list&tenant=1&limit=600`)).data || [];
  log(`القائمة: ${list.length} فاتورة`);

  const full = [];
  for (let i = 0; i < list.length; i += CONC) {
    const part = await Promise.all(list.slice(i, i + CONC).map(async p => {
      try {
        const j = await getJson(`${API}?action=daftra_purchase_get&tenant=1&id=${p.id}`);
        const o = (j.data && j.data.data && j.data.data.PurchaseOrder) || null;
        return o ? { id: p.id, no: o.no, date: o.date, supplier: o.supplier_business_name,
          total: o.summary_total, paid: o.summary_paid, work_order_id: o.work_order_id,
          created: o.created, items: o.PurchaseOrderItem || [], payments: o.PurchaseOrderPayment || [],
          attachments: o.Attachments || [] } : { id: p.id, error: 'تعذر الجلب' };
      } catch (e) { return { id: p.id, error: String(e.message).slice(0, 60) }; }
    }));
    full.push(...part);
    if ((i / CONC) % 10 === 0) log(`  ${full.length}/${list.length}`);
  }

  const errs = full.filter(x => x.error).length;
  const snapshot = {
    taken_at: new Date().toISOString(),
    counts: { invoices: full.length, errors: errs,
      items: full.reduce((s, x) => s + (x.items ? x.items.length : 0), 0),
      payments: full.reduce((s, x) => s + (x.payments ? x.payments.length : 0), 0),
      attachments: full.reduce((s, x) => s + (x.attachments ? x.attachments.length : 0), 0) },
    total_value: +full.reduce((s, x) => s + (+x.total || 0), 0).toFixed(2),
    purchases: full,
  };

  const file = path.join(DEST, `daftra-backup-${stamp()}.json`);
  fs.writeFileSync(file, JSON.stringify(snapshot));
  log(`حُفظت: ${path.basename(file)} (${(fs.statSync(file).size / 1048576).toFixed(1)} م.ب)`);

  // ملخص مقروء بجانبها
  const csv = ['invoice_no,date,supplier,total,paid,work_order_id,items,payments,attachments'];
  full.forEach(x => csv.push([x.no || '', x.date || '', '"' + String(x.supplier || '').replace(/"/g,'') + '"',
    x.total || 0, x.paid || 0, x.work_order_id || '', (x.items||[]).length, (x.payments||[]).length, (x.attachments||[]).length].join(',')));
  fs.writeFileSync(path.join(DEST, `daftra-summary-${stamp()}.csv`), '\ufeff' + csv.join('\n'), 'utf8');

  // تنظيف النسخ القديمة
  const olds = fs.readdirSync(DEST).filter(f => /^daftra-(backup|summary)-/.test(f))
    .map(f => ({ f, t: fs.statSync(path.join(DEST, f)).mtimeMs })).sort((a, b) => b.t - a.t);
  olds.slice(KEEP * 2).forEach(o => { try { fs.unlinkSync(path.join(DEST, o.f)); } catch {} });

  log(`تمت النسخة — فواتير ${snapshot.counts.invoices} | بنود ${snapshot.counts.items} | دفعات ${snapshot.counts.payments} | أخطاء ${errs}`);
})().catch(e => { console.error('فشل:', e.message); process.exit(1); });
