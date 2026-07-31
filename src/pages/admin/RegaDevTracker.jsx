// ════════════════════════════════════════════════════════════════════════════
//  متابعة قيد المطور العقاري — الهيئة العامة للعقار
//  أداة أدمن لمتابعة تجهيز مستندات القيد في سجل المطورين.
//  الكيان القانوني: «سمك العمارة» (الاسم المسجّل في السجل التجاري).
//  الحفظ: JSON blob واحد في الباك-إند (acc_settings['rega_dev_tracker']) مع
//  تدرّج آمن إلى localStorage عند عدم توفّر الخادم + تصدير/استيراد يدوي.
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  FileText, Calculator, CalendarDays, Download, Upload, Save, Check, Clock,
  Building2, ShieldCheck, Network, ScrollText, HardHat, Flag, Users,
  GraduationCap, Receipt, Map as MapIcon, DraftingCompass, HeartHandshake,
  FileBarChart, AlertTriangle, ChevronDown, Loader2, CloudOff, ExternalLink,
} from 'lucide-react';
import { apiGet, apiPost, TENANT } from '../../lib/api/client';

// ─── الهوية ──────────────────────────────────────────────────────────────────
const LEGAL_NAME = 'سمك العمارة';           // الاسم المسجّل في السجل التجاري
const LS_KEY     = 'semak_rega_tracker_cache';

// ─── المستندات المطلوبة ───────────────────────────────────────────────────────
const MANDATORY_DOCS = [
  { id:'d1', icon:FileBarChart,    name:'القوائم المالية',                          source:'محاسب قانوني معتمد',                 points:'حتى 20 نقطة' },
  { id:'d2', icon:ShieldCheck,     name:'شهادة سلامة السجل الائتماني',              source:'شركة سمة أو مرخّصة',                 points:'حتى 10 نقاط' },
  { id:'d3', icon:Network,         name:'الهيكل التنظيمي المعتمد',                  source:'المؤسسة',                            points:'1 نقطة' },
  { id:'d4', icon:ScrollText,      name:'لائحة تنظيم العمل',                        source:'وزارة الموارد البشرية',              points:'3 نقاط' },
  { id:'d5', icon:HardHat,         name:'لائحة السلامة والصحة المهنية أو ISO 45001', source:'المؤسسة / جهة معتمدة',              points:'3 نقاط' },
  { id:'d6', icon:Flag,            name:'شهادة التوطين (السعودة)',                  source:'وزارة الموارد البشرية',              points:'2 نقطة' },
  { id:'d7', icon:Users,           name:'شهادات التأمينات الاجتماعية وقائمة المشتركين', source:'المؤسسة العامة للتأمينات',        points:'حتى 3 نقاط' },
  { id:'d8', icon:GraduationCap,   name:'اجتياز البرنامج التأهيلي المعتمد',          source:'الهيئة العامة للعقار',               points:'3 نقاط' },
  { id:'d9', icon:Receipt,         name:'شهادة الإقرار الزكوي',                     source:'هيئة الزكاة والضريبة والجمارك',       points:'5 نقاط' },
];
const OPTIONAL_DOCS = [
  { id:'d10', icon:Building2,        name:'بيان المشاريع المنفذة',        source:'المؤسسة', points:'حتى 30 نقطة', note:'مشروع 7 وحدات سكنية غير محتسب (أقل من 10 وحدات).' },
  { id:'d11', icon:DraftingCompass,  name:'المنهج المتبع لأحد المشاريع',   source:'المؤسسة', points:'حتى 10 نقاط' },
  { id:'d12', icon:MapIcon,          name:'عدد المهندسين المعتمدين',      source:'المؤسسة / هيئة المهندسين', points:'حتى 5 نقاط' },
  { id:'d13', icon:HeartHandshake,   name:'برامج المسؤولية الاجتماعية',   source:'المؤسسة', points:'5 نقاط' },
];
const ALL_DOCS = [...MANDATORY_DOCS, ...OPTIONAL_DOCS];

