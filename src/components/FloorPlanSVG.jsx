import React, { useState } from 'react';

// ── Furniture ─────────────────────────────────────────────────────────────────
const FBed = ({ x, y, w, h }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={4} fill="#d4c8b0" stroke="#b0a080" strokeWidth={1.5}/>
    <rect x={x+4} y={y+4} width={w-8} height={h-8} rx={3} fill="#f0e8d8"/>
    <rect x={x+7} y={y+7} width={(w-14)*.46} height={h*.28} rx={3} fill="#fff8f0"/>
    <rect x={x+7+(w-14)*.54} y={y+7} width={(w-14)*.46} height={h*.28} rx={3} fill="#fff8f0"/>
  </g>
);

const FSingleBed = ({ x, y, w, h }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={3} fill="#d4c8b0" stroke="#b0a080" strokeWidth={1}/>
    <rect x={x+3} y={y+3} width={w-6} height={h-6} rx={2} fill="#f0e8d8"/>
    <rect x={x+5} y={y+5} width={w-10} height={h*.28} rx={2} fill="#fff8f0"/>
  </g>
);

const FSofa = ({ x, y, w, h }) => (
  <g>
    <rect x={x} y={y} width={w} height={h*.27} rx={4} fill="#a89878" stroke="#907860" strokeWidth={1}/>
    <rect x={x} y={y+h*.29} width={w*.34} height={h*.63} rx={3} fill="#c8b898" stroke="#907860" strokeWidth={1}/>
    <rect x={x+w*.35} y={y+h*.29} width={w*.3} height={h*.63} rx={3} fill="#c8b898" stroke="#907860" strokeWidth={1}/>
    <rect x={x+w*.66} y={y+h*.29} width={w*.34} height={h*.63} rx={3} fill="#c8b898" stroke="#907860" strokeWidth={1}/>
    <rect x={x} y={y+h*.29} width={w*.055} height={h*.63} rx={2} fill="#988868"/>
    <rect x={x+w*.945} y={y+h*.29} width={w*.055} height={h*.63} rx={2} fill="#988868"/>
  </g>
);

const FCoffeeTable = ({ x, y, w, h }) => (
  <g>
    <rect x={x+4} y={y+4} width={w-8} height={h-8} rx={4} fill="#c8b090" stroke="#a89070" strokeWidth={1}/>
    <rect x={x+8} y={y+8} width={w-16} height={h-16} rx={3} fill="#d8c8a8"/>
  </g>
);

const FDiningTable = ({ x, y, w, h }) => (
  <g>
    {[.15,.55].map(p => <rect key={p} x={x+w*p} y={y-10} width={w*.3} height={9} rx={2} fill="#c0a880"/>)}
    {[.15,.55].map(p => <rect key={'b'+p} x={x+w*p} y={y+h+1} width={w*.3} height={9} rx={2} fill="#c0a880"/>)}
    <rect x={x-10} y={y+h*.2} width={9} height={h*.6} rx={2} fill="#c0a880"/>
    <rect x={x+w+1} y={y+h*.2} width={9} height={h*.6} rx={2} fill="#c0a880"/>
    <rect x={x} y={y} width={w} height={h} rx={4} fill="#d4c4a0" stroke="#b0a070" strokeWidth={1.5}/>
  </g>
);

const FKitchenL = ({ x, y, w, h }) => {
  const cw = 18;
  return (
    <g>
      <rect x={x} y={y} width={w} height={cw} rx={2} fill="#a8b8c8" stroke="#8898b0" strokeWidth={1}/>
      <rect x={x} y={y} width={cw} height={h} rx={2} fill="#a8b8c8" stroke="#8898b0" strokeWidth={1}/>
      <rect x={x+w*.45} y={y+2} width={w*.4} height={cw-4} rx={2} fill="#8898a8"/>
      <circle cx={x+w*.67} cy={y+cw/2} r={4} fill="#6070a0" opacity={.5}/>
      {[.15,.3].map((p,i) => [.3,.7].map((q,j) => (
        <circle key={`${i}${j}`} cx={x+w*p} cy={y+6+q*6} r={3} fill="#6878a0" opacity={.8}/>
      )))}
      <rect x={x+2} y={y+h*.55} width={cw-4} height={h*.43} rx={2} fill="#b8c8d8"/>
      <line x1={x+cw/2} y1={y+h*.65} x2={x+cw/2} y2={y+h*.95} stroke="#8898b0" strokeWidth={.8}/>
    </g>
  );
};

