import React from 'react';

/**
 * Component Phân trang tái sử dụng (Pagination) chuẩn Tailwind CSS
 * @param {number} currentPage - Trang hiện tại (1-indexed)
 * @param {number} totalPages - Tổng số trang
 * @param {function} onPageChange - Callback khi chuyển trang: (page: number) => void
 * @param {number} totalCount - Tổng số kết quả (bản ghi)
 * @param {number} pageSize - Số bản ghi trên mỗi trang (mặc định 10)
 * @param {function} onPageSizeChange - Callback khi thay đổi số dòng/trang: (size: number) => void
 * @param {number[]} pageSizeOptions - Danh sách tùy chọn số dòng/trang (mặc định [5, 10, 20, 50])
 */
export default function Pagination({
    currentPage = 1,
    totalPages = 1,
    onPageChange,
    totalCount = null,
    pageSize = 10,
    onPageSizeChange = null,
    pageSizeOptions = [5, 10, 20, 50],
}) {
    // Nếu tổng số trang nhỏ hơn hoặc bằng 0 thì không render hoặc chỉ hiển thị 1 trang
    const effectiveTotalPages = Math.max(totalPages || 1, 1);
    const activePage = Math.min(Math.max(currentPage || 1, 1), effectiveTotalPages);

    // Tính toán số thứ tự bắt đầu và kết thúc của trang hiện tại
    let startItem = 1;
    let endItem = 10;
    if (totalCount !== null && totalCount !== undefined) {
        if (totalCount === 0) {
            startItem = 0;
            endItem = 0;
        } else {
            startItem = (activePage - 1) * pageSize + 1;
            endItem = Math.min(activePage * pageSize, totalCount);
        }
    } else {
        startItem = (activePage - 1) * pageSize + 1;
        endItem = activePage * pageSize;
    }

    // Tạo danh sách các nút số trang kèm dấu ... khi danh sách dài
    const getPageNumbers = () => {
        const pages = [];
        const maxButtons = 5;

        if (effectiveTotalPages <= maxButtons + 2) {
            for (let i = 1; i <= effectiveTotalPages; i++) {
                pages.push(i);
            }
        } else {
            // Luôn hiển thị trang đầu tiên
            pages.push(1);

            let startRange = Math.max(2, activePage - 1);
            let endRange = Math.min(effectiveTotalPages - 1, activePage + 1);

            if (activePage <= 3) {
                endRange = 4;
            } else if (activePage >= effectiveTotalPages - 2) {
                startRange = effectiveTotalPages - 3;
            }

            if (startRange > 2) {
                pages.push('dots-prev');
            }

            for (let i = startRange; i <= endRange; i++) {
                pages.push(i);
            }

            if (endRange < effectiveTotalPages - 1) {
                pages.push('dots-next');
            }

            // Luôn hiển thị trang cuối cùng
            pages.push(effectiveTotalPages);
        }

        return pages;
    };

    const handleFirst = () => {
        if (activePage > 1 && onPageChange) {
            onPageChange(1);
        }
    };

    const handlePrev = () => {
        if (activePage > 1 && onPageChange) {
            onPageChange(activePage - 1);
        }
    };

    const handleNext = () => {
        if (activePage < effectiveTotalPages && onPageChange) {
            onPageChange(activePage + 1);
        }
    };

    const handleLast = () => {
        if (activePage < effectiveTotalPages && onPageChange) {
            onPageChange(effectiveTotalPages);
        }
    };

    const handleSelectPage = (page) => {
        if (page !== activePage && onPageChange) {
            onPageChange(page);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-3.5 bg-slate-50/70 border-t border-slate-200">
            {/* Text đếm kết quả & Tùy chọn pageSize bên trái */}
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                <div>
                    {totalCount !== null && totalCount !== undefined ? (
                        totalCount > 0 ? (
                            <span>
                                Hiển thị từ <span className="font-semibold text-slate-800">{startItem}</span> đến{' '}
                                <span className="font-semibold text-slate-800">{endItem}</span> trong tổng số{' '}
                                <span className="font-semibold text-slate-800">{totalCount}</span> kết quả
                            </span>
                        ) : (
                            <span>Không có kết quả nào</span>
                        )
                    ) : (
                        <span>
                            Hiển thị từ <span className="font-semibold text-slate-800">{startItem}</span> đến{' '}
                            <span className="font-semibold text-slate-800">{endItem}</span> kết quả
                        </span>
                    )}
                </div>

                {onPageSizeChange && (
                    <div className="flex items-center gap-1.5 pl-3 border-l border-slate-200">
                        <span className="text-slate-400">Số dòng:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => onPageSizeChange(Number(e.target.value))}
                            className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
                        >
                            {pageSizeOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt} / trang
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Các nút điều hướng và số trang bên phải */}
            <div className="flex items-center gap-1.5">
                {/* Nút [« Trang đầu] */}
                <button
                    type="button"
                    onClick={handleFirst}
                    disabled={activePage <= 1}
                    title="Trang đầu"
                    className={`p-1.5 rounded-lg text-xs font-semibold transition border ${
                        activePage <= 1
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 cursor-pointer shadow-2xs'
                    }`}
                >
                    <span className="text-sm leading-none font-bold">«</span>
                </button>

                {/* Nút [< Trước] */}
                <button
                    type="button"
                    onClick={handlePrev}
                    disabled={activePage <= 1}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        activePage <= 1
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 cursor-pointer shadow-2xs'
                    }`}
                >
                    <span>‹</span>
                    <span>Trước</span>
                </button>

                {/* Các nút số trang [1], [2], [3]... */}
                <div className="flex items-center gap-1">
                    {getPageNumbers().map((item, index) => {
                        if (typeof item === 'string') {
                            return (
                                <span
                                    key={`dots-${index}`}
                                    className="px-2 py-1 text-xs text-slate-400 font-medium select-none"
                                >
                                    ...
                                </span>
                            );
                        }

                        const isCurrent = item === activePage;
                        return (
                            <button
                                key={`page-${item}`}
                                type="button"
                                onClick={() => handleSelectPage(item)}
                                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-semibold transition border flex items-center justify-center cursor-pointer ${
                                    isCurrent
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 shadow-2xs'
                                }`}
                            >
                                {item}
                            </button>
                        );
                    })}
                </div>

                {/* Nút [Tiếp >] */}
                <button
                    type="button"
                    onClick={handleNext}
                    disabled={activePage >= effectiveTotalPages}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                        activePage >= effectiveTotalPages
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-blue-600 hover:border-blue-300 cursor-pointer shadow-2xs'
                    }`}
                >
                    <span>Tiếp</span>
                    <span>›</span>
                </button>

                {/* Nút [» Trang cuối] */}
                <button
                    type="button"
                    onClick={handleLast}
                    disabled={activePage >= effectiveTotalPages}
                    title="Trang cuối"
                    className={`p-1.5 rounded-lg text-xs font-semibold transition border ${
                        activePage >= effectiveTotalPages
                            ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 cursor-pointer shadow-2xs'
                    }`}
                >
                    <span className="text-sm leading-none font-bold">»</span>
                </button>
            </div>
        </div>
    );
}
