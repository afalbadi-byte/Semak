import React, { useState, useMemo } from 'react';

/* ─── Isometric projection ──────────────────────────────────────────────────
   Standard 2:1 isometric viewed from south-east.
   World: X = right, Z = depth (into screen), Y = up
   Screen: right+down for X, left+down for Z, up for Y
   isoW = pixels per world unit (horizontal), isoH = isoW/2 (vertical)
────────────────────────────────────────────────────────────────────────── */
const ISO_W = 26;           // px per world unit, horizontal
const ISO_H = ISO_W / 2;   // px per world unit, vertical (2:1 ratio)
const WALL_H = 2.6;        // metres
const S = 1 / 34;          // SVG px → world metres

function pt(wx, wy, wz) {
  return {
    x: (wx - wz) * ISO_W,
    y: (wx + wz) * ISO_H - wy * ISO_W,
  };
}
function poly(points) {
  return points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/* ─── Colours ─────────────────────────────────────────────────────────────── */
const FLOOR_COLORS = {
  'مجلس':                   '#F0DFB8',
  'مجلس فاخر':              '#F0DFB8',
  'غرفة معيشة':             '#C8DCF0',
  'غرفة رئيسية':            '#C8E8CC',
  'غرفة 2':                 '#C8E8CC',
  'غرفة 3':                 '#D4CCF0',
  'غرفة 4':                 '#F0E8C0',
  'غرفة 3 + غرفة 4':       '#D4CCF0',
  'مطبخ':                   '#F8D8B0',
  'حمام':                   '#B8D4F8',
  'حمام رئيسي':             '#B8D4F8',
  'حمام 2':                 '#B8D4F8',
  'حمام 3':                 '#B8D4F8',
  'خادمة':                  '#E8C8F0',
  'غرفة خادمة + غسيل':     '#E8C8F0',
  'غسيل':                   '#C0EDD8',
  'مستودع':                 '#D8DCE0',
  'مدخل':                   '#E8EAEC',
  'سطح خاص':                '#B8E8CC',
  'موقف 1':                 '#D8D8D8',
  'موقف 2':                 '#E0E0E0',
  'موقف 3':                 '#D8D8D8',
  'موقف 4':                 '#E0E0E0',
  'موقف 5':                 '#D8D8D8',
  'موقف 6':                 '#E0E0E0',
  'موقف 7':                 '#D8D8D8',
  'مصعد وسلالم':            '#B8C4D8',
  default:                  '#E8EAEC',
};

function darken(hex, amount = 0.15) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amount)) | 0;
  const g = Math.max(0, ((n >> 8) & 0xff) * (1 - amount)) | 0;
  const b = Math.max(0, (n & 0xff) * (1 - amount)) | 0;
  return `rgb(${r},${g},${b})`;
}

/* ─── Single isometric room ───────────────────────────────────────────────── */
function IsoRoom({ room, hovered, onHover }) {
  const { x, y, w, h, label, area } = room;
  const wx = x * S, wz = y * S, sw = w * S, sd = h * S;
  const isHov = hovered === label;

  const floorColor = isHov ? '#C5A059' : (FLOOR_COLORS[label] || FLOOR_COLORS.default);
  const wallColorL  = darken(floorColor, isHov ? 0.28 : 0.22); // east wall (left-facing)
  const wallColorR  = darken(floorColor, isHov ? 0.18 : 0.12); // south wall (right-facing)
  const wallTop     = '#FFFFFF';

  // 8 corners of the room box
  const p000 = pt(wx,        0,       wz);
  const p100 = pt(wx + sw,   0,       wz);
  const p110 = pt(wx + sw,   0,       wz + sd);
  const p010 = pt(wx,        0,       wz + sd);
  const p001 = pt(wx,        WALL_H,  wz);
  const p101 = pt(wx + sw,   WALL_H,  wz);
  const p111 = pt(wx + sw,   WALL_H,  wz + sd);
  const p011 = pt(wx,        WALL_H,  wz + sd);

  // Center of top face for label
  const cx = (p000.x + p100.x + p110.x + p010.x) / 4;
  const cy = (p000.y + p100.y + p110.y + p010.y) / 4;

  // Font size based on room size
  const minDim = Math.min(sw, sd);
  const fs = Math.max(7, Math.min(13, minDim * ISO_W * 0.38));

  return (
    <g
      onPointerEnter={() => onHover(label, area)}
      onPointerLeave={() => onHover(null)}
      style={{ cursor: 'pointer' }}
    >
      {/* Top face (floor) */}
      <polygon
        points={poly([p000, p100, p110, p010])}
        fill={floorColor}
        stroke="#C0B090"
        strokeWidth="0.5"
        strokeLinejoin="round"
      />

      {/* South wall (facing viewer, lighter) */}
      <polygon
        points={poly([p010, p110, p111, p011])}
        fill={wallColorR}
        stroke="#B8B0A0"
        strokeWidth="0.5"
      />

      {/* East wall (facing right, darker) */}
      <polygon
        points={poly([p100, p110, p111, p101])}
        fill={wallColorL}
        stroke="#B8B0A0"
        strokeWidth="0.5"
      />

      {/* Wall tops (thin white strip) */}
      <polygon points={poly([p001, p101, p111, p011])} fill={wallTop} stroke="#E0D8C8" strokeWidth="0.3" />

      {/* Room label on top face */}
      <text
        x={cx}
        y={cy - fs * 0.3}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fs}
        fontWeight="700"
        fontFamily="Cairo, Tajawal, Arial, sans-serif"
        fill={isHov ? '#fff' : '#1a365d'}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
      {area && (
        <text
          x={cx}
          y={cy + fs * 0.9}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fs * 0.75}
          fontWeight="600"
          fontFamily="Cairo, Tajawal, Arial, sans-serif"
          fill={isHov ? '#ffe' : '#4a7a9b'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {area}
        </text>
      )}
    </g>
  );
}

