import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowRight, Search } from 'lucide-react';
import PageMeta from '../components/PageMeta';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <>
    <PageMeta title="404 — الصفحة غير موجودة" description="عذراً، الصفحة التي تبحث عنها غير موجودة." />
    <div className="min-h-screen flex items-center justify-center bg-slate-50 -mt-24 px-4">
      <div className="text-center max-w-lg w-full">

        {/* الرقم الكبير */}
        <div className="relative mb-8 select-none">
          <span className="text-[180px] md:text-[220px] font-black text-[#1a365d]/5 leading-none block">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-[#c5a059]/10 rounded-full flex items-center justify-center">
              <Search size={40} className="text-[#c5a059]" />
            </div>
          </div>
        </div>

        {/* النص */}
        <h1 className="text-3xl md:text-4xl font-black text-[#1a365d] mb-4">
          الصفحة غير موجودة
        </h1>
        <p className="text-slate-500 text-base mb-10 leading-relaxed">
          عذراً، الرابط الذي تبحث عنه غير متوفر أو تم نقله.<br />
          دعنا نعيدك للصفحة الصحيحة.
        </p>

        {/* الأزرار */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 bg-[#1a365d] text-white px-8 py-4 rounded-2xl font-bold text-base hover:bg-[#c5a059] transition-all shadow-lg hover:-translate-y-0.5"
          >
            <Home size={20} /> الصفحة الرئيسية
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center justify-center gap-2 bg-white border-2 border-[#1a365d]/20 text-[#1a365d] px-8 py-4 rounded-2xl font-bold text-base hover:border-[#c5a059] hover:text-[#c5a059] transition-all"
          >
            <ArrowRight size={20} /> استعرض مشاريعنا
          </button>
        </div>

        {/* خط فاصل */}
        <div className="mt-12 pt-8 border-t border-slate-100">
          <p className="text-slate-400 text-sm">
            هل تحتاج مساعدة؟{' '}
            <button
              onClick={() => navigate('/contact')}
              className="text-[#c5a059] font-bold hover:underline"
            >
              تواصل معنا
            </button>
          </p>
        </div>

      </div>
    </div>
    </>
  );
}
