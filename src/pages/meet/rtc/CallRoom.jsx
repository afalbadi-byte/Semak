import React, { useEffect, useRef, useState } from 'react';
import {
    Mic, MicOff, Video, VideoOff, SwitchCamera, MonitorUp, Hand, PhoneOff, Users, UserPlus,
    Check, X, Loader2, WifiOff, UserX,
} from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
//  شاشة المكالمة — مشتركة بين الفريق والضيف
//  شبكة صورٍ تتكيّف مع العدد، وصورتك صغيرة في الزاوية، والمتكلّم يلمع بإطارٍ ذهبي.
// ════════════════════════════════════════════════════════════════════════════

const initials = n => String(n || '؟').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('');

function VideoEl({ stream, muted, mirror, contain }) {
    const ref = useRef(null);
    useEffect(() => {
        const v = ref.current; if (!v) return;
        if (v.srcObject !== stream) v.srcObject = stream || null;
        if (stream) v.play().catch(() => {});
    }, [stream]);
    return <video ref={ref} autoPlay playsInline muted={muted}
        className={'absolute inset-0 w-full h-full ' + (contain ? 'object-contain' : 'object-cover') + (mirror ? ' -scale-x-100' : '')} />;
}

function Tile({ p, speaking, big }) {
    const showVideo = p.stream && p.cam;
    return (
        <div className={'relative rounded-2xl overflow-hidden bg-[#111a2e] transition-shadow ' +
            (speaking ? 'ring-[3px] ring-[#c5a059] shadow-[0_0_24px_rgba(197,160,89,.35)]' : 'ring-1 ring-white/10')}>
            {/* الصوت يأتي من عنصر الفيديو نفسه، فيبقى معروضاً وإن أُطفئت الكاميرا */}
            {p.stream ? <div className={showVideo ? '' : 'opacity-0'}><VideoEl stream={p.stream} contain={p.share} /></div> : null}
            {!showVideo ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className={'rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d5299] flex items-center justify-center font-black text-white ' +
                        (big ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl')}>{initials(p.name)}</div>
                </div>
            ) : null}
            {p.conn !== 'connected' ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    {p.conn === 'failed'
                        ? <span className="px-3 py-1.5 rounded-xl bg-red-500/80 text-white text-[11px] font-bold flex items-center gap-1.5"><WifiOff size={13} />تعذّر الاتصال</span>
                        : <span className="px-3 py-1.5 rounded-xl bg-black/60 text-white text-[11px] font-bold flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />يتصل…</span>}
                </div>
            ) : null}
            <div className="absolute bottom-2 inset-x-2 flex items-center gap-1.5">
                <span className="max-w-full truncate px-2 py-1 rounded-lg bg-black/55 backdrop-blur text-white text-[12px] font-bold flex items-center gap-1">
                    {!p.mic ? <MicOff size={12} className="text-red-400 shrink-0" /> : null}
                    {p.name}{p.role === 'guest' ? <span className="text-[#c5a059] text-[10px]">ضيف</span> : null}
                </span>
                {p.hand ? <span className="px-1.5 py-1 rounded-lg bg-[#c5a059] text-[#0b1220]"><Hand size={13} /></span> : null}
            </div>
        </div>
    );
}

function Ctl({ on, danger, onClick, children, title, disabled }) {
    return (
        <button onClick={onClick} title={title} disabled={disabled}
            className={'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 transition disabled:opacity-30 ' +
                (danger ? 'bg-red-600 text-white' : on ? 'bg-white/10 text-white' : 'bg-white text-[#0b1220]')}>
            {children}
        </button>
    );
}

export default function CallRoom({ rtc, isGuest, onInvite, title, height }) {
    const [people, setPeople] = useState(false);
    const list = rtc.peers;
    const n = list.length;
    const cols = n <= 1 ? 'grid-cols-1' : n <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-3';
    const rows = n <= 1 ? 'grid-rows-1' : n === 2 ? 'grid-rows-2 sm:grid-rows-1' : n <= 4 ? 'grid-rows-2' : 'grid-rows-3 sm:grid-rows-2';
    const mob = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    return (
        <div dir="rtl" className="relative w-full bg-[#0b1220] rounded-2xl overflow-hidden flex flex-col" style={{ height: height || '72vh' }}>
            {/* ── طلبات الدخول (للفريق) ── */}
            {!isGuest && rtc.waiting.length ? (
                <div className="absolute top-2 inset-x-2 z-30 space-y-1.5">
                    {rtc.waiting.map(w => (
                        <div key={w.id} className="rounded-2xl bg-[#1a365d]/95 backdrop-blur border border-[#c5a059]/50 p-2.5 flex items-center gap-2 shadow-2xl">
                            <UserPlus size={16} className="text-[#c5a059] shrink-0" />
                            <div className="flex-1 min-w-0 text-[13px] text-white"><b>{w.name}</b> <span className="text-white/70">(ضيف) يطلب الدخول</span></div>
                            <button onClick={() => rtc.admit(w.id, true)} className="h-9 px-3 rounded-xl bg-emerald-500 text-white text-[12px] font-black flex items-center gap-1"><Check size={14} />قبول</button>
                            <button onClick={() => rtc.admit(w.id, false)} title="رفض" className="h-9 w-9 rounded-xl bg-white/10 text-white flex items-center justify-center"><X size={15} /></button>
                        </div>
                    ))}
                </div>
            ) : null}

            {/* ── الصور ── */}
            <div className="flex-1 min-h-0 p-2">
                {n ? (
                    <div className={'grid gap-2 h-full ' + cols + ' ' + rows}>
                        {list.map(p => <Tile key={p.id} p={p} speaking={!!rtc.speaking[p.id]} big={n <= 2} />)}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6">
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-3"><Users size={24} className="text-white/40" /></div>
                        <div className="text-white font-black">{title || 'غرفة الاجتماع'}</div>
                        <div className="text-slate-400 text-[13px] mt-1">بانتظار انضمام الآخرين…</div>
                        {onInvite ? <button onClick={onInvite} className="mt-4 h-11 px-4 rounded-2xl bg-[#c5a059] text-[#0b1220] font-black text-[13px] flex items-center gap-2"><UserPlus size={16} />دعوة ضيف</button> : null}
                    </div>
                )}
            </div>

            {/* ── صورتي ── */}
            {rtc.local ? (
                <div className={'absolute z-20 left-3 w-24 h-32 sm:w-40 sm:h-28 rounded-2xl overflow-hidden bg-[#111a2e] shadow-2xl ' +
                    (rtc.speaking.me ? 'ring-[3px] ring-[#c5a059]' : 'ring-1 ring-white/20')}
                    style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}>
                    {rtc.cam || rtc.share ? <VideoEl stream={rtc.local} muted mirror={!rtc.share && rtc.facing === 'user'} contain={rtc.share} />
                        : <div className="absolute inset-0 flex items-center justify-center text-white/60"><VideoOff size={20} /></div>}
                    <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[10px] font-bold flex items-center gap-1">
                        {!rtc.mic ? <MicOff size={10} className="text-red-400" /> : null}أنت
                    </span>
                </div>
            ) : null}

            {/* ── الأزرار ── */}
            <div className="relative z-20 px-2 pt-2 flex items-center justify-center gap-2 overflow-x-auto no-scrollbar bg-gradient-to-t from-black/60 to-transparent"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 10px)' }}>
                <Ctl on={rtc.mic} onClick={rtc.toggleMic} title={rtc.mic ? 'كتم المايك' : 'فتح المايك'}>{rtc.mic ? <Mic size={20} /> : <MicOff size={20} />}</Ctl>
                <Ctl on={rtc.cam} onClick={rtc.toggleCam} title={rtc.cam ? 'إطفاء الكاميرا' : 'تشغيل الكاميرا'}>{rtc.cam ? <Video size={20} /> : <VideoOff size={20} />}</Ctl>
                {mob ? <Ctl on onClick={rtc.flipCam} title="تبديل الكاميرا" disabled={!rtc.cam}><SwitchCamera size={20} /></Ctl> : null}
                {rtc.canShare ? <Ctl on={!rtc.share} onClick={rtc.toggleShare} title="مشاركة الشاشة"><MonitorUp size={20} /></Ctl> : null}
                <Ctl on={!rtc.hand} onClick={rtc.toggleHand} title="رفع اليد"><Hand size={20} /></Ctl>
                <Ctl on onClick={() => setPeople(v => !v)} title="المشاركون">
                    <span className="relative"><Users size={20} />
                        <span className="absolute -top-2 -left-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#c5a059] text-[#0b1220] text-[10px] font-black flex items-center justify-center">{n + 1}</span>
                    </span>
                </Ctl>
                <Ctl danger onClick={rtc.leave} title="مغادرة"><PhoneOff size={20} /></Ctl>
            </div>

            {/* ── قائمة المشاركين ── */}
            {people ? (
                <div className="absolute z-40 inset-x-2 bottom-24 sm:inset-x-auto sm:left-3 sm:w-80 max-h-[60%] overflow-y-auto rounded-2xl bg-[#111a2e]/95 backdrop-blur border border-white/10 p-2 shadow-2xl">
                    <div className="flex items-center justify-between px-2 py-1.5">
                        <span className="text-white font-black text-[13px]">المشاركون ({n + 1})</span>
                        <button onClick={() => setPeople(false)} className="text-white/60"><X size={16} /></button>
                    </div>
                    <Row name={(rtc.me && rtc.me.name) || 'أنت'} tag="أنت" mic={rtc.mic} hand={rtc.hand} />
                    {list.map(p => (
                        <Row key={p.id} name={p.name} tag={p.role === 'guest' ? 'ضيف' : ''} mic={p.mic} hand={p.hand} conn={p.conn}
                            onKick={!isGuest && p.role === 'guest' ? () => { if (window.confirm('إخراج ' + p.name + ' من الاجتماع؟')) rtc.kick(p.id); } : null} />
                    ))}
                    {onInvite ? <button onClick={() => { setPeople(false); onInvite(); }} className="mt-1 w-full h-10 rounded-xl bg-white/5 text-[#c5a059] font-bold text-[13px] flex items-center justify-center gap-2"><UserPlus size={15} />دعوة ضيف</button> : null}
                </div>
            ) : null}
        </div>
    );
}

function Row({ name, tag, mic, hand, conn, onKick }) {
    return (
        <div className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5">
            <div className="w-8 h-8 rounded-full bg-[#1a365d] text-white text-[12px] font-black flex items-center justify-center shrink-0">{initials(name)}</div>
            <div className="flex-1 min-w-0 text-white text-[13px] font-bold truncate">{name}{tag ? <span className="text-[#c5a059] text-[10px] font-bold mr-1">{tag}</span> : null}</div>
            {conn === 'failed' ? <WifiOff size={14} className="text-red-400" /> : null}
            {hand ? <Hand size={14} className="text-[#c5a059]" /> : null}
            {mic ? <Mic size={14} className="text-white/50" /> : <MicOff size={14} className="text-red-400" />}
            {onKick ? <button onClick={onKick} title="إخراج" className="w-8 h-8 rounded-lg bg-red-500/15 text-red-300 flex items-center justify-center"><UserX size={14} /></button> : null}
        </div>
    );
}
