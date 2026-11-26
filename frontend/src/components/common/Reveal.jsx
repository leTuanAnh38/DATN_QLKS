import React from 'react';
import { useInViewOnce } from '../../hooks/useMotion';

/**
 * Wrapper nhẹ cho hiệu ứng Scroll Reveal (trượt dọc tinh tế + hiện rõ trên GPU).
 * Giữ nguyên cấu trúc bố cục, không gây tràn khung ngang trên Mobile.
 */
export default function Reveal({
    children,
    delay = 0,
    className = '',
    as: Component = 'div',
    threshold = 0.12,
    style = {},
    ...rest
}) {
    const [ref, isVisible] = useInViewOnce({ threshold });

    return (
        <Component
            ref={ref}
            className={`reveal-base ${isVisible ? 'reveal-visible' : ''} ${className}`}
            style={delay ? { transitionDelay: `${delay}ms`, ...style } : style}
            {...rest}
        >
            {children}
        </Component>
    );
}

