import React, { useState, Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// ── Scale: SVG coords → 3D units (680×500 SVG ≈ 20×15 meters) ──────────────
const S = 1 / 34;          // scale factor
const WALL_H = 3.2;        // wall height (meters)
const WALL_T = 0.18;       // wall thickness

function svgToWorld(x, y, w, h) {
  // Convert SVG rect to 3D center + size
  const cx = (x + w / 2) * S;
  const cz = (y + h / 2) * S;
  const sw = w * S;
  const sh = h * S;
  return { cx, cz, sw, sh };
}

// ── Room component ─────────────────────────────────────────────────────────
const ROOM_COLORS = {
  'مجلس':           '#fef3c7',
  'غرفة معيشة':     '#eff6ff',
  'غرفة رئيسية':   '#f0fdf4',
  'غرفة 2':         '#f0fdf4',
  'غرفة 3':         '#eef2ff',
  'غرفة 4':         '#fffbeb',
  'مطبخ':           '#fff7ed',
  'حمام':           '#eff6ff',
  'حمام رئيسي':     '#eff6ff',
  'حمام 2':         '#eff6ff',
  'حمام 3':         '#eff6ff',
  'خادمة':          '#fdf4ff',
  'غسيل':           '#f0fdf4',
  'مستودع':         '#f1f5f9',
  'مدخل':           '#f8fafc',
  'سطح خاص':        '#ecfdf5',
  'مجلس فاخر':      '#fef3c7',
  'غرفة 3 + غرفة 4':'#eef2ff',
  'غرفة خادمة + غسيل': '#fdf4ff',
  'default':         '#f8fafc',
};

function Room({ x, y, w, h, label, area, hovered, onHover }) {
  const { cx, cz, sw, sh } = svgToWorld(x, y, w, h);
  const color = ROOM_COLORS[label] || ROOM_COLORS.default;
  const isHov = hovered === label;

  return (
    <group position={[cx, 0, cz]}>
      {/* Floor */}
      <mesh
        position={[0, 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerEnter={() => onHover(label, area)}
        onPointerLeave={() => onHover(null)}
        receiveShadow
      >
        <planeGeometry args={[sw - WALL_T, sh - WALL_T]} />
        <meshStandardMaterial
          color={isHov ? '#c5a059' : color}
          roughness={0.8}
          metalness={0.0}
          transparent
          opacity={isHov ? 0.9 : 0.85}
        />
      </mesh>

      {/* Walls — 4 sides */}
      {[
        // N wall
        { pos: [0, WALL_H/2, -sh/2], rot: [0,0,0], w: sw, h: WALL_H },
        // S wall
        { pos: [0, WALL_H/2,  sh/2], rot: [0,0,0], w: sw, h: WALL_H },
        // W wall
        { pos: [-sw/2, WALL_H/2, 0], rot: [0, Math.PI/2, 0], w: sh, h: WALL_H },
        // E wall
        { pos: [ sw/2, WALL_H/2, 0], rot: [0, Math.PI/2, 0], w: sh, h: WALL_H },
      ].map(({ pos, rot, w: ww, h: hh }, i) => (
        <mesh key={i} position={pos} rotation={rot} castShadow>
          <planeGeometry args={[ww, hh]} />
          <meshStandardMaterial
            color="#ffffff"
            roughness={0.9}
            metalness={0}
            side={THREE.BackSide}
            transparent opacity={0.6}
          />
        </mesh>
      ))}

      {/* Thin wall outline */}
      <lineSegments position={[0, 0.02, 0]}>
        <edgesGeometry args={[new THREE.BoxGeometry(sw, 0.01, sh)]} />
        <lineBasicMaterial color="#334155" linewidth={1} />
      </lineSegments>

      {/* Label */}
      <Text
        position={[0, 0.15, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={Math.min(sw, sh) * 0.12}
        color={isHov ? '#ffffff' : '#1e3a5f'}
        anchorX="center"
        anchorY="middle"
        maxWidth={sw * 0.9}
        textAlign="center"
      >
        {label}
      </Text>
      {area && (
        <Text
          position={[0, 0.14, sw > sh ? 0 : sw * 0.1]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={Math.min(sw, sh) * 0.08}
          color="#64748b"
          anchorX="center"
          anchorY="middle"
        >
          {area}
        </Text>
      )}
    </group>
  );
}

// ── Furniture (simple 3D shapes) ───────────────────────────────────────────
function Bed({ x, y, w, h, single = false }) {
  const { cx, cz, sw, sh } = svgToWorld(x, y, w, h);
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[sw * 0.9, 0.4, sh * 0.9]} />
        <meshStandardMaterial color="#d4c8b0" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.42, -sh * 0.3]} castShadow>
        <boxGeometry args={[sw * 0.85, 0.15, sh * 0.28]} />
        <meshStandardMaterial color="#f0e8d8" roughness={0.9} />
      </mesh>
      {!single && (
        <>
          <mesh position={[-sw * 0.2, 0.46, -sh * 0.28]} castShadow>
            <boxGeometry args={[sw * 0.35, 0.08, sh * 0.22]} />
            <meshStandardMaterial color="#fff8f0" roughness={0.9} />
          </mesh>
          <mesh position={[sw * 0.2, 0.46, -sh * 0.28]} castShadow>
            <boxGeometry args={[sw * 0.35, 0.08, sh * 0.22]} />
            <meshStandardMaterial color="#fff8f0" roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Sofa({ x, y, w, h }) {
  const { cx, cz, sw, sh } = svgToWorld(x, y, w, h);
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.22, -sh * 0.35]} castShadow>
        <boxGeometry args={[sw * 0.95, 0.44, sh * 0.28]} />
        <meshStandardMaterial color="#c8b898" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.42, sh * 0.1]} castShadow>
        <boxGeometry args={[sw * 0.95, 0.85, sh * 0.55]} />
        <meshStandardMaterial color="#c8b898" roughness={0.8} />
      </mesh>
      <mesh position={[-sw * 0.46, 0.5, sh * 0.1]} castShadow>
        <boxGeometry args={[sh * 0.08, 0.8, sh * 0.55]} />
        <meshStandardMaterial color="#a89878" roughness={0.8} />
      </mesh>
      <mesh position={[sw * 0.46, 0.5, sh * 0.1]} castShadow>
        <boxGeometry args={[sh * 0.08, 0.8, sh * 0.55]} />
        <meshStandardMaterial color="#a89878" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Table({ x, y, w, h }) {
  const { cx, cz, sw, sh } = svgToWorld(x, y, w, h);
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[sw, 0.06, sh]} />
        <meshStandardMaterial color="#d4c4a0" roughness={0.7} metalness={0.05} />
      </mesh>
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b],i) => (
        <mesh key={i} position={[a*sw*0.4, 0.2, b*sh*0.4]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.38, 8]} />
          <meshStandardMaterial color="#b0a070" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

// ── Floor plans data ────────────────────────────────────────────────────────
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

const APARTMENT_FURNITURE = [
  { type:'sofa', x:22,  y:22,  w:128, h:58  },
  { type:'bed',  x:405, y:22,  w:100, h:145 },
  { type:'bed',  x:187, y:212, w:110, h:82  },
  { type:'bed',  x:405, y:212, w:100, h:82  },
  { type:'bed',  x:150, y:392, w:110, h:78  },
  { type:'table',x:244, y:65,  w:96,  h:58  },
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

const ROOF_FURNITURE = [
  { type:'sofa',  x:22,  y:22,  w:150, h:68  },
  { type:'bed',   x:450, y:22,  w:130, h:165 },
  { type:'bed',   x:192, y:225, w:125, h:95  },
  { type:'bed',   x:162, y:407, w:115, h:92  },
  { type:'table', x:274, y:75,  w:110, h:65  },
];

const GROUND_ROOMS = [
  { x:22,  y:65,  w:148, h:185, label:'موقف 1', area:'' },
  { x:180, y:65,  w:148, h:185, label:'موقف 2', area:'' },
  { x:338, y:65,  w:148, h:185, label:'موقف 3', area:'' },
  { x:496, y:65,  w:148, h:185, label:'موقف 4', area:'' },
  { x:22,  y:275, w:148, h:185, label:'موقف 5', area:'' },
  { x:180, y:275, w:148, h:185, label:'موقف 6', area:'' },
  { x:338, y:275, w:148, h:185, label:'موقف 7', area:'' },
  { x:497, y:275, w:171, h:210, label:'مصعد وسلالم', area:'' },
];

// ── Auto-rotate camera ─────────────────────────────────────────────────────
function AutoRotate({ enabled }) {
  const ref = useRef();
  return null;
}

// ── Tooltip overlay ────────────────────────────────────────────────────────
function Tooltip({ info }) {
  if (!info) return null;
  return (
    <div className="absolute top-3 right-3 bg-white/95 border border-slate-200 rounded-xl px-4 py-2.5 shadow-lg z-10 pointer-events-none backdrop-blur-sm">
      <p className="font-black text-[#1a365d] text-sm">{info.label}</p>
      {info.area && <p className="text-[#c5a059] font-bold text-xs mt-0.5">{info.area}</p>}
    </div>
  );
}

// ── Scene ──────────────────────────────────────────────────────────────────
function Scene({ rooms, furniture, onHover, hovered }) {
  // Compute scene center for offsetting
  const allX = rooms.map(r => (r.x + r.w / 2) * S);
  const allZ = rooms.map(r => (r.y + r.h / 2) * S);
  const cx = (Math.min(...allX) + Math.max(...allX)) / 2;
  const cz = (Math.min(...allZ) + Math.max(...allZ)) / 2;

  return (
    <group position={[-cx, 0, -cz]}>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.01, cz]} receiveShadow>
        <planeGeometry args={[30, 25]} />
        <meshStandardMaterial color="#e8edf2" roughness={1} />
      </mesh>

      {rooms.map((r, i) => (
        <Room key={i} {...r} hovered={hovered} onHover={onHover} />
      ))}

      {furniture?.map((f, i) => {
        if (f.type === 'bed')   return <Bed   key={i} {...f} />;
        if (f.type === 'sofa')  return <Sofa  key={i} {...f} />;
        if (f.type === 'table') return <Table key={i} {...f} />;
        return null;
      })}
    </group>
  );
}

