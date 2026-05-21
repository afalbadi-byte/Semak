import React, { useState, useEffect } from 'react';
import {
    Layers, Plus, Edit, Trash2, RefreshCw, X, ChevronLeft, Calendar, DollarSign,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Receipt, ShoppingCart, FileText
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function WorkCycles() {
    const [cycles, setCycles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [selectedCycle, setSelectedCycle] = useState(null);

    const loadCycles = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=cycles_list`);
            const json = await res.json();
            if (json.success) setCycles(json.data);
        } finally { setLoading(false); }
    };

    useEffect(() => { loadCycles(); }, []);

    const saveCycle = async (form) => {
        const res = await fetch(`${API_URL}?action=cycle_save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        const json = await res.json();
        if (json.success) {
            setShowForm(false);
            setEditing(null);
            loadCycles();
        } else alert(json.message);
    };

    const deleteCycle = async (id) => {
        if (!confirm('تأكيد حذف دورة العمل؟')) return;
        await fetch(`${API_URL}?action=cycle_delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        loadCycles();
    };

    if (selectedCycle) {
        return <CycleDetail cycleId={selectedCycle} onBack={() => setSelectedCycle(null)} />;
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
                            <Layers size={32}/>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black">دورات العمل</h1>
                            <p className="text-sm text-slate-300 mt-1">تجميع المشتريات والمصروفات والإيرادات لكل دورة مشروع</p>
                        </div>
                    </div>
                    <button onClick={() => { setEditing(null); setShowForm(true); }}
                        className="bg-[#c5a059] hover:bg-yellow-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md">
                        <Plus size={18}/> دورة جديدة
                    </button>
                </div>
            </div>

            {showForm && (
                <CycleForm
                    initial={editing}
                    onCancel={() => { setShowForm(false); setEditing(null); }}
                    onSave={saveCycle}
                />
            )}

            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center"><RefreshCw className="animate-spin inline mr-2"/> جاري التحميل...</div>
            ) : cycles.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                    <Layers size={48} className="mx-auto mb-3 opacity-50"/>
                    <p className="font-bold">لا توجد دورات عمل بعد</p>
                    <p className="text-sm mt-2">أنشئ دورة جديدة لتجميع تكاليف وإيرادات مشروع/مرحلة معينة</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {cycles.map(c => (
                        <CycleCard key={c.id} cycle={c}
                            onOpen={() => setSelectedCycle(c.id)}
                            onEdit={() => { setEditing(c); setShowForm(true); }}
                            onDelete={() => deleteCycle(c.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function CycleCard({ cycle, onOpen, onEdit, onDelete }) {
    const statusColors = {
        active: 'bg-emerald-100 text-emerald-700',
        paused: 'bg-amber-100 text-amber-700',
        completed: 'bg-blue-100 text-blue-700',
        cancelled: 'bg-red-100 text-red-700',
    };
    const statusLabels = { active: 'نشطة', paused: 'متوقفة', completed: 'مكتملة', cancelled: 'ملغاة' };
    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="text-lg font-black text-[#1a365d] mb-1">{cycle.name}</h3>
                    {cycle.project_name && <p className="text-sm text-slate-500">{cycle.project_name}</p>}
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded-lg ${statusColors[cycle.status] || statusColors.active}`}>
                    {statusLabels[cycle.status] || cycle.status}
                </span>
            </div>
            <div className="space-y-1 text-xs text-slate-600 mb-3">
                {cycle.start_date && (
                    <div className="flex items-center gap-2"><Calendar size={12}/> {cycle.start_date} {cycle.end_date && `إلى ${cycle.end_date}`}</div>
                )}
                {cycle.budget > 0 && (
                    <div className="flex items-center gap-2"><DollarSign size={12}/> ميزانية: <strong>{Number(cycle.budget).toLocaleString()}</strong> ريال</div>
                )}
            </div>
            <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button onClick={onOpen} className="flex-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white py-2 rounded-xl text-sm font-bold transition">عرض التفاصيل</button>
                <button onClick={onEdit}  className="bg-slate-50 text-slate-600 hover:bg-emerald-500 hover:text-white p-2 rounded-xl transition"><Edit size={14}/></button>
                <button onClick={onDelete} className="bg-red-50 text-red-600 hover:bg-red-500 hover:text-white p-2 rounded-xl transition"><Trash2 size={14}/></button>
            </div>
        </div>
    );
}

function CycleForm({ initial, onCancel, onSave }) {
    const [form, setForm] = useState({
        id: initial?.id || null,
        name: initial?.name || '',
        description: initial?.description || '',
        project_name: initial?.project_name || '',
        start_date: initial?.start_date || '',
        end_date: initial?.end_date || '',
        budget: initial?.budget || 0,
        supplier_ids: initial?.supplier_ids || '',
        categories: initial?.categories || '',
        status: initial?.status || 'active',
    });

    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-6">
            <h3 className="font-black text-[#1a365d] mb-4">{initial ? 'تعديل دورة العمل' : 'دورة عمل جديدة'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="اسم الدورة *"><input type="text" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="input" /></Field>
                <Field label="المشروع المرتبط"><input type="text" value={form.project_name} onChange={e=>setForm({...form, project_name:e.target.value})} className="input" placeholder="مثل: سماك البوابة 1" /></Field>
                <Field label="تاريخ البداية"><input type="date" value={form.start_date} onChange={e=>setForm({...form, start_date:e.target.value})} className="input" /></Field>
                <Field label="تاريخ النهاية"><input type="date" value={form.end_date} onChange={e=>setForm({...form, end_date:e.target.value})} className="input" /></Field>
                <Field label="الميزانية المخصصة (ريال)"><input type="number" value={form.budget} onChange={e=>setForm({...form, budget:e.target.value})} className="input" /></Field>
                <Field label="الحالة">
                    <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="input">
                        <option value="active">نشطة</option>
                        <option value="paused">متوقفة</option>
                        <option value="completed">مكتملة</option>
                        <option value="cancelled">ملغاة</option>
                    </select>
                </Field>
                <Field label="معرّفات الموردين (مفصولة بفاصلة)" full><input type="text" value={form.supplier_ids} onChange={e=>setForm({...form, supplier_ids:e.target.value})} className="input" placeholder="مثل: 3,5,7 — أو اتركه فارغ لكل الموردين"/></Field>
                <Field label="تصنيفات المصروفات (مفصولة بفاصلة)" full><input type="text" value={form.categories} onChange={e=>setForm({...form, categories:e.target.value})} className="input" placeholder="مثل: نثرية,تخريم — أو اتركه فارغ لكل التصنيفات"/></Field>
                <Field label="وصف" full><textarea value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="input" rows={2}/></Field>
            </div>
            <div className="flex gap-2 mt-4">
                <button onClick={()=>onSave(form)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold">حفظ</button>
                <button onClick={onCancel} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold">إلغاء</button>
            </div>
            <style>{`.input { width: 100%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 8px 12px; font-weight: 600; color: #1a365d; outline: none; } .input:focus { border-color: #c5a059; }`}</style>
        </div>
    );
}

function Field({ label, children, full }) {
    return (
        <div className={full ? 'md:col-span-2' : ''}>
            <label className="text-xs font-bold text-slate-600 block mb-1">{label}</label>
            {children}
        </div>
    );
}

function CycleDetail({ cycleId, onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`${API_URL}?action=cycle_summary&id=${cycleId}`)
            .then(r => r.json())
            .then(j => { if (j.success) setData(j); setLoading(false); });
    }, [cycleId]);

    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

    if (loading) return <div className="bg-white rounded-2xl p-12 text-center"><RefreshCw className="animate-spin inline mr-2"/> جاري حساب البيانات...</div>;
    if (!data) return <div>خطأ</div>;
    const { cycle, summary, purchases, expenses, invoices } = data;
    const overBudget = summary.budget_used_pct > 100;

    return (
        <div className="space-y-6 p-4 md:p-6">
            <button onClick={onBack} className="flex items-center gap-2 text-[#1a365d] font-bold hover:text-emerald-600 transition">
                <ChevronLeft size={18}/> رجوع لقائمة الدورات
            </button>

            {/* رأس الدورة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <h2 className="text-2xl font-black mb-1">{cycle.name}</h2>
                {cycle.project_name && <p className="text-slate-300">{cycle.project_name}</p>}
                {(cycle.start_date || cycle.end_date) && (
                    <p className="text-xs text-slate-400 mt-2">{cycle.start_date || '—'} → {cycle.end_date || 'الآن'}</p>
                )}
            </div>

            {/* المؤشرات الكبيرة */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Big label="الميزانية" value={fmt(summary.budget)} color="slate"/>
                <Big label="الإيرادات" value={fmt(summary.total_revenue)} color="emerald" icon={TrendingUp}/>
                <Big label="المشتريات" value={fmt(summary.total_purchases)} color="purple" icon={ShoppingCart}/>
                <Big label="المصروفات" value={fmt(summary.total_expenses)} color="red" icon={TrendingDown}/>
                <Big label="صافي الربح" value={fmt(summary.net_profit)} color={summary.net_profit >= 0 ? 'emerald' : 'red'}/>
            </div>

            {/* مؤشر الميزانية */}
            {summary.budget > 0 && (
                <div className={`rounded-2xl p-5 border ${overBudget ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            {overBudget ? <AlertTriangle className="text-red-600"/> : <CheckCircle2 className="text-emerald-600"/>}
                            <h3 className={`font-black ${overBudget ? 'text-red-900' : 'text-[#1a365d]'}`}>استهلاك الميزانية</h3>
                        </div>
                        <div className={`text-2xl font-black ${overBudget ? 'text-red-700' : 'text-emerald-700'}`}>{summary.budget_used_pct}%</div>
                    </div>
                    <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                        <div className={`h-full transition-all ${overBudget ? 'bg-gradient-to-l from-red-500 to-orange-500' : 'bg-gradient-to-l from-emerald-500 to-teal-500'}`}
                            style={{ width: `${Math.min(100, summary.budget_used_pct)}%` }}/>
                    </div>
                    <div className="flex justify-between text-xs mt-2 font-bold">
                        <span className="text-slate-600">استُهلك: {fmt(summary.total_cost)} ريال</span>
                        <span className={summary.budget_left >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                            {summary.budget_left >= 0 ? 'متبقي' : 'تجاوز'}: {fmt(Math.abs(summary.budget_left))} ريال
                        </span>
                    </div>
                </div>
            )}

            {/* الجداول */}
            <DataSection title="المشتريات" icon={ShoppingCart} color="purple" items={purchases} columns={[
                {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'}, {key:'supplier', label:'المورد'},
                {key:'total', label:'الإجمالي', fmt:true}, {key:'paid', label:'المسدد', fmt:true}
            ]}/>
            <DataSection title="المصروفات" icon={TrendingDown} color="red" items={expenses} columns={[
                {key:'date', label:'التاريخ'}, {key:'category', label:'التصنيف'},
                {key:'amount', label:'المبلغ', fmt:true}, {key:'note', label:'ملاحظات'}
            ]}/>
            <DataSection title="الفواتير الصادرة" icon={Receipt} color="blue" items={invoices} columns={[
                {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'}, {key:'client', label:'العميل'},
                {key:'total', label:'الإجمالي', fmt:true}, {key:'paid', label:'المسدد', fmt:true}
            ]}/>
        </div>
    );
}

function Big({ label, value, color, icon:Icon }) {
    const colors = {
        slate: 'bg-slate-50 text-slate-700 border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        purple: 'bg-purple-50 text-purple-700 border-purple-200',
        red: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
        <div className={`border rounded-2xl p-4 ${colors[color]}`}>
            {Icon && <Icon size={18} className="mb-1 opacity-70"/>}
            <div className="text-[10px] font-bold opacity-80">{label}</div>
            <div className="text-2xl font-black">{value}</div>
        </div>
    );
}

function DataSection({ title, icon:Icon, color, items, columns }) {
    const fmt = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
            <div className={`p-4 border-b border-slate-100 flex items-center gap-2 bg-${color}-50/40`}>
                <Icon size={18} className={`text-${color}-700`}/>
                <h3 className="font-black text-[#1a365d]">{title} ({items.length})</h3>
            </div>
            {items.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm">لا توجد سجلات في هذه الدورة</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                            <tr>{columns.map(c=>(<th key={c.key} className="px-3 py-2">{c.label}</th>))}</tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((it, i) => (
                                <tr key={i} className="hover:bg-slate-50/50">
                                    {columns.map(c=>(
                                        <td key={c.key} className="px-3 py-2 whitespace-nowrap">
                                            {c.fmt ? fmt(it[c.key]) : (it[c.key] || '—')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