const FToilet = ({ x, y, w, h }) => (
  <g>
    <rect x={x} y={y} width={w} height={h*.32} rx={2} fill="#c0c8d0" stroke="#9098a8" strokeWidth={1}/>
    <ellipse cx={x+w/2} cy={y+h*.72} rx={w*.44} ry={h*.26} fill="#c0c8d0" stroke="#9098a8" strokeWidth={1}/>
  </g>
);

const FSink = ({ x, y, s }) => (
  <g>
    <rect x={x} y={y} width={s} height={s} rx={3} fill="#b8c0c8" stroke="#8890a0" strokeWidth={1}/>
    <rect x={x+2} y={y+2} width={s-4} height={s-4} rx={2} fill="#c8d0d8"/>
    <circle cx={x+s/2} cy={y+s/2} r={s*.22} fill="#8898a8"/>
    <circle cx={x+s/2} cy={y+s/2} r={3} fill="#5068a0"/>
  </g>
);

const FWardrobe = ({ x, y, w, h }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2} fill="#b8a880" stroke="#987860" strokeWidth={1}/>
    <line x1={x+w/2} y1={y+2} x2={x+w/2} y2={y+h-2} stroke="#987860" strokeWidth={1}/>
    <circle cx={x+w*.28} cy={y+h/2} r={3} fill="#786040"/>
    <circle cx={x+w*.72} cy={y+h/2} r={3} fill="#786040"/>
  </g>
);

const FTV = ({ x, y, w, h }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={2} fill="#1a202c"/>
    <rect x={x+2} y={y+2} width={w-4} height={h-4} rx={1} fill="#2d3748"/>
    <rect x={x+w*.3} y={y+h} width={w*.4} height={4} rx={1} fill="#1a202c"/>
  </g>
);

const FPlant = ({ x, y, r }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#86c87a" stroke="#5a9450" strokeWidth={1} opacity={.85}/>
    <circle cx={x-r*.4} cy={y-r*.4} r={r*.55} fill="#6db860" opacity={.7}/>
    <circle cx={x+r*.45} cy={y-r*.35} r={r*.45} fill="#96d886" opacity={.65}/>
    <rect x={x-3} y={y+r*.5} width={6} height={r*.6} rx={2} fill="#8b5e3c"/>
  </g>
);

const FCar = ({ x, y, w, h }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx={6} fill="#b0b8c0" stroke="#8898a8" strokeWidth={1.5}/>
    <rect x={x+w*.08} y={y+h*.12} width={w*.84} height={h*.76} rx={5} fill="#9098a0"/>
    <circle cx={x+w*.22} cy={y+h*.88} r={8} fill="#484858" stroke="#303040" strokeWidth={1}/>
    <circle cx={x+w*.78} cy={y+h*.88} r={8} fill="#484858" stroke="#303040" strokeWidth={1}/>
    <rect x={x+w*.08} y={y+h*.06} width={w*.84} height={h*.2} rx={3} fill="#b8ccd8" opacity={.7}/>
  </g>
);

const Door = ({ x, y, size, dir = 'right' }) => {
  const arcs = {
    right: `M${x+size},${y} A${size},${size} 0 0,0 ${x},${y+size}`,
    left:  `M${x},${y} A${size},${size} 0 0,1 ${x+size},${y+size}`,
    up:    `M${x},${y} A${size},${size} 0 0,1 ${x+size},${y+size}`,
    down:  `M${x+size},${y+size} A${size},${size} 0 0,0 ${x},${y}`,
  };
  const lines = {
    right: `M${x},${y} L${x+size},${y}`,
    left:  `M${x},${y} L${x+size},${y}`,
    up:    `M${x},${y} L${x},${y+size}`,
    down:  `M${x},${y} L${x},${y+size}`,
  };
  return (
    <g>
      <path d={arcs[dir]} fill="none" stroke="#c5a059" strokeWidth={1} strokeDasharray="3 2"/>
      <path d={lines[dir]} fill="none" stroke="#c5a059" strokeWidth={2}/>
    </g>
  );
};

