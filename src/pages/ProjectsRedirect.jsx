import React, { useEffect } from 'react';
import PageMeta from '../components/PageMeta';

// صفحة المشاريع أُلغيت (قرار 2026-08-28) — البروشور الرسمي هو المصدر الوحيد لعرض المشروع
const BROCHURE_URL = 'https://brochure.semak.sa/view.html';

export default function ProjectsRedirect() {
  useEffect(() => { window.location.replace(BROCHURE_URL); }, []);

  return (
    <>
      <PageMeta title="مشاريعنا" description="مشروع سماك البوابة — بروشور المشروع الرسمي." />
      <div dir="rtl" className="min-h-screen flex items-center justify-center bg-[#0a0f1e] font-cairo">
        <div className="text-center px-6">
          <div className="w-11 h-11 mx-auto mb-5 border-4 border-[#c5a059]/25 border-t-[#c5a059] rounded-full animate-spin" />
          <p className="text-white/85 font-bold text-lg mb-6">جارٍ تحويلك إلى بروشور مشروع <span className="text-[#c5a059]">سماك البوابة</span>…</p>
          <a href={BROCHURE_URL} className="inline-block bg-[#c5a059] text-white px-8 py-3.5 rounded-2xl font-bold hover:opacity-90 transition">
            افتح البروشور
          </a>
        </div>
      </div>
    </>
  );
}