/* ─── Simple furniture shapes ─────────────────────────────────────────────── */
function IsoBed({ x, y, w, h }) {
  const wx = x * S + 0.1, wz = y * S + 0.1;
  const sw = w * S - 0.2, sd = h * S - 0.2;
  const py = 0.45; // mattress height

  const p000 = pt(wx, 0, wz), p100 = pt(wx+sw, 0, wz);
  const p110 = pt(wx+sw, 0, wz+sd), p010 = pt(wx, 0, wz+sd);
  const p001 = pt(wx, py, wz), p101 = pt(wx+sw, py, wz);
  const p111 = pt(wx+sw, py, wz+sd), p011 = pt(wx, py, wz+sd);
  // Headboard
  const hbH = 0.9, hbD = 0.15;
  const hb00 = pt(wx, 0, wz), hb10 = pt(wx+sw, 0, wz);
  const hb01 = pt(wx, hbH, wz), hb11 = pt(wx+sw, hbH, wz);
  const hb00b = pt(wx, 0, wz+hbD), hb10b = pt(wx+sw, 0, wz+hbD);
  const hb01b = pt(wx, hbH, wz+hbD), hb11b = pt(wx+sw, hbH, wz+hbD);

  return (
    <g style={{ pointerEvents: 'none' }}>
      {/* Mattress top */}
      <polygon points={poly([p000,p100,p110,p010])} fill="#E8E0D0" stroke="#C8C0B0" strokeWidth="0.4"/>
      {/* South side */}
      <polygon points={poly([p010,p110,p111,p011])} fill="#D8D0C0" stroke="#C8C0B0" strokeWidth="0.3"/>
      {/* East side */}
      <polygon points={poly([p100,p110,p111,p101])} fill="#D0C8B8" stroke="#C8C0B0" strokeWidth="0.3"/>
      {/* Headboard front */}
      <polygon points={poly([hb00b,hb10b,hb11b,hb01b])} fill="#8B6F4E" stroke="#6B4F2E" strokeWidth="0.4"/>
      {/* Headboard top */}
      <polygon points={poly([hb00,hb10,hb10b,hb00b])} fill="#9B7F5E" stroke="#6B4F2E" strokeWidth="0.3"/>
    </g>
  );
}

function IsoSofa({ x, y, w, h }) {
  const wx = x*S+0.1, wz = y*S+0.1, sw = w*S-0.2, sd = h*S-0.2;
  const seatH = 0.42, backH = 0.85, armW = 0.18, backD = 0.22;

  function face(pts, fill) {
    return <polygon points={poly(pts)} fill={fill} stroke="#9A9088" strokeWidth="0.35"/>;
  }

  return (
    <g style={{ pointerEvents:'none' }}>
      {/* Seat top */}
      {face([pt(wx,seatH,wz), pt(wx+sw,seatH,wz), pt(wx+sw,seatH,wz+sd*0.7), pt(wx,seatH,wz+sd*0.7)], '#C8BEB0')}
      {/* Seat south */}
      {face([pt(wx,0,wz+sd*0.7), pt(wx+sw,0,wz+sd*0.7), pt(wx+sw,seatH,wz+sd*0.7), pt(wx,seatH,wz+sd*0.7)], '#B8AEA0')}
      {/* Back top */}
      {face([pt(wx,backH,wz), pt(wx+sw,backH,wz), pt(wx+sw,backH,wz+backD), pt(wx,backH,wz+backD)], '#D8D0C8')}
      {/* Back south */}
      {face([pt(wx,seatH,wz+backD), pt(wx+sw,seatH,wz+backD), pt(wx+sw,backH,wz+backD), pt(wx,backH,wz+backD)], '#C0B8B0')}
    </g>
  );
}

