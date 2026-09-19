import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import { fromHub } from '../lib/semakApps';

// زر الرجوع إلى «تطبيقات سماك» — يظهر فقط إذا فُتح التطبيق من داخل البوابة
export default function HubButton({ className = '' }) {
    if (!fromHub()) return null;
    return (
        <Link to="/apps" title="تطبيقات سماك"
            className={'w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 ' + className}>
            <LayoutGrid size={17} className="text-[#c5a059]" />
        </Link>
    );
}
