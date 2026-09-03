import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Save, RefreshCw, CheckCircle2, AlertTriangle, X,
  Cpu, Home, Zap, Gauge, Droplets, Wrench, Plus, Trash2, Link as LinkIcon, Copy
} from 'lucide-react';

import { API_URL, getAdminToken } from '../../lib/api/client';

const emptyData = () => ({
  electromechanical: { notes: '' },
  smart_home: { app_name: '', wifi_network: '', notes: '' },
  panel_rooms: [],
  meters: { electricity_meter_no: '', water_meter_no: '' },
  tanks: [],
  maintenance_note: '',
  internal_notes: '',
});

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold ${type === 'success' ? 'bg-green-600' : 'bg-red-600'} animate-fadeIn`}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      {msg}
      <button onClick={onClose} className="mr-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-[1.75rem] shadow-sm border border-slate-100 p-6 mb-5">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 bg-[#1a365d]/10 rounded-xl flex items-center justify-center">
          <Icon size={20} className="text-[#1a365d]" />
        </div>
        <h3 className="text-base font-black text-[#1a365d]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

const inputCls = "w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]";
const labelCls = "block text-xs font-bold text-slate-500 mb-1";

export default function UnitTechCatalog() {
  const [dbProjects, setDbProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [unitName, setUnitName] = useState('');
  const [data, setData] = useState(emptyData());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [toast, setToast] = useState(null);
  const notify = (msg, type = 'success') => setToast({ msg, type });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}?action=get_projects_data`);
        const d = await res.json();
        if (d.success && Array.isArray(d.data)) {
          setDbProjects(d.data);
          const firstProj = d.data[0];
          const firstUnit = firstProj?.units_details?.[0];
          if (firstProj) setSelectedProject(firstProj);
          if (firstUnit) setUnitName(firstUnit.unit_code);
        }
      } catch (e) {}
    })();
  }, []);

  const loadCatalog = useCallback(async () => {
    if (!unitName) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_unit_tech_specs&unit=${encodeURIComponent(unitName)}`);
      const d = await res.json();
      if (d.success && d.data) {
        setData({ ...emptyData(), ...d.data });
        setUpdatedAt(d.updated_at || null);
      } else {
        setData(emptyData());
        setUpdatedAt(null);
      }
    } catch (e) { notify('خطأ في تحميل الكتالوج', 'error'); } finally { setLoading(false); }
  }, [unitName]);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const _t = getAdminToken();
      const res = await fetch(`${API_URL}?action=save_unit_tech_specs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(_t ? { Authorization: `Bearer ${_t}` } : {}) },
        body: JSON.stringify({ unit: unitName, data }),
      });
      const d = await res.json();
      if (d.success) notify('تم حفظ الكتالوج بنجاح');
      else notify(d.message || 'فشل الحفظ', 'error');
    } catch (e) { notify('خطأ في الاتصال بالخادم', 'error'); } finally { setSaving(false); }
  };

  const addPanelRow = () => setData(d => ({ ...d, panel_rooms: [...(d.panel_rooms || []), { room: '', circuit_no: '', breaker_label: '' }] }));
  const updatePanelRow = (i, field, val) => setData(d => ({ ...d, panel_rooms: d.panel_rooms.map((r, idx) => idx === i ? { ...r, [field]: val } : r) }));
  const removePanelRow = (i) => setData(d => ({ ...d, panel_rooms: d.panel_rooms.filter((_, idx) => idx !== i) }));

  const addTank = () => setData(d => ({ ...d, tanks: [...(d.tanks || []), { name: '', number: '', capacity: '' }] }));
  const updateTank = (i, field, val) => setData(d => ({ ...d, tanks: d.tanks.map((t, idx) => idx === i ? { ...t, [field]: val } : t) }));
  const removeTank = (i) => setData(d => ({ ...d, tanks: d.tanks.filter((_, idx) => idx !== i) }));

  const ownerLink = unitName ? `https://semak.sa/unit-catalog?unit=${encodeURIComponent(unitName)}` : '';
  const copyOwnerLink = () => { if (ownerLink) { navigator.clipboard.writeText(ownerLink); notify('تم نسخ الرابط'); } };

  return (
    <div dir="rtl" className="font-cairo pt-24 pb-20 bg-slate-50 min-h-screen">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="container mx-auto px-6 max-w-4xl">

        {/* الرأس */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 bg-[#1a365d] rounded-2xl flex items-center justify-center shadow-lg">
              <ClipboardList size={22} className="text-[#c5a059]" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1a365d]">الكتالوج التقني للوحدة</h1>
              <p className="text-xs text-slate-400 font-medium">إلكتروميكانيك، سمارت هوم، طبلون الكهرباء، العدادات، والخزانات — لكل وحدة</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={labelCls}>المشروع</label>
              <select
                value={selectedProject?.id || ''}
                onChange={(e) => {
                  const proj = dbProjects.find(p => p.id.toString() === e.target.value);
                  setSelectedProject(proj);
                  const firstUnit = proj?.units_details?.[0];
                  setUnitName(firstUnit?.unit_code || '');
                }}
                className={inputCls + " min-w-[180px]"}
              >
                {dbProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>الوحدة</label>
              <select value={unitName} onChange={(e) => setUnitName(e.target.value)} className={inputCls + " min-w-[160px]"}>
                {selectedProject?.units_details?.length > 0
                  ? selectedProject.units_details.map(u => <option key={u.id} value={u.unit_code}>{u.unit_code}</option>)
                  : <option disabled>لا توجد وحدات</option>}
              </select>
            </div>
            {loading && <RefreshCw size={18} className="text-[#1a365d] animate-spin mb-2" />}
            {updatedAt && <span className="text-xs text-slate-400 font-medium mb-2">آخر تحديث: {updatedAt}</span>}
          </div>
        </div>

        {/* رابط العميل */}
        {unitName && (
          <div className="bg-[#1a365d] rounded-2xl p-4 mb-6 flex items-center justify-between gap-3 text-white">
            <div className="flex items-center gap-2 text-sm font-bold overflow-hidden">
              <LinkIcon size={16} className="text-[#c5a059] flex-none" />
              <span className="truncate">{ownerLink}</span>
            </div>
            <button onClick={copyOwnerLink} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-xl text-xs font-bold flex-none transition-colors">
              <Copy size={13} /> نسخ رابط المالك
            </button>
          </div>
        )}

        <Section icon={Zap} title="الإلكتروميكانيك">
          <label className={labelCls}>ملاحظات / تفاصيل</label>
          <textarea rows={3} value={data.electromechanical?.notes || ''} onChange={e => setData(d => ({ ...d, electromechanical: { ...d.electromechanical, notes: e.target.value } }))} className={inputCls} placeholder="تفاصيل الأنظمة الكهروميكانيكية بالوحدة..." />
        </Section>

        <Section icon={Home} title="سمارت هوم">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div>
              <label className={labelCls}>اسم التطبيق</label>
              <input value={data.smart_home?.app_name || ''} onChange={e => setData(d => ({ ...d, smart_home: { ...d.smart_home, app_name: e.target.value } }))} className={inputCls} placeholder="مثال: Tuya Smart" />
            </div>
            <div>
              <label className={labelCls}>شبكة الواي فاي</label>
              <input value={data.smart_home?.wifi_network || ''} onChange={e => setData(d => ({ ...d, smart_home: { ...d.smart_home, wifi_network: e.target.value } }))} className={inputCls} />
            </div>
          </div>
          <label className={labelCls}>ملاحظات</label>
          <textarea rows={2} value={data.smart_home?.notes || ''} onChange={e => setData(d => ({ ...d, smart_home: { ...d.smart_home, notes: e.target.value } }))} className={inputCls} />
        </Section>

        <Section icon={Zap} title="توزيع طبلون الكهرباء على الغرف">
          <div className="space-y-3">
            {(data.panel_rooms || []).map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={row.room} onChange={e => updatePanelRow(i, 'room', e.target.value)} placeholder="الغرفة" className={inputCls} />
                <input value={row.circuit_no} onChange={e => updatePanelRow(i, 'circuit_no', e.target.value)} placeholder="رقم الدائرة" className={inputCls} />
                <input value={row.breaker_label} onChange={e => updatePanelRow(i, 'breaker_label', e.target.value)} placeholder="تسمية القاطع" className={inputCls} />
                <button onClick={() => removePanelRow(i)} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-none"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={addPanelRow} className="mt-3 flex items-center gap-1.5 text-xs bg-[#1a365d]/10 hover:bg-[#1a365d]/20 text-[#1a365d] px-3 py-2 rounded-xl font-bold transition-colors">
            <Plus size={13} /> إضافة صف
          </button>
        </Section>

        <Section icon={Gauge} title="العدادات">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>رقم عداد الكهرباء</label>
              <input value={data.meters?.electricity_meter_no || ''} onChange={e => setData(d => ({ ...d, meters: { ...d.meters, electricity_meter_no: e.target.value } }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>رقم عداد المياه</label>
              <input value={data.meters?.water_meter_no || ''} onChange={e => setData(d => ({ ...d, meters: { ...d.meters, water_meter_no: e.target.value } }))} className={inputCls} />
            </div>
          </div>
        </Section>

        <Section icon={Droplets} title="الخزانات">
          <div className="space-y-3">
            {(data.tanks || []).map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={t.name} onChange={e => updateTank(i, 'name', e.target.value)} placeholder="اسم الخزان (علوي/أرضي)" className={inputCls} />
                <input value={t.number} onChange={e => updateTank(i, 'number', e.target.value)} placeholder="الرقم" className={inputCls} />
                <input value={t.capacity} onChange={e => updateTank(i, 'capacity', e.target.value)} placeholder="السعة" className={inputCls} />
                <button onClick={() => removeTank(i)} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-none"><Trash2 size={16} /></button>
              </div>
            ))}
          </div>
          <button onClick={addTank} className="mt-3 flex items-center gap-1.5 text-xs bg-[#1a365d]/10 hover:bg-[#1a365d]/20 text-[#1a365d] px-3 py-2 rounded-xl font-bold transition-colors">
            <Plus size={13} /> إضافة خزان
          </button>
        </Section>

        <Section icon={Wrench} title="بوابة الصيانة">
          <p className="text-xs text-slate-400 font-medium mb-3">رابط طلب الصيانة الخاص بهذه الوحدة (يفتح تلقائياً برمز الوحدة): <span className="text-[#1a365d] font-bold">semak.sa/maintenance?unit={unitName}</span></p>
          <label className={labelCls}>ملاحظة إضافية (اختياري)</label>
          <textarea rows={2} value={data.maintenance_note || ''} onChange={e => setData(d => ({ ...d, maintenance_note: e.target.value }))} className={inputCls} />
        </Section>

        <Section icon={Cpu} title="ملاحظات داخلية (لا تظهر للمالك)">
          <textarea rows={3} value={data.internal_notes || ''} onChange={e => setData(d => ({ ...d, internal_notes: e.target.value }))} className={inputCls} placeholder="ملاحظات للموظفين فقط..." />
        </Section>

        <button onClick={handleSave} disabled={saving || !unitName} className="w-full bg-[#1a365d] text-white px-6 py-4 rounded-xl font-black text-base hover:bg-[#2d5299] transition disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg">
          {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          حفظ الكتالوج
        </button>
      </div>
    </div>
  );
}
