import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// عامل الخدمة الجديد يتسلّم فوراً، لكن الصفحة المفتوحة تبقى على النسخة القديمة
// حتى تُحدَّث — فنعيد تحميلها مرة واحدة عند تسلّمه ليصل التحديث من أول فتحة.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    try {
      if (sessionStorage.getItem('sw_reloaded') === '1') return;
      sessionStorage.setItem('sw_reloaded', '1');
    } catch { /* تجاهل */ }
    window.location.reload();
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