// ── Room ──────────────────────────────────────────────────────────────────────
const Room = ({ x, y, w, h, label, area, color, onHover, children }) => {
  const fs = Math.min(13, Math.max(8, Math.min(w, h) * .15));
  return (
    <g onMouseEnter={() => onHover?.({ label, area })} onMouseLeave={() => onHover?.(null)}>
      <rect x={x} y={y} width={w} height={h} fill={color} stroke="#334155" strokeWidth={1.5}/>
      {children}
      <text x={x+w/2} y={y+h/2+(area?-7:0)} textAnchor="middle" dominantBaseline="middle"
        fontSize={fs} fontWeight="800" fill="#1e3a5f" fontFamily="Cairo,Arial,sans-serif"
        style={{ pointerEvents:'none', userSelect:'none' }}>{label}</text>
      {area && (
        <text x={x+w/2} y={y+h/2+8} textAnchor="middle" dominantBaseline="middle"
          fontSize={Math.max(7,fs-3)} fill="#64748b" fontFamily="Cairo,Arial,sans-serif"
          style={{ pointerEvents:'none', userSelect:'none' }}>{area}</text>
      )}
    </g>
  );
};

// ── Compass ───────────────────────────────────────────────────────────────────
const Compass = ({ x, y }) => (
  <g transform={`translate(${x},${y})`}>
    <circle cx={0} cy={0} r={13} fill="white" stroke="#1a365d" strokeWidth={1.5}/>
    <polygon points="0,-9 3.5,2 0,0" fill="#1a365d"/>
    <polygon points="0,-9 -3.5,2 0,0" fill="#94a3b8"/>
    <text x={0} y={11} textAnchor="middle" fontSize={7} fill="#1a365d" fontFamily="Arial" fontWeight="700">N</text>
  </g>
);

// ── Apartment Plan (floors 1-3, 204m²) ───────────────────────────────────────
const ApartmentPlan = ({ onHover }) => (
  <svg viewBox="0 0 680 500" style={{ width:'100%', maxHeight:460 }}>
    <rect width={680} height={500} fill="#f1f5f9"/>
    <rect x={12} y={12} width={656} height={476} rx={3} fill="none" stroke="#1a365d" strokeWidth={5}/>

    {/* Row 1 — y:12..202 */}
    <Room x={12} y={12} w={200} h={190} label="مجلس" area="45 م²" color="#fffbeb" onHover={onHover}>
      <FSofa x={22} y={22} w={128} h={58}/>
      <FCoffeeTable x={22} y={98} w={80} h={44}/>
      <FTV x={185} y={24} w={22} h={7}/>
      <FPlant x={26} y={185} r={9}/>
    </Room>

    <Room x={212} y={12} w={183} h={190} label="غرفة معيشة" area="32 م²" color="#eff6ff" onHover={onHover}>
      <FDiningTable x={244} y={65} w={96} h={58}/>
      <FPlant x={375} y={185} r={9}/>
    </Room>

    <Room x={395} y={12} w={197} h={190} label="غرفة رئيسية" area="38 م²" color="#f0fdf4" onHover={onHover}>
      <FBed x={405} y={22} w={100} h={145}/>
      <FWardrobe x={523} y={22} w={18} h={145}/>
    </Room>

    <Room x={592} y={12} w={76} h={95} label="حمام رئيسي" area="8 م²" color="#eff6ff" onHover={onHover}>
      <FToilet x={601} y={17} w={28} h={38}/>
      <FSink x={602} y={65} s={19}/>
    </Room>

    <Room x={592} y={107} w={76} h={95} label="خادمة" area="9 م²" color="#fdf4ff" onHover={onHover}>
      <FSingleBed x={598} y={113} w={64} h={44}/>
    </Room>

    {/* Row 2 — y:202..382 */}
    <Room x={12} y={202} w={165} h={180} label="مطبخ" area="22 م²" color="#fff7ed" onHover={onHover}>
      <FKitchenL x={18} y={208} w={145} h={158}/>
    </Room>

    <Room x={177} y={202} w={218} h={180} label="غرفة 2" area="28 م²" color="#f0fdf4" onHover={onHover}>
      <FBed x={187} y={212} w={110} h={82}/>
      <FWardrobe x={323} y={212} w={18} h={82}/>
      <FPlant x={185} y={368} r={8}/>
    </Room>

    <Room x={395} y={202} w={197} h={180} label="غرفة 3" area="26 م²" color="#eef2ff" onHover={onHover}>
      <FBed x={405} y={212} w={100} h={82}/>
      <FWardrobe x={523} y={212} w={18} h={82}/>
    </Room>

    <Room x={592} y={202} w={76} h={87} label="حمام 2" area="6 م²" color="#eff6ff" onHover={onHover}>
      <FToilet x={600} y={207} w={26} h={36}/>
      <FSink x={601} y={252} s={18}/>
    </Room>

    <Room x={592} y={289} w={76} h={93} label="غسيل" area="6 م²" color="#f0fdf4" onHover={onHover}/>

    {/* Row 3 — y:382..488 */}
    <Room x={12} y={382} w={128} h={106} label="مدخل" area="" color="#f8fafc" onHover={onHover}>
      <Door x={12} y={428} size={38} dir="right"/>
    </Room>

    <Room x={140} y={382} w={255} h={106} label="غرفة 4" area="24 م²" color="#fffbeb" onHover={onHover}>
      <FBed x={150} y={392} w={110} h={78}/>
      <FWardrobe x={350} y={392} w={18} h={78}/>
    </Room>

    <Room x={395} y={382} w={115} h={106} label="مستودع" area="10 م²" color="#f1f5f9" onHover={onHover}/>

    <Room x={510} y={382} w={158} h={106} label="حمام 3" area="8 م²" color="#eff6ff" onHover={onHover}>
      <FToilet x={518} y={390} w={28} h={40}/>
      <FSink x={520} y={442} s={20}/>
    </Room>

    <Compass x={660} y={483}/>
  </svg>
);

