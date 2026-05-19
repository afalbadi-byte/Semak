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

  const [scale,    setScale]    = useState(1);
  const [pos,      setPos]      = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [loaded,   setLoaded]   = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const dragStart = useRef(null);
  const touches   = useRef({});

  // reset on floor change
  useEffect(() => {
    setScale(1);
    setPos({ x: 0, y: 0 });
    setLoaded(false);
  }, [floorId]);

  // close fullscreen on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setScale(s => Math.min(5, Math.max(0.4, s - e.deltaY * 0.0012)));
  }, []);

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
      const prev = touches.current;
      if (prev[a.identifier] && prev[b.identifier]) {
        const prevDist = Math.hypot(prev[a.identifier].x - prev[b.identifier].x, prev[a.identifier].y - prev[b.identifier].y);
        const currDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        setScale(s => Math.min(5, Math.max(0.4, s * (currDist / (prevDist || 1)))));
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

  const viewer = (
    <div
      className="relative overflow-hidden bg-[#F4F5F7] select-none"
      style={{
        width: '100%',
        height: fullscreen ? '100vh' : '100%',
        minHeight: fullscreen ? '100vh' : 480,
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
      {/* Image */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={floor.src}
          alt={floor.label}
          draggable={false}
          onLoad={() => setLoaded(true)}
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: dragging ? 'none' : 'transform 0.12s ease-out',
            maxWidth: '92%',
            maxHeight: '92%',
            objectFit: 'contain',
            userSelect: 'none',
            opacity: loaded ? 1 : 0,
            filter: 'drop-shadow(0 6px 28px rgba(0,0,0,0.15))',
            borderRadius: 4,
          }}
        />
      </div>

      {/* Loading */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#1a365d]/20 border-t-[#1a365d] rounded-full animate-spin" />
        </div>
      )}

      {/* Controls – top right */}
      <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-20">
        <button onClick={() => setScale(s => Math.min(5, s + 0.4))}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-xl font-light leading-none select-none">
          +
        </button>
        <button onClick={() => setScale(s => Math.max(0.4, s - 0.4))}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-xl font-light leading-none select-none">
          −
        </button>
        <button onClick={reset}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-sm select-none"
          title="إعادة ضبط">
          ↺
        </button>
        <button onClick={() => { setFullscreen(f => !f); reset(); }}
          className="w-8 h-8 bg-white/90 border border-slate-200 rounded-lg shadow flex items-center justify-center text-[#1a365d] hover:bg-slate-50 text-sm select-none"
          title={fullscreen ? 'إغلاق' : 'ملء الشاشة'}>
          {fullscreen ? '✕' : '⛶'}
        </button>
      </div>

      {/* Hint */}
      {loaded && !fullscreen && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] text-slate-400 border border-slate-200 shadow-sm whitespace-nowrap">
            اسحب للتحريك • اسكرول للتكبير
          </div>
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
        onClick={(e) => { if (e.target === e.currentTarget) setFullscreen(false); }}>
        <div className="w-full h-full max-w-6xl rounded-2xl overflow-hidden shadow-2xl">
          {viewer}
        </div>
      </div>
    );
  }

  return viewer;
}
