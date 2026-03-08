import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function LegalPage({ title }) {
  const navigate = useNavigate();
  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen container mx-auto px-6 max-w-4xl text-right">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
        <div className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black text-[#1a365d]">{title}</h1>
          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-[#c5a059]">
            <ArrowRight size={24} />
          </button>
        </div>
        <div className="prose prose-lg text-slate-600 space-y-6">
          <p>محتوى {title} يكتب هنا...</p>
          {title === "سياسة الخصوصية" && <p>نحرص في سماك العقارية على حماية خصوصية بيانات عملائنا...</p>}
          {title === "الشروط والأحكام" && <p>بوصولك واستخدامك لموقع سماك العقارية، فإنك توافق على الالتزام بهذه الشروط...</p>}
        </div>
      </div>
    </div>
  );
}