function IsoTable({ x, y, w, h }) {
  const wx = x*S+0.05, wz = y*S+0.05, sw = w*S-0.1, sd = h*S-0.1;
  const th = 0.75;
  return (
    <g style={{ pointerEvents:'none' }}>
      <polygon points={poly([pt(wx,th,wz),pt(wx+sw,th,wz),pt(wx+sw,th,wz+sd),pt(wx,th,wz+sd)])} fill="#C8A870" stroke="#A88850" strokeWidth="0.4"/>
      <polygon points={poly([pt(wx,0,wz+sd),pt(wx+sw,0,wz+sd),pt(wx+sw,th,wz+sd),pt(wx,th,wz+sd)])} fill="#B89860" stroke="#A88850" strokeWidth="0.3"/>
      <polygon points={poly([pt(wx+sw,0,wz),pt(wx+sw,0,wz+sd),pt(wx+sw,th,wz+sd),pt(wx+sw,th,wz)])} fill="#A88850" stroke="#A88850" strokeWidth="0.3"/>
    </g>
  );
}

function IsoPlant({ x, y }) {
  const cx = x*S, cz = y*S;
  const base = pt(cx, 0, cz);
  const top  = pt(cx, 0.8, cz);
  return (
    <g style={{ pointerEvents:'none' }}>
      <ellipse cx={base.x} cy={base.y} rx={ISO_W*0.18} ry={ISO_H*0.18} fill="#7A5030"/>
      <ellipse cx={top.x}  cy={top.y}  rx={ISO_W*0.38} ry={ISO_H*0.5}  fill="#2E8B40" opacity="0.9"/>
      <ellipse cx={top.x-2} cy={top.y-3} rx={ISO_W*0.22} ry={ISO_H*0.3} fill="#38A050" opacity="0.7"/>
    </g>
  );
}

/* ─── Data ────────────────────────────────────────────────────────────────── */
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
  { type:'plant', x:195, y:18  },
  { type:'plant', x:600, y:380 },
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
  { type:'plant', x:230, y:18  },
  { type:'plant', x:635, y:410 },
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

/* ─── Tooltip ─────────────────────────────────────────────────────────────── */
function Tooltip({ info }) {
  if (!info) return null;
  return (
    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-2.5 shadow-lg z-10 pointer-events-none">
      <p className="font-black text-[#1a365d] text-sm">{info.label}</p>
      {info.area && <p className="text-[#c5a059] font-bold text-xs mt-0.5">{info.area}</p>}
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
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

  // Compute SVG bounds
  const { minX, minY, maxX, maxY } = useMemo(() => {
    let minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
    for (const r of rooms) {
      const corners = [
        pt(r.x*S, 0, r.y*S),
        pt((r.x+r.w)*S, 0, r.y*S),
        pt((r.x+r.w)*S, 0, (r.y+r.h)*S),
        pt(r.x*S, 0, (r.y+r.h)*S),
        pt(r.x*S, WALL_H, r.y*S),
        pt((r.x+r.w)*S, WALL_H, r.y*S),
        pt(r.x*S, WALL_H, (r.y+r.h)*S),
        pt((r.x+r.w)*S, WALL_H, (r.y+r.h)*S),
      ];
      for (const c of corners) {
        minX = Math.min(minX, c.x); minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y);
      }
    }
    return { minX, minY, maxX, maxY };
  }, [rooms]);

  const pad = 20;
  const vbX = minX - pad, vbY = minY - pad;
  const vbW = maxX - minX + pad * 2;
  const vbH = maxY - minY + pad * 2;

  // Painter's sort: rooms with smaller (wx+wz) drawn first (further back)
  const sortedRooms = useMemo(() =>
    [...rooms].sort((a, b) =>
      ((a.x + a.w / 2) * S + (a.y + a.h / 2) * S) -
      ((b.x + b.w / 2) * S + (b.y + b.h / 2) * S)
    ), [rooms]);

  const sortedFurn = useMemo(() =>
    [...furn].sort((a, b) =>
      ((a.x || 0) * S + (a.y || 0) * S) -
      ((b.x || 0) * S + (b.y || 0) * S)
    ), [furn]);

  return (
    <div className="relative w-full select-none" style={{ height: 480 }}>
      <svg
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#F0F4F8 0%,#E4EAF2 100%)' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Subtle shadow under the building */}
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="4" dy="8" stdDeviation="6" floodColor="#00000030"/>
          </filter>
        </defs>

        <g filter="url(#shadow)">
          {/* Rooms — back to front */}
          {sortedRooms.map((r, i) => (
            <IsoRoom key={i} room={r} hovered={hovered} onHover={handleHover} />
          ))}

          {/* Furniture */}
          {sortedFurn.map((f, i) => {
            if (f.type === 'bed')   return <IsoBed   key={i} {...f}/>;
            if (f.type === 'sofa')  return <IsoSofa  key={i} {...f}/>;
            if (f.type === 'table') return <IsoTable key={i} {...f}/>;
            if (f.type === 'plant') return <IsoPlant key={i} {...f}/>;
            return null;
          })}
        </g>
      </svg>

      <Tooltip info={info} />

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] text-slate-400 border border-slate-200 shadow-sm">
          مرّر الماوس فوق أي غرفة لمعرفة تفاصيلها
        </div>
      </div>
    </div>
  );
}
