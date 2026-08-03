import React from 'react';

/**
 * ترويسة سماك الرسمية للطباعة في نافذة منفصلة.
 *
 * تستخدم نمط position:fixed مع @page margins لضمان:
 * - تكرار الترويسة على كل صفحة (top fixed)
 * - تكرار الذيل على كل صفحة (bottom fixed)
 * - تكرار العلامة المائية على كل صفحة (centered fixed)
 *
 * يجب أن يُحقن CSS التالي في النافذة الجديدة قبل المحتوى:
 *   import { SEMAK_PRINT_CSS } from 'PrintableLetterhead';
 */

const LOGO = 'https://semak.sa/images/logo-main.png';
// علامة سماك المائية الجديدة — مطلقة المسار لأن الطباعة تتم في نافذة مستقلة
const WATERMARK = 'https://semak.sa/images/semak-watermark.png';

// CSS كامل يُحقن في نافذة الطباعة الجديدة
export const SEMAK_PRINT_CSS = `
  @page {
    size: A4;
    margin: 38mm 0 26mm 0;
  }

  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
    font-family: 'Cairo', Tahoma, Arial, sans-serif;
  }

  /* الهيدر الثابت — يتكرر على كل صفحة */
  .semak-print-header {
    position: fixed;
    top: -38mm;
    left: 0;
    right: 0;
    width: 100%;
    height: 36mm;
    background: #ffffff;
    z-index: 100;
  }

  .semak-print-header-bar {
    height: 6mm;
    width: 100%;
    display: flex;
  }
  .semak-print-header-bar > div:first-child {
    width: 75%;
    height: 100%;
    background: #1a365d;
  }
  .semak-print-header-bar > div:last-child {
    width: 25%;
    height: 100%;
    background: #c5a059;
  }

  .semak-print-header-main {
    padding: 4mm 12mm;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f1f5f9;
  }

  .semak-print-header-main img {
    height: 18mm;
    width: auto;
    object-fit: contain;
  }

  .semak-print-header-info {
    text-align: left;
    border-left: 4px solid #c5a059;
    padding-left: 10px;
  }

  .semak-print-header-info h1 {
    margin: 0;
    font-size: 18px;
    font-weight: 900;
    color: #1a365d;
    line-height: 1.2;
  }

  .semak-print-header-info .tagline {
    color: #c5a059;
    font-weight: 700;
    font-size: 10px;
    margin-top: 2px;
  }

  .semak-print-header-info .cr {
    color: #94a3b8;
    font-size: 8px;
    margin-top: 2px;
    direction: ltr;
    text-align: left;
  }

  .semak-print-doc-bar {
    padding: 2mm 12mm;
    background: #f8fafc;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px dashed #e2e8f0;
    font-size: 10px;
  }
  .semak-print-doc-bar .label {
    font-weight: 700;
    color: #1a365d;
  }
  .semak-print-doc-bar .dot {
    display: inline-block;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #c5a059;
    margin-left: 5px;
    vertical-align: middle;
  }
  .semak-print-doc-bar .sub {
    font-weight: 500;
    color: #64748b;
    margin-right: 6px;
  }
  .semak-print-doc-bar .date {
    color: #475569;
  }
  .semak-print-doc-bar .date strong {
    color: #1a365d;
    margin-left: 4px;
  }

  /* الفوتر الثابت — يتكرر على كل صفحة */
  .semak-print-footer {
    position: fixed;
    bottom: -26mm;
    left: 0;
    right: 0;
    width: 100%;
    height: 22mm;
    padding: 4mm 12mm;
    background: #ffffff;
    z-index: 100;
  }

  .semak-print-footer-inner {
    background: #1a365d;
    color: #ffffff;
    border-radius: 12px;
    padding: 8px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 100%;
  }

  .semak-print-footer-left .name {
    font-weight: 700;
    font-size: 11px;
    color: #c5a059;
  }
  .semak-print-footer-left .addr {
    color: rgba(255,255,255,0.85);
    font-size: 8px;
    margin-top: 2px;
  }

  .semak-print-footer-right {
    direction: ltr;
    text-align: left;
    font-size: 9px;
    color: #ffffff;
  }
  .semak-print-footer-right .phone {
    font-weight: 700;
    font-size: 10px;
  }
  .semak-print-footer-right .url {
    color: rgba(255,255,255,0.85);
    margin-top: 2px;
  }

  /* العلامة المائية — تتكرر على كل صفحة عبر position:fixed */
  /* العلامة المائية الجديدة — صورة مُلوّنة مسبقاً بلا فلتر (مسطّحة، خفيفة عند التصدير PDF) */
  .semak-print-watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 62%;
    max-width: 520px;
    opacity: 0.05;
    pointer-events: none;
    z-index: 0;
  }

  /* المحتوى يتدفق بين الهيدر والفوتر */
  .semak-print-content {
    padding: 4mm 12mm;
    position: relative;
    z-index: 1;
  }

  /* قواعد فصل الصفحات */
  .page-break-avoid { page-break-inside: avoid; break-inside: avoid; }
  .page-break-after { page-break-after: always; break-after: page; }

  /* جداول تتكرر رؤوسها على كل صفحة */
  table thead { display: table-header-group; }
  table tfoot { display: table-footer-group; }

  @media print {
    html, body { margin: 0 !important; padding: 0 !important; }
    .semak-print-watermark { display: block !important; }
    .semak-print-header { display: block !important; }
    .semak-print-footer { display: block !important; }
  }
`;

