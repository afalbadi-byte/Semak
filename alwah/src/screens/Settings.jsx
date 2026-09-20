import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus, Pencil, LogOut, KeyRound, Users, Home as HomeIcon, Share2, Trash2, Building, BellRing } from 'lucide-react';
import { call } from '../lib/api';
import { subscribe, unsubscribe, pushState } from '../lib/push';
import { useRoute } from '../lib/router';
import { useData } from '../App';
import { Card, Section, Btn, Field, inputCls, Seg, Sheet, Stepper, PALETTE, useToast, todayStr } from '../ui';
import { SURAHS, TOTAL_LINES, initLinesFor, linesLabel } from '../lib/quran';

export default function Settings() {
    const { me, family, sup, members, reloadMembers, logout, setFamily } = useData();
    const r = useRoute();
    const toast = useToast();
    const [edit, setEdit] = useState(r.q.add ? {} : null);
    const owner = me.role === 'owner';

    return (
        <div className="space-y-6">
            {owner ? <FamilyName family={family} onSaved={n => setFamily({ ...family, name: n })} /> : null}

            {sup ? (
                <Section title="أفراد الأسرة" action={<button onClick={() => setEdit({})} className="text-[12px] font-bold text-brand inline-flex items-center gap-1"><UserPlus size={14} />إضافة</button>}>
                    <Card className="divide-y divide-paper-2">
                        {members.length ? members.map(m => (
                            <button key={m.id} onClick={() => setEdit(m)} className="w-full p-4 flex items-center gap-3 text-right hover:bg-paper-2/40">
                                <span className="w-9 h-9 rounded-full text-white font-bold flex items-center justify-center shrink-0" style={{ background: m.color }}>{m.name.slice(0, 1)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-ink">{m.name}</div>
                                    <div className="text-[12px] text-ink-3">{m.dir === 'asc' ? 'من الفاتحة' : 'من الناس صعوداً'} · الورد {linesLabel(m.target_lines)} · ألواح {m.alwah_n} · مراجعة {m.review_n}</div>
                                </div>
                                <Pencil size={15} className="text-ink-3" />
                            </button>
                        )) : <p className="p-5 text-center text-[13px] text-ink-3">لا أفراد بعد</p>}
                    </Card>
                </Section>
            ) : null}

            {owner ? <Accounts members={members} /> : null}
            <Notifications />
            <Password />
            {me.is_admin ? <Families /> : null}

            <Btn kind="line" className="w-full" onClick={logout}><LogOut size={16} />تسجيل الخروج</Btn>
            <p className="text-center text-[11px] text-ink-3">{me.name} · {me.username}</p>

            <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit && edit.id ? 'تعديل ' + edit.name : 'فرد جديد'}>
                {edit ? <MemberForm m={edit} onDone={async msg => { setEdit(null); await reloadMembers(); if (msg) toast(msg); }} /> : null}
            </Sheet>
        </div>
    );
}

