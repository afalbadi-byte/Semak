import React, { useState, useMemo } from 'react';

/* ── Isometric projection (2:1) ─────────────────────────────────────────── */
const IW   = 30;          // px per world unit – horizontal
const IH   = IW / 2;     // px per world unit – vertical
const WH   = 1.8;         // wall height (world units)
const S    = 1 / 34;      // SVG px → world m

function pt(wx, wy, wz) {
  return { x: (wx - wz) * IW, y: (wx + wz) * IH - wy * IW };
}
function pp(pts) {
  return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/* ── Room tints (floor only – walls always white) ───────────────────────── */
const TINT = {
  'مجلس':                '#EDD9A3',
  'مجلس فاخر':           '#EDD9A3',
  'غرفة معيشة':          '#B8D4EC',
  'غرفة رئيسية':         '#B8DDB8',
  'غرفة 2':              '#B8DDB8',
  'غرفة 3':              '#C8C0E8',
  'غرفة 4':              '#EDE0A8',
  'غرفة 3 + غرفة 4':    '#C8C0E8',
  'مطبخ':                '#F5C896',
  'حمام':                '#96C0F0',
  'حمام رئيسي':          '#96C0F0',
  'حمام 2':              '#96C0F0',
  'حمام 3':              '#96C0F0',
  'خادمة':               '#D8A8E8',
  'غرفة خادمة + غسيل':  '#D8A8E8',
  'غسيل':                '#A8DCC0',
  'مستودع':              '#C8CCD0',
  'مدخل':                '#D8DCE0',
  'سطح خاص':             '#A8D8BC',
  'موقف 1':              '#C4C8CC',
  'موقف 2':              '#CCCED2',
  'موقف 3':              '#C4C8CC',
  'موقف 4':              '#CCCED2',
  'موقف 5':              '#C4C8CC',
  'موقف 6':              '#CCCED2',
  'موقف 7':              '#C4C8CC',
  'مصعد وسلالم':         '#A8B4C8',
  default:               '#D8DCE0',
};

/* ── Room ───────────────────────────────────────────────────────────────── */
function IsoRoom({ room, hovered, onHover }) {
  const { x, y, w, h, label, area } = room;
  const x0 = x * S, z0 = y * S, x1 = x0 + w * S, z1 = z0 + h * S;
  const isHov = hovered === label;
  const floor  = isHov ? '#C5A059' : (TINT[label] || TINT.default);

  // 8 corners
  const A = pt(x0, 0,  z0), B = pt(x1, 0,  z0);
  const C = pt(x1, 0,  z1), D = pt(x0, 0,  z1);
  const E = pt(x0, WH, z0), F = pt(x1, WH, z0);
  const G = pt(x1, WH, z1), H = pt(x0, WH, z1);

  // label center on top face
  const lx = (A.x + B.x + C.x + D.x) / 4;
  const ly = (A.y + B.y + C.y + D.y) / 4;
  const sw = w * S, sd = h * S;
  const fs = Math.max(6, Math.min(11, Math.min(sw, sd) * IW * 0.32));

  return (
    <g onPointerEnter={() => onHover(label, area)}
       onPointerLeave={() => onHover(null)}
       style={{ cursor: 'pointer' }}>

      {/* Top / floor */}
      <polygon points={pp([A,B,C,D])} fill={floor}
        stroke="#C8C0A8" strokeWidth="0.6" strokeLinejoin="round"/>

      {/* South wall — viewer-facing, near-white */}
      <polygon points={pp([D,C,G,H])} fill={isHov ? '#F5EDD8' : '#F0F0EE'}
        stroke="#D8D0C0" strokeWidth="0.5"/>

      {/* East wall — side-facing, slightly darker */}
      <polygon points={pp([B,C,G,F])} fill={isHov ? '#E8E0C8' : '#E4E4E0'}
        stroke="#D0C8B8" strokeWidth="0.5"/>

      {/* Top edge cap */}
      <polygon points={pp([E,F,G,H])} fill="#FAFAF8" stroke="#E0D8C8" strokeWidth="0.3"/>

      {/* Label */}
      <text x={lx} y={ly - fs * 0.2} textAnchor="middle" dominantBaseline="middle"
        fontSize={fs} fontWeight="700" fontFamily="Cairo,Tajawal,Arial,sans-serif"
        fill={isHov ? '#fff' : '#1a365d'}
        style={{ pointerEvents:'none', userSelect:'none' }}>
        {label}
      </text>
      {area && (
        <text x={lx} y={ly + fs * 0.95} textAnchor="middle" dominantBaseline="middle"
          fontSize={fs * 0.72} fontWeight="600" fontFamily="Cairo,Tajawal,Arial,sans-serif"
          fill={isHov ? '#FFE' : '#4A6A8A'}
          style={{ pointerEvents:'none', userSelect:'none' }}>
          {area}
        </text>
      )}
    </g>
  );
}

/* ── Furniture helpers ──────────────────────────────────────────────────── */
// A simple isometric box at world coords
function IsoBox({ wx, wy, wz, sw, sh, bh, topColor, southColor, eastColor, stroke='#A89870' }) {
  const A = pt(wx,    wy,    wz),    B = pt(wx+sw, wy,    wz);
  const C = pt(wx+sw, wy,    wz+sh), D = pt(wx,    wy,    wz+sh);
  const E = pt(wx,    wy+bh, wz),    F = pt(wx+sw, wy+bh, wz);
  const G = pt(wx+sw, wy+bh, wz+sh), H = pt(wx,    wy+bh, wz+sh);
  return (
    <g style={{ pointerEvents:'none' }}>
      <polygon points={pp([E,F,G,H])} fill={topColor}   stroke={stroke} strokeWidth="0.4"/>
      <polygon points={pp([D,C,G,H])} fill={southColor} stroke={stroke} strokeWidth="0.4"/>
      <polygon points={pp([B,C,G,F])} fill={eastColor}  stroke={stroke} strokeWidth="0.4"/>
    </g>
  );
}

function IsoBed({ x, y, w, h }) {
  const wx=x*S+0.08, wz=y*S+0.08, sw=w*S-0.16, sd=h*S-0.16;
  const frame_h=0.12, matt_h=0.22, hb_h=0.72, hb_d=0.12;
  return (
    <g style={{ pointerEvents:'none' }}>
      {/* frame */}
      <IsoBox wx={wx} wy={0} wz={wz} sw={sw} sh={sd} bh={frame_h}
        topColor="#C8A870" southColor="#B89060" eastColor="#A88050" stroke="#907040"/>
      {/* mattress */}
      <IsoBox wx={wx+0.04} wy={frame_h} wz={wz+0.04} sw={sw-0.08} sh={sd-0.08} bh={matt_h}
        topColor="#EDE4D4" southColor="#DDD4C4" eastColor="#D0C8B4" stroke="#C0B8A0"/>
      {/* headboard */}
      <IsoBox wx={wx} wy={0} wz={wz} sw={sw} sh={hb_d} bh={hb_h}
        topColor="#8B6540" southColor="#7A5430" eastColor="#6A4420" stroke="#5A3410"/>
      {/* pillow L */}
      <IsoBox wx={wx+sw*0.08} wy={frame_h+matt_h} wz={wz+hb_d+0.02}
        sw={sw*0.37} sh={sd*0.22} bh={0.08}
        topColor="#F5F0E8" southColor="#E8E0D0" eastColor="#DDD8C8" stroke="#C8C0B0"/>
      {/* pillow R */}
      <IsoBox wx={wx+sw*0.55} wy={frame_h+matt_h} wz={wz+hb_d+0.02}
        sw={sw*0.37} sh={sd*0.22} bh={0.08}
        topColor="#F5F0E8" southColor="#E8E0D0" eastColor="#DDD8C8" stroke="#C8C0B0"/>
    </g>
  );
}

function IsoSofa({ x, y, w, h }) {
  const wx=x*S+0.06, wz=y*S+0.06, sw=w*S-0.12, sd=h*S-0.12;
  const seatH=0.36, backH=0.62, armW=0.15, backD=0.2;
  return (
    <g style={{ pointerEvents:'none' }}>
      {/* seat */}
      <IsoBox wx={wx+armW} wy={0} wz={wz+backD} sw={sw-armW*2} sh={sd-backD} bh={seatH}
        topColor="#C0B4A0" southColor="#B0A490" eastColor="#A09480" stroke="#908070"/>
      {/* back */}
      <IsoBox wx={wx+armW} wy={0} wz={wz} sw={sw-armW*2} sh={backD} bh={backH}
        topColor="#D0C4B0" southColor="#C0B4A0" eastColor="#B0A490" stroke="#908070"/>
      {/* left arm */}
      <IsoBox wx={wx} wy={0} wz={wz} sw={armW} sh={sd} bh={seatH*1.4}
        topColor="#B8AC98" southColor="#A89C88" eastColor="#988C78" stroke="#887060"/>
      {/* right arm */}
      <IsoBox wx={wx+sw-armW} wy={0} wz={wz} sw={armW} sh={sd} bh={seatH*1.4}
        topColor="#B8AC98" southColor="#A89C88" eastColor="#988C78" stroke="#887060"/>
    </g>
  );
}

function IsoTable({ x, y, w, h }) {
  const wx=x*S+0.06, wz=y*S+0.06, sw=w*S-0.12, sd=h*S-0.12;
  const legW=0.06, legH=0.68, topT=0.06;
  return (
    <g style={{ pointerEvents:'none' }}>
      {/* legs */}
      {[[0,0],[1,0],[0,1],[1,1]].map(([a,b],i)=>(
        <IsoBox key={i}
          wx={wx+a*(sw-legW)} wy={0} wz={wz+b*(sd-legW)}
          sw={legW} sh={legW} bh={legH}
          topColor="#C0A060" southColor="#B09050" eastColor="#A08040" stroke="#907030"/>
      ))}
      {/* tabletop */}
      <IsoBox wx={wx-0.04} wy={legH} wz={wz-0.04} sw={sw+0.08} sh={sd+0.08} bh={topT}
        topColor="#D4B070" southColor="#C4A060" eastColor="#B49050" stroke="#A08040"/>
    </g>
  );
}

function IsoPlant({ x, y }) {
  const p0 = pt(x*S, 0,    y*S);
  const p1 = pt(x*S, 0.28, y*S);
  const p2 = pt(x*S, 0.72, y*S);
  return (
    <g style={{ pointerEvents:'none' }}>
      <ellipse cx={p0.x} cy={p0.y} rx={IW*0.14} ry={IH*0.14} fill="#8B6030"/>
      <ellipse cx={p1.x} cy={p1.y} rx={IW*0.32} ry={IH*0.42} fill="#2A7A35" opacity="0.85"/>
      <ellipse cx={p2.x-3} cy={p2.y-2} rx={IW*0.18} ry={IH*0.26} fill="#38A045" opacity="0.7"/>
    </g>
  );
}

/* ── Data ───────────────────────────────────────────────────────────────── */
const APARTMENT_ROOMS = [
  { x:12,  y:12,  w:200, h:190, label:'مجلس',         area:'45 م²' },
  { x:212, y:12,  w:183, h:190, label:'غرفة معيشة',   area:'32 م²' },
  { x:395, y:12,  w:197, h:190, label:'غرفة رئيسية',  area:'38 م²' },
  { x:592, y:12,  w:76,  h:95,  label:'حمام رئيسي',   area:'8 م²'  },
  { x:592, y:107, w:76,  h:95,  label:'خادمة',         area:'9 م²'  },
  { x:12,  y:202, w:165, h:180, label:'مطبخ',          area:'22 م²' },
  { x:177, y:202, w:218, h:180, label:'غرفة 2',        area:'28 م²' },
  { x:395, y:202, w:197, h:180, label:'غرفة 3',        area:'26 م²' },
  { x:592, y:202, w:76,  h:87,  label:'حمام 2',        area:'6 م²'  },
  { x:592, y:289, w:76,  h:93,  label:'غسيل',          area:'6 م²'  },
  { x:12,  y:382, w:128, h:106, label:'مدخل',          area:''      },
  { x:140, y:382, w:255, h:106, label:'غرفة 4',        area:'24 م²' },
  { x:395, y:382, w:115, h:106, label:'مستودع',        area:'10 م²' },
  { x:510, y:382, w:158, h:106, label:'حمام 3',        area:'8 م²'  },
];
const APARTMENT_FURN = [
  { type:'sofa',  x:22,  y:22,  w:128, h:58  },
  { type:'table', x:244, y:65,  w:96,  h:58  },
  { type:'bed',   x:405, y:22,  w:100, h:145 },
  { type:'bed',   x:187, y:212, w:110, h:82  },
  { type:'bed',   x:405, y:212, w:100, h:82  },
  { type:'bed',   x:150, y:392, w:110, h:78  },
  { type:'plant', x:195, y:20  },
  { type:'plant', x:598, y:378 },
];

const ROOF_ROOMS = [
  { x:12,  y:12,  w:230, h:203, label:'مجلس فاخر',        area:'55 م²' },
  { x:242, y:12,  w:198, h:203, label:'غرفة معيشة',        area:'38 م²' },
  { x:440, y:12,  w:308, h:203, label:'غرفة رئيسية',       area:'50 م²' },
  { x:12,  y:215, w:170, h:182, label:'مطبخ',               area:'25 م²' },
  { x:182, y:215, w:258, h:182, label:'غرفة 2',             area:'30 م²' },
  { x:440, y:215, w:105, h:88,  label:'حمام رئيسي',        area:'9 م²'  },
  { x:545, y:215, w:203, h:88,  label:'حمام 2',             area:'7 م²'  },
  { x:440, y:303, w:308, h:94,  label:'غرفة خادمة + غسيل', area:'19 م²' },
  { x:12,  y:397, w:140, h:171, label:'مدخل',               area:''      },
  { x:152, y:397, w:286, h:171, label:'غرفة 3 + غرفة 4',   area:'56 م²' },
  { x:438, y:397, w:232, h:171, label:'سطح خاص',            area:'120 م²'},
  { x:670, y:397, w:78,  h:171, label:'حمام 3',             area:'7 م²'  },
];
const ROOF_FURN = [
  { type:'sofa',  x:22,  y:22,  w:150, h:68  },
  { type:'table', x:274, y:75,  w:110, h:65  },
  { type:'bed',   x:450, y:22,  w:130, h:165 },
  { type:'bed',   x:192, y:225, w:125, h:95  },
  { type:'bed',   x:162, y:407, w:115, h:92  },
  { type:'plant', x:230, y:20  },
  { type:'plant', x:633, y:408 },
];

const GROUND_ROOMS = [
  { x:22,  y:65,  w:148, h:185, label:'موقف 1',      area:'' },
  { x:180, y:65,  w:148, h:185, label:'موقف 2',      area:'' },
  { x:338, y:65,  w:148, h:185, label:'موقف 3',      area:'' },
  { x:496, y:65,  w:148, h:185, label:'موقف 4',      area:'' },
  { x:22,  y:275, w:148, h:185, label:'موقف 5',      area:'' },
  { x:180, y:275, w:148, h:185, label:'موقف 6',      area:'' },
  { x:338, y:275, w:148, h:185, label:'موقف 7',      area:'' },
  { x:497, y:275, w:171, h:210, label:'مصعد وسلالم', area:'' },
];

/* ── Tooltip ────────────────────────────────────────────────────────────── */
function Tooltip({ info }) {
  if (!info) return null;
  return (
    <div className="absolute top-3 right-3 bg-white/96 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-2.5 shadow-lg z-10 pointer-events-none">
      <p className="font-black text-[#1a365d] text-sm">{info.label}</p>
      {info.area && <p className="text-[#c5a059] font-bold text-xs mt-0.5">{info.area}</p>}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────────── */
export default function FloorPlan3D({ floorId }) {
  const [hovered, setHovered] = useState(null);
  const [info,    setInfo]    = useState(null);

  const isGround = floorId === 'ground';
  const isRoof   = floorId === 'fourth';
  const rooms    = isGround ? GROUND_ROOMS : isRoof ? ROOF_ROOMS : APARTMENT_ROOMS;
  const furn     = isGround ? [] : isRoof ? ROOF_FURN : APARTMENT_FURN;

  const handleHover = (label, area) => {
    setHovered(label);
    setInfo(label ? { label, area } : null);
  };

  // Compute SVG viewBox
  const vb = useMemo(() => {
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    for (const r of rooms) {
      const corners = [
        pt(r.x*S,0,r.y*S), pt((r.x+r.w)*S,0,r.y*S),
        pt((r.x+r.w)*S,0,(r.y+r.h)*S), pt(r.x*S,0,(r.y+r.h)*S),
        pt(r.x*S,WH,r.y*S), pt((r.x+r.w)*S,WH,r.y*S),
        pt(r.x*S,WH,(r.y+r.h)*S), pt((r.x+r.w)*S,WH,(r.y+r.h)*S),
      ];
      for (const c of corners) {
        x0=Math.min(x0,c.x); y0=Math.min(y0,c.y);
        x1=Math.max(x1,c.x); y1=Math.max(y1,c.y);
      }
    }
    const pad = 24;
    return `${x0-pad} ${y0-pad} ${x1-x0+pad*2} ${y1-y0+pad*2}`;
  }, [rooms]);

  // Painter's sort (back to front by wx+wz)
  const sortedRooms = useMemo(() =>
    [...rooms].sort((a,b)=>
      (a.x+a.w/2)*S+(a.y+a.h/2)*S - ((b.x+b.w/2)*S+(b.y+b.h/2)*S)
    ), [rooms]);

  const sortedFurn = useMemo(() =>
    [...furn].sort((a,b)=> (a.x||0)*S+(a.y||0)*S - ((b.x||0)*S+(b.y||0)*S)
    ), [furn]);

  return (
    <div className="relative w-full select-none" style={{ height: 480 }}>
      <svg
        viewBox={vb}
        style={{
          width: '100%', height: '100%',
          background: 'linear-gradient(150deg,#EEF2F8 0%,#E4EAF4 100%)',
        }}
      >
        <defs>
          <filter id="bshadow">
            <feDropShadow dx="6" dy="12" stdDeviation="8" floodColor="#00000022"/>
          </filter>
        </defs>
        <g filter="url(#bshadow)">
          {sortedRooms.map((r,i)=>(
            <IsoRoom key={i} room={r} hovered={hovered} onHover={handleHover}/>
          ))}
          {sortedFurn.map((f,i)=>{
            if (f.type==='bed')   return <IsoBed   key={i} {...f}/>;
            if (f.type==='sofa')  return <IsoSofa  key={i} {...f}/>;
            if (f.type==='table') return <IsoTable key={i} {...f}/>;
            if (f.type==='plant') return <IsoPlant key={i} {...f}/>;
            return null;
          })}
        </g>
      </svg>

      <Tooltip info={info}/>

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] text-slate-400 border border-slate-200 shadow-sm">
          مرّر الماوس فوق أي غرفة لمعرفة تفاصيلها
        </div>
      </div>
    </div>
  );
}
