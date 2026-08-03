import React from 'react';

/**
 * علامة سماك المائية الموحّدة — طبقتان ثابتتان خفيفتان على كل صفحات الموقع.
 *
 * مسطّحة ومُحسّنة عمداً لتجنّب الثقل:
 *  • صورتان PNG مُلوّنتان مسبقاً (كحلي/أبيض) — بلا فلاتر runtime (grayscale/invert) وبلا blur.
 *  • النسخة الكحلية بمزج multiply → تظهر على الخلفيات الفاتحة وتختفي على الداكنة.
 *  • النسخة البيضاء بمزج screen → تظهر على الخلفيات الداكنة وتختفي على الفاتحة.
 *  • pointer-events:none — لا تتفاعل. no-print — لا تتداخل مع طباعة المستندات.
 */
const base = {
  position: 'fixed',
  inset: 0,
  zIndex: 20,
  pointerEvents: 'none',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  backgroundSize: 'cover',
};

export default function Watermark() {
  return (
    <>
      <div
        aria-hidden="true"
        className="no-print"
        style={{ ...base, backgroundImage: 'url(/images/semak-watermark.png)', mixBlendMode: 'multiply', opacity: 0.03 }}
      />
      <div
        aria-hidden="true"
        className="no-print"
        style={{ ...base, backgroundImage: 'url(/images/semak-watermark-white.png)', mixBlendMode: 'screen', opacity: 0.05 }}
      />
    </>
  );
}
