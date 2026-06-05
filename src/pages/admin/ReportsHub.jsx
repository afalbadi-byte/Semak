import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  RefreshCw, Printer, Calendar, AlertCircle, Loader2,
  FileBarChart2, Users, Receipt, BarChart3
} from 'lucide-react';

import { API_URL } from '../../lib/api/client';

const fmt = (n) =>
  Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ر.س';

const fmtPct = (n) => Number(n || 0).toFixed(1) + '%';

const MONTH_NAMES = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر',
};

const monthLabel = (key) => {
  const [year, mon] = key.split('-');
  return `${MONTH_NAMES[mon] || mon} ${year}`;
};

/* ─── Period helpers ─── */
const isoDate = (d) => d.toISOString().slice(0, 10);

const getPeriod = (preset) => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'month':
      return {
        from: isoDate(new Date(y, m, 1)),
        to: isoDate(new Date(y, m + 1, 0)),
      };
    case 'quarter': {
      const qStart = Math.floor(m / 3) * 3;
      return {
        from: isoDate(new Date(y, qStart, 1)),
        to: isoDate(new Date(y, qStart + 3, 0)),
      };
    }
    case 'year':
    default:
      return {
        from: `${y}-01-01`,
        to: `${y}-12-31`,
      };
  }
};

/* ─── Summary card ─── */
function SummaryCard({ label, value, icon: Icon, color, sub }) {
  const colors = {
    green:   { bg: 'bg-emerald-900/20', border: 'border-emerald-500/25', icon: 'text-emerald-400', val: 'text-emerald-400' },
    red:     { bg: 'bg-red-900/20',     border: 'border-red-500/25',     icon: 'text-red-400',     val: 'text-red-400' },
    purple:  { bg: 'bg-purple-900/20',  border: 'border-purple-500/25',  icon: 'text-purple-400',  val: 'text-purple-400' },
    emerald: { bg: 'bg-emerald-900/20', border: 'border-emerald-500/25', icon: 'text-emerald-400', val: 'text-emerald-300' },
    gold:    { bg: 'bg-[#c5a059]/10',   border: 'border-[#c5a059]/25',   icon: 'text-[#c5a059]',   val: 'text-[#c5a059]' },
  };
  const c = colors[color] || colors.gold;

  return (
    <div className={`${c.bg} border ${c.border} rounded-2xl p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-xl bg-[#1a365d] border ${c.border} flex items-center justify-center`}>
          <Icon size={18} className={c.icon} />
        </div>
        <p className="text-gray-400 text-xs font-medium">{label}</p>
      </div>
      <div>
        <p className={`text-xl font-black tracking-tight ${c.val}`}>{value}</p>
        {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

/* ─── Chip count ─── */
function CountChip({ label, value, color = 'gold' }) {
  const cls = {
    gold:    'bg-[#c5a059]/10 border-[#c5a059]/25 text-[#c5a059]',
    blue:    'bg-blue-900/20 border-blue-500/25 text-blue-300',
    purple:  'bg-purple-900/20 border-purple-500/25 text-purple-300',
    emerald: 'bg-emerald-900/20 border-emerald-500/25 text-emerald-300',
  };
  return (
    <div className={`inline-flex flex-col items-center px-5 py-3 rounded-xl border ${cls[color] || cls.gold}`}>
      <span className="text-2xl font-black">{value ?? '—'}</span>
      <span className="text-xs mt-0.5 opacity-75">{label}</span>
    </div>
  );
}

/* ─── MAIN COMPONENT ─── */
export default function ReportsHub({ showToast }) {
  const printRef = useRef(null);

  const [preset, setPreset] = useState('year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);

  /* Derive actual from/to */
  const activePeriod = preset === 'custom'
    ? { from: customFrom, to: customTo }
    : getPeriod(preset);

  const fetchReport = useCallback(async () => {
    if (preset === 'custom' && (!customFrom || !customTo)) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = activePeriod;
      const res = await fetch(`${API_URL}?action=daftra_reports&from=${from}&to=${to}`);
      const data = await res.json();
      if (data.success) {
        setReport(data);
      } else {
        setError(data.message || 'فشل تحميل التقارير');
      }
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [preset, customFrom, customTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=1000,height=1200');
    if (!win) { alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة'); return; }
    win.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>التقارير المالية - سمك</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Cairo', sans-serif; direction: rtl; background: #fff; color: #1a1a1a; padding: 30px; }
  h1 { font-size: 22px; font-weight: 900; color: #1a365d; margin-bottom: 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #ddd; border-radius: 10px; padding: 14px; }
  .card-label { font-size: 11px; color: #888; margin-bottom: 6px; }
  .card-val { font-size: 16px; font-weight: 900; }
  .green { color: #059669; } .red { color: #dc2626; } .purple { color: #7c3aed; } .gold { color: #c5a059; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #1a365d; color: #c5a059; font-size: 12px; padding: 8px 12px; text-align: right; }
  td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #eee; }
  tr:last-child td { border-bottom: none; }
  .total-row td { background: #f3f4f6; font-weight: 700; }
  .neg { color: #dc2626; }
  h2 { font-size: 15px; font-weight: 700; color: #1a365d; margin-bottom: 10px; border-bottom: 2px solid #c5a059; padding-bottom: 4px; }
  @media print { body { padding: 15px; } }
</style>
</head>
<body>
${content.innerHTML}
</body>
</html>`);
    win.document.close();
    win.onload = () => setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  /* ─── Derived data ─── */
  const summary = report?.summary || {};
  const byMonth = report?.by_month || {};
  const byClient = Array.isArray(report?.by_client) ? report.by_client : [];
  const counts = report?.counts || {};
  const net = parseFloat(summary.net || 0);
  const revenue = parseFloat(summary.revenue || 0);
  const revPaid = parseFloat(summary.rev_paid || 0);
  const collectionRate = revenue > 0 ? (revPaid / revenue) * 100 : 0;

  const monthKeys = Object.keys(byMonth).sort();
  const totalRow = monthKeys.reduce(
    (acc, k) => ({
      revenue: acc.revenue + parseFloat(byMonth[k].revenue || 0),
      purchases: acc.purchases + parseFloat(byMonth[k].purchases || 0),
      expenses: acc.expenses + parseFloat(byMonth[k].expenses || 0),
    }),
    { revenue: 0, purchases: 0, expenses: 0 }
  );
  totalRow.net = totalRow.revenue - totalRow.purchases - totalRow.expenses;

  const totalClientRevenue = byClient.reduce((s, c) => s + parseFloat(c.total || 0), 0);

  const periodLabel = `${activePeriod.from || '—'} إلى ${activePeriod.to || '—'}`;

  /* ─── Print-friendly inner HTML ─── */
  const printContent = () => {
    if (!report) return '';
    const monthRows = monthKeys.map(k => {
      const m = byMonth[k];
      const mNet = parseFloat(m.revenue || 0) - parseFloat(m.purchases || 0) - parseFloat(m.expenses || 0);
      return `<tr>
        <td>${monthLabel(k)}</td>
        <td class="green">${fmt(m.revenue)}</td>
        <td class="purple">${fmt(m.purchases)}</td>
        <td class="red">${fmt(m.expenses)}</td>
        <td class="${mNet < 0 ? 'neg' : ''}">${fmt(mNet)}</td>
      </tr>`;
    }).join('');
    const clientRows = byClient.slice(0, 20).map((c, i) => {
      const pct = totalClientRevenue > 0 ? ((parseFloat(c.total || 0) / totalClientRevenue) * 100).toFixed(1) : '0.0';
      return `<tr><td>${i + 1}</td><td>${c.name}</td><td>${fmt(c.total)}</td><td>${pct}%</td></tr>`;
    }).join('');
    return `
      <h1>التقارير المالية - سمك</h1>
      <p class="sub">الفترة: ${periodLabel}</p>
      <div class="cards">
        <div class="card"><div class="card-label">الإيرادات</div><div class="card-val green">${fmt(summary.revenue)}</div></div>
        <div class="card"><div class="card-label">التكاليف والمصروفات</div><div class="card-val red">${fmt(summary.costs)}</div></div>
        <div class="card"><div class="card-label">المشتريات</div><div class="card-val purple">${fmt(summary.purchases)}</div></div>
        <div class="card"><div class="card-label">صافي الربح</div><div class="card-val ${net >= 0 ? 'green' : 'red'}">${fmt(net)}</div></div>
      </div>
      <h2>التوزيع الشهري</h2>
      <table>
        <thead><tr><th>الشهر</th><th>الإيرادات</th><th>المشتريات</th><th>المصروفات</th><th>الصافي</th></tr></thead>
        <tbody>${monthRows}
          <tr class="total-row">
            <td>الإجمالي</td>
            <td>${fmt(totalRow.revenue)}</td>
            <td>${fmt(totalRow.purchases)}</td>
            <td>${fmt(totalRow.expenses)}</td>
            <td class="${totalRow.net < 0 ? 'neg' : ''}">${fmt(totalRow.net)}</td>
          </tr>
        </tbody>
      </table>
      <h2>أفضل العملاء</h2>
      <table>
        <thead><tr><th>#</th><th>العميل</th><th>إجمالي الإيرادات</th><th>النسبة</th></tr></thead>
        <tbody>${clientRows}</tbody>
      </table>
    `;
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1f38] p-4 sm:p-6 font-[Cairo,sans-serif]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');`}</style>

      {/* Hidden print target */}
      <div ref={printRef} style={{ display: 'none' }} dangerouslySetInnerHTML={{ __html: printContent() }} />

      <div className="max-w-6xl mx-auto">
        {/* ─── Page header ─── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c5a059]/10 border border-[#c5a059]/30 flex items-center justify-center">
              <FileBarChart2 size={20} className="text-[#c5a059]" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">التقارير المالية</h1>
              <p className="text-gray-500 text-xs">عرض شامل للأداء المالي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReport}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#1a365d] border border-[#c5a059]/30 hover:border-[#c5a059]/60 rounded-xl text-[#c5a059] text-sm font-medium transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              تحديث
            </button>
            {report && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-[#c5a059] hover:bg-[#d4b06a] text-[#1a365d] font-bold rounded-xl text-sm transition-colors"
              >
                <Printer size={14} />
                طباعة
              </button>
            )}
          </div>
        </div>

        {/* ─── Period selector ─── */}
        <div className="bg-[#0f2240] border border-[#c5a059]/20 rounded-2xl p-4 mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar size={15} className="text-[#c5a059]" />
            {[
              { key: 'month', label: 'هذا الشهر' },
              { key: 'quarter', label: 'هذا الربع' },
              { key: 'year', label: 'هذا العام' },
              { key: 'custom', label: 'مخصص' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all
                  ${preset === p.key
                    ? 'bg-[#c5a059] border-[#c5a059] text-[#1a365d]'
                    : 'bg-[#1a365d] border-[#c5a059]/20 text-gray-300 hover:border-[#c5a059]/50 hover:text-white'}`}
              >
                {p.label}
              </button>
            ))}

            {preset === 'custom' && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-gray-400 text-sm">من:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#c5a059]"
                />
                <span className="text-gray-400 text-sm">إلى:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#c5a059]"
                />
                <button
                  onClick={fetchReport}
                  disabled={!customFrom || !customTo || loading}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-[#c5a059] hover:bg-[#d4b06a] disabled:opacity-40 text-[#1a365d] font-bold rounded-lg text-sm transition-colors"
                >
                  <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                  عرض
                </button>
              </div>
            )}

            {preset !== 'custom' && (
              <span className="mr-auto text-gray-500 text-xs">
                {activePeriod.from} → {activePeriod.to}
              </span>
            )}
          </div>
        </div>

        {/* ─── Loading ─── */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={36} className="animate-spin text-[#c5a059]" />
          </div>
        )}

        {/* ─── Error ─── */}
        {!loading && error && (
          <div className="flex items-center gap-3 bg-red-900/30 border border-red-500/30 rounded-2xl p-5 text-red-300 mb-6">
            <AlertCircle size={20} />
            <div>
              <p className="font-semibold">حدث خطأ</p>
              <p className="text-sm opacity-80">{error}</p>
            </div>
            <button onClick={fetchReport} className="mr-auto text-sm underline opacity-75 hover:opacity-100">
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* ─── Report content ─── */}
        {!loading && report && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
              <SummaryCard
                label="الإيرادات"
                value={fmt(summary.revenue)}
                icon={TrendingUp}
                color="green"
                sub={`محصّل: ${fmt(summary.rev_paid)}`}
              />
              <SummaryCard
                label="التكاليف والمصروفات"
                value={fmt(summary.costs)}
                icon={TrendingDown}
                color="red"
              />
              <SummaryCard
                label="المشتريات"
                value={fmt(summary.purchases)}
                icon={ShoppingCart}
                color="purple"
              />
              <SummaryCard
                label="صافي الربح"
                value={fmt(net)}
                icon={DollarSign}
                color={net >= 0 ? 'emerald' : 'red'}
                sub={net >= 0 ? 'ربح' : 'خسارة'}
              />
            </div>

            {/* Count chips + collection rate */}
            <div className="bg-[#0f2240] border border-[#c5a059]/20 rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={15} className="text-[#c5a059]" />
                <h2 className="text-white font-semibold text-sm">مؤشرات الفترة</h2>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <CountChip label="فواتير المبيعات" value={counts.invoices} color="gold" />
                <CountChip label="فواتير الشراء" value={counts.purchases} color="purple" />
                <CountChip label="المصروفات" value={counts.expenses} color="blue" />

                {/* Collection rate */}
                <div className="mr-auto bg-[#1a365d] border border-[#c5a059]/20 rounded-xl p-4 min-w-[150px]">
                  <p className="text-gray-400 text-xs mb-2 text-center">نسبة التحصيل</p>
                  <div className="flex items-center justify-center gap-2">
                    <span className={`text-2xl font-black ${collectionRate >= 80 ? 'text-emerald-400' : collectionRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {fmtPct(collectionRate)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-[#0f2240] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${collectionRate >= 80 ? 'bg-emerald-400' : collectionRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(collectionRate, 100)}%` }}
                    />
                  </div>
                  <p className="text-gray-500 text-xs mt-1 text-center">{fmt(revPaid)} من {fmt(revenue)}</p>
                </div>
              </div>
            </div>

            {/* Monthly breakdown table */}
            <div className="bg-[#0f2240] border border-[#c5a059]/20 rounded-2xl overflow-hidden mb-6">
              <div className="px-5 py-4 border-b border-[#c5a059]/15 flex items-center gap-2">
                <Calendar size={15} className="text-[#c5a059]" />
                <h2 className="text-white font-semibold text-sm">التوزيع الشهري</h2>
              </div>

              {monthKeys.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">لا توجد بيانات شهرية</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1a365d]/60">
                        <th className="text-right text-[#c5a059] font-semibold px-5 py-3">الشهر</th>
                        <th className="text-right text-[#c5a059] font-semibold px-4 py-3">الإيرادات</th>
                        <th className="text-right text-[#c5a059] font-semibold px-4 py-3">المشتريات</th>
                        <th className="text-right text-[#c5a059] font-semibold px-4 py-3">المصروفات</th>
                        <th className="text-right text-[#c5a059] font-semibold px-4 py-3">الصافي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthKeys.map(k => {
                        const m = byMonth[k];
                        const mNet = parseFloat(m.revenue || 0) - parseFloat(m.purchases || 0) - parseFloat(m.expenses || 0);
                        return (
                          <tr key={k} className="border-b border-[#c5a059]/10 hover:bg-[#1a365d]/25 transition-colors">
                            <td className="px-5 py-3 text-white font-medium whitespace-nowrap">{monthLabel(k)}</td>
                            <td className="px-4 py-3 text-emerald-400 font-semibold whitespace-nowrap">{fmt(m.revenue)}</td>
                            <td className="px-4 py-3 text-purple-400 whitespace-nowrap">{fmt(m.purchases)}</td>
                            <td className="px-4 py-3 text-red-400 whitespace-nowrap">{fmt(m.expenses)}</td>
                            <td className={`px-4 py-3 font-bold whitespace-nowrap ${mNet < 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                              {fmt(mNet)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-[#1a365d]/50 border-t-2 border-[#c5a059]/30">
                        <td className="px-5 py-3 text-[#c5a059] font-bold">الإجمالي</td>
                        <td className="px-4 py-3 text-emerald-400 font-bold">{fmt(totalRow.revenue)}</td>
                        <td className="px-4 py-3 text-purple-400 font-bold">{fmt(totalRow.purchases)}</td>
                        <td className="px-4 py-3 text-red-400 font-bold">{fmt(totalRow.expenses)}</td>
                        <td className={`px-4 py-3 font-black text-base ${totalRow.net < 0 ? 'text-red-400' : 'text-emerald-300'}`}>
                          {fmt(totalRow.net)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Top clients table */}
            <div className="bg-[#0f2240] border border-[#c5a059]/20 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#c5a059]/15 flex items-center gap-2">
                <Users size={15} className="text-[#c5a059]" />
                <h2 className="text-white font-semibold text-sm">أفضل العملاء</h2>
                <span className="mr-auto text-gray-500 text-xs">{byClient.length} عميل</span>
              </div>

              {byClient.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm">لا توجد بيانات عملاء</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-[#1a365d]/60">
                        <th className="text-right text-[#c5a059] font-semibold px-5 py-3 w-12">#</th>
                        <th className="text-right text-[#c5a059] font-semibold px-4 py-3">العميل</th>
                        <th className="text-right text-[#c5a059] font-semibold px-4 py-3">إجمالي الإيرادات</th>
                        <th className="text-right text-[#c5a059] font-semibold px-4 py-3">نسبة المساهمة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byClient.map((c, i) => {
                        const pct = totalClientRevenue > 0
                          ? (parseFloat(c.total || 0) / totalClientRevenue) * 100
                          : 0;
                        return (
                          <tr key={i} className="border-b border-[#c5a059]/10 hover:bg-[#1a365d]/25 transition-colors">
                            <td className="px-5 py-3">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold
                                ${i === 0 ? 'bg-[#c5a059] text-[#1a365d]' : i === 1 ? 'bg-gray-400 text-[#1a365d]' : i === 2 ? 'bg-amber-700 text-white' : 'bg-[#1a365d] text-gray-400 border border-[#c5a059]/20'}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                            <td className="px-4 py-3 text-emerald-400 font-semibold whitespace-nowrap">{fmt(c.total)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-[#1a365d] rounded-full overflow-hidden max-w-[80px]">
                                  <div
                                    className="h-full bg-[#c5a059] rounded-full"
                                    style={{ width: `${Math.min(pct, 100)}%` }}
                                  />
                                </div>
                                <span className="text-[#c5a059] text-xs font-semibold whitespace-nowrap">
                                  {fmtPct(pct)}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state (no report, no error, no loading) */}
        {!loading && !error && !report && (
          <div className="text-center py-20 text-gray-500">
            <FileBarChart2 size={44} className="mx-auto mb-4 opacity-20" />
            <p className="text-base">اختر فترة زمنية لعرض التقارير</p>
          </div>
        )}
      </div>
    </div>
  );
}
