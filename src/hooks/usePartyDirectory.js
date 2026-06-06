/**
 * usePartyDirectory — يبني جدول بحث للأطراف من acc_parties
 * يُخزّن النتيجة في ذاكرة الوحدة (module-level cache) لتجنب الطلبات المتعددة.
 *
 * يُرجع: { byDaftraId: { [daftraId]: accPartyId }, byName: { [name]: accPartyId } }
 */
import { useState, useEffect } from 'react';
import { API_URL } from '../lib/api/client';

let _cache = null;
let _promise = null;

async function loadDirectory() {
  if (_cache) return _cache;
  if (_promise) return _promise;

  _promise = fetch(`${API_URL}?action=acc_parties_list&tenant=1&limit=500`)
    .then(r => r.json())
    .then(d => {
      const byDaftraId = {};
      const byName = {};
      if (d.success && Array.isArray(d.data)) {
        d.data.forEach(p => {
          if (p.daftra_id) byDaftraId[String(p.daftra_id)] = p.id;
          if (p.name) byName[String(p.name).trim()] = p.id;
        });
      }
      _cache = { byDaftraId, byName };
      return _cache;
    })
    .catch(() => {
      _promise = null; // allow retry on next mount
      return { byDaftraId: {}, byName: {} };
    });

  return _promise;
}

/** إلغاء التخزين المؤقت — استدعِها بعد إضافة/تعديل طرف لإجبار الجلب من جديد */
export function invalidatePartyDirectory() {
  _cache = null;
  _promise = null;
}

export function usePartyDirectory() {
  const [dir, setDir] = useState(_cache || { byDaftraId: {}, byName: {} });

  useEffect(() => {
    if (_cache) {
      setDir(_cache);
      return;
    }
    loadDirectory().then(d => setDir({ ...d }));
  }, []);

  return dir;
}