// ── Force R3F resize after mount ───────────────────────────────────────────
function ForceResize() {
  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
    const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 150);
    return () => clearTimeout(t);
  }, []);
  return null;
}

// ── Main export ────────────────────────────────────────────────────────────
export default function FloorPlan3D({ floorId }) {
  const [hovered, setHovered] = useState(null);
  const [info, setInfo] = useState(null);
  const [autoRotate, setAutoRotate] = useState(false);

  const handleHover = (label, area) => {
    setHovered(label);
    setInfo(label ? { label, area } : null);
  };

  const isGround = floorId === 'ground';
  const isRoof   = floorId === 'fourth';
  const rooms    = isGround ? GROUND_ROOMS : isRoof ? ROOF_ROOMS : APARTMENT_ROOMS;
  const furn     = isGround ? [] : isRoof ? ROOF_FURNITURE : APARTMENT_FURNITURE;

  const camPos = isRoof ? [8, 12, 14] : [6, 10, 12];

  return (
    <div className="relative select-none" style={{ width: '100%', height: '480px' }}>
      <Canvas
        shadows
        gl={{ antialias: true }}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(160deg,#f0f4ff 0%,#e8edf5 100%)',
        }}
      >
        <PerspectiveCamera makeDefault position={camPos} fov={45} />

        {/* Lighting */}
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={1.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={60}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />
        <pointLight position={[-5, 8, -5]} intensity={0.6} color="#fff8f0" />
        <pointLight position={[5, 6, 5]}   intensity={0.4} color="#f0f8ff" />

        <ForceResize />
        <Suspense fallback={null}>
          <Scene
            rooms={rooms}
            furniture={furn}
            onHover={handleHover}
            hovered={hovered}
          />
        </Suspense>

        <OrbitControls
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          enableZoom
          enablePan
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={3}
          maxDistance={22}
        />
      </Canvas>

      <Tooltip info={info} />

      {/* Controls bar */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <button
          onClick={() => setAutoRotate(v => !v)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold border transition shadow-sm ${autoRotate ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'bg-white text-[#1a365d] border-slate-200 hover:bg-slate-50'}`}
        >
          {autoRotate ? '⏹ إيقاف الدوران' : '▶ دوران تلقائي'}
        </button>
        <div className="bg-white/80 px-3 py-1.5 rounded-full text-[10px] text-slate-400 border border-slate-200 font-cairo">
          اسحب للتدوير • اسكرول للتكبير
        </div>
      </div>
    </div>
  );
}
