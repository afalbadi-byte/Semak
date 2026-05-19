import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useLocation } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import {
  ShieldCheck, Loader2, XCircle, ChevronDown, Check, X,
  Send, FileWarning, PlusCircle, Pen, FileCheck, Download,
  CalendarCheck2
} from 'lucide-react';
import { API_URL } from '../../utils/helpers';

// ─────────────────────────────────────────────
// لوحة التوقيع — Canvas خالص
// ─────────────────────────────────────────────
const SignaturePad = forwardRef(({ onChange }, ref) => {
  const canvasRef = useRef(null);
  const drawing   = useRef(false);
  const [hasSign, setHasSign] = useState(false);

  const coords = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const c = canvasRef.current;
    const sx = c.width  / r.width;
    const sy = c.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  };

  const onStart = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const { x, y } = coords(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  };

  const onMove = (e) => {
    e.preventDefault();
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#1a365d';
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    const { x, y } = coords(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSign) setHasSign(true);
  };

  const onEnd = (e) => {
    e.preventDefault();
    drawing.current = false;
    if (hasSign || canvasRef.current) {
      onChange(canvasRef.current.toDataURL('image/png'));
    }
  };

  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setHasSign(false);
    onChange(null);
  };

  useImperativeHandle(ref, () => ({ clear, isEmpty: () => !hasSign }));

  return (
    <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-[#c5a059]/40 bg-white" style={{ height: 150 }}>
      <canvas
        ref={canvasRef}
        width={700} height={150}
        style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none', display: 'block' }}
        onMouseDown={onStart} onMouseMove={onMove} onMouseUp={onEnd} onMouseLeave={onEnd}
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd}
      />
      {!hasSign && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2">
          <Pen size={22} className="text-slate-300" />
          <p className="text-slate-300 font-bold text-sm">وقّع هنا بإصبعك أو بالماوس</p>
        </div>
      )}
      {hasSign && (
        <button type="button" onClick={clear}
          className="absolute top-2 left-2 text-[11px] font-bold text-slate-400 hover:text-red-500 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-lg transition">
          مسح التوقيع
        </button>
      )}
    </div>
  );
});
SignaturePad.displayName = 'SignaturePad';

