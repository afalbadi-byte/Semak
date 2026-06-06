import React from 'react';

// ════════════════════════════════════════════════════════════════════════════
//  حاجز الأخطاء (Error Boundary) — يصطاد أخطاء التصيير في الشجرة الفرعية
//  ويعرض واجهة احتياطية بدلاً من تعطّل الصفحة بأكملها.
//
//  الاستخدام:
//    <ErrorBoundary>
//      <SomeComponent />
//    </ErrorBoundary>
//
//    أو مع واجهة احتياطية مخصَّصة:
//    <ErrorBoundary fallback={<div>مخصَّص</div>}>
//      <SomeComponent />
//    </ErrorBoundary>
// ════════════════════════════════════════════════════════════════════════════

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
        this.reset = this.reset.bind(this);
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        // سجّل في وحدة التحكم للتتبع — لا ترسل للخادم (بلا Sentry حتى الآن)
        console.error('[ErrorBoundary]', error.message, info.componentStack);
    }

    reset() {
        this.setState({ hasError: false, error: null });
    }

    render() {
        if (!this.state.hasError) return this.props.children;

        if (this.props.fallback) return this.props.fallback;

        return (
            <div
                className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8"
                dir="rtl"
            >
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center text-3xl select-none">
                    ⚠
                </div>
                <h2 className="text-xl font-black text-brand-800 dark:text-brand-100">
                    حدث خطأ غير متوقع
                </h2>
                <p className="text-slate-500 dark:text-brand-400 text-sm max-w-sm leading-relaxed">
                    {this.state.error?.message || 'يرجى تحديث الصفحة أو المحاولة لاحقاً.'}
                </p>
                <button
                    onClick={this.reset}
                    className="px-5 py-2.5 rounded-xl bg-brand-800 text-white font-bold text-sm hover:bg-brand-900 transition"
                >
                    إعادة المحاولة
                </button>
            </div>
        );
    }
}