// ─── معايير حاسبة النقاط ───────────────────────────────────────────────────────
const CRITERIA = [
  { id:'financial', name:'القوائم المالية', max:20, type:'radio', key:'financial',
    options:[
      { label:'نسبة الالتزامات/الأصول أقل من 20%', pts:20 },
      { label:'النسبة بين 20% و80%',              pts:15 },
      { label:'النسبة بين 80% و100%',             pts:10 },
      { label:'النسبة 100% أو أكبر',              pts:5  },
    ],
    note:'كلما انخفضت نسبة الالتزامات إلى الأصول ارتفعت النقاط.' },
  { id:'credit', name:'سلامة السجل الائتماني', max:10, type:'checks',
    checks:[
      { key:'credit_nocase',   label:'لا توجد قضايا قانونية منظورة', pts:2 },
      { key:'credit_nocheque', label:'لا توجد شيكات مرتجعة',        pts:4 },
      { key:'credit_nodebt',   label:'لا توجد مبالغ متعثرة',        pts:4 },
    ] },
  { id:'org_chart',   name:'الهيكل التنظيمي المعتمد', max:1, type:'single', key:'org_chart',   label:'لديّ هيكل تنظيمي معتمد', pts:1 },
  { id:'work_reg',    name:'لائحة تنظيم العمل',       max:3, type:'single', key:'work_reg',    label:'اللائحة معتمدة من وزارة الموارد البشرية', pts:3 },
  { id:'safety',      name:'السلامة والصحة المهنية (أو ISO 45001)', max:3, type:'single', key:'safety', label:'لديّ لائحة سلامة أو شهادة ISO 45001', pts:3 },
  { id:'saudization', name:'شهادة التوطين (السعودة)', max:2, type:'single', key:'saudization', label:'لديّ شهادة توطين سارية', pts:2 },
  { id:'insurance', name:'شهادات التأمينات الاجتماعية', max:3, type:'radio', key:'insurance',
    options:[
      { label:'من 1 إلى 5 موظفين',  pts:1 },
      { label:'من 6 إلى 49 موظفاً', pts:2 },
      { label:'50 موظفاً فأكثر',    pts:3 },
    ] },
  { id:'training',    name:'البرنامج التأهيلي للهيئة العامة للعقار', max:3, type:'single', key:'training', label:'تم اجتياز البرنامج التأهيلي بنجاح', pts:3 },
  { id:'zakat',       name:'شهادة الإقرار الزكوي', max:5, type:'single', key:'zakat', label:'لديّ شهادة إقرار زكوي سارية', pts:5 },
  { id:'projects',    name:'بيان المشاريع المنفذة', max:30, type:'single', key:'projects', label:'لديّ مشاريع منفذة موثقة (≥ 10 وحدات)', pts:30,
    note:'مشروع 7 وحدات سكنية لا يُحتسب — المعيار يتطلب 10 وحدات فأكثر.' },
  { id:'methodology', name:'منهج أحد المشاريع المنفذة', max:10, type:'single', key:'methodology', label:'لديّ منهج موثق لأحد المشاريع', pts:10 },
  { id:'engineers', name:'عدد المهندسين المعتمدين', max:5, type:'radio', key:'engineers',
    options:[
      { label:'من 1 إلى 2 مهندس',  pts:2 },
      { label:'من 3 إلى 9 مهندسين', pts:3 },
      { label:'10 مهندسين فأكثر',   pts:5 },
    ] },
  { id:'csr', name:'برامج المسؤولية الاجتماعية', max:5, type:'single', key:'csr', label:'لديّ برامج مسؤولية اجتماعية موثقة', pts:5 },
];
const MIN_SCORE = 35;
const MAX_SCORE = 100;