// ─── الإشعارات: تصل الجوال ولو كان التطبيق مغلقاً ─────────────────────────────
function Notifications() {
    const toast = useToast();
    const [st, setSt] = useState('…');
    const [busy, setBusy] = useState(false);
    useEffect(() => { setSt(pushState()); }, []);
    const on = async () => {
        setBusy(true);
        try { await subscribe(); setSt('on'); toast('فُعِّلت الإشعارات على هذا الجهاز'); }
        catch (e) { toast(e.message || 'تعذّر التفعيل', 'err'); setSt(pushState()); }
        setBusy(false);
    };
    const off = async () => { setBusy(true); try { await unsubscribe(); toast('أُوقفت على هذا الجهاز'); } catch (e) { /* تجاهل */ } setSt(pushState() === 'on' ? 'off' : pushState()); setBusy(false); };
    return (
        <Section title="الإشعارات">
            <Card className="p-4 space-y-2">
                {st === 'nokey' ? <p className="text-[13px] text-ink-3 leading-6">خدمة الإشعارات غير مهيّأة بعد على الخادم.</p>
                    : st === 'unsupported' ? <p className="text-[13px] text-ink-3 leading-6">هذا المتصفّح لا يدعم الإشعارات. ثبّت التطبيق على الشاشة الرئيسية ثم افتحه منها.</p>
                    : st === 'blocked' ? <p className="text-[13px] text-red-700 leading-6">الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفّح ثم أعد المحاولة.</p>
                        : <>
                            <p className="text-[13px] text-ink-2 leading-6">تذكيرٌ بورد اليوم عصراً، وتذكيرٌ مساءً بما لم يُسمَّع وباعتماد ورد الغد. تصل ولو كان التطبيق مغلقاً.</p>
                            {st === 'on'
                                ? <div className="flex gap-2"><Btn kind="soft" className="flex-1" busy={busy} onClick={on}><BellRing size={16} />أعد التفعيل هنا</Btn><Btn kind="line" busy={busy} onClick={off}>أوقفها</Btn></div>
                                : <Btn className="w-full" busy={busy} onClick={on}><BellRing size={16} />فعّل الإشعارات على هذا الجهاز</Btn>}
                        </>}
                <p className="text-[11px] text-ink-3">لكل جهازٍ تفعيله. في الآيفون لا بدّ من تثبيت التطبيق على الشاشة الرئيسية أوّلاً.</p>
            </Card>
        </Section>
    );
}

function FamilyName({ family, onSaved }) {
    const toast = useToast();
    const [n, setN] = useState(family ? family.name : '');
    const save = async () => {
        const r = await call('family_save', { body: { name: n } });
        if (r.success) { onSaved(n); toast('حُفظ'); } else toast(r.message, 'err');
    };
    return (
        <Section title="الأسرة">
            <Card className="p-4 flex gap-2">
                <input className={inputCls} value={n} onChange={e => setN(e.target.value)} />
                <Btn kind="soft" onClick={save}><HomeIcon size={16} />حفظ</Btn>
            </Card>
        </Section>
    );
}

