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
                <div className="fixed inset-0 z-[60] bg-[#0b1220] overflow-y-auto"
                    style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <BuyEntity key={top.type + top.value} type={top.type} value={top.value}
                        onOpen={openEntity} onBack={back} depth={stack.length} />
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