// ─── الجدول الزمني (10 أيام) ───────────────────────────────────────────────────
const DAYS = [
  { day:1, title:'إطلاق المهام الخارجية الطويلة', tasks:[
    { id:'t1_1', text:'التواصل مع محاسب قانوني معتمد لإعداد القوائم المالية وتحديد الموعد', tag:'external' },
    { id:'t1_2', text:'طلب شهادة سلامة السجل الائتماني من شركة سمة', tag:'external' },
    { id:'t1_3', text:'استخراج شهادة التأمينات الاجتماعية وقائمة المشتركين', tag:'external' },
    { id:'t1_4', text:'الدخول لبوابة الهيئة العامة للعقار والتحقق من خطوات القيد', tag:'submit' },
  ]},
  { day:2, title:'المتطلبات الحكومية الإلكترونية', tasks:[
    { id:'t2_1', text:'استخراج شهادة الإقرار الزكوي من بوابة هيئة الزكاة والضريبة', tag:'external' },
    { id:'t2_2', text:'استخراج شهادة التوطين (نسبة السعودة) من منصة قوى', tag:'external' },
    { id:'t2_3', text:'التسجيل في البرنامج التأهيلي المعتمد وتحديد موعد الاجتياز', tag:'urgent' },
    { id:'t2_4', text:'طلب إصدار لائحة تنظيم العمل من وزارة الموارد البشرية', tag:'external' },
  ]},
  { day:3, title:'المستندات الداخلية', tasks:[
    { id:'t3_1', text:'إعداد وإقرار الهيكل التنظيمي للمؤسسة', tag:'internal' },
    { id:'t3_2', text:'إعداد لائحة السلامة والصحة المهنية', tag:'internal' },
    { id:'t3_3', text:'جمع مستندات المهندسين المعتمدين', tag:'internal' },
    { id:'t3_4', text:'إعداد بيان المشاريع المنفذة مع التوثيق (عقود، تراخيص، صور)', tag:'internal' },
  ]},
  { day:4, title:'إعداد مستندات المشاريع', tasks:[
    { id:'t4_1', text:'إعداد المنهج المتبع لأحد المشاريع المنفذة', tag:'internal' },
    { id:'t4_2', text:'توثيق برامج المسؤولية الاجتماعية (إن وجدت)', tag:'internal' },
    { id:'t4_3', text:'متابعة المحاسب القانوني في تقدم القوائم المالية', tag:'external' },
    { id:'t4_4', text:'التأكد من استلام شهادة التأمينات وقائمة المشتركين', tag:'external' },
  ]},
  { day:5, title:'المتابعة والتحقق', tasks:[
    { id:'t5_1', text:'استلام شهادة السجل الائتماني من سمة والتحقق من سلامتها', tag:'external' },
    { id:'t5_2', text:'اجتياز البرنامج التأهيلي للهيئة أو متابعة موعده', tag:'urgent' },
    { id:'t5_3', text:'مراجعة لائحة تنظيم العمل واعتمادها نهائياً', tag:'external' },
    { id:'t5_4', text:'التحقق من استيفاء نسبة السعودة المطلوبة', tag:'internal' },
  ]},
  { day:6, title:'استلام المستندات الخارجية', tasks:[
    { id:'t6_1', text:'استلام القوائم المالية النهائية من المحاسب ومراجعتها', tag:'external' },
    { id:'t6_2', text:'إعداد ملف جامع لجميع المستندات (PDF مرقّم)', tag:'internal' },
    { id:'t6_3', text:'التحقق من صلاحية جميع الشهادات', tag:'internal' },
    { id:'t6_4', text:'مراجعة قائمة التحقق النهائية وتأشير المكتمل', tag:'internal' },
  ]},
  { day:7, title:'مراجعة أولية وتدقيق', tasks:[
    { id:'t7_1', text:'مطابقة الاسم التجاري والسجل التجاري في جميع المستندات', tag:'internal' },
    { id:'t7_2', text:'التحقق من توقيع وختم المستندات التي تستلزم ذلك', tag:'internal' },
    { id:'t7_3', text:'تشغيل حاسبة النقاط والتأكد من تجاوز 35 نقطة', tag:'internal' },
    { id:'t7_4', text:'تحديد أي مستندات ناقصة ووضع خطة لتداركها', tag:'urgent' },
  ]},
  { day:8, title:'تجهيز الملف النهائي', tasks:[
    { id:'t8_1', text:'رفع جميع المستندات على منصة الهيئة (تجريبي)', tag:'submit' },
    { id:'t8_2', text:'التأكد من جودة الصور والملفات (PDF واضح)', tag:'internal' },
    { id:'t8_3', text:'تعبئة نموذج طلب القيد إلكترونياً والتحقق من البيانات', tag:'submit' },
    { id:'t8_4', text:'الاحتفاظ بنسخ احتياطية من الملف كاملاً', tag:'internal' },
  ]},
  { day:9, title:'المراجعة النهائية قبل التقديم', tasks:[
    { id:'t9_1', text:'مراجعة الطلب المرفوع وإصلاح أي ملاحظات', tag:'submit' },
    { id:'t9_2', text:'التأكد من اكتمال الملف قبل الإرسال', tag:'external' },
    { id:'t9_3', text:'التأكد من سداد الرسوم المطلوبة (إن وجدت)', tag:'submit' },
    { id:'t9_4', text:'الحصول على رقم المرجع / الطلب وحفظه', tag:'submit' },
  ]},
  { day:10, title:'التقديم الرسمي والمتابعة', tasks:[
    { id:'t10_1', text:'تقديم الطلب رسمياً والتأكد من وصول الإشعار', tag:'submit' },
    { id:'t10_2', text:'متابعة حالة الطلب على منصة الهيئة', tag:'submit' },
    { id:'t10_3', text:'الاستعداد لأي مستندات إضافية قد تطلبها الهيئة', tag:'internal' },
    { id:'t10_4', text:'حفظ نسخة كاملة من الملف والأرقام المرجعية', tag:'internal' },
  ]},
];