// ─────────────────────────────────────────────
// وثيقة الاستلام — للطباعة / PDF
// ─────────────────────────────────────────────
const HandoverDocument = forwardRef(
  ({ unitCode, ownerName, ownerPhone, idNumber, signatureData, acceptedAt, progressScore, totalItems }, ref) => (
    <div ref={ref} dir="rtl" style={{ fontFamily: "'Cairo', sans-serif", padding: 40, background: '#fff', color: '#1a1a1a' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px solid #c5a059', paddingBottom: 20, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#1a365d' }}>سماك العقارية</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>semak.sa — خدمات تسليم الوحدات</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#c5a059' }}>سماك</div>
          <div style={{ fontSize: 10, color: '#aaa', letterSpacing: 3 }}>العقارية</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#1a365d' }}>محضر استلام وحدة سكنية</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Official Unit Handover Document</div>
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, background: '#f8fafc', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        {[
          ['رقم الوحدة',    unitCode],
          ['تاريخ الاستلام', acceptedAt],
          ['اسم المالك',    ownerName],
          ['رقم الجوال',    ownerPhone],
          ['رقم الهوية',    idNumber],
          ['نتيجة الفحص',   `${progressScore}% مطابق للمواصفات`],
        ].map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: '#888', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a365d' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Acceptance text */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, fontSize: 13, lineHeight: 2, color: '#444', marginBottom: 28 }}>
        أقرّ أنا <strong>{ownerName}</strong> حامل الهوية رقم <strong>{idNumber}</strong> بأنني عاينت الوحدة رقم <strong>{unitCode}</strong>
        {' '}وفحصت جميع البنود المخصصة لي (<strong>{totalItems} بند</strong>) وأنها مطابقة للمواصفات المتفق عليها، وأستلمها رسمياً من شركة سماك العقارية،
        ويبدأ سريان الضمان الشامل اعتباراً من تاريخ هذا التوقيع.
      </div>

      {/* Signatures */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
        <div style={{ textAlign: 'center', width: 200 }}>
          <div style={{ borderBottom: '2px solid #cbd5e1', marginBottom: 8, minHeight: 80, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {signatureData && (
              <img src={signatureData} alt="توقيع المالك" style={{ maxHeight: 75, maxWidth: 190, objectFit: 'contain' }} />
            )}
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>توقيع المالك / المستلم</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a365d', marginTop: 2 }}>{ownerName}</div>
        </div>
        <div style={{ textAlign: 'center', width: 200 }}>
          <div style={{ borderBottom: '2px solid #cbd5e1', marginBottom: 8, height: 80 }} />
          <div style={{ fontSize: 11, color: '#888' }}>ختم وتوقيع الشركة</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a365d', marginTop: 2 }}>سماك العقارية</div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 36, paddingTop: 16, borderTop: '1px solid #e2e8f0', textAlign: 'center', fontSize: 10, color: '#aaa' }}>
        وثيقة إلكترونية صادرة بتاريخ {acceptedAt} | سماك العقارية — semak.sa | جميع الحقوق محفوظة
      </div>
    </div>
  )
);
HandoverDocument.displayName = 'HandoverDocument';

// ─────────────────────────────────────────────
// المكوّن الرئيسي
// ─────────────────────────────────────────────
export default function UnitHandover() {
  const location = useLocation();

  const [unitCode,         setUnitCode]         = useState('');
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');
  const [saving,           setSaving]           = useState(false);
  const [isSuccess,        setIsSuccess]        = useState(false);
  const [hasSnagsSubmitted,setHasSnagsSubmitted]= useState(false);
  const [acceptedAtDisplay,setAcceptedAtDisplay]= useState('');

  const [globalTemplate, setGlobalTemplate] = useState([]);
  const [unitSpaces,     setUnitSpaces]     = useState([]);
  const [inspectionData, setInspectionData] = useState({});
  const [expandedSpace,  setExpandedSpace]  = useState(null);

  const [formData, setFormData] = useState({ owner_name: '', owner_phone: '', id_number: '' });
  const [signatureData, setSignatureData] = useState(null);

  const sigRef = useRef(null);
  const docRef = useRef(null);

  const handlePrint = useReactToPrint({
    contentRef: docRef,
    documentTitle: `محضر استلام الوحدة ${unitCode}`,
    pageStyle: `
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap');
      body { font-family: 'Cairo', sans-serif; }
      @page { margin: 15mm; }
    `,
  });

  // ── جلب البيانات ──
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const unit  = query.get('unit');
    if (!unit) { setError('الرابط غير صحيح.'); setLoading(false); return; }
    setUnitCode(unit);
    fetchData(unit);
  }, [location]);

  const fetchData = async (unit) => {
    try {
      const ownerRes  = await fetch(`${API_URL}?action=get_unit_owner&unit_code=${encodeURIComponent(unit.trim())}`);
      const ownerData = await ownerRes.json();
      if (ownerData.success && ownerData.data.name !== 'غير مسجل') {
        setError(`تم تسليم الوحدة مسبقاً للمالك: ${ownerData.data.name}`);
        setLoading(false);
        return;
      }

      const projRes  = await fetch(`${API_URL}?action=get_projects_data`);
      const projData = await projRes.json();
      let spaces = ['صالة', 'غرفة نوم', 'مطبخ', 'حمام'];
      if (projData.success) {
        for (const p of projData.data) {
          const u = p.units_details?.find(ud => ud.unit_code === unit);
          if (u?.spaces?.length) { spaces = u.spaces; break; }
        }
      }
      setUnitSpaces(spaces);

      const tplRes  = await fetch(`${API_URL}?action=get_inspection_template`);
      const tplData = await tplRes.json();
      let template  = [];
      if (tplData.success && tplData.data) {
        template = tplData.data.map(cat => ({
          ...cat,
          items: cat.items
            .map(i => typeof i === 'string' ? { name: i, target: 'both' } : i)
            .filter(i => i.target === 'both' || i.target === 'client'),
        })).filter(cat => cat.items.length);
      }
      setGlobalTemplate(template);

      const insRes  = await fetch(`${API_URL}?action=get_inspection&unit=${unit}`);
      const insData = await insRes.json();
      if (insData.success && insData.data) {
        const parsed = JSON.parse(insData.data.inspection_data || '{}');
        setInspectionData(parsed);
        const first = spaces.find(sp =>
          template.some(cat => cat.items.some(item => {
            const d = parsed[`${sp}_${cat.name}_${item.name}`];
            return d?.isSelected && d?.passed !== null && d?.clientVisible !== false;
          }))
        );
        setExpandedSpace(first || null);
      } else {
        setError('لم يتم تجهيز البنود لهذه الوحدة بعد.');
      }
    } catch {
      setError('فشل الاتصال.');
    } finally {
      setLoading(false);
    }
  };

  // ── حالة البنود ──
  const setItemStatus = (key, val) =>
    setInspectionData(p => ({ ...p, [key]: { ...p[key], client_passed: val } }));

  const setItemNote = (key, note) =>
    setInspectionData(p => ({ ...p, [key]: { ...p[key], client_notes: note } }));

  const setCustomNote = (space, note) =>
    setInspectionData(p => ({ ...p, [`custom_client_note_${space}`]: note }));

  // ── حسابات التقدم ──
  let totalItems = 0, answeredItems = 0, passedItemsCount = 0;
  unitSpaces.forEach(sp => globalTemplate.forEach(cat => cat.items.forEach(item => {
    const d = inspectionData[`${sp}_${cat.name}_${item.name}`];
    if (d?.isSelected && d?.passed !== null && d?.clientVisible !== false) {
      totalItems++;
      if (d.client_passed !== undefined) {
        answeredItems++;
        if (d.client_passed === true) passedItemsCount++;
      }
    }
  })));

  const isAllAnswered  = totalItems > 0 && answeredItems === totalItems;
  const progressScore  = totalItems === 0 ? 0 : Math.round((passedItemsCount / totalItems) * 100);

  // ── الإرسال ──
  const submitInspection = async (e) => {
    e?.preventDefault();
    if (!isAllAnswered) { alert('الرجاء فحص جميع البنود أولاً'); return; }
    if (progressScore === 100) {
      if (!formData.owner_name.trim()) { alert('يجب إدخال الاسم الرباعي'); return; }
      if (!formData.id_number.trim())  { alert('يجب إدخال رقم الهوية');    return; }
      if (!formData.owner_phone.trim()){ alert('يجب إدخال رقم الجوال');    return; }
      if (!signatureData)              { alert('يجب التوقيع قبل الاستلام'); return; }
    }

    const now = new Date().toLocaleString('ar-SA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const finalData = {
      ...inspectionData,
      ...(progressScore === 100 && {
        _handover_meta: {
          owner_name:     formData.owner_name,
          owner_phone:    formData.owner_phone,
          id_number:      formData.id_number,
          signature_data: signatureData,
          accepted_at:    now,
        },
      }),
    };

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}?action=submit_client_inspection`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit:            unitCode,
          owner_name:      formData.owner_name,
          owner_phone:     formData.owner_phone,
          inspection_data: finalData,
          progress:        progressScore,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (progressScore === 100) { setAcceptedAtDisplay(now); setIsSuccess(true); }
        else setHasSnagsSubmitted(true);
      }
    } catch { alert('فشل الاتصال.'); }
    finally  { setSaving(false); }
  };

  // ── شاشات الحالة ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-cairo">
      <Loader2 className="animate-spin text-[#c5a059]" size={48} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-cairo p-4 text-center">
      <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full">
        <XCircle className="text-red-500 mx-auto mb-4" size={60} />
        <h2 className="text-xl font-black text-[#1a365d] mb-2">تنبيه</h2>
        <p className="text-slate-500 font-bold">{error}</p>
      </div>
    </div>
  );

  if (isSuccess) return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a365d] font-cairo p-4">
      {/* وثيقة الاستلام — مخفية عن الشاشة، تُطبع فقط */}
      <div style={{ display: 'none' }}>
        <HandoverDocument
          ref={docRef}
          unitCode={unitCode}
          ownerName={formData.owner_name}
          ownerPhone={formData.owner_phone}
          idNumber={formData.id_number}
          signatureData={signatureData}
          acceptedAt={acceptedAtDisplay}
          progressScore={progressScore}
          totalItems={totalItems}
        />
      </div>

      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center">
        <ShieldCheck className="text-emerald-500 mx-auto mb-4" size={70} />
        <h2 className="text-3xl font-black text-[#1a365d] mb-2">تم الاستلام الرسمي 🎉</h2>
        <p className="text-slate-500 font-bold mb-1">
          الوحدة <span className="text-emerald-600 font-black">{unitCode}</span> استُلمت بنجاح
        </p>
        <p className="text-slate-400 text-sm mb-2">بدأ سريان الضمان الشامل</p>

        <div className="bg-slate-50 rounded-2xl p-4 mb-6 text-sm text-right space-y-1.5 border border-slate-100">
          <div className="flex justify-between"><span className="text-slate-400">المالك</span><span className="font-bold text-[#1a365d]">{formData.owner_name}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">رقم الهوية</span><span className="font-bold text-[#1a365d]">{formData.id_number}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">تاريخ الاستلام</span><span className="font-bold text-[#1a365d] text-xs">{acceptedAtDisplay}</span></div>
        </div>

        <button
          onClick={handlePrint}
          className="w-full flex items-center justify-center gap-2 bg-[#1a365d] hover:bg-[#1a365d]/90 text-white font-black py-3.5 rounded-xl transition shadow-lg"
        >
          <Download size={18} /> تحميل محضر الاستلام PDF
        </button>
      </div>
    </div>
  );

  if (hasSnagsSubmitted) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-cairo p-4 text-center">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-orange-100">
        <FileWarning className="text-orange-500 mx-auto mb-4" size={70} />
        <h2 className="text-2xl font-black text-[#1a365d] mb-2">تم رفع الملاحظات 🛠️</h2>
        <p className="text-slate-500 font-bold leading-relaxed">شكراً لك! تم استلام تقرير الملاحظات وسيقوم فريق الصيانة بمعالجتها في أقرب وقت.</p>
      </div>
    </div>
  );

  if (totalItems === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-cairo p-4 text-center">
      <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full">
        <XCircle className="text-slate-400 mx-auto mb-4" size={60} />
        <h2 className="text-xl font-black text-[#1a365d] mb-2">عذراً</h2>
        <p className="text-slate-500 font-bold">لا توجد بنود جاهزة للمراجعة حالياً.</p>
      </div>
    </div>
  );

  // ── الصفحة الرئيسية ──
  return (
    <div className="min-h-screen py-12 flex flex-col items-center bg-slate-50 font-cairo px-4 animate-fadeIn">
      <div className="max-w-2xl w-full">

        {/* Header / Progress */}
        <div className="bg-[#1a365d] p-8 rounded-[2.5rem] text-center text-white shadow-xl mb-6 relative overflow-hidden">
          <h2 className="text-2xl font-black mb-1">فحص واستلام الوحدة</h2>
          <p className="text-[#c5a059] font-bold text-sm mb-6">وحدة رقم: {unitCode}</p>
          <div className="w-full bg-[#112240] h-3 rounded-full overflow-hidden mb-2">
            <div
              className="bg-gradient-to-l from-emerald-400 to-emerald-500 h-full transition-all duration-500"
              style={{ width: `${(answeredItems / totalItems) * 100}%` }}
            />
          </div>
          <p className="text-xs font-bold text-slate-300">تم فحص: {answeredItems} من {totalItems} بند</p>
        </div>

        {/* بنود الغرف */}
        <div className="space-y-4 mb-8">
          {unitSpaces.map((space, idx) => {
            const hasItems = globalTemplate.some(cat => cat.items.some(item => {
              const d = inspectionData[`${space}_${cat.name}_${item.name}`];
              return d?.isSelected && d?.passed !== null && d?.clientVisible !== false;
            }));
            const notesAllowed = inspectionData[`custom_notes_allowed_${space}`] !== false;
            if (!hasItems && !notesAllowed) return null;

            const isExpanded = expandedSpace === space;
            return (
              <div key={idx} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setExpandedSpace(isExpanded ? null : space)}
                  className="w-full p-5 flex justify-between items-center hover:bg-slate-50 transition-colors"
                >
                  <h3 className="font-black text-lg text-[#1a365d]">{space}</h3>
                  <ChevronDown className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={20} />
                </button>

                {isExpanded && (
                  <div className="p-5 pt-0 border-t border-slate-100 bg-slate-50/30 space-y-6">
                    {globalTemplate.map((cat, cIdx) => {
                      const hasVisible = cat.items.some(item => {
                        const d = inspectionData[`${space}_${cat.name}_${item.name}`];
                        return d?.isSelected && d?.passed !== null && d?.clientVisible !== false;
                      });
                      if (!hasVisible) return null;
                      return (
                        <div key={cIdx}>
                          <h4 className={`text-xs font-black mb-3 ${cat.color || 'text-indigo-500'}`}>{cat.name}</h4>
                          <div className="space-y-3">
                            {cat.items.map((item, iIdx) => {
                              const key  = `${space}_${cat.name}_${item.name}`;
                              const data = inspectionData[key];
                              if (!data?.isSelected || data?.passed === null || data?.clientVisible === false) return null;
                              return (
                                <div key={iIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                                  <p className="text-sm font-bold text-[#1a365d] mb-3">{item.name}</p>
                                  <div className="flex gap-2 mb-2">
                                    <button onClick={() => setItemStatus(key, true)}
                                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${data.client_passed === true ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100'}`}>
                                      <Check size={16} /> سليم
                                    </button>
                                    <button onClick={() => setItemStatus(key, false)}
                                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${data.client_passed === false ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-orange-100'}`}>
                                      <X size={16} /> ملاحظة
                                    </button>
                                  </div>
                                  {data.client_passed === false && (
                                    <div className="mt-3 animate-fadeIn">
                                      <textarea
                                        value={data.client_notes || ''}
                                        onChange={e => setItemNote(key, e.target.value)}
                                        placeholder="اكتب وصف المشكلة هنا..."
                                        className="w-full bg-orange-50/50 border border-orange-100 p-3 rounded-lg text-xs font-bold outline-none focus:border-orange-400 resize-none"
                                        rows={2}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {notesAllowed && (
                      <div className="mt-6 pt-4 border-t border-slate-200">
                        <label className="flex items-center gap-2 text-[#1a365d] font-bold text-sm mb-3">
                          <PlusCircle size={18} className="text-emerald-500" />
                          هل لديك ملاحظات أخرى في ({space})؟
                        </label>
                        <textarea
                          value={inspectionData[`custom_client_note_${space}`] || ''}
                          onChange={e => setCustomNote(space, e.target.value)}
                          placeholder={`اكتب أي ملاحظة إضافية تخص ${space}...`}
                          className="w-full bg-white border border-slate-200 p-4 rounded-xl text-sm font-medium outline-none focus:border-emerald-400 shadow-inner resize-none"
                          rows={3}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── إقرار الاستلام النهائي (100%) ── */}
        {isAllAnswered && progressScore === 100 && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-emerald-100">
            <div className="flex items-center gap-3 mb-6">
              <FileCheck className="text-emerald-500 flex-shrink-0" size={28} />
              <h3 className="text-xl font-black text-[#1a365d]">إقرار الاستلام الرسمي</h3>
            </div>

            <form onSubmit={submitInspection} className="space-y-4">

              {/* الاسم */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">الاسم الرباعي للمالك</label>
                <input required type="text"
                  value={formData.owner_name}
                  onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                  placeholder="مثال: أحمد محمد علي الغامدي"
                  className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-xl outline-none focus:border-emerald-500 font-bold text-[#1a365d]"
                />
              </div>

              {/* رقم الهوية */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الهوية الوطنية / الإقامة</label>
                <input required type="text" inputMode="numeric"
                  value={formData.id_number}
                  onChange={e => setFormData({ ...formData, id_number: e.target.value })}
                  placeholder="١٠ أرقام"
                  className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-xl outline-none focus:border-emerald-500 font-bold text-[#1a365d]"
                  dir="ltr"
                />
              </div>

              {/* الجوال */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الجوال</label>
                <input required type="tel"
                  value={formData.owner_phone}
                  onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                  placeholder="05XXXXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-xl outline-none focus:border-emerald-500 font-bold text-[#1a365d]"
                  dir="ltr"
                />
              </div>

              {/* التوقيع */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                  <Pen size={13} className="text-[#c5a059]" />
                  التوقيع الإلكتروني
                </label>
                <SignaturePad ref={sigRef} onChange={setSignatureData} />
                {!signatureData && (
                  <p className="text-[11px] text-orange-400 font-bold mt-1.5 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full inline-block" />
                    التوقيع مطلوب لإتمام الاستلام
                  </p>
                )}
                {signatureData && (
                  <p className="text-[11px] text-emerald-500 font-bold mt-1.5 flex items-center gap-1">
                    <Check size={12} /> تم التوقيع
                  </p>
                )}
              </div>

              {/* نص الإقرار */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-xs font-bold text-slate-600 leading-relaxed flex items-start gap-3">
                <CalendarCheck2 size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>
                  بتوقيعي أعلاه أقرّ بأنني عاينت الوحدة رقم <strong className="text-[#1a365d]">{unitCode}</strong> وفحصت
                  جميع البنود ({totalItems} بند) وأنها مطابقة للمواصفات، وأستلمها رسمياً ويبدأ سريان الضمان الشامل.
                </span>
              </div>

              <button type="submit" disabled={saving || !signatureData}
                className="w-full bg-emerald-500 disabled:opacity-50 text-white py-4 rounded-xl font-black text-lg hover:bg-emerald-600 transition shadow-xl flex justify-center items-center gap-2 mt-2">
                {saving ? <Loader2 className="animate-spin" size={20} /> : <FileCheck size={20} />}
                توقيع واستلام الوحدة رسمياً
              </button>
            </form>
          </div>
        )}

        {/* ── رفع الملاحظات (< 100%) ── */}
        {isAllAnswered && progressScore < 100 && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-orange-200 text-center">
            <FileWarning className="text-orange-500 mx-auto mb-4" size={40} />
            <h3 className="text-lg font-black text-[#1a365d] mb-2">إرسال قائمة الملاحظات</h3>
            <p className="text-sm font-bold text-slate-500 mb-6">سيتم إرسالها كتقرير (Snag List) لفريق الصيانة.</p>
            <button onClick={submitInspection} disabled={saving}
              className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-lg hover:bg-orange-600 transition shadow-xl flex justify-center items-center gap-2">
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
              رفع التقرير للإدارة
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
