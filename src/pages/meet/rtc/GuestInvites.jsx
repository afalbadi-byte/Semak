import React, { useCallback, useEffect, useState } from 'react';
import { X, UserPlus, Copy, Check, Loader2, Trash2, MessageCircle, Share2, Clock, PenTool } from 'lucide-react';
import { API_URL, getAdminToken } from '../../../lib/api/client';

// ════════════════════════════════════════════════════════════════════════════
//  دعوة ضيف (عميل أو مورد) إلى الاجتماع
//  رابطٌ خاصّ بهذا الاجتماع وهذا الشخص، يُرسَل واتساب بضغطة، ويدخل منه الضيف
//  من المتصفح بلا حساب — ثم ينتظر حتى يقبله أحد الفريق.
// ════════════════════════════════════════════════════════════════════════════

const hdr = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + getAdminToken() });
const TYPES = [['customer', 'عميل'], ['supplier', 'مورد'], ['other', 'أخرى']];
const waPhone = p => {
    const d = String(p || '').replace(/\D/g, '');
    if (/^05\d{8}$/.test(d)) return '966' + d.slice(1);
    if (/^5\d{8}$/.test(d)) return '966' + d;
    return d;
};
const fmtTime = t => {
    if (!t) return '';
    const [h, m] = String(t).split(':').map(Number);
    return ((h % 12) || 12) + ':' + String(m || 0).padStart(2, '0') + (h < 12 ? ' ص' : ' م');
};
const inviteText = (g, m) => [
    'السلام عليكم ' + g.name + '،',
    'يسعدنا حضوركم اجتماع «' + ((m && m.title) || 'اجتماع سماك') + '» مع سماك العقارية.',
    m && m.meet_date ? 'الموعد: ' + m.meet_date + (m.meet_time ? ' الساعة ' + fmtTime(m.meet_time) : '') : '',
    'رابط الدخول: ' + g.url,
    'يفتح من الجوال أو الكمبيوتر بدون تطبيق، وعند الدخول تنتظر لحظات حتى نقبل دخولك.',
].filter(Boolean).join('\n');