// ── Ground Floor ──────────────────────────────────────────────────────────────
const GroundPlan = ({ onHover }) => (
  <svg viewBox="0 0 680 500" style={{ width:'100%', maxHeight:460 }}>
    <rect width={680} height={500} fill="#f1f5f9"/>
    <rect x={12} y={12} width={656} height={476} rx={3} fill="none" stroke="#1a365d" strokeWidth={5}/>

    <text x={340} y={48} textAnchor="middle" fontSize={15} fontWeight="900" fill="#1a365d" fontFamily="Cairo">مواقف السيارات</text>

    {[0,1,2,3].map(i => (
      <g key={i}>
        <rect x={22+i*158} y={65} width={148} height={185} rx={3}
          fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3"/>
        <FCar x={30+i*158} y={75} w={132} h={165}/>
        <text x={96+i*158} y={264} textAnchor="middle" fontSize={11} fontWeight="700" fill="#475569" fontFamily="Cairo">
          {`موقف ${i+1}`}
        </text>
      </g>
    ))}

    {[0,1,2].map(i => (
      <g key={i}>
        <rect x={22+i*158} y={275} width={148} height={185} rx={3}
          fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3"/>
        {i < 3 && <FCar x={30+i*158} y={285} w={132} h={165}/>}
        <text x={96+i*158} y={474} textAnchor="middle" fontSize={11} fontWeight="700" fill="#475569" fontFamily="Cairo">
          {`موقف ${i+5}`}
        </text>
      </g>
    ))}

    <rect x={497} y={275} width={171} height={210} rx={3} fill="#dde6ee" stroke="#1a365d" strokeWidth={2}/>
    <text x={582} y={362} textAnchor="middle" fontSize={12} fontWeight="800" fill="#1a365d" fontFamily="Cairo">مصعد</text>
    <text x={582} y={380} textAnchor="middle" fontSize={12} fontWeight="800" fill="#1a365d" fontFamily="Cairo">وسلالم</text>

    <rect x={12} y={460} width={656} height={28} rx={0} fill="#c8d4e0" stroke="#1a365d" strokeWidth={1}/>
    <text x={340} y={479} textAnchor="middle" fontSize={11} fontWeight="800" fill="#334155" fontFamily="Cairo">مدخل وخروج السيارات</text>
    <Compass x={660} y={483}/>
  </svg>
);