// ─── بيانات الفرد ونقطة بدايته ──────────────────────────────────────────────
function MemberForm({ m, onDone }) {
    const toast = useToast();
    const isNew = !m.id;
    const [f, setF] = useState({
        name: m.name || '', gender: m.gender || 'm', color: m.color || PALETTE[0], dir: m.dir || 'desc',
        target_lines: m.target_lines || 5, alwah_n: m.alwah_n || 5, review_n: m.review_n || 10,
        rest_days: m.rest_days || [], goal_surah: m.goal_surah || '', goal_date: m.goal_date || '',
        rest_lines: m.rest_lines || 0, rest_alwah: m.rest_alwah === undefined ? 1 : m.rest_alwah,
    });
    const [start, setStart] = useState({ mode: isNew ? 'none' : 'keep', value: '' });
    const [busy, setBusy] = useState(false);
    const set = (k, v) => setF(x => ({ ...x, [k]: v }));

    const init = start.mode === 'keep' ? (m.init_lines || 0) : initLinesFor(f.dir, start.mode, start.value);
    const surahOrder = f.dir === 'desc' ? [...SURAHS.keys()].reverse() : [...SURAHS.keys()];

    const save = async () => {
        setBusy(true);
        const r = await call('member_save', { body: { ...f, id: m.id || 0, init_lines: init } });
        setBusy(false);
        if (!r.success) { toast(r.message, 'err'); return; }
        onDone(isNew ? 'أُضيف، وحُسب ورده اليومي' : 'حُفظ');
    };
    const del = async () => {
        if (!window.confirm('إخفاء ' + m.name + ' من الأسرة؟ يبقى سجلّه محفوظاً.')) return;
        const r = await call('member_delete', { body: { id: m.id } });
        if (r.success) onDone('أُخفي'); else toast(r.message, 'err');
    };

    return (
        <div className="space-y-4">
            <Field label="الاسم"><input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} autoFocus={isNew} /></Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="النوع"><Seg value={f.gender} onChange={v => set('gender', v)} options={[{ v: 'm', t: 'ذكر' }, { v: 'f', t: 'أنثى' }]} /></Field>
                <Field label="اللون">
                    <div className="flex flex-wrap gap-1.5 pt-1">
                        {PALETTE.map(c => <button key={c} type="button" onClick={() => set('color', c)} className={'w-7 h-7 rounded-full ' + (f.color === c ? 'ring-2 ring-offset-2 ring-ink' : '')} style={{ background: c }} />)}
                    </div>
                </Field>
            </div>

            <Field label="اتجاه الحفظ" hint={f.dir === 'desc' ? 'من الناس صعوداً سورةً سورة، وكل سورةٍ تُحفظ من أوّلها إلى آخرها. الأشهر للصغار.' : 'يبدأ من الفاتحة والبقرة نزولاً إلى الناس.'}>
                <Seg value={f.dir} onChange={v => set('dir', v)} options={[{ v: 'desc', t: 'من الناس صعوداً' }, { v: 'asc', t: 'من الفاتحة' }]} />
            </Field>

            <Field label="أين وصل في الحفظ؟" hint={init ? `المحفوظ عند البدء: نحو ${(init * 30 / TOTAL_LINES).toFixed(1).replace('.0', '')} جزء` : 'لم يبدأ الحفظ بعد'}>
                <Seg value={start.mode} onChange={v => setStart({ mode: v, value: '' })}
                    options={[...(isNew ? [] : [{ v: 'keep', t: 'كما هو' }]), { v: 'none', t: 'لم يبدأ' }, { v: 'surah', t: 'حتى سورة' }, { v: 'juz', t: 'أجزاء' }, { v: 'page', t: 'صفحة' }]} />
                {start.mode === 'surah' ? (
                    <select className={inputCls + ' mt-2'} value={start.value} onChange={e => setStart({ ...start, value: e.target.value })}>
                        <option value="">{f.dir === 'desc' ? 'حفظ من الناس حتى سورة…' : 'حفظ من الفاتحة حتى سورة…'}</option>
                        {surahOrder.map(i => <option key={i} value={i + 1}>{i + 1}. {SURAHS[i][0]}</option>)}
                    </select>
                ) : null}
                {start.mode === 'juz' ? (
                    <input className={inputCls + ' mt-2'} type="number" min="1" max="30" inputMode="numeric" placeholder={f.dir === 'desc' ? 'عدد الأجزاء من آخر المصحف' : 'عدد الأجزاء من أوّل المصحف'}
                        value={start.value} onChange={e => setStart({ ...start, value: e.target.value })} />
                ) : null}
                {start.mode === 'page' ? (
                    <input className={inputCls + ' mt-2'} type="number" min="1" max="604" inputMode="numeric" placeholder={f.dir === 'desc' ? 'أتمّ الحفظ من الصفحة ٦٠٤ صعوداً حتى صفحة…' : 'أتمّ الحفظ من الصفحة ١ حتى صفحة…'}
                        value={start.value} onChange={e => setStart({ ...start, value: e.target.value })} />
                ) : null}
            </Field>

            <Field label="مقدار الحفظ الجديد يومياً" hint={linesLabel(f.target_lines)}>
                <div className="flex gap-1.5 flex-wrap">
                    {[[3, '٣ أسطر'], [5, '٥ أسطر'], [8, 'نصف صفحة'], [15, 'صفحة'], [30, 'صفحتان']].map(([v, t]) => (
                        <button key={v} type="button" onClick={() => set('target_lines', v)}
                            className={'h-9 px-3 rounded-xl text-[13px] font-semibold ' + (f.target_lines === v ? 'bg-brand text-white' : 'bg-paper-2 text-ink-2')}>{t}</button>
                    ))}
                </div>
            </Field>

            <Field label="أيام الراحة" hint="لا حفظ جديد فيها، والمراجعة تستمرّ، ولا تكسر عدّاد الأيام المتتالية">
                <div className="flex gap-1.5 flex-wrap">
                    {['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map((t, i) => {
                        const on = (f.rest_days || []).includes(i);
                        return <button key={i} type="button" onClick={() => set('rest_days', on ? f.rest_days.filter(x => x !== i) : [...(f.rest_days || []), i])}
                            className={'h-9 px-3 rounded-xl text-[13px] font-semibold ' + (on ? 'bg-brand text-white' : 'bg-paper-2 text-ink-2')}>{t}</button>;
                    })}
                </div>
                {(f.rest_days || []).length ? (
                    <div className="mt-3 space-y-2 rounded-xl bg-paper-2/50 p-3">
                        <div className="text-[12px] font-bold text-ink-2">في يوم الراحة</div>
                        <div className="flex gap-1.5 flex-wrap">
                            {[[0, 'لا حفظ جديد'], [2, 'سطران'], [3, '٣ أسطر'], [5, '٥ أسطر']].map(([v, t]) => (
                                <button key={v} type="button" onClick={() => set('rest_lines', v)}
                                    className={'h-9 px-3 rounded-xl text-[13px] font-semibold ' + (f.rest_lines === v ? 'bg-brand text-white' : 'bg-white text-ink-2')}>{t}</button>
                            ))}
                        </div>
                        <label className="flex items-center gap-2 text-[13px] text-ink-2">
                            <input type="checkbox" checked={!!f.rest_alwah} onChange={e => set('rest_alwah', e.target.checked ? 1 : 0)} />تبقى الألواح في يوم الراحة
                        </label>
                        <p className="text-[11px] text-ink-3 leading-5">المراجعة تبقى دائماً، فهي التي تثبّت المحفوظ.</p>
                    </div>
                ) : null}
            </Field>

            <Field label="الهدف (اختياري)" hint="سورةٌ يُتمّها في تاريخ، فيبيّن التطبيق المطلوب يومياً وهل هو متقدّم أم متأخّر">
                <div className="grid grid-cols-2 gap-2">
                    <select className={inputCls} value={f.goal_surah} onChange={e => set('goal_surah', e.target.value)}>
                        <option value="">بلا هدف</option>
                        {SURAHS.map(([n], i) => <option key={i} value={i + 1}>{i + 1}. {n}</option>)}
                    </select>
                    <input type="date" className={inputCls} value={f.goal_date || ''} min={todayStr()} onChange={e => set('goal_date', e.target.value)} />
                </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
                <Card className="p-3 flex flex-col items-center gap-1"><span className="text-[12px] font-semibold text-ink-2">صفحات الألواح</span><Stepper value={f.alwah_n} onChange={v => set('alwah_n', v)} min={1} max={20} /></Card>
                <Card className="p-3 flex flex-col items-center gap-1"><span className="text-[12px] font-semibold text-ink-2">صفحات المراجعة</span><Stepper value={f.review_n} onChange={v => set('review_n', v)} min={1} max={60} /></Card>
            </div>

            <Btn className="w-full !h-12" busy={busy} onClick={save}>{isNew ? 'أضف' : 'احفظ'}</Btn>
            {!isNew ? <Btn kind="danger" className="w-full" onClick={del}><Trash2 size={16} />إخفاء من الأسرة</Btn> : null}
        </div>
    );
}

