import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageMeta from '../../components/PageMeta';
import { ShieldCheck, Zap, Home, Gauge, Droplets, Wrench, Loader2, ArrowLeft } from 'lucide-react';
import { API_URL } from '../../utils/helpers';

const cardCls = "bg-white rounded-[1.75rem] shadow-sm border border-slate-100 p-6 mb-5";
const titleCls = "flex items-center gap-3 mb-4";

export default function UnitCatalog() {
  const location = useLocation();
  const navigate = useNavigate();
  const unit = new URLSearchParams(location.search).get('unit') || '';

  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}?action=get_unit_tech_specs_owner&unit=${encodeURIComponent(unit)}&phone=${encodeURIComponent(phone.trim())}`);
      const d = await res.json();
      if (d.success) {
        if (!d.data) setError('لم يتم إدخال بيانات الكتالوج لهذه الوحدة بعد — تواصل معنا على 920032842.');
        else setData(d.data);
      } else {
        setError(d.message || 'تعذر التحقق');
      }
    } catch (e) { setError('خطأ في الاتصال بالخادم'); } finally { setLoading(false); }
  };

  return (
    <div dir="rtl" className="font-cairo min-h-screen bg-slate-50 py-16 px-4">
      <PageMeta title={`الكتالوج التقني — ${unit}`} />
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <p className="text-[#c5a059] font-black tracking-[0.3em] text-xs uppercase mb-2">سماك العقارية</p>
          <h1 className="text-2xl md:text-3xl font-black text-[#1a365d]">الكتالوج التقني لوحدتك</h1>
          <p className="text-slate-400 text-sm mt-2 font-medium">وحدة {unit}</p>
        </div>

        {!data && (
          <form onSubmit={submit} className={cardCls}>
            <label className="block text-xs font-bold text-slate-500 mb-2">أدخل رقم جوالك المسجل لدينا للتحقق</label>
            <div className="flex gap-2">
              <input
                type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="05XXXXXXXX" dir="ltr"
                className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
              <button type="submit" disabled={loading} className="bg-[#1a365d] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#c5a059] transition-all disabled:opacity-50 flex items-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : 'عرض'}
              </button>
            </div>
            {error && <p className="text-red-600 text-xs font-bold mt-3">{error}</p>}
          </form>
        )}

        {data && (
          <div className="animate-fadeIn">
            {data.electromechanical?.notes && (
              <div className={cardCls}>
                <div className={titleCls}><Zap size={18} className="text-[#c5a059]" /><h3 className="font-black text-[#1a365d]">الإلكتروميكانيك</h3></div>
                <p className="text-sm text-slate-600 font-medium whitespace-pre-line">{data.electromechanical.notes}</p>
              </div>
            )}

            {(data.smart_home?.app_name || data.smart_home?.wifi_network || data.smart_home?.notes) && (
              <div className={cardCls}>
                <div className={titleCls}><Home size={18} className="text-[#c5a059]" /><h3 className="font-black text-[#1a365d]">سمارت هوم</h3></div>
                {data.smart_home?.app_name && <p className="text-sm text-slate-600 font-medium mb-1"><b className="text-[#1a365d]">التطبيق:</b> {data.smart_home.app_name}</p>}
                {data.smart_home?.wifi_network && <p className="text-sm text-slate-600 font-medium mb-1"><b className="text-[#1a365d]">شبكة الواي فاي:</b> {data.smart_home.wifi_network}</p>}
                {data.smart_home?.notes && <p className="text-sm text-slate-600 font-medium whitespace-pre-line mt-2">{data.smart_home.notes}</p>}
              </div>
            )}

            {Array.isArray(data.panel_rooms) && data.panel_rooms.length > 0 && (
              <div className={cardCls}>
                <div className={titleCls}><Zap size={18} className="text-[#c5a059]" /><h3 className="font-black text-[#1a365d]">توزيع طبلون الكهرباء</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="text-right text-slate-400 font-bold text-xs"><th className="pb-2">الغرفة</th><th className="pb-2">رقم الدائرة</th><th className="pb-2">القاطع</th></tr></thead>
                    <tbody>
                      {data.panel_rooms.map((r, i) => (
                        <tr key={i} className="border-t border-slate-100"><td className="py-2 font-bold text-slate-700">{r.room}</td><td className="py-2 text-slate-600">{r.circuit_no}</td><td className="py-2 text-slate-600">{r.breaker_label}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(data.meters?.electricity_meter_no || data.meters?.water_meter_no) && (
              <div className={cardCls}>
                <div className={titleCls}><Gauge size={18} className="text-[#c5a059]" /><h3 className="font-black text-[#1a365d]">العدادات</h3></div>
                {data.meters?.electricity_meter_no && <p className="text-sm text-slate-600 font-medium mb-1"><b className="text-[#1a365d]">عداد الكهرباء:</b> {data.meters.electricity_meter_no}</p>}
                {data.meters?.water_meter_no && <p className="text-sm text-slate-600 font-medium"><b className="text-[#1a365d]">عداد المياه:</b> {data.meters.water_meter_no}</p>}
              </div>
            )}

            {Array.isArray(data.tanks) && data.tanks.length > 0 && (
              <div className={cardCls}>
                <div className={titleCls}><Droplets size={18} className="text-[#c5a059]" /><h3 className="font-black text-[#1a365d]">الخزانات</h3></div>
                {data.tanks.map((t, i) => (
                  <p key={i} className="text-sm text-slate-600 font-medium mb-1">
                    <b className="text-[#1a365d]">{t.name}:</b> رقم {t.number} — سعة {t.capacity}
                  </p>
                ))}
              </div>
            )}

            <div className={cardCls}>
              <div className={titleCls}><Wrench size={18} className="text-[#c5a059]" /><h3 className="font-black text-[#1a365d]">بوابة الصيانة</h3></div>
              {data.maintenance_note && <p className="text-sm text-slate-600 font-medium mb-3 whitespace-pre-line">{data.maintenance_note}</p>}
              <button onClick={() => navigate(`/maintenance?unit=${encodeURIComponent(unit)}`)} className="bg-[#1a365d] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#c5a059] transition-all flex items-center gap-2">
                <ShieldCheck size={16} /> رفع طلب صيانة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
