import React, { forwardRef } from 'react';

/**
 * ترويسة سماك الرسمية للطباعة والـ PDF.
 * - تستخدم thead/tfoot كي تتكرر الترويسة والذيل على كل صفحة طباعة تلقائياً.
 * - علامة مائية ثابتة position:fixed تتكرر على كل صفحة في متصفحات الطباعة الحديثة.
 * - متجاوبة مع الجوال والكمبيوتر، وتحافظ على الألوان عند تصدير PDF.
 *
 * الاستخدام:
 *   const ref = useRef();
 *   const handlePrint = useReactToPrint({
 *     content: () => ref.current,
 *     pageStyle: SEMAK_PRINT_PAGE_STYLE,
 *     documentTitle: '...',
 *   });
 *   <PrintableLetterhead ref={ref} documentLabel="دراسة جدوى">
 *     ... المحتوى ...
 *   </PrintableLetterhead>
 */

export const SEMAK_PRINT_PAGE_STYLE = `
  @page {
    size: A4;
    margin: 0;
  }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .semak-watermark {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
    }
    .semak-watermark img {
      max-width: 60%;
      max-height: 60%;
      opacity: 0.04;
      filter: grayscale(100%);
    }
    .semak-letterhead-table { width: 100%; border-collapse: collapse; }
    .semak-letterhead-table thead { display: table-header-group; }
    .semak-letterhead-table tfoot { display: table-footer-group; }
    .semak-content { padding: 6mm 10mm; position: relative; z-index: 1; }
    .page-break-after { page-break-after: always; break-after: page; }
    .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
  }
`;

const LOGO = '/images/logo-main.png';

const PrintableLetterhead = forwardRef(function PrintableLetterhead(
  { children, documentLabel = '', subtitle = '', date = '' },
  ref
) {
  return (
    <div ref={ref} className="font-cairo bg-white text-black w-full" style={{ margin: 0, padding: 0 }} dir="rtl">
      {/* العلامة المائية الثابتة - تتكرر على كل صفحة */}
      <div className="semak-watermark" aria-hidden="true">
        <img src={LOGO} alt="" />
      </div>

      <table className="semak-letterhead-table w-full" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <td style={{ padding: 0 }}>
              {/* الشريط العلوي الذهبي والكحلي */}
              <div style={{ height: '12px', width: '100%', display: 'flex' }}>
                <div style={{ height: '100%', width: '75%', backgroundColor: '#1a365d', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
                <div style={{ height: '100%', width: '25%', backgroundColor: '#c5a059', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }} />
              </div>

              {/* الترويسة الرئيسية */}
              <div style={{ padding: '14px 30px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <img src={LOGO} alt="شعار سماك" style={{ height: '70px', objectFit: 'contain' }} />
                <div style={{ textAlign: 'left', borderLeft: '4px solid #c5a059', paddingLeft: '14px' }}>
                  <h1 style={{ fontSize: '22px', fontWeight: 900, color: '#1a365d', margin: 0, letterSpacing: '-0.02em' }}>سماك العقارية</h1>
                  <p style={{ color: '#c5a059', fontWeight: 700, fontSize: '11px', marginTop: '4px', letterSpacing: '0.05em', margin: '4px 0 0' }}>سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
                  <p style={{ color: '#94a3b8', fontSize: '9px', marginTop: '3px', letterSpacing: '0.1em', margin: '3px 0 0', direction: 'ltr', textAlign: 'left' }}>CR: 7051031099 — 920032842</p>
                </div>
              </div>

              {/* شريط معلومات المستند (اختياري) */}
              {(documentLabel || date) && (
                <div style={{ padding: '6px 30px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', fontSize: '11px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  {documentLabel && (
                    <span style={{ fontWeight: 700, color: '#1a365d' }}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c5a059', marginLeft: '6px' }} />
                      {documentLabel}
                      {subtitle && <span style={{ fontWeight: 500, color: '#64748b', marginRight: '6px' }}>— {subtitle}</span>}
                    </span>
                  )}
                  {date && (
                    <span style={{ color: '#475569', fontFamily: 'monospace' }}>
                      <strong style={{ color: '#1a365d', marginLeft: '4px' }}>التاريخ:</strong> {date}
                    </span>
                  )}
                </div>
              )}

              <div style={{ height: '10px' }} />
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={{ padding: 0, verticalAlign: 'top' }}>
              <div className="semak-content" style={{ padding: '6mm 10mm', position: 'relative' }}>
                {children}
              </div>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr>
            <td style={{ padding: 0 }}>
              <div style={{ height: '8px' }} />
              <div style={{ padding: '0 18px 10px', backgroundColor: '#ffffff', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ backgroundColor: '#1a365d', color: 'white', borderRadius: '14px', padding: '10px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '12px', color: '#c5a059', margin: 0, letterSpacing: '0.03em' }}>سماك العقارية</p>
                    <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '9px', margin: '2px 0 0' }}>المملكة العربية السعودية — مكة المكرمة — حي البوابة</p>
                  </div>
                  <div style={{ direction: 'ltr', textAlign: 'left', fontSize: '10px' }}>
                    <div style={{ color: 'white', fontWeight: 700, fontSize: '11px' }}>📞 920032842</div>
                    <div style={{ color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>🌐 semak.sa</div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
});

export default PrintableLetterhead;
