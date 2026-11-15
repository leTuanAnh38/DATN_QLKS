import { useEffect, useRef, useCallback } from 'react';

/**
 * Cuộn mượt về đầu khu vực danh sách SAU KHI React commit trang mới vào DOM.
 * Dùng double requestAnimationFrame để trình duyệt di động hoàn tất tính toán lại layout
 * trước khi cuộn, tránh bị tụt xuống footer khi trang sau ít phần tử hơn trang trước.
 */
export function useScrollAfterPageChange(
    currentPage,
    targetId,
    { offset = 88, fallbackTop = 0 } = {}
) {
    const shouldScrollRef = useRef(false);

    useEffect(() => {
        if (!shouldScrollRef.current) return;
        shouldScrollRef.current = false;

        let raf2 = 0;
        const raf1 = window.requestAnimationFrame(() => {
            raf2 = window.requestAnimationFrame(() => {
                const targetEl = targetId ? document.getElementById(targetId) : null;
                if (targetEl) {
                    const targetTop = Math.max(
                        0,
                        targetEl.getBoundingClientRect().top + window.scrollY - offset
                    );
                    window.scrollTo({ top: targetTop, behavior: 'smooth' });
                } else {
                    window.scrollTo({ top: fallbackTop, behavior: 'smooth' });
                }
            });
        });

        return () => {
            window.cancelAnimationFrame(raf1);
            if (raf2) window.cancelAnimationFrame(raf2);
        };
    }, [currentPage, targetId, offset, fallbackTop]);

    return useCallback(() => {
        shouldScrollRef.current = true;
    }, []);
}

