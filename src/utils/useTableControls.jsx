import { useState, useMemo } from 'react';

/**
 * هوك موحّد لجداول القوائم: فرز + ترقيم صفحات + تحديد متعدد.
 * @param {Array} rows   الصفوف المفلترة الجاهزة للعرض.
 * @param {Object} opts  { pageSize=15, idKey='id', initialSort=null }
 * @returns {{
 *   pageRows, sortKey, sortDir, toggleSort,
 *   page, setPage, totalPages, totalRows, pageStart, pageEnd,
 *   selected, isSelected, toggleSelect, toggleSelectAllPage, allPageSelected, clearSelection, selectedRows
 * }}
 */
export default function useTableControls(rows, opts = {}) {
    const { pageSize = 15, idKey = 'id', initialSort = null } = opts;
    const [sortKey, setSortKey] = useState(initialSort?.key ?? null);
    const [sortDir, setSortDir] = useState(initialSort?.dir ?? 'asc');
    const [page, setPage]       = useState(1);
    const [selected, setSelected] = useState(() => new Set());

    const safeRows = Array.isArray(rows) ? rows : [];

    // ─── فرز ────────────────────────────────────────────────────
    const sorted = useMemo(() => {
        if (!sortKey) return safeRows;
        const arr = [...safeRows];
        arr.sort((a, b) => {
            let va = a?.[sortKey], vb = b?.[sortKey];
            // أرقام
            const na = parseFloat(va), nb = parseFloat(vb);
            const bothNum = !isNaN(na) && !isNaN(nb) && String(va).trim() !== '' && String(vb).trim() !== '';
            if (bothNum) return sortDir === 'asc' ? na - nb : nb - na;
            // نصوص
            va = (va ?? '').toString(); vb = (vb ?? '').toString();
            return sortDir === 'asc' ? va.localeCompare(vb, 'ar') : vb.localeCompare(va, 'ar');
        });
        return arr;
    }, [safeRows, sortKey, sortDir]);

    const toggleSort = (key) => {
        if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortKey(key); setSortDir('asc'); }
        setPage(1);
    };

    // ─── ترقيم الصفحات ──────────────────────────────────────────
    const totalRows  = sorted.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const safePage   = Math.min(page, totalPages);
    const pageStart  = totalRows === 0 ? 0 : (safePage - 1) * pageSize;
    const pageEnd    = Math.min(pageStart + pageSize, totalRows);
    const pageRows   = useMemo(() => sorted.slice(pageStart, pageEnd), [sorted, pageStart, pageEnd]);

    // ─── تحديد متعدد ────────────────────────────────────────────
    const isSelected = (id) => selected.has(id);
    const toggleSelect = (id) => setSelected(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });
    const pageIds = pageRows.map(r => r[idKey]);
    const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
    const toggleSelectAllPage = () => setSelected(prev => {
        const n = new Set(prev);
        if (allPageSelected) pageIds.forEach(id => n.delete(id));
        else pageIds.forEach(id => n.add(id));
        return n;
    });
    const clearSelection = () => setSelected(new Set());
    const selectedRows = safeRows.filter(r => selected.has(r[idKey]));

    return {
        pageRows, sortKey, sortDir, toggleSort,
        page: safePage, setPage, totalPages, totalRows, pageStart, pageEnd,
        selected, isSelected, toggleSelect, toggleSelectAllPage, allPageSelected, clearSelection, selectedRows,
    };
}
