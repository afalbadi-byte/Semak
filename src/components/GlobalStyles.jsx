import React from 'react';

export default function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Amiri:wght@400;700&display=swap');
      
      .font-cairo { font-family: 'Cairo', sans-serif; }
      .font-amiri { font-family: 'Amiri', serif; }
      
      body { font-family: 'Cairo', sans-serif; overflow-x: hidden; background-color: #f8fafc; }
      .hero-gradient { background: linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.6)); }
      .text-glow { text-shadow: 0 0 15px rgba(197, 160, 89, 0.4); }
      .card-hover { transition: all 0.3s ease; }
      .card-hover:hover { transform: translateY(-10px); box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
      
      .logo-blend-light { mix-blend-mode: multiply; }
      .logo-footer-gold { transition: transform 0.3s ease; }
      .logo-footer-gold:hover { transform: scale(1.05); filter: drop-shadow(0 0 10px rgba(197, 160, 89, 0.3)); }

      .map-container iframe { filter: grayscale(20%) contrast(1.2) opacity(0.9); transition: all 0.3s ease; }
      .map-container:hover iframe { filter: grayscale(0%) opacity(1); }
      
      @keyframes marquee { 
          0% { transform: translateX(0%); } 
          100% { transform: translateX(-100%); } 
      }
      .marquee-container { 
          display: flex; overflow: hidden; width: 100%; direction: ltr; 
      }
      .marquee-content { 
          display: flex; min-width: 100%; flex-shrink: 0; align-items: center; justify-content: space-around; animation: marquee 25s linear infinite; 
      }
      .marquee-container:hover .marquee-content { animation-play-state: paused; }
      
      /* أنيميشن ختم الجودة */
      @keyframes stamp-in {
        0% { transform: scale(3) rotate(-30deg); opacity: 0; }
        70% { transform: scale(0.9) rotate(5deg); opacity: 1; }
        100% { transform: scale(1) rotate(-15deg); opacity: 1; }
      }
      .animate-stamp-in { animation: stamp-in 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

      /* Print Styles */
      .a4-page {
          width: 210mm; min-height: 297mm; height: auto; background: white; margin: 0 auto;
          position: relative; padding: 0; display: flex; flex-direction: column; overflow: hidden;
          box-shadow: 0 0 20px rgba(0,0,0,0.15); color: #333; transform-origin: top center;
      }
      .decorative-strip { position: absolute; right: 0; top: 0; bottom: 0; width: 8mm; background: linear-gradient(180deg, #1a365d 0%, #1a365d 85%, #c5a059 85%, #c5a059 100%); z-index: 10; -webkit-print-color-adjust: exact; }
      .corner-accent { position: absolute; bottom: 20mm; left: 20mm; width: 30mm; height: 30mm; border-bottom: 2px solid #c5a059; border-left: 2px solid #c5a059; opacity: 0.3; pointer-events: none; z-index: 5; }
      .watermark { position: absolute; top: 55%; left: 45%; transform: translate(-50%, -50%); opacity: 0.04; width: 80%; pointer-events: none; filter: grayscale(100%); z-index: 0; }
      .letter-header { padding: 15mm 20mm 5mm 30mm; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; }
      .letter-footer { margin-top: auto; background-color: #1a365d; color: white; padding: 12px 0; border-top: 4px solid #c5a059; z-index: 20; -webkit-print-color-adjust: exact !important; }
      .letter-body { padding: 10mm 20mm 10mm 30mm; flex-grow: 1; font-family: 'Amiri', serif; font-size: 18px; line-height: 2.2; position: relative; z-index: 5; display: flex; flex-direction: column; font-variant-ligatures: no-common-ligatures; letter-spacing: 0px; }

      /* تنسيقات محرر النصوص للطباعة */
      .quill-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 10px auto; display: block; }
      .quill-content table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
      .quill-content th, .quill-content td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
      .quill-content th { background-color: #f1f5f9; font-weight: bold; }
      .quill-content ul { list-style-type: disc; margin-right: 20px; }
      .quill-content ol { list-style-type: decimal; margin-right: 20px; }
      .quill-content strong { font-weight: 900; color: #1a365d; }
      
      /* تعديل شكـل المحرر في الوضع الليلي */
      .ql-toolbar.ql-snow { background-color: #f8fafc; border-radius: 8px 8px 0 0; font-family: 'Cairo', sans-serif; direction: ltr;}
      .ql-container.ql-snow { background-color: white; border-radius: 0 0 8px 8px; color: black; font-family: 'Cairo', sans-serif; font-size: 16px; min-height: 200px;}
      .ql-editor { direction: rtl; text-align: right; }

      @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden; }
          #printArea, #printArea * { visibility: visible; }
          #printArea { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .a4-page { box-shadow: none !important; width: 100% !important; min-height: 297mm !important; }
          .decorative-strip { background: linear-gradient(180deg, #1a365d 0%, #1a365d 85%, #c5a059 85%, #c5a059 100%) !important; -webkit-print-color-adjust: exact !important; }
          .letter-footer { background-color: #1a365d !important; color: white !important; -webkit-print-color-adjust: exact !important; position: absolute !important; bottom: 0 !important; left: 0 !important; width: 100% !important;}
      }

      .timeline-container { position: relative; }
      .timeline-container::before { content: ''; position: absolute; top: 0; bottom: 0; right: 24px; width: 2px; background: #e2e8f0; }
      .timeline-item { position: relative; padding-right: 60px; margin-bottom: 30px; }
      .timeline-item:last-child { margin-bottom: 0; }
      .timeline-icon { position: absolute; right: 8px; top: 0; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; border: 4px solid white; }
      
      .kanban-scroll::-webkit-scrollbar { height: 6px; }
      .kanban-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; }
      .kanban-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
      .kanban-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      
      .custom-scrollbar::-webkit-scrollbar { width: 6px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    `}</style>
  );
}