export default function GuestInvites({ meetingId, meeting, onClose }) {
    const [f, setF] = useState({ name: '', phone: '', party_type: 'customer', party_id: 0, can_draw: false, hours: 0 });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [made, setMade] = useState(null);
    const [list, setList] = useState([]);
    const [sugg, setSugg] = useState([]);
    const [copied, setCopied] = useState('');

    const load = useCallback(async () => {
        if (!meetingId) return;
        try {
            const r = await fetch(`${API_URL}?action=mtg_guest_list&meeting_id=${meetingId}`, { headers: hdr() }).then(x => x.json());
            if (r && r.success) setList(r.data || []);
        } catch (e) {}
    }, [meetingId]);
    useEffect(() => { load(); }, [load]);

    // اقتراح من العملاء والموردين أثناء كتابة الاسم
    useEffect(() => {
        const q = f.name.trim();
        if (q.length < 2 || f.party_id) { setSugg([]); return; }
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`${API_URL}?action=mtg_contacts&q=${encodeURIComponent(q)}`, { headers: hdr() }).then(x => x.json());
                setSugg(r && r.success ? r.data || [] : []);
            } catch (e) { setSugg([]); }
        }, 300);
        return () => clearTimeout(t);
    }, [f.name, f.party_id]);

    const create = async e => {
        e.preventDefault();
        if (!f.name.trim()) { setErr('اكتب اسم الضيف'); return; }
        setBusy(true); setErr('');
        try {
            const r = await fetch(`${API_URL}?action=mtg_guest_invite`, {
                method: 'POST', headers: hdr(), body: JSON.stringify({ ...f, meeting_id: meetingId, can_draw: f.can_draw ? 1 : 0 }),
            }).then(x => x.json());
            if (!r || !r.success) { setErr((r && r.message) || 'تعذّرت الدعوة'); return; }
            setMade({ name: f.name.trim(), phone: f.phone, url: r.url, meeting: r.meeting || meeting, expires_at: r.expires_at });
            setF({ name: '', phone: '', party_type: 'customer', party_id: 0, can_draw: false, hours: 0 });
            load();
        } catch (e2) { setErr('تعذّر الوصول إلى الخادم'); }
        finally { setBusy(false); }
    };

    const revoke = async g => {
        if (!window.confirm('إلغاء دعوة ' + g.name + '؟ سيُخرج من الاجتماع إن كان داخله.')) return;
        await fetch(`${API_URL}?action=mtg_guest_revoke`, { method: 'POST', headers: hdr(), body: JSON.stringify({ id: g.id }) }).catch(() => {});
        load();
    };

    const copy = async (url, key) => {
        try { await navigator.clipboard.writeText(url); setCopied(key); setTimeout(() => setCopied(''), 1600); }
        catch (e) { window.prompt('انسخ الرابط', url); }
    };
    const whatsapp = g => {
        const text = inviteText(g, g.meeting || meeting);
        const ph = waPhone(g.phone);
        window.open((ph ? 'https://wa.me/' + ph : 'https://wa.me/') + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
    };
    const share = async g => {
        const text = inviteText(g, g.meeting || meeting);
        if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { return; } }
        copy(text, 'share');
    };

    const field = 'w-full h-11 px-3 rounded-xl bg-white/5 border border-white/10 text-[14px] text-white outline-none focus:border-[#c5a059]';

    return (
        <div dir="rtl" className="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[#0f1a30] text-white rounded-t-3xl sm:rounded-3xl border border-white/10 shadow-2xl"
                onClick={e => e.stopPropagation()} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <div className="sticky top-0 bg-[#0f1a30] px-4 pt-4 pb-3 flex items-center gap-2 border-b border-white/10 z-10">
                    <UserPlus size={18} className="text-[#c5a059]" />
                    <div className="flex-1 font-black">دعوة ضيف إلى الاجتماع</div>
                    <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><X size={16} /></button>
                </div>

                <div className="p-4 space-y-4">
                    {made ? (
                        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-3 space-y-2">
                            <div className="text-[13px] font-black text-emerald-300">جاهزة دعوة {made.name}</div>
                            <div className="text-[11px] text-slate-300 break-all" dir="ltr">{made.url}</div>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => whatsapp(made)} className="h-11 rounded-xl bg-[#25D366] text-white font-black text-[13px] flex items-center justify-center gap-1.5"><MessageCircle size={16} />واتساب</button>
                                <button onClick={() => copy(made.url, 'made')} className="h-11 rounded-xl bg-white/10 font-bold text-[13px] flex items-center justify-center gap-1.5">{copied === 'made' ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}نسخ</button>
                                <button onClick={() => share(made)} className="h-11 rounded-xl bg-white/10 font-bold text-[13px] flex items-center justify-center gap-1.5"><Share2 size={15} />مشاركة</button>
                            </div>
                            <button onClick={() => setMade(null)} className="text-[12px] text-[#c5a059] font-bold">دعوة شخص آخر</button>
                        </div>
                    ) : (
                        <form onSubmit={create} className="space-y-3">
                            <div className="relative">
                                <label className="text-[11px] text-slate-400 font-bold">الاسم</label>
                                <input value={f.name} onChange={e => setF({ ...f, name: e.target.value, party_id: 0 })} placeholder="اسم الضيف أو ابحث في العملاء والموردين" className={field} autoFocus />
                                {sugg.length ? (
                                    <div className="absolute z-20 inset-x-0 mt-1 rounded-xl bg-[#16233f] border border-white/10 shadow-2xl max-h-56 overflow-y-auto">
                                        {sugg.map(s => (
                                            <button type="button" key={s.id} onClick={() => { setF({ ...f, name: s.name, phone: s.phone || f.phone, party_type: s.type, party_id: +s.id }); setSugg([]); }}
                                                className="w-full text-right px-3 py-2 hover:bg-white/5 flex items-center gap-2">
                                                <span className="flex-1 text-[13px] font-bold truncate">{s.name}</span>
                                                <span className="text-[10px] text-[#c5a059]">{s.type === 'supplier' ? 'مورد' : 'عميل'}</span>
                                                {s.phone ? <span className="text-[11px] text-slate-400" dir="ltr">{s.phone}</span> : null}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[11px] text-slate-400 font-bold">الجوال (لإرسال الواتساب)</label>
                                    <input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="05xxxxxxxx" dir="ltr" inputMode="tel" className={field} />
                                </div>
                                <div>
                                    <label className="text-[11px] text-slate-400 font-bold">الصفة</label>
                                    <div className="flex gap-1 h-11">
                                        {TYPES.map(([k, t]) => (
                                            <button type="button" key={k} onClick={() => setF({ ...f, party_type: k })}
                                                className={'flex-1 rounded-xl text-[12px] font-bold border ' + (f.party_type === k ? 'bg-[#c5a059] text-[#0b1220] border-[#c5a059]' : 'border-white/10 text-slate-300')}>{t}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button type="button" onClick={() => setF({ ...f, can_draw: !f.can_draw })}
                                    className={'h-11 rounded-xl border text-[12px] font-bold flex items-center justify-center gap-1.5 ' + (f.can_draw ? 'border-[#c5a059] text-[#c5a059] bg-[#c5a059]/10' : 'border-white/10 text-slate-300')}>
                                    <PenTool size={14} />{f.can_draw ? 'يرسم على السبورة' : 'يشاهد السبورة فقط'}
                                </button>
                                <select value={f.hours} onChange={e => setF({ ...f, hours: +e.target.value })} className={field + ' text-[12px]'}>
                                    <option value={0}>صالحة حتى اليوم التالي للاجتماع</option>
                                    <option value={3}>ثلاث ساعات</option>
                                    <option value={24}>يوم واحد</option>
                                    <option value={168}>أسبوع</option>
                                </select>
                            </div>
                            {err ? <div className="rounded-xl bg-red-500/15 text-red-300 p-2.5 text-[12px] font-bold">{err}</div> : null}
                            <button type="submit" disabled={busy || !meetingId}
                                className="w-full h-12 rounded-2xl bg-[#c5a059] text-[#0b1220] font-black flex items-center justify-center gap-2 disabled:opacity-50">
                                {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}أنشئ رابط الدعوة
                            </button>
                        </form>
                    )}

                    {list.length ? (
                        <div className="space-y-2">
                            <div className="text-[12px] font-black text-slate-400">دعوات هذا الاجتماع</div>
                            {list.map(g => (
                                <div key={g.id} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-[13px] truncate">{g.name}
                                                <span className="text-[10px] text-[#c5a059] mr-1">{(TYPES.find(t => t[0] === g.party_type) || [])[1] || ''}</span></div>
                                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                                <Clock size={11} />
                                                {!g.active ? (+g.revoked ? 'ملغاة' : 'انتهت') : g.last_seen_at ? 'آخر حضور ' + g.last_seen_at.slice(11, 16) : 'لم يدخل بعد'}
                                                {g.active ? ' · تنتهي ' + g.expires_at.slice(0, 16) : ''}
                                            </div>
                                        </div>
                                        {g.active ? <>
                                            <button onClick={() => whatsapp({ ...g, meeting })} title="واتساب" className="w-9 h-9 rounded-xl bg-[#25D366]/20 text-[#25D366] flex items-center justify-center"><MessageCircle size={15} /></button>
                                            <button onClick={() => copy(g.url, 'g' + g.id)} title="نسخ الرابط" className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">{copied === 'g' + g.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}</button>
                                            <button onClick={() => revoke(g)} title="إلغاء الدعوة" className="w-9 h-9 rounded-xl bg-red-500/15 text-red-300 flex items-center justify-center"><Trash2 size={14} /></button>
                                        </> : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
