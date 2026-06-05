import React, { useContext } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

const ICONS = { light: Sun, dark: Moon, system: Monitor };
const LABELS = { light: 'فاتح', dark: 'داكن', system: 'تلقائي' };

/**
 * زر تبديل الثيم — يدوّر بين فاتح/داكن/تلقائي.
 * props: size (px), className (إضافي للزر)
 */
export default function ThemeToggle({ size = 18, className = '' }) {
  const { theme = 'system', cycleTheme } = useContext(AppContext) || {};
  const Icon = ICONS[theme] || Monitor;
  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`الوضع الحالي: ${LABELS[theme] || 'تلقائي'} — اضغط للتبديل`}
      aria-label="تبديل وضع العرض"
      className={`p-2 rounded-lg text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-800 transition ${className}`}
    >
      <Icon size={size} />
    </button>
  );
}