const TAG_STYLE = {
  external: { label:'جهة خارجية', cls:'bg-pink-100 text-pink-700' },
  internal: { label:'داخلي',     cls:'bg-sky-100 text-sky-700' },
  submit:   { label:'تقديم',     cls:'bg-green-100 text-green-700' },
  urgent:   { label:'عاجل',      cls:'bg-red-100 text-red-700' },
};

const STATUS_META = {
  none:     { label:'لم يبدأ',      bar:'bg-slate-300',   sel:'⬜' },
  progress: { label:'قيد التجهيز',  bar:'bg-amber-400',   sel:'🔄' },
  ready:    { label:'جاهز',         bar:'bg-green-500',   sel:'✅' },
};

// ─── الحالة الافتراضية ─────────────────────────────────────────────────────────
function buildDefaultState() {
  const docs = {};
  ALL_DOCS.forEach(d => { docs[d.id] = { status:'none', notes:'' }; });
  const scores = {
    financial:null, credit_nocase:false, credit_nocheque:false, credit_nodebt:false,
    org_chart:false, work_reg:false, safety:false, saudization:false, insurance:null,
    training:false, zakat:false, projects:false, methodology:false, engineers:null, csr:false,
  };
  const timeline = {};
  DAYS.forEach(day => day.tasks.forEach(t => { timeline[t.id] = false; }));
  return { docs, scores, timeline };
}

// دمج المحفوظ فوق الافتراضي (يبقى المخطّط سليماً لو أُضيفت عناصر جديدة لاحقاً)
function mergeState(base, saved) {
  if (!saved || typeof saved !== 'object') return base;
  const out = { docs:{ ...base.docs }, scores:{ ...base.scores }, timeline:{ ...base.timeline } };
  if (saved.docs) for (const k in base.docs) if (saved.docs[k]) out.docs[k] = { ...base.docs[k], ...saved.docs[k] };
  if (saved.scores) out.scores = { ...base.scores, ...saved.scores };
  if (saved.timeline) for (const k in base.timeline) if (k in saved.timeline) out.timeline[k] = !!saved.timeline[k];
  return out;
}