// ─── حسابات الدخول ──────────────────────────────────────────────────────────
function Accounts({ members }) {
    const toast = useToast();
    const [list, setList] = useState([]);
    const [edit, setEdit] = useState(null);
    const load = useCallback(async () => { const r = await call('users'); if (r.success) setList(r.data); }, []);
    useEffect(() => { load(); }, [load]);
    const ROLE = { owner: 'صاحب الحساب', supervisor: 'مشرف (يسمّع للجميع)', member: 'فرد (يرى صفحته)' };

    return (
        <Section title="حسابات الدخول" action={<button onClick={() => setEdit({ role: 'member' })} className="text-[12px] font-bold text-brand inline-flex items-center gap-1"><KeyRound size={14} />حساب جديد</button>}>
            <Card className="divide-y divide-paper-2">
                {list.map(u => (
                    <button key={u.id} onClick={() => u.role !== 'owner' && setEdit(u)} className="w-full p-4 flex items-center gap-3 text-right hover:bg-paper-2/40">
                        <Users size={17} className="text-ink-3" />
                        <div className="flex-1 min-w-0">
                            <div className="font-bold text-ink">{u.name} <span className="text-[12px] font-normal text-ink-3" dir="ltr">{u.username}</span></div>
                            <div className="text-[12px] text-ink-3">{ROLE[u.role]}{u.member_id ? ' · ' + ((members.find(m => m.id === u.member_id) || {}).name || '') : ''}{!u.active ? ' · موقوف' : ''}</div>
                        </div>
                        {u.role !== 'owner' ? <Pencil size={15} className="text-ink-3" /> : null}
                    </button>
                ))}
            </Card>
            <p className="text-[11px] text-ink-3 mt-2 px-1 leading-5">المشرف (كالأم) يسمّع للأسرة كلّها، والفرد (كالابن) يرى صفحته ويسمّع لنفسه.</p>
            <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit && edit.id ? 'تعديل الحساب' : 'حساب دخول جديد'}>
                {edit ? <UserForm u={edit} members={members} onDone={() => { setEdit(null); load(); toast('حُفظ'); }} /> : null}
            </Sheet>
        </Section>
    );
}

