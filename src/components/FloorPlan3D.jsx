import React, { useState, useRef, useEffect, useCallback } from 'react';

const FLOOR_IMAGES = {
  ground: { src: '/images/floor-ground.jpg', label: 'الدور الأرضي' },
  first:  { src: '/images/floor-1.jpg',      label: 'الدور الأول'  },
  second: { src: '/images/floor-2.jpg',      label: 'الدور الثاني' },
  third:  { src: '/images/floor-3.jpg',      label: 'الدور الثالث' },
  fourth: { src: '/images/floor-4.jpg',      label: 'الدور الرابع' },
};

export default function FloorPlan3D({ floorId }) {
  const floor = FLOOR_IMAGES[floorId] || FLOOR_IMAGES.first;

  // zoom / pan state
  const [scale, setScale]   = useState(1);
  const [pos, setPos]       = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const dragStart = useRef(null);
  const posRef    = useRef(pos);
  posRef.current  = pos;

  // reset when floor changes
  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
    setLoaded(false);
  }, [floorId]);

  // ── mouse wheel zoom ──────────────────────────────────────────────────────
  const onWheel = useCallback((e) => {
    e.preventDefault();
    setScale(s => Math.min(4, Math.max(0.5, s - e.deltaY * 0.001)));
  }, []);

  // ── mouse drag ────────────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    setDragging(true);
  };
  const onMouseMove = (e) => {
    if (!dragStart.current) return;
    setPos({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  };
  const onMouseUp = () => { dragStart.current = null; setDragging(false); };

  // ── touch pinch zoom ──────────────────────────────────────────────────────
  const touches = useRef({});
  const onTouchStart = (e) => {
    [...e.touches].forEach(t => { touches.current[t.identifier] = { x: t.clientX, y: t.clientY }; });
    if (e.touches.length === 1) {
      dragStart.current = { mx: e.touches[0].clientX, my: e.touches[0].clientY, px: pos.x, py: pos.y };
    }
  };
  const onTouchMove = (e) => {
    e.preventDefault();
    if (e.touches.length === 2) {
      const [a, b] = [...e.touches];
      const prev   = touches.current;
      if (prev[a.identifier] && prev[b.identifier]) {
        const prevDist = Math.hypot(prev[a.identifier].x - prev[b.identifier].x, prev[a.identifier].y - prev[b.identifier].y);
        const currDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const ratio    = currDist / (prevDist || 1);
        setScale(s => Math.min(4, Math.max(0.5, s * ratio)));
      }
      [...e.touches].forEach(t => { touches.current[t.identifier] = { x: t.clientX, y: t.clientY }; });
    } else if (e.touches.length === 1 && dragStart.current) {
      setPos({
        x: dragStart.current.px + (e.touches[0].clientX - dragStart.current.mx),
        y: dragStart.current.py + (e.touches[0].clientY - dragStart.current.my),
      });
    }
  };
  const onTouchEnd = () => { dragStart.current = null; touches.current = {}; };

  const reset = () => { setScale(1); setPos({ x: 0, y: 0 }); };

  const container = (
    <div
      className="relative overflow-hidden bg-[#f8f9fa] select-none"
      style={{
        width: '100%',
        height: fullscreen ? '100vh' : '480px',
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Floor plan image */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={floor.src}
          alt={floor.label}
          draggable={false}
          onLoad={() => setLoaded(true)}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.15s ease-out',
            maxWidth: '95%',
            maxHeight: '95%',
            objectFit: 'contain',
            userSelect: 'none',
            opacity: loaded ? 1 : 0,
            filter: 'drop-shadow(0 4px 24px rgba(0,0,0,0.13))',
          }}
        />
      </div>

      {/* Loading shimmer */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-[#1a365d]/20 border-t-[#1a365d] rounded-full animate-spin" />
        </div>
      )}

      {/* Top-right controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
        <button
          onClick={() => setScale(s => Math.min(4, s + 0.3))}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-lg font-bold leading-none"
          title="تكبير"
        >+</button>
        <button
          onClick={() => setScale(s => Math.max(0.5, s - 0.3))}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-lg font-bold leading-none"
          title="تصغير"
        >−</button>
        <button
          onClick={reset}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-xs"
          title="إعادة ضبط"
        >↺</button>
        <button
          onClick={() => { setFullscreen(f => !f); reset(); }}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-xs"
          title={fullscreen ? 'خروج' : 'ملء الشاشة'}
        >{fullscreen ? '✕' : '⛶'}</button>
      </div>

      {/* Bottom hint */}
      {loaded && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] text-slate-500 border border-slate-200 shadow-sm font-cairo">
            اسحب للتحريك • اسكرول أو ضغطتان للتكبير
          </div>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full h-full max-w-5xl rounded-2xl overflow-hidden shadow-2xl">
          {container}
        </div>
      </div>
    );
  }

  return container;
}