/**
 * مكوّن المحتوى القابل للطباعة (يتضمّن الهيدر/الفوتر/العلامة المائية الثابتة).
 * يجب أن يُلَفّ المحتوى داخل صفحة HTML تتضمن SEMAK_PRINT_CSS.
 */
export default function PrintableLetterhead({ children, documentLabel = '', subtitle = '', date = '', companyName = 'سماك العقارية' }) {
    return (
        <>
            {/* العلامة المائية — position:fixed تتكرر تلقائياً على كل صفحة */}
            <img className="semak-print-watermark" src={WATERMARK} alt="" aria-hidden="true" />

            {/* الهيدر الثابت — يتكرر على كل صفحة */}
            <div className="semak-print-header">
                <div className="semak-print-header-bar">
                    <div></div>
                    <div></div>
                </div>
                <div className="semak-print-header-main">
                    <img src={LOGO} alt="شعار سماك" />
                    <div className="semak-print-header-info">
                        <h1>{companyName}</h1>
                        <div className="tagline">سقف يعلو برؤيتك ومسكن يحكي قصتك</div>
                        <div className="cr">CR: 7051031099 — 920032842</div>
                    </div>
                </div>
                {(documentLabel || date) && (
                    <div className="semak-print-doc-bar">
                        {documentLabel && (
                            <span className="label">
                                <span className="dot"></span>
                                {documentLabel}
                                {subtitle && <span className="sub">— {subtitle}</span>}
                            </span>
                        )}
                        {date && (
                            <span className="date">
                                <strong>التاريخ:</strong> {date}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* الفوتر الثابت — يتكرر على كل صفحة */}
            <div className="semak-print-footer">
                <div className="semak-print-footer-inner">
                    <div className="semak-print-footer-left">
                        <div className="name">{companyName}</div>
                        <div className="addr">المملكة العربية السعودية — مكة المكرمة — حي البوابة</div>
                    </div>
                    <div className="semak-print-footer-right">
                        <div className="phone">📞 920032842</div>
                        <div className="url">🌐 semak.sa</div>
                    </div>
                </div>
            </div>

            {/* المحتوى يتدفق بشكل طبيعي بين الهيدر والفوتر */}
            <div className="semak-print-content">
                {children}
            </div>
        </>
    );
}