const loadLocal = () => { try { const r = localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const saveLocal = (s) => { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} };

// ════════════════════════════════════════════════════════════════════════════
export default function RegaDevTracker({ showToast }) {
  const [tab, setTab]           = useState('docs');           // docs | score | timeline
  const [state, setState]       = useState(buildDefaultState);
  const [saveStatus, setStatus] = useState('loading');        // loading|saved|saving|offline
  const [loaded, setLoaded]     = useState(false);
  const [openDays, setOpenDays] = useState(() => new Set([0]));
  const skipSave = useRef(true);
  const saveTimer = useRef(null);
  const fileRef = useRef(null);

  // ─── تحميل الحالة عند الإقلاع ───────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await apiGet('rega_tracker_get', {}, { tenant: TENANT });
        if (!alive) return;
        if (res && res.success && res.data) {
          setState(mergeState(buildDefaultState(), res.data));
          setStatus('saved');
        } else {
          const cached = loadLocal();
          if (cached) setState(mergeState(buildDefaultState(), cached));
          setStatus(res && res.success ? 'saved' : 'offline');
        }
      } catch {
        const cached = loadLocal();
        if (alive && cached) setState(mergeState(buildDefaultState(), cached));
        if (alive) setStatus('offline');
      } finally {
        if (alive) { skipSave.current = true; setLoaded(true); }
      }
    })();
    return () => { alive = false; };
  }, []);

  // ─── الحفظ الفعلي (باك-إند + كاش محلي) ──────────────────────────────────────
  const doSave = useCallback(async (snapshot) => {
    saveLocal(snapshot);
    setStatus('saving');
    try {
      const res = await apiPost('rega_tracker_save', { data: snapshot }, {}, { tenant: TENANT });
      if (res && res.success) setStatus('saved');
      else { setStatus('offline'); }
    } catch { setStatus('offline'); }
  }, []);

  // ─── حفظ تلقائي مؤجَّل عند أي تغيير ──────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    if (skipSave.current) { skipSave.current = false; return; }
    setStatus('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(state), 1000);
    return () => clearTimeout(saveTimer.current);
  }, [state, loaded, doSave]);

  // ─── مُحدِّثات الحالة ────────────────────────────────────────────────────────
  const setDocStatus = (id, status) => setState(s => ({ ...s, docs:{ ...s.docs, [id]:{ ...s.docs[id], status } } }));
  const setDocNotes  = (id, notes)  => setState(s => ({ ...s, docs:{ ...s.docs, [id]:{ ...s.docs[id], notes } } }));
  const setScore     = (key, val)   => setState(s => ({ ...s, scores:{ ...s.scores, [key]:val } }));
  const toggleTask   = (tid)        => setState(s => ({ ...s, timeline:{ ...s.timeline, [tid]:!s.timeline[tid] } }));

  const saveNow = () => { clearTimeout(saveTimer.current); doSave(state); showToast?.('تم حفظ حالة القيد'); };

  // ─── مشتقّات ────────────────────────────────────────────────────────────────
  const docSummary = useMemo(() => {
    const vals = Object.values(state.docs);
    return {
      total: vals.length,
      ready: vals.filter(d => d.status === 'ready').length,
      progress: vals.filter(d => d.status === 'progress').length,
      none: vals.filter(d => d.status === 'none').length,
    };
  }, [state.docs]);

  const totalScore = useMemo(() => {
    const s = state.scores; let t = 0;
    if (s.financial) t += s.financial;
    if (s.credit_nocase)   t += 2;
    if (s.credit_nocheque) t += 4;
    if (s.credit_nodebt)   t += 4;
    if (s.org_chart)   t += 1;
    if (s.work_reg)    t += 3;
    if (s.safety)      t += 3;
    if (s.saudization) t += 2;
    if (s.insurance)   t += s.insurance;
    if (s.training)    t += 3;
    if (s.zakat)       t += 5;
    if (s.projects)    t += 30;
    if (s.methodology) t += 10;
    if (s.engineers)   t += s.engineers;
    if (s.csr)         t += 5;
    return t;
  }, [state.scores]);

  const scoreTone = totalScore >= MIN_SCORE ? 'green' : totalScore >= 30 ? 'yellow' : 'red';

  const timelineStats = useMemo(() => {
    const allTasks = DAYS.flatMap(d => d.tasks);
    const done = allTasks.filter(t => state.timeline[t.id]).length;
    const doneDays = DAYS.filter(d => d.tasks.every(t => state.timeline[t.id])).length;
    return { done, total: allTasks.length, doneDays, pct: allTasks.length ? Math.round(done / allTasks.length * 100) : 0 };
  }, [state.timeline]);

  // ─── تصدير / استيراد ────────────────────────────────────────────────────────
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ version:1, exportedAt:new Date().toISOString(), state }, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `rega-tracker-${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const importJSON = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const incoming = parsed.state || parsed;
        setState(mergeState(buildDefaultState(), incoming));
        showToast?.('تم استيراد البيانات');
      } catch { showToast?.('فشل الاستيراد — ملف غير صالح'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const toggleDay = (i) => setOpenDays(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; });

  // ─── مؤشّر الحفظ ─────────────────────────────────────────────────────────────
  const SaveIndicator = () => {
    const map = {
      loading: { icon:<Loader2 size={15} className="animate-spin" />, text:'جارٍ التحميل…', cls:'text-slate-500 bg-slate-100' },
      saving:  { icon:<Loader2 size={15} className="animate-spin" />, text:'جارٍ الحفظ…',   cls:'text-amber-600 bg-amber-50' },
      saved:   { icon:<Check size={15} />,                           text:'محفوظ',         cls:'text-green-600 bg-green-50' },
      offline: { icon:<CloudOff size={15} />,                        text:'محلي (بانتظار النشر)', cls:'text-amber-600 bg-amber-50' },
    };
    const m = map[saveStatus] || map.saved;
    return <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${m.cls}`}>{m.icon}{m.text}</span>;
  };

  const TABS = [
    { id:'docs',     label:'المستندات والمهام', icon:FileText },
    { id:'score',    label:'حاسبة النقاط',      icon:Calculator },
    { id:'timeline', label:'الجدول الزمني',     icon:CalendarDays },
  ];

  return (
    <div dir="rtl" className="font-cairo text-[#1a365d]">
      {/* شريط تنبيه علوي */}
      <div className="flex items-start gap-2 bg-[#1a365d]/5 border border-[#1a365d]/10 rounded-2xl px-4 py-3 mb-5 text-xs md:text-sm text-[#1a365d]/80 font-semibold">
        <AlertTriangle size={18} className="text-[#c5a059] flex-shrink-0 mt-0.5" />
        <span>
          أداة تنظيمية مساعدة — المرجع الرسمي هو الهيئة العامة للعقار{' '}
          <a href="https://rega.gov.sa" target="_blank" rel="noreferrer" className="text-[#c5a059] inline-flex items-center gap-0.5 hover:underline">rega.gov.sa <ExternalLink size={11} /></a>
          . النقاط والمعايير استرشادية والاعتماد النهائي من الهيئة.
        </span>
      </div>

      {/* الترويسة */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="w-12 h-12 rounded-2xl bg-[#1a365d] flex items-center justify-center flex-shrink-0">
          <Building2 size={24} className="text-[#c5a059]" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl md:text-2xl font-black leading-tight">متابعة قيد المطور العقاري</h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold">سجل المطورين — الهيئة العامة للعقار · باسم «{LEGAL_NAME}»</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SaveIndicator />
          <button onClick={saveNow} className="inline-flex items-center gap-1.5 bg-[#1a365d] text-white px-4 py-2 rounded-2xl text-xs font-bold hover:bg-[#c5a059] transition-all shadow-sm">
            <Save size={15} /> حفظ الآن
          </button>
          <button onClick={exportJSON} className="inline-flex items-center gap-1.5 bg-white border-2 border-[#1a365d]/15 text-[#1a365d] px-3 py-2 rounded-2xl text-xs font-bold hover:border-[#c5a059] hover:text-[#c5a059] transition-all">
            <Download size={15} /> تصدير
          </button>
          <button onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 bg-white border-2 border-[#1a365d]/15 text-[#1a365d] px-3 py-2 rounded-2xl text-xs font-bold hover:border-[#c5a059] hover:text-[#c5a059] transition-all">
            <Upload size={15} /> استيراد
          </button>
          <input ref={fileRef} type="file" accept="application/json" onChange={importJSON} className="hidden" />
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl mb-6 sticky top-2 z-10">
        {TABS.map(t => {
          const Icon = t.icon; const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all ${active ? 'bg-white text-[#1a365d] shadow' : 'text-slate-500 hover:text-[#1a365d]'}`}>
              <Icon size={17} /> <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══ التبويب 1: المستندات ═══ */}
      {tab === 'docs' && (
        <div className="animate-fadeIn">
          {/* ملخّص */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { n:docSummary.total,    l:'إجمالي',      c:'text-[#1a365d]' },
              { n:docSummary.ready,    l:'جاهز',        c:'text-green-600' },
              { n:docSummary.progress, l:'قيد التجهيز', c:'text-amber-600' },
              { n:docSummary.none,     l:'لم يبدأ',     c:'text-slate-400' },
            ].map((x,i) => (
              <div key={i} className="bg-white rounded-2xl border-2 border-slate-100 p-3 md:p-4 text-center">
                <div className={`text-2xl md:text-3xl font-black ${x.c}`}>{x.n}</div>
                <div className="text-[11px] md:text-xs text-slate-500 font-semibold mt-1">{x.l}</div>
              </div>
            ))}
          </div>

          <SectionTitle>المستندات الإلزامية</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 mb-8">
            {MANDATORY_DOCS.map(d => <DocCard key={d.id} doc={d} type="mandatory" st={state.docs[d.id]} onStatus={setDocStatus} onNotes={setDocNotes} />)}
          </div>

          <SectionTitle>المستندات الاختيارية (تعزيز النقاط)</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {OPTIONAL_DOCS.map(d => <DocCard key={d.id} doc={d} type="optional" st={state.docs[d.id]} onStatus={setDocStatus} onNotes={setDocNotes} />)}
          </div>
        </div>
      )}

      {/* ═══ التبويب 2: حاسبة النقاط ═══ */}
      {tab === 'score' && (
        <div className="animate-fadeIn">
          {/* بطاقة النتيجة */}
          <div className="bg-gradient-to-br from-[#1a365d] to-[#0a0f1e] rounded-[2rem] p-6 md:p-8 mb-6 flex flex-wrap items-center gap-6 text-white">
            <div className="relative w-28 h-28 rounded-full border-[6px] border-white/20 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-4xl font-black leading-none">{totalScore}</span>
              <span className="text-xs opacity-70 mt-1">من {MAX_SCORE}</span>
            </div>
            <div className="flex-1 min-w-[220px]">
              <h2 className="text-lg md:text-xl font-black mb-1">إجمالي النقاط التقديرية</h2>
              <p className="text-xs md:text-sm opacity-80 mb-3">الحد الأدنى للقيد: <strong>{MIN_SCORE} نقطة</strong> مع استيفاء جميع المعايير الإلزامية</p>
              <div className="w-full max-w-sm bg-white/20 rounded-full h-3 overflow-hidden mb-3">
                <div className={`h-full rounded-full transition-all duration-500 ${scoreTone === 'green' ? 'bg-green-400' : scoreTone === 'yellow' ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width:`${Math.min(100, totalScore)}%` }} />
              </div>
              <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-bold ${scoreTone === 'green' ? 'bg-green-100 text-green-700' : scoreTone === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {scoreTone === 'green' ? `✅ تجاوزت الحد الأدنى (${totalScore}/${MIN_SCORE})`
                  : scoreTone === 'yellow' ? `⚠️ تقترب من الحد الأدنى (${totalScore}/${MIN_SCORE})`
                  : `❌ لم تبلغ الحد الأدنى بعد (${totalScore}/${MIN_SCORE})`}
              </span>
            </div>
          </div>

          {/* تنبيه إلزامية */}
          <div className="flex items-start gap-3 bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 mb-6 text-sm font-semibold text-amber-800">
            <AlertTriangle size={20} className="flex-shrink-0" />
            <div><strong>تنبيه مهم:</strong> المعايير الإلزامية يجب استيفاؤها بالكامل بغضّ النظر عن المجموع الكلي — عدم استيفاء أيّ معيار إلزامي يمنع إتمام القيد حتى لو تجاوزت {MIN_SCORE} نقطة.</div>
          </div>

          {/* بطاقات المعايير */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CRITERIA.map(c => <CriteriaCard key={c.id} c={c} scores={state.scores} setScore={setScore} />)}
          </div>
        </div>
      )}

      {/* ═══ التبويب 3: الجدول الزمني ═══ */}
      {tab === 'timeline' && (
        <div className="animate-fadeIn">
          <div className="bg-white rounded-2xl border-2 border-slate-100 p-5 mb-6 flex flex-wrap items-center gap-5">
            <Stat n={timelineStats.doneDays} l="يوم مكتمل" />
            <Divider />
            <Stat n={`${timelineStats.done}/${timelineStats.total}`} l="مهمة منجزة" />
            <Divider />
            <div className="flex-1 min-w-[180px]">
              <div className="text-xs font-bold text-slate-500 mb-2">تقدّم الجدول الزمني</div>
              <div className="bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-l from-[#1a365d] to-[#c5a059] transition-all duration-300" style={{ width:`${timelineStats.pct}%` }} />
              </div>
            </div>
            <Stat n={`${timelineStats.pct}%`} l="إنجاز" />
          </div>

          <div className="flex flex-col gap-3">
            {DAYS.map((day, i) => {
              const doneCnt = day.tasks.filter(t => state.timeline[t.id]).length;
              const allDone = doneCnt === day.tasks.length;
              const open = openDays.has(i);
              return (
                <div key={day.day} className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${allDone ? 'border-green-300' : 'border-slate-100'}`}>
                  <button onClick={() => toggleDay(i)} className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-right">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white flex-shrink-0 ${allDone ? 'bg-green-500' : 'bg-[#1a365d]'}`}>{day.day}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm md:text-base truncate">اليوم {day.day} — {day.title}</div>
                    </div>
                    <span className="text-xs font-bold text-slate-500 flex-shrink-0">{doneCnt}/{day.tasks.length}</span>
                    <ChevronDown size={18} className={`text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 flex flex-col gap-1.5">
                      {day.tasks.map(t => {
                        const done = !!state.timeline[t.id];
                        const tg = TAG_STYLE[t.tag];
                        return (
                          <label key={t.id} className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${done ? 'bg-green-50' : 'hover:bg-slate-50'}`}>
                            <input type="checkbox" checked={done} onChange={() => toggleTask(t.id)} className="w-4.5 h-4.5 mt-0.5 accent-green-600 flex-shrink-0" style={{ width:18, height:18 }} />
                            <span className={`flex-1 text-sm ${done ? 'line-through text-slate-400' : 'text-slate-700'}`}>{t.text}</span>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${tg.cls}`}>{tg.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── مكوّنات فرعية ─────────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <div className="flex items-center gap-2 mb-3">
    <span className="w-1 h-5 bg-[#c5a059] rounded" />
    <h3 className="font-black text-[#1a365d]">{children}</h3>
  </div>
);

const Stat = ({ n, l }) => (
  <div className="text-center">
    <div className="text-2xl font-black text-[#1a365d] leading-none">{n}</div>
    <div className="text-[11px] text-slate-500 font-semibold mt-1">{l}</div>
  </div>
);
const Divider = () => <div className="w-px self-stretch bg-slate-200" />;

function DocCard({ doc, type, st, onStatus, onNotes }) {
  const Icon = doc.icon;
  const mandatory = type === 'mandatory';
  const barCls = STATUS_META[st?.status || 'none'].bar;
  return (
    <div className="relative bg-white rounded-2xl border-2 border-slate-100 p-4 hover:shadow-xl transition-all overflow-hidden">
      <span className={`absolute top-0 right-0 w-1 h-full ${barCls}`} />
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${mandatory ? 'bg-red-50 text-red-500' : 'bg-sky-50 text-sky-500'}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-sm leading-snug">{doc.name}</div>
          <div className="text-xs text-slate-400 mt-0.5">{doc.source}</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-3">
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${mandatory ? 'bg-red-100 text-red-700' : 'bg-sky-100 text-sky-700'}`}>{mandatory ? 'إلزامي' : 'اختياري'}</span>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">🏆 {doc.points}</span>
      </div>
      {doc.note && <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 mb-3 border-r-2 border-[#c5a059]">{doc.note}</div>}
      <select value={st?.status || 'none'} onChange={e => onStatus(doc.id, e.target.value)}
        className="w-full text-sm border-2 border-slate-100 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:border-[#1a365d] cursor-pointer mb-2 font-semibold">
        <option value="none">⬜ لم يبدأ</option>
        <option value="progress">🔄 قيد التجهيز</option>
        <option value="ready">✅ جاهز</option>
      </select>
      <textarea value={st?.notes || ''} onChange={e => onNotes(doc.id, e.target.value)} placeholder="ملاحظات…" rows={2}
        className="w-full text-sm border-2 border-slate-100 rounded-xl px-3 py-2 bg-slate-50 focus:outline-none focus:border-[#1a365d] resize-y" />
    </div>
  );
}

function CriteriaCard({ c, scores, setScore }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-slate-100 p-4 hover:border-[#1a365d]/30 transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="font-bold text-sm flex-1">{c.name}</div>
        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-l from-[#c5a059] to-[#a8843d] text-white whitespace-nowrap">حتى {c.max}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {c.type === 'radio' && c.options.map((o, i) => (
          <label key={i} className="flex items-center gap-2 p-2 rounded-xl border-2 border-slate-100 cursor-pointer hover:border-[#1a365d]/30 hover:bg-[#1a365d]/[.03] transition-all text-sm">
            <input type="radio" name={`crit_${c.id}`} checked={scores[c.key] === o.pts} onChange={() => setScore(c.key, o.pts)} className="accent-[#1a365d] w-4 h-4" />
            <span className="flex-1">{o.label}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#1a365d]/5 text-[#1a365d]">{o.pts}</span>
          </label>
        ))}
        {c.type === 'checks' && c.checks.map(ch => (
          <label key={ch.key} className="flex items-center gap-2 p-2 rounded-xl border-2 border-slate-100 cursor-pointer hover:border-[#1a365d]/30 hover:bg-[#1a365d]/[.03] transition-all text-sm">
            <input type="checkbox" checked={!!scores[ch.key]} onChange={() => setScore(ch.key, !scores[ch.key])} className="accent-[#1a365d] w-4 h-4" />
            <span className="flex-1">{ch.label}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#1a365d]/5 text-[#1a365d]">{ch.pts}</span>
          </label>
        ))}
        {c.type === 'single' && (
          <label className="flex items-center gap-2 p-2 rounded-xl border-2 border-slate-100 cursor-pointer hover:border-[#1a365d]/30 hover:bg-[#1a365d]/[.03] transition-all text-sm">
            <input type="checkbox" checked={!!scores[c.key]} onChange={() => setScore(c.key, !scores[c.key])} className="accent-[#1a365d] w-4 h-4" />
            <span className="flex-1">{c.label}</span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#1a365d]/5 text-[#1a365d]">{c.pts}</span>
          </label>
        )}
      </div>
      {c.note && <div className="text-[11px] text-slate-500 bg-slate-50 rounded-lg px-2.5 py-1.5 mt-2 border-r-2 border-[#c5a059]">💡 {c.note}</div>}
    </div>
  );
}
