import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Kiểm tra cài đặt giảm chuyển động (prefers-reduced-motion) của thiết bị
 */
export function prefersReducedMotion() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Kích hoạt trạng thái hiển thị 1 lần duy nhất khi phần tử cuộn vào vùng nhìn thấy.
 * Dùng callback ref để bắt chuẩn cả các khối render sau khi tải API (loading -> data)
 * và tự ngắt IntersectionObserver ngay sau khi kích hoạt.
 */
export function useInViewOnce(options = {}) {
    const { threshold = 0.05, rootMargin = '0px 0px -20px 0px' } = options;
    const [node, setNode] = useState(null);
    const [isVisible, setIsVisible] = useState(() => {
        if (typeof window === 'undefined') return true;
        if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
            return true;
        }
        return false;
    });

    const ref = useCallback((el) => {
        setNode(el);
    }, []);

    useEffect(() => {
        if (isVisible || !node) return undefined;

        // Nếu phần tử vừa mount sau khi gọi API và đã nằm trong (hoặc ở phía trên) vùng nhìn thấy
        const rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight - 10) {
            const rafId = window.requestAnimationFrame(() => setIsVisible(true));
            return () => window.cancelAnimationFrame(rafId);
        }

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
                        setIsVisible(true);
                        observer.disconnect();
                        break;
                    }
                }
            },
            { threshold: Math.min(threshold, 0.05), rootMargin }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [node, isVisible, threshold, rootMargin]);

    return [ref, isVisible];
}

/**
 * Theo dõi trạng thái cuộn vượt ngưỡng threshold (dùng passive listener, chỉ re-render khi đổi trạng thái).
 */
export function useScrolled(threshold = 24) {
    const [isScrolled, setIsScrolled] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.scrollY > threshold;
    });

    useEffect(() => {
        const handleScroll = () => {
            const next = window.scrollY > threshold;
            setIsScrolled((prev) => (prev === next ? prev : next));
        };

        handleScroll();
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [threshold]);

    return isScrolled;
}

/**
 * Đếm số tăng dần mượt mà bằng requestAnimationFrame (chỉ chạy 1 lần khi enabled = true).
 * Tôn trọng prefers-reduced-motion.
 */
export function useCountUp({ end, start = 0, duration = 1200, decimals = 0, enabled = true }) {
    const [value, setValue] = useState(() => (prefersReducedMotion() ? end : start));
    const hasAnimatedRef = useRef(false);

    useEffect(() => {
        if (!enabled || hasAnimatedRef.current || prefersReducedMotion()) return undefined;

        hasAnimatedRef.current = true;
        let rafId = null;
        let startTime = null;

        const step = (timestamp) => {
            if (startTime === null) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Đường cong easeOutQuart khoan thai chuẩn Luxury
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = start + (end - start) * eased;

            if (decimals > 0) {
                setValue(Number(current.toFixed(decimals)));
            } else {
                setValue(Math.round(current));
            }

            if (progress < 1) {
                rafId = window.requestAnimationFrame(step);
            } else {
                setValue(end);
            }
        };

        rafId = window.requestAnimationFrame(step);
        return () => {
            if (rafId !== null) window.cancelAnimationFrame(rafId);
        };
    }, [enabled, start, end, duration, decimals]);

    return decimals > 0 ? Number(value).toFixed(decimals) : String(value);
}
