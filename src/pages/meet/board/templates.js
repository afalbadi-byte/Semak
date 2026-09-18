import { uid } from './useBoard';

// ════════════════════════════════════════════════════════════════════════════
//  قوالب جاهزة — تُسقَط في وسط الشاشة فتبدأ الجلسة من هيكل لا من بياض
// ════════════════════════════════════════════════════════════════════════════

const F = (x, y, w, h, title, color) => ({ id: uid(), kind: 'frame', z: 1,
    data: { x, y, w, h, title, color: color || '#64748b' } });
const T = (x, y, w, text, size, color) => ({ id: uid(), kind: 'text', z: 50,
    data: { x, y, w, h: (size || 22) * 1.6, text, size: size || 22, color: color || '#e2e8f0' } });
const N = (x, y, text, color) => ({ id: uid(), kind: 'note', z: 60,
    data: { x, y, w: 170, h: 120, text: text || '', color: color || '#f6c343' } });
const S = (kind, x, y, w, h, color, text) => ({ id: uid(), kind, z: 40,
    data: { x, y, w, h, color: color || '#60a5fa', fill: 'rgba(96,165,250,.12)', sw: 2, text: text || '' } });
const A = (x1, y1, x2, y2, color) => ({ id: uid(), kind: 'arrow', z: 30,
    data: { x1, y1, x2, y2, color: color || '#94a3b8', w: 3 } });

export const TEMPLATES = [
    {
        key: 'kanban', name: 'لوحة مهام', hint: 'ثلاثة أعمدة وبطاقات',
        build: (x, y) => {
            const cols = [['للتنفيذ', '#94a3b8'], ['قيد التنفيذ', '#fb923c'], ['منجزة', '#34d399']];
            const out = [];
            cols.forEach(([nm, c], i) => {
                const cx = x + i * 320;
                out.push(F(cx, y, 280, 520, nm, c));
                out.push(N(cx + 55, y + 50, '', c));
            });
            return out;
        },
    },
    {
        key: 'matrix', name: 'مصفوفة ٢×٢', hint: 'أهمّية مقابل جهد',
        build: (x, y) => [
            F(x, y, 600, 600, 'مصفوفة القرار'),
            A(x, y + 300, x + 600, y + 300, '#475569'),
            A(x + 300, y + 600, x + 300, y, '#475569'),
            T(x + 20, y + 20, 240, 'مهمّ · سهل', 18, '#34d399'),
            T(x + 330, y + 20, 240, 'مهمّ · صعب', 18, '#fb923c'),
            T(x + 20, y + 330, 240, 'ثانوي · سهل', 18, '#60a5fa'),
            T(x + 330, y + 330, 240, 'ثانوي · صعب', 18, '#f87171'),
        ],
    },
    {
        key: 'mind', name: 'خريطة ذهنية', hint: 'فكرة مركزية وفروع',
        build: (x, y) => {
            const c = S('ellipse', x + 200, y + 180, 200, 100, '#f6c343', 'الفكرة');
            const out = [c];
            const spots = [[x - 40, y], [x + 440, y], [x - 40, y + 360], [x + 440, y + 360]];
            spots.forEach(([bx, by], i) => {
                const n = S('roundrect', bx, by, 180, 80, '#60a5fa', 'فرع ' + (i + 1));
                out.push(n);
                out.push({ id: uid(), kind: 'connector', z: 20,
                    data: { x1: 0, y1: 0, x2: 0, y2: 0, color: '#64748b', w: 2, curve: 1,
                        from: { id: c.id, anchor: 'c' }, to: { id: n.id, anchor: 'c' } } });
            });
            return out;
        },
    },
    {
        key: 'flow', name: 'مخطّط سير', hint: 'بداية وقرار ونهاية',
        build: (x, y) => {
            const a = S('roundrect', x, y, 180, 70, '#34d399', 'البداية');
            const b = S('diamond', x + 20, y + 140, 140, 120, '#fb923c', 'قرار؟');
            const c = S('rect', x + 260, y + 160, 180, 80, '#60a5fa', 'إجراء');
            const e = S('roundrect', x, y + 320, 180, 70, '#f87171', 'النهاية');
            const link = (p, q) => ({ id: uid(), kind: 'connector', z: 20,
                data: { x1: 0, y1: 0, x2: 0, y2: 0, color: '#94a3b8', w: 2,
                    from: { id: p.id, anchor: 'b' }, to: { id: q.id, anchor: 't' } } });
            return [a, b, c, e, link(a, b), link(b, e),
                { ...link(b, c), data: { ...link(b, c).data, from: { id: b.id, anchor: 'r' }, to: { id: c.id, anchor: 'l' } } }];
        },
    },
    {
        key: 'retro', name: 'مراجعة', hint: 'ما نجح · ما تعثّر · ما نجرّب',
        build: (x, y) => {
            const cols = [['ما نجح', '#34d399'], ['ما تعثّر', '#f87171'], ['ما نجرّب', '#60a5fa']];
            const out = [];
            cols.forEach(([nm, c], i) => {
                const cx = x + i * 300;
                out.push(F(cx, y, 260, 460, nm, c));
                out.push(N(cx + 45, y + 50, '', c));
            });
            return out;
        },
    },
    {
        key: 'agenda', name: 'أجندة سماك', hint: 'أقسام الاجتماع الستّة',
        build: (x, y) => {
            const secs = ['المقدمة', 'لوحة الأرقام', 'أولويات ٩٠ يوماً', 'مستجدات', 'اللوحة', 'الختام'];
            const out = [T(x, y - 46, 600, 'أجندة الاجتماع', 30, '#f6c343')];
            secs.forEach((s, i) => {
                out.push(S('roundrect', x + (i % 3) * 300, y + Math.floor(i / 3) * 170, 260, 130,
                    '#60a5fa', s));
            });
            return out;
        },
    },
];
