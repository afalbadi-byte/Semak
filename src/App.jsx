import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, AppContext } from './context/AppContext';
import { CircleCheckBig } from 'lucide-react';
import UnitHandover from './pages/admin/UnitHandover';

// المكونات المشتركة
import GlobalStyles from './components/GlobalStyles';
import Navbar from './components/Navbar';
import Partners from './components/Partners';
import Footer from './components/Footer';

// الصفحات العامة والعملاء
import Home from './pages/Home';
import About from './pages/About';
import Projects from './pages/Projects';
import Contact from './pages/Contact';
import LegalPage from './pages/LegalPage';
import CustomerLogin from './pages/customer/CustomerLogin';
import Maintenance from './pages/customer/Maintenance';

// صفحات لوحة التحكم الإدارية
import AdminLogin from './pages/admin/AdminLogin';
import Dashboard from './pages/admin/Dashboard';
import TechDashboard from './pages/admin/TechDashboard';
import LetterGenerator from './pages/admin/LetterGenerator';
import UnitInspection from './pages/admin/UnitInspection';



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

const MainApp = () => {
  return (
    <Router>
      <div dir="rtl" className="min-h-screen flex flex-col font-cairo text-slate-900 bg-slate-50">
        
        <GlobalStyles />
        <ToastNotification />
        <Navbar />

        <div className="flex-grow pt-24">
          <Routes>
            {/* الصفحات العامة */}
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/handover" element={<UnitHandover />} />
            <Route path="/privacy" element={<LegalPage title="سياسة الخصوصية" />} />
            <Route path="/terms" element={<LegalPage title="الشروط والأحكام" />} />
            <Route path="/inspection" element={<UnitInspection />} />
            {/* بوابة العملاء */}
            <Route path="/customer-login" element={<CustomerLogin />} />
            <Route path="/maintenance" element={<Maintenance />} />

            {/* لوحات التحكم الإدارية والفنية */}
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/tech-dashboard" element={<TechDashboard />} />
            <Route path="/admin/letter-generator" element={<LetterGenerator />} />
          </Routes>
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