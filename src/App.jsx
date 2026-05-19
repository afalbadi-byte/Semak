import React, { useContext, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, AppContext } from './context/AppContext';
import { CircleCheckBig } from 'lucide-react';

// المكونات المشتركة — تُحمَّل فوراً لأنها موجودة في كل الصفحات
import GlobalStyles from './components/GlobalStyles';
import Navbar from './components/Navbar';
import Partners from './components/Partners';
import Footer from './components/Footer';

// الصفحات — تُحمَّل عند الطلب (code splitting)
const Home         = lazy(() => import('./pages/Home'));
const About        = lazy(() => import('./pages/About'));
const Projects     = lazy(() => import('./pages/Projects'));
const Contact      = lazy(() => import('./pages/Contact'));
const Services     = lazy(() => import('./pages/Services'));
const LegalPage    = lazy(() => import('./pages/LegalPage'));

const CustomerLogin = lazy(() => import('./pages/customer/CustomerLogin'));
const Maintenance   = lazy(() => import('./pages/customer/Maintenance'));
const Portal        = lazy(() => import('./pages/customer/Portal'));

const AdminLogin      = lazy(() => import('./pages/admin/AdminLogin'));
const Dashboard       = lazy(() => import('./pages/admin/Dashboard'));
const TechDashboard   = lazy(() => import('./pages/admin/TechDashboard'));
const LetterGenerator = lazy(() => import('./pages/admin/LetterGenerator'));
const UnitInspection  = lazy(() => import('./pages/admin/UnitInspection'));
const UnitHandover    = lazy(() => import('./pages/admin/UnitHandover'));
const NotFound        = lazy(() => import('./pages/NotFound'));

// شاشة تحميل بسيطة بين الصفحات
const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center">
    <div className="w-10 h-10 rounded-full border-4 border-[#c5a059]/20 border-t-[#c5a059] animate-spin" />
  </div>
);

// زر واتساب العائم
const WhatsAppFloat = () => {
  const location = useLocation();
  const hide = ['login', 'portal', 'dashboard', 'tech-dashboard', 'letter-generator', 'admin']
    .some(p => location.pathname.toLowerCase().includes(p));
  if (hide) return null;

  return (
    <a
      href="https://wa.me/966920032842?text=أهلاً، أود الاستفسار عن خدماتكم العقارية"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="تواصل معنا عبر واتساب"
      className="fixed bottom-6 left-6 z-50 no-print group w-14 h-14"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20 pointer-events-none" />
      <span className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] shadow-[0_4px_24px_rgba(37,211,102,0.45)] group-hover:scale-110 transition-transform duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="white" viewBox="0 0 16 16">
          <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
        </svg>
      </span>
      <span
        dir="rtl"
        className="absolute top-1/2 -translate-y-1/2 left-[4.5rem] bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap opacity-0 translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 pointer-events-none"
      >
        تواصل معنا عبر واتساب
        <span className="absolute top-1/2 -translate-y-1/2 -left-[5px] w-2.5 h-2.5 bg-slate-900 rotate-45" />
      </span>
    </a>
  );
};

// مكون الإشعارات
const ToastNotification = () => {
  const { toast } = useContext(AppContext);
  return (
    <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-white border-r-4 ${toast.type === "error" ? "border-red-500" : "border-[#c5a059]"} px-8 py-4 rounded-xl shadow-2xl flex items-center gap-4 transition-all duration-500 no-print ${toast.show ? "translate-y-0 opacity-100 visible" : "translate-y-20 opacity-0 invisible"}`}>
      <div className={`p-2 rounded-full ${toast.type === "error" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
        <CircleCheckBig size={24} />
      </div>
      <div>
        <p className="font-bold text-[#1a365d]">{toast.title}</p>
        <p className="text-sm text-gray-500">{toast.desc}</p>
      </div>
    </div>
  );
};

const ProtectedRoute = ({ children }) => {
  const { adminUser } = useContext(AppContext);
  if (!adminUser) return <Navigate to="/login" replace />;
  return children;
};

const MainApp = () => {
  useEffect(() => {
    document.title = "سماك العقارية | سقف يعلو برؤيتك، ومسكن يحكي قصتك";
    let icon = document.querySelector("link[rel~='icon']");
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(icon);
    }
    icon.href = "/images/favicon.png";
  }, []);

  return (
    <Router>
      <div dir="rtl" className="min-h-screen flex flex-col font-cairo text-slate-900 bg-slate-50">

        <GlobalStyles />
        <ToastNotification />
        <WhatsAppFloat />
        <Navbar />

        <div className="flex-grow pt-24">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* الصفحات العامة */}
              <Route path="/"          element={<Home />} />
              <Route path="/about"     element={<About />} />
              <Route path="/projects"  element={<Projects />} />
              <Route path="/contact"   element={<Contact />} />
              <Route path="/services"  element={<Services />} />
              <Route path="/privacy"   element={<LegalPage title="سياسة الخصوصية" />} />
              <Route path="/terms"     element={<LegalPage title="الشروط والأحكام" />} />
              <Route path="/inspection" element={<UnitInspection />} />
              <Route path="/handover"  element={<ProtectedRoute><UnitHandover /></ProtectedRoute>} />

              {/* بوابة العملاء */}
              <Route path="/customer-login" element={<CustomerLogin />} />
              <Route path="/portal"         element={<Portal />} />
              <Route path="/maintenance"    element={<Maintenance />} />

              {/* لوحات التحكم */}
              <Route path="/login"                    element={<AdminLogin />} />
              <Route path="/admin/dashboard"          element={<Dashboard />} />
              <Route path="/admin/tech-dashboard"     element={<TechDashboard />} />
              <Route path="/admin/letter-generator"   element={<LetterGenerator />} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </div>

        <Partners />
        <Footer />

      </div>
    </Router>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