function UserForm({ u, members, onDone }) {
    const toast = useToast();
    const [f, setF] = useState({ name: u.name || '', username: u.username || '', password: '', role: u.role || 'member', member_id: u.member_id || '', active: u.active === undefined ? 1 : u.active });
    const [busy, setBusy] = useState(false);
    const [saved, setSaved] = useState(null);
    const set = (k, v) => setF(x => ({ ...x, [k]: v }));

    const save = async () => {
        setBusy(true);
        const r = await call('user_save', { body: { ...f, id: u.id || 0 } });
        setBusy(false);
        if (!r.success) { toast(r.message, 'err'); return; }
        if (f.password) setSaved({ ...f }); else onDone();
    };
    const msg = s => [`السلام عليكم ${s.name}،`, 'حسابك في تطبيق «ألواح» لمتابعة حفظ القرآن:',
        'الرابط: ' + location.origin + location.pathname.replace(/index.html$/, ''), 'اسم الدخول: ' + s.username, 'كلمة المرور: ' + s.password,
        'افتح الرابط، ثم «إضافة إلى الشاشة الرئيسية» ليصير تطبيقاً على جوالك.'].join('\n');

    if (saved) return (
        <div className="space-y-3">
            <p className="text-[14px] text-ink-2">حُفظ الحساب. أرسل له بيانات الدخول:</p>
            <pre className="whitespace-pre-wrap text-[13px] bg-white border border-paper-2 rounded-xl p-3 leading-6 font-sans">{msg(saved)}</pre>
            <a href={'https://wa.me/?text=' + encodeURIComponent(msg(saved))} target="_blank" rel="noreferrer">
                <Btn className="w-full"><Share2 size={16} />أرسلها واتساب</Btn>
            </a>
            <Btn kind="line" className="w-full" onClick={onDone}>تمّ</Btn>
        </div>
    );

    return (
        <div className="space-y-3">
            <Field label="الاسم"><input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
            <Field label="اسم الدخول"><input className={inputCls} dir="ltr" autoCapitalize="none" value={f.username} onChange={e => set('username', e.target.value.toLowerCase())} /></Field>
            <Field label={u.id ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور'}><input className={inputCls} dir="ltr" value={f.password} onChange={e => set('password', e.target.value)} /></Field>
            <Field label="الصلاحية">
                <Seg value={f.role} onChange={v => set('role', v)} options={[{ v: 'supervisor', t: 'مشرف' }, { v: 'member', t: 'فرد' }]} />
            </Field>
            <Field label={f.role === 'member' ? 'صفحة من يتابع؟' : 'يمثّل فرداً في الأسرة؟ (اختياري)'}>
                <select className={inputCls} value={f.member_id} onChange={e => set('member_id', e.target.value)}>
                    <option value="">—</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
            </Field>
            {u.id ? <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={!!f.active} onChange={e => set('active', e.target.checked ? 1 : 0)} />الحساب فعّال</label> : null}
            <Btn className="w-full !h-12" busy={busy} onClick={save}>احفظ</Btn>
        </div>
    );
}

function Password() {
    const toast = useToast();
    const [f, setF] = useState({ old: '', new: '' });
    const [open, setOpen] = useState(false);
    const save = async () => {
        const r = await call('password', { body: f });
        if (r.success) { toast('تغيّرت كلمة المرور'); setOpen(false); setF({ old: '', new: '' }); } else toast(r.message, 'err');
    };
    return (
        <Section title="كلمة المرور">
            {open ? (
                <Card className="p-4 space-y-3">
                    <input className={inputCls} type="password" dir="ltr" placeholder="الحالية" value={f.old} onChange={e => setF({ ...f, old: e.target.value })} />
                    <input className={inputCls} type="password" dir="ltr" placeholder="الجديدة (٦ أحرف فأكثر)" value={f.new} onChange={e => setF({ ...f, new: e.target.value })} />
                    <Btn className="w-full" onClick={save}>غيّرها</Btn>
                </Card>
            ) : <Btn kind="line" className="w-full" onClick={() => setOpen(true)}><KeyRound size={16} />تغيير كلمة المرور</Btn>}
        </Section>
    );
}

// ─── أسرٌ أخرى (لمدير التطبيق) ──────────────────────────────────────────────
function Families() {
    const toast = useToast();
    const [list, setList] = useState([]);
    const [f, setF] = useState(null);
    const load = useCallback(async () => { const r = await call('families'); if (r.success) setList(r.data); }, []);
    useEffect(() => { load(); }, [load]);
    const save = async () => {
        const r = await call('family_create', { body: f });
        if (r.success) { toast('أُنشئت الأسرة'); setF(null); load(); } else toast(r.message, 'err');
    };
    return (
        <Section title="أسر أخرى" action={<button onClick={() => setF({ family: '', name: '', username: '', password: '' })} className="text-[12px] font-bold text-brand inline-flex items-center gap-1"><Building size={14} />أسرة جديدة</button>}>
            <Card className="divide-y divide-paper-2">
                {list.map(x => (
                    <div key={x.id} className="p-4 flex items-center gap-3">
                        <div className="flex-1"><div className="font-bold text-ink">{x.name}</div><div className="text-[12px] text-ink-3">{x.members} أفراد · صاحبها <span dir="ltr">{x.owner}</span></div></div>
                    </div>
                ))}
            </Card>
            <p className="text-[11px] text-ink-3 mt-2 px-1">لكل أسرة حسابها، ولا ترى أسرةٌ بيانات أخرى.</p>
            <Sheet open={!!f} onClose={() => setF(null)} title="أسرة جديدة">
                {f ? (
                    <div className="space-y-3">
                        <Field label="اسم الأسرة"><input className={inputCls} value={f.family} onChange={e => setF({ ...f, family: e.target.value })} /></Field>
                        <Field label="اسم صاحب الحساب"><input className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
                        <Field label="اسم الدخول"><input className={inputCls} dir="ltr" value={f.username} onChange={e => setF({ ...f, username: e.target.value.toLowerCase() })} /></Field>
                        <Field label="كلمة المرور"><input className={inputCls} dir="ltr" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></Field>
                        <Btn className="w-full !h-12" onClick={save}>أنشئ</Btn>
                    </div>
                ) : null}
            </Sheet>
        </Section>
    );
}
