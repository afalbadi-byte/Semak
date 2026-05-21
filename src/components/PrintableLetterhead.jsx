import React, { forwardRef } from 'react';

/**
 * ترويسة سماك الرسمية للطباعة والـ PDF.
 * - thead/tfoot يضمنان تكرار الترويسة والذيل على كل صفحة عند الطباعة.
 * - علامة مائية مكررة عبر background-image على @page (تتكرر طبيعياً لكل ورقة).
 * - متجاوبة مع الجوال والكمبيوتر مع طباعة الألوان.
 */

const LOGO = '/images/logo-main.png';

export const SEMAK_PRINT_PAGE_STYLE = `
  @page { size: A4; margin: 0; }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
    }
    body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
  }
`;

const PrintableLetterhead = forwardRef(function PrintableLetterhead(
  { children, documentLabel = '', subtitle = '', date = '' },
  ref
) {
  // الستايلات inline لضمان عملها في كل المتصفحات
  const watermarkStyle = {
    position: 'absolute',
    top: '40mm',
    left: '0',
    right: '0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 0,
    width: '100%',
  };

  return (
    <div
      ref={ref}
      style={{
        fontFamily: 'Cairo, Tahoma, Arial, sans-serif',
        backgroundColor: '#ffffff',
        color: '#000000',
        width: '210mm',
        margin: 0,
        padding: 0,
        position: 'relative',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
      dir="rtl"
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <thead style={{ display: 'table-header-group' }}>
          <tr>
            <td style={{ padding: 0 }}>
              {/* الشريط العلوي */}
              <div style={{ height: '12px', width: '100%', display: 'flex', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                <div style={{ height: '12px', width: '75%', backgroundColor: '#1a365d' }} />
                <div style={{ height: '12px', width: '25%', backgroundColor: '#c5a059' }} />
              </div>

              {/* الترويسة */}
              <div style={{ padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                <img src={LOGO} alt="شعار سماك" style={{ height: '64px', width: 'auto', objectFit: 'contain' }} crossOrigin="anonymous" />
                <div style={{ textAlign: 'left', borderLeft: '4px solid #c5a059', paddingLeft: '12px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: '#1a365d', lineHeight: 1.2 }}>سماك العقارية</div>
                  <div style={{ color: '#c5a059', fontWeight: 700, fontSize: '11px', marginTop: '3px' }}>سقف يعلو برؤيتك ومسكن يحكي قصتك</div>
                  <div style={{ color: '#94a3b8', fontSize: '9px', marginTop: '2px', direction: 'ltr', textAlign: 'left' }}>CR: 7051031099 — 920032842</div>
                </div>
              </div>

              {(documentLabel || date) && (
                <div style={{ padding: '6px 24px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #e2e8f0', fontSize: '11px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  {documentLabel && (
                    <span style={{ fontWeight: 700, color: '#1a365d' }}>
                      <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#c5a059', marginLeft: '6px', verticalAlign: 'middle' }} />
                      {documentLabel}
                      {subtitle && <span style={{ fontWeight: 500, color: '#64748b', marginRight: '6px' }}>— {subtitle}</span>}
                    </span>
                  )}
                  {date && (
                    <span style={{ color: '#475569' }}>
                      <strong style={{ color: '#1a365d', marginLeft: '4px' }}>التاريخ:</strong> {date}
                    </span>
                  )}
                </div>
              )}

              <div style={{ height: '6px' }} />
            </td>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={{ padding: 0, verticalAlign: 'top', position: 'relative' }}>
              {/* علامة مائية بصرية في وسط المحتوى */}
              <div style={watermarkStyle} aria-hidden="true">
                <img
                  src={LOGO}
                  alt=""
                  style={{ width: '70%', maxWidth: '500px', opacity: 0.05, filter: 'grayscale(100%)' }}
                  crossOrigin="anonymous"
                />
              </div>

              <div style={{ padding: '8mm 12mm', position: 'relative', zIndex: 1, minHeight: '180mm' }}>
                {children}
              </div>
            </td>
          </tr>
        </tbody>

        <tfoot style={{ display: 'table-footer-group' }}>
          <tr>
            <td style={{ padding: 0 }}>
              <div style={{ height: '6px' }} />
              <div style={{ padding: '0 16px 8px', backgroundColor: '#ffffff' }}>
                <div style={{ backgroundColor: '#1a365d', color: 'white', borderRadius: '10px', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '12px', color: '#c5a059' }}>سماك العقارية</div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '9px', marginTop: '2px' }}>المملكة العربية السعودية — مكة المكرمة — حي البوابة</div>
                  </div>
                  <div style={{ direction: 'ltr', textAlign: 'left', fontSize: '10px', color: 'white' }}>
                    <div style={{ fontWeight: 700, fontSize: '11px' }}>📞 920032842</div>
                    <div style={{ color: 'rgba(255,255,255,0.85)', marginTop: '2px' }}>🌐 semak.sa</div>
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
