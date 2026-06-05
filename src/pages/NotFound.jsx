import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ArrowRight, Search } from 'lucide-react';
import PageMeta from '../components/PageMeta';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <>
    <PageMeta title="404 — الصفحة غير موجودة" description="عذراً، الصفحة التي تبحث عنها غير موجودة." />
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-brand-900/40 -mt-24 px-4">
      <div className="text-center max-w-lg w-full">

        {/* الرقم الكبير */}
        <div className="relative mb-8 select-none">
          <span className="text-[180px] md:text-[220px] font-black text-brand-800/5 leading-none block">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 bg-gold-500/10 rounded-full flex items-center justify-center">
              <Search size={40} className="text-gold-500" />
            </div>
          </div>
        </div>

        {/* النص */}
        <h1 className="text-3xl md:text-4xl font-black text-brand-800 dark:text-brand-100 mb-4">
          الصفحة غير موجودة
        </h1>
        <p className="text-slate-500 dark:text-brand-300 text-base mb-10 leading-relaxed">
          عذراً، الرابط الذي تبحث عنه غير متوفر أو تم نقله.<br />
          دعنا نعيدك للصفحة الصحيحة.
        </p>

        {/* الأزرار */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center gap-2 bg-brand-800 text-white px-8 py-4 rounded-2xl font-bold text-base hover:bg-gold-500 transition-all shadow-lg hover:-translate-y-0.5"
          >
            <Home size={20} /> الصفحة الرئيسية
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center justify-center gap-2 bg-white dark:bg-brand-900 border-2 border-brand-800/20 dark:border-brand-700 text-brand-800 dark:text-brand-300 px-8 py-4 rounded-2xl font-bold text-base hover:border-gold-500 hover:text-gold-500 transition-all"
          >
            <ArrowRight size={20} /> استعرض مشاريعنا
          </button>
        </div>

        {/* خط فاصل */}
        <div className="mt-12 pt-8 border-t border-slate-100 dark:border-brand-700">
          <p className="text-slate-400 dark:text-brand-400 text-sm">
            هل تحتاج مساعدة؟{' '}
            <button
              onClick={() => navigate('/contact')}
              className="text-gold-500 font-bold hover:underline"
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
