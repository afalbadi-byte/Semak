import React, { useState, useCallback } from 'react';
import BuyEntity from './BuyEntity';
import { useDepthGuard } from '../../lib/backstack';
import { EntityCtx, useEntity } from './entityCtx';

// ─── مكدّس البطاقات على مستوى التطبيق كله ───────────────────────────────────
// أي شاشة تنادي openEntity فتفتح البطاقة فوقها، ومنها تُفتح بطاقات أخرى بلا حد.
// كان المكدّس حبيس السجلات، فما كانت أسماء الرئيسية والأسعار والمساعد روابط.

export function EntityProvider({ children }) {
    const [stack, setStack] = useState([]);
    const openEntity = useCallback((type, value) => {
        if (!type || value === undefined || value === null || value === '') return;
        setStack(s => s.concat({ type, value }));
    }, []);
    const back = useCallback(() => setStack(s => s.slice(0, -1)), []);
    useDepthGuard(stack.length, back);

    const top = stack[stack.length - 1];
    return (
        <EntityCtx.Provider value={{ openEntity }}>
            {children}
            {top && (
                // على الجوال تملأ الشاشة، وعلى المكتب لوحٌ في الوسط فوق حاجب —
                // نفس البطاقة ونفس البيانات، تجلس في السياق الذي فُتحت منه
                <div className="fixed inset-0 z-[60] bg-[#0b1220] overflow-y-auto
                        md:bg-black/60 md:p-6 md:flex md:items-start md:justify-center"
                    style={{ paddingTop: 'env(safe-area-inset-top)' }}
                    onClick={e => { if (e.target === e.currentTarget) back(); }}>
                    <div className="w-full md:max-w-3xl md:rounded-3xl md:bg-[#0b1220] md:overflow-hidden md:shadow-2xl">
                        <BuyEntity key={top.type + top.value} type={top.type} value={top.value}
                            onOpen={openEntity} onBack={back} depth={stack.length} />
                    </div>
                </div>
            )}
        </EntityCtx.Provider>
    );
}

// اسم مورّد أو أي نص يفتح بطاقته — يُستعمل في كل الشاشات
export function EntityLink({ type, value, children, className = '' }) {
    const { openEntity } = useEntity();
    if (!value) return <span className={className}>{children}</span>;
    return (
        <button onClick={e => { e.stopPropagation(); openEntity(type, value); }}
            className={'text-right underline decoration-dotted underline-offset-4 ' + className}>
            {children}
        </button>
    );
}