// ── Roof Villa (floor 4, 422m²) ───────────────────────────────────────────────
const RoofVillaPlan = ({ onHover }) => (
  <svg viewBox="0 0 760 580" style={{ width:'100%', maxHeight:540 }}>
    <rect width={760} height={580} fill="#f1f5f9"/>
    <rect x={12} y={12} width={736} height={556} rx={3} fill="none" stroke="#1a365d" strokeWidth={5}/>

    {/* Row 1 — y:12..215 */}
    <Room x={12} y={12} w={230} h={203} label="مجلس فاخر" area="55 م²" color="#fffbeb" onHover={onHover}>
      <FSofa x={22} y={22} w={150} h={68}/>
      <FCoffeeTable x={22} y={108} w={95} h={52}/>
      <FTV x={205} y={28} w={28} h={9}/>
      <FPlant x={26} y={198} r={11}/>
      <FPlant x={220} y={198} r={10}/>
    </Room>

    <Room x={242} y={12} w={198} h={203} label="غرفة معيشة" area="38 م²" color="#eff6ff" onHover={onHover}>
      <FDiningTable x={274} y={75} w={110} h={65}/>
    </Room>

    <Room x={440} y={12} w={308} h={203} label="غرفة رئيسية" area="50 م²" color="#f0fdf4" onHover={onHover}>
      <FBed x={450} y={22} w={130} h={165}/>
      <FWardrobe x={598} y={22} w={18} h={165}/>
      <FWardrobe x={620} y={22} w={18} h={165}/>
      <FSink x={700} y={60} s={24}/>
    </Room>

    {/* Row 2 — y:215..397 */}
    <Room x={12} y={215} w={170} h={182} label="مطبخ" area="25 م²" color="#fff7ed" onHover={onHover}>
      <FKitchenL x={18} y={221} w={150} h={160}/>
    </Room>

    <Room x={182} y={215} w={258} h={182} label="غرفة 2" area="30 م²" color="#f0fdf4" onHover={onHover}>
      <FBed x={192} y={225} w={125} h={95}/>
      <FWardrobe x={348} y={225} w={18} h={95}/>
    </Room>

    <Room x={440} y={215} w={105} h={88} label="حمام رئيسي" area="9 م²" color="#eff6ff" onHover={onHover}>
      <FToilet x={450} y={221} w={30} h={40}/>
      <FSink x={450} y={271} s={22}/>
    </Room>

    <Room x={545} y={215} w={203} h={88} label="حمام 2" area="7 م²" color="#eff6ff" onHover={onHover}>
      <FToilet x={555} y={221} w={28} h={38}/>
      <FSink x={555} y={268} s={20}/>
    </Room>

    <Room x={440} y={303} w={308} h={94} label="غرفة خادمة + غسيل" area="19 م²" color="#fdf4ff" onHover={onHover}>
      <FSingleBed x={450} y={312} w={90} h={72}/>
    </Room>

    {/* Row 3 — y:397..568 */}
    <Room x={12} y={397} w={140} h={171} label="مدخل" area="" color="#f8fafc" onHover={onHover}>
      <Door x={12} y={452} size={45} dir="right"/>
    </Room>

    <Room x={152} y={397} w={286} h={171} label="غرفة 3 + غرفة 4" area="56 م²" color="#eef2ff" onHover={onHover}>
      <FBed x={162} y={407} w={115} h={92}/>
      <FBed x={162} y={468} w={115} h={92}/>
      <FWardrobe x={380} y={407} w={18} h={153}/>
    </Room>

    <Room x={438} y={397} w={232} h={171} label="سطح خاص" area="120 م²" color="#ecfdf5" onHover={onHover}>
      <FPlant x={462} y={430} r={18}/>
      <FPlant x={640} y={430} r={15}/>
      <FPlant x={550} y={535} r={12}/>
      <text x={552} y={490} textAnchor="middle" fontSize={10} fill="#4a9070"
        fontFamily="Cairo" fontWeight="700" style={{pointerEvents:'none'}}>منطقة خارجية</text>
    </Room>

    <Room x={670} y={397} w={78} h={171} label="حمام 3" area="7 م²" color="#eff6ff" onHover={onHover}>
      <FToilet x={678} y={405} w={28} h={40}/>
      <FSink x={679} y={458} s={20}/>
    </Room>

    <Compass x={742} y={562}/>
  </svg>
);

// ── Export ────────────────────────────────────────────────────────────────────
export default function FloorPlanSVG({ floorId }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div className="relative w-full h-full select-none font-cairo">
      {floorId === 'ground'  && <GroundPlan    onHover={setHovered}/>}
      {floorId === 'fourth'  && <RoofVillaPlan onHover={setHovered}/>}
      {!['ground','fourth'].includes(floorId) && <ApartmentPlan onHover={setHovered}/>}

      {hovered && (
        <div className="absolute top-3 right-3 bg-white/95 border border-slate-200 rounded-xl px-4 py-2.5 shadow-lg pointer-events-none z-10 backdrop-blur-sm">
          <p className="font-black text-[#1a365d] text-sm">{hovered.label}</p>
          {hovered.area && <p className="text-[#c5a059] font-bold text-xs mt-0.5">{hovered.area}</p>}
        </div>
      )}

      <div className="absolute bottom-2 left-2 bg-white/80 rounded-md px-2 py-1 text-[10px] text-slate-400 border border-slate-200 font-cairo">
        المخطط توضيحي — مرر المؤشر على الغرف
      </div>
    </div>
  );
}
