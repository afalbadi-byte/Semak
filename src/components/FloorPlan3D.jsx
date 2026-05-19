import React, { useState, Suspense, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

/* ── Scale ──────────────────────────────────────────────────────────────── */
const S      = 1 / 34;      // SVG px → world meters
const WALL_H = 2.8;
const WALL_T = 0.25;

function toW(x, y, w, h) {
  return {
    cx: (x + w / 2) * S,
    cz: (y + h / 2) * S,
    sw: w * S,
    sh: h * S,
  };
}

/* ── Canvas wood texture ─────────────────────────────────────────────────── */
function useWoodTex() {
  return useMemo(() => {
    const sz = 512;
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const ctx = cv.getContext('2d');

    // base oak colour
    ctx.fillStyle = '#C8A87A';
    ctx.fillRect(0, 0, sz, sz);

    // subtle grain streaks
    for (let i = 0; i < 80; i++) {
      const y = Math.random() * sz;
      ctx.strokeStyle = `rgba(${140 + Math.random() * 40 | 0},${90 + Math.random() * 30 | 0},${40 + Math.random() * 20 | 0},0.18)`;
      ctx.lineWidth = Math.random() * 1.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sz, y + (Math.random() - 0.5) * 8); ctx.stroke();
    }

    // plank borders
    const ph = 56;
    for (let y = ph; y < sz; y += ph) {
      ctx.strokeStyle = 'rgba(100,60,20,0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(sz, y); ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 5);
    return tex;
  }, []);
}

/* ── Wall colour texture (subtle plaster) ────────────────────────────────── */
function useWallTex() {
  return useMemo(() => {
    const sz = 128;
    const cv = document.createElement('canvas');
    cv.width = cv.height = sz;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#FAFAFA';
    ctx.fillRect(0, 0, sz, sz);
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(180,180,180,${Math.random() * 0.04})`;
      ctx.fillRect(Math.random() * sz, Math.random() * sz, Math.random() * 4, Math.random() * 4);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 2);
    return tex;
  }, []);
}

/* ── Room colours ─────────────────────────────────────────────────────────── */
const RC = {
  'مجلس':              '#F5E8D0',
  'مجلس فاخر':         '#F5E8D0',
  'غرفة معيشة':        '#EAF0F8',
  'غرفة رئيسية':       '#EAF4EA',
  'غرفة 2':            '#EAF4EA',
  'غرفة 3':            '#EDEAF8',
  'غرفة 4':            '#F8F2E0',
  'غرفة 3 + غرفة 4':  '#EDEAF8',
  'مطبخ':              '#FFF0E0',
  'حمام':              '#E0EEFF',
  'حمام رئيسي':        '#E0EEFF',
  'حمام 2':            '#E0EEFF',
  'حمام 3':            '#E0EEFF',
  'خادمة':             '#F4E0F8',
  'غرفة خادمة + غسيل':'#F4E0F8',
  'غسيل':              '#E0F8EE',
  'مستودع':            '#E8EAEC',
  'مدخل':              '#F2F4F6',
  'سطح خاص':           '#D8F0E0',
  'موقف 1':            '#E8EAEC',
  'موقف 2':            '#F0F2F4',
  'موقف 3':            '#E8EAEC',
  'موقف 4':            '#F0F2F4',
  'موقف 5':            '#E8EAEC',
  'موقف 6':            '#F0F2F4',
  'موقف 7':            '#E8EAEC',
  'مصعد وسلالم':       '#D8DCE8',
  default:             '#F2F4F6',
};

/* ── Shared materials ─────────────────────────────────────────────────────── */
const MAT_WALL    = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.75, metalness: 0 });
const MAT_BASBD   = new THREE.MeshStandardMaterial({ color: '#E8DDD0', roughness: 0.85 });
const MAT_PILLOW  = new THREE.MeshStandardMaterial({ color: '#F8F4EE', roughness: 0.9 });
const MAT_SOFA    = new THREE.MeshStandardMaterial({ color: '#C8BEB0', roughness: 0.8 });
const MAT_SOFA_DK = new THREE.MeshStandardMaterial({ color: '#A8A098', roughness: 0.8 });
const MAT_WOOD    = new THREE.MeshStandardMaterial({ color: '#C0A070', roughness: 0.7, metalness: 0.05 });

/* ── Room ─────────────────────────────────────────────────────────────────── */
function Room({ x, y, w, h, label, area, hovered, onHover, woodTex, wallTex }) {
  const { cx, cz, sw, sh } = toW(x, y, w, h);
  const isHov = hovered === label;
  const floorCol = isHov ? '#C5A059' : (RC[label] || RC.default);

  const floorMat = useMemo(() => new THREE.MeshStandardMaterial({
    map: woodTex,
    color: floorCol,
    roughness: 0.6,
  }), [floorCol, woodTex]);

  return (
    <group position={[cx, 0, cz]}>
      {/* Floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}
        onPointerEnter={() => onHover(label, area)}
        onPointerLeave={() => onHover(null)}>
        <planeGeometry args={[sw, sh]} />
        <primitive object={floorMat} attach="material" />
      </mesh>

      {/* 4 solid walls */}
      {/* N */}
      <mesh castShadow receiveShadow material={MAT_WALL}
        position={[0, WALL_H / 2, -sh / 2 + WALL_T / 2]}>
        <boxGeometry args={[sw, WALL_H, WALL_T]} />
      </mesh>
      {/* S */}
      <mesh castShadow receiveShadow material={MAT_WALL}
        position={[0, WALL_H / 2, sh / 2 - WALL_T / 2]}>
        <boxGeometry args={[sw, WALL_H, WALL_T]} />
      </mesh>
      {/* W */}
      <mesh castShadow receiveShadow material={MAT_WALL}
        position={[-sw / 2 + WALL_T / 2, WALL_H / 2, 0]}>
        <boxGeometry args={[WALL_T, WALL_H, sh]} />
      </mesh>
      {/* E */}
      <mesh castShadow receiveShadow material={MAT_WALL}
        position={[sw / 2 - WALL_T / 2, WALL_H / 2, 0]}>
        <boxGeometry args={[WALL_T, WALL_H, sh]} />
      </mesh>

      {/* Label plate floating above floor */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[Math.min(sw * 0.55, 1.8), Math.min(sh * 0.28, 0.7)]} />
        <meshBasicMaterial color={isHov ? '#c5a059' : '#ffffff'} transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

/* ── Furniture components ─────────────────────────────────────────────────── */
function Bed({ x, y, w, h }) {
  const { cx, cz, sw, sh } = toW(x, y, w, h);
  return (
    <group position={[cx, 0, cz]}>
      {/* Frame */}
      <mesh castShadow position={[0, 0.08, 0]} material={MAT_WOOD}>
        <boxGeometry args={[sw, 0.16, sh]} />
      </mesh>
      {/* Mattress */}
      <mesh castShadow position={[0, 0.26, sh * 0.08]} material={MAT_BASBD}>
        <boxGeometry args={[sw * 0.9, 0.22, sh * 0.8]} />
      </mesh>
      {/* Headboard */}
      <mesh castShadow position={[0, 0.52, -sh * 0.44]} material={MAT_SOFA_DK}>
        <boxGeometry args={[sw * 0.9, 0.68, 0.1]} />
      </mesh>
      {/* Pillows */}
      {[-0.22, 0.22].map((ox, i) => (
        <mesh key={i} castShadow position={[ox * sw, 0.42, -sh * 0.29]} material={MAT_PILLOW}>
          <boxGeometry args={[sw * 0.33, 0.08, sh * 0.22]} />
        </mesh>
      ))}
      {/* Duvet line */}
      <mesh position={[0, 0.38, sh * 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sw * 0.86, sh * 0.55]} />
        <meshStandardMaterial color="#E8E0D8" roughness={0.95} />
      </mesh>
    </group>
  );
}

function Sofa({ x, y, w, h }) {
  const { cx, cz, sw, sh } = toW(x, y, w, h);
  return (
    <group position={[cx, 0, cz]}>
      {/* Seat cushions */}
      <mesh castShadow position={[0, 0.22, sh * 0.1]} material={MAT_SOFA}>
        <boxGeometry args={[sw * 0.9, 0.22, sh * 0.55]} />
      </mesh>
      {/* Back */}
      <mesh castShadow position={[0, 0.5, -sh * 0.27]} material={MAT_SOFA_DK}>
        <boxGeometry args={[sw * 0.9, 0.52, sh * 0.18]} />
      </mesh>
      {/* Arms */}
      {[-1, 1].map((s, i) => (
        <mesh key={i} castShadow position={[s * sw * 0.44, 0.38, sh * 0.05]} material={MAT_SOFA_DK}>
          <boxGeometry args={[sh * 0.1, 0.52, sh * 0.6]} />
        </mesh>
      ))}
      {/* Cushion dividers */}
      {[-0.25, 0.25].map((ox, i) => (
        <mesh key={i} castShadow position={[ox * sw, 0.35, sh * 0.12]} material={MAT_SOFA_DK}>
          <boxGeometry args={[0.04, 0.26, sh * 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

function Table({ x, y, w, h }) {
  const { cx, cz, sw, sh } = toW(x, y, w, h);
  return (
    <group position={[cx, 0, cz]}>
      <mesh castShadow position={[0, 0.42, 0]} material={MAT_WOOD}>
        <boxGeometry args={[sw, 0.06, sh]} />
      </mesh>
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([a,b],i) => (
        <mesh key={i} castShadow position={[a*sw*0.38, 0.21, b*sh*0.38]} material={MAT_WOOD}>
          <cylinderGeometry args={[0.03, 0.03, 0.42, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function Kitchen({ x, y, w, h }) {
  const { cx, cz, sw, sh } = toW(x, y, w, h);
  const counterH = 0.88;
  return (
    <group position={[cx, 0, cz]}>
      {/* Counter along north wall */}
      <mesh castShadow position={[0, counterH / 2, -sh * 0.35]}>
        <boxGeometry args={[sw * 0.85, counterH, sh * 0.28]} />
        <meshStandardMaterial color="#E0E0DC" roughness={0.5} />
      </mesh>
      {/* Counter top */}
      <mesh castShadow position={[0, counterH + 0.02, -sh * 0.35]}>
        <boxGeometry args={[sw * 0.85, 0.04, sh * 0.28]} />
        <meshStandardMaterial color="#C8C8C4" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Sink outline */}
      <mesh position={[-sw * 0.2, counterH + 0.04, -sh * 0.35]}>
        <boxGeometry args={[sw * 0.18, 0.01, sh * 0.14]} />
        <meshStandardMaterial color="#A0A8B0" roughness={0.2} metalness={0.5} />
      </mesh>
    </group>
  );
}

function Bathtub({ x, y, w, h }) {
  const { cx, cz, sw, sh } = toW(x, y, w, h);
  return (
    <group position={[cx, 0, cz]}>
      {/* Tub shell */}
      <mesh castShadow position={[0, 0.22, 0]}>
        <boxGeometry args={[sw * 0.88, 0.44, sh * 0.88]} />
        <meshStandardMaterial color="#F0F0EE" roughness={0.3} metalness={0.05} />
      </mesh>
      {/* Inside */}
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[sw * 0.72, 0.02, sh * 0.72]} />
        <meshStandardMaterial color="#D8EEF8" roughness={0.1} metalness={0.05} />
      </mesh>
    </group>
  );
}

function Plant({ x, y }) {
  const cx = x * S, cz = y * S;
  return (
    <group position={[cx, 0, cz]}>
      <mesh castShadow position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.12, 0.1, 0.3, 8]} />
        <meshStandardMaterial color="#8B5E3C" roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial color="#3A8C4A" roughness={0.8} />
      </mesh>
    </group>
  );
}

/* ── Scene ────────────────────────────────────────────────────────────────── */
function Scene({ rooms, furniture, extra, hovered, onHover, woodTex, wallTex }) {
  const allX = rooms.map(r => (r.x + r.w / 2) * S);
  const allZ = rooms.map(r => (r.y + r.h / 2) * S);
  const cx   = (Math.min(...allX) + Math.max(...allX)) / 2;
  const cz   = (Math.min(...allZ) + Math.max(...allZ)) / 2;

  return (
    <group position={[-cx, 0, -cz]}>
      {/* Ground base */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.01, cz]}>
        <planeGeometry args={[40, 35]} />
        <meshStandardMaterial color="#D4D8DC" roughness={1} />
      </mesh>

      {rooms.map((r, i) => (
        <Room key={i} {...r} hovered={hovered} onHover={onHover} woodTex={woodTex} wallTex={wallTex} />
      ))}

      {furniture?.map((f, i) => {
        if (f.type === 'bed')      return <Bed      key={i} {...f} />;
        if (f.type === 'sofa')     return <Sofa     key={i} {...f} />;
        if (f.type === 'table')    return <Table    key={i} {...f} />;
        if (f.type === 'kitchen')  return <Kitchen  key={i} {...f} />;
        if (f.type === 'bathtub')  return <Bathtub  key={i} {...f} />;
        if (f.type === 'plant')    return <Plant    key={i} x={f.x} y={f.y} />;
        return null;
      })}
    </group>
  );
}

/* ── Tooltip ──────────────────────────────────────────────────────────────── */
function Tooltip({ info }) {
  if (!info) return null;
  return (
    <div className="absolute top-3 right-3 bg-white/96 backdrop-blur-sm border border-slate-200 rounded-xl px-4 py-2.5 shadow-lg z-10 pointer-events-none">
      <p className="font-black text-[#1a365d] text-sm">{info.label}</p>
      {info.area && <p className="text-[#c5a059] font-bold text-xs mt-0.5">{info.area}</p>}
    </div>
  );
}

/* ── Data ─────────────────────────────────────────────────────────────────── */
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
  { type:'sofa',    x:22,  y:22,  w:128, h:58  },
  { type:'table',   x:244, y:65,  w:96,  h:58  },
  { type:'bed',     x:405, y:22,  w:100, h:145 },
  { type:'kitchen', x:12,  y:202, w:165, h:180 },
  { type:'bed',     x:187, y:212, w:110, h:82  },
  { type:'bed',     x:405, y:212, w:100, h:82  },
  { type:'bed',     x:150, y:392, w:110, h:78  },
  { type:'bathtub', x:597, y:17,  w:66,  h:80  },
  { type:'plant',   x:195, y:18 },
  { type:'plant',   x:600, y:390 },
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
  { type:'sofa',    x:22,  y:22,  w:150, h:68  },
  { type:'table',   x:274, y:75,  w:110, h:65  },
  { type:'kitchen', x:12,  y:215, w:170, h:182 },
  { type:'bed',     x:450, y:22,  w:130, h:165 },
  { type:'bed',     x:192, y:225, w:125, h:95  },
  { type:'bed',     x:162, y:407, w:115, h:92  },
  { type:'bathtub', x:445, y:220, w:90,  h:75  },
  { type:'plant',   x:230, y:18 },
  { type:'plant',   x:635, y:410 },
];

const GROUND_ROOMS = [
  { x:22,  y:65,  w:148, h:185, label:'موقف 1',       area:'' },
  { x:180, y:65,  w:148, h:185, label:'موقف 2',       area:'' },
  { x:338, y:65,  w:148, h:185, label:'موقف 3',       area:'' },
  { x:496, y:65,  w:148, h:185, label:'موقف 4',       area:'' },
  { x:22,  y:275, w:148, h:185, label:'موقف 5',       area:'' },
  { x:180, y:275, w:148, h:185, label:'موقف 6',       area:'' },
  { x:338, y:275, w:148, h:185, label:'موقف 7',       area:'' },
  { x:497, y:275, w:171, h:210, label:'مصعد وسلالم',  area:'' },
];

/* ── Main ─────────────────────────────────────────────────────────────────── */
export default function FloorPlan3D({ floorId }) {
  const [hovered, setHovered] = useState(null);
  const [info,    setInfo]    = useState(null);
  const [autoRot, setAutoRot] = useState(false);

  const woodTex = useWoodTex();
  const wallTex = useWallTex();

  const isGround = floorId === 'ground';
  const isRoof   = floorId === 'fourth';
  const rooms    = isGround ? GROUND_ROOMS : isRoof ? ROOF_ROOMS : APARTMENT_ROOMS;
  const furn     = isGround ? [] : isRoof ? ROOF_FURNITURE : APARTMENT_FURNITURE;

  // isometric camera — slightly from the side so walls are visible
  const camPos = isRoof ? [10, 12, 13] : [8, 10, 11];

  const handleHover = (label, area) => {
    setHovered(label);
    setInfo(label ? { label, area } : null);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '500px' }}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        gl={{ antialias: true }}
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          const cv = gl.domElement;
          cv.style.width   = '100%';
          cv.style.height  = '100%';
          cv.style.display = 'block';
          gl.setClearColor('#E8ECF0');
          // Trigger R3F's internal ResizeObserver so the draw buffer matches the CSS size
          requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
        }}
      >
        <PerspectiveCamera makeDefault position={camPos} fov={40} />
        <color attach="background" args={['#E8ECF0']} />

        {/* ── Lighting ── */}
        {/* Ambient: soft fill */}
        <ambientLight intensity={1.0} color="#F8F4EE" />

        {/* Main sun: top-left, warm, casts shadows */}
        <directionalLight
          position={[14, 24, 10]}
          intensity={2.2}
          color="#FFF8F0"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={100}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
          shadow-bias={-0.0003}
        />

        {/* Fill from front-right, cool */}
        <directionalLight position={[-8, 10, 14]} intensity={0.7} color="#E8F0FF" />

        {/* Sky hemisphere */}
        <hemisphereLight skyColor="#EEF4FF" groundColor="#C8B890" intensity={0.5} />

        <Suspense fallback={null}>
          <Scene
            rooms={rooms}
            furniture={furn}
            hovered={hovered}
            onHover={handleHover}
            woodTex={woodTex}
            wallTex={wallTex}
          />
        </Suspense>

        <OrbitControls
          autoRotate={autoRot}
          autoRotateSpeed={0.6}
          enableZoom
          enablePan
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2.1}
          minDistance={4}
          maxDistance={28}
        />
      </Canvas>

      <Tooltip info={info} />

      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        <button
          onClick={() => setAutoRot(v => !v)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold border shadow-sm transition
            ${autoRot ? 'bg-[#1a365d] text-white border-[#1a365d]' : 'bg-white/90 text-[#1a365d] border-slate-200 hover:bg-white'}`}
        >
          {autoRot ? '⏹ إيقاف الدوران' : '▶ دوران تلقائي'}
        </button>
        <span className="bg-white/80 px-3 py-1.5 rounded-full text-[10px] text-slate-400 border border-slate-200">
          اسحب للتدوير • اسكرول للتكبير
        </span>
      </div>
    </div>
  );
}
