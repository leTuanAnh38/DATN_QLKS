import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import roomService from '../../services/roomService';
import RoomSlider from './RoomSlider';

export default function FeaturedRoomCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                setLoading(true);
                const res = await roomService.getCategories();
                if (res.success && res.categories) {
                    setCategories(res.categories);
                } else if (Array.isArray(res)) {
                    setCategories(res);
                } else if (res.results) {
                    setCategories(res.results);
                }
            } catch (error) {
                console.error('Error fetching customer room categories:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, []);

    // Lọc theo loại nếu người dùng bấm tab
    const filteredCategories = categories.filter((cat) => {
        if (filterType === 'all') return true;
        if (filterType === 'suite') return cat.name.toLowerCase().includes('suite');
        if (filterType === 'deluxe') return cat.name.toLowerCase().includes('deluxe');
        if (filterType === 'penthouse') return cat.name.toLowerCase().includes('penthouse') || cat.name.toLowerCase().includes('president');
        return true;
    });

    return (
        <section className="py-16 sm:py-20 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-100/30 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                {/* Section Header */}
                <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold uppercase tracking-widest mb-4 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                        BỘ SƯU TẬP HẠNG PHÒNG 5 SAO
                    </div>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-serif font-bold text-slate-900 tracking-tight leading-tight">
                        Không Gian Nghỉ Dưỡng <br className="hidden sm:inline" />
                        <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-amber-600 bg-clip-text text-transparent">
                            Đẳng Cấp & Sang Trọng
                        </span>
                    </h2>
                    <p className="text-slate-600 text-sm sm:text-base mt-4 leading-relaxed font-normal">
                        Mỗi hạng phòng tại Khách Sạn TA Đà Nẵng là một tác phẩm kiến trúc hòa quyện cùng thiên nhiên biển Mỹ Khê, đem lại sự thư thái và tiện nghi thượng lưu cho kỳ nghỉ hoàn mỹ.
                    </p>

                    {/* Filter Tabs */}
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-8">
                        {[
                            { id: 'all', label: 'Tất Cả Hạng Phòng' },
                            { id: 'deluxe', label: 'Hạng Deluxe' },
                            { id: 'suite', label: 'Suites Cao Cấp' },
                            { id: 'penthouse', label: 'Penthouse Hoàng Gia' },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setFilterType(tab.id)}
                                className={`px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 shadow-xs ${
                                    filterType === tab.id
                                        ? 'bg-blue-600 text-white shadow-blue-600/30 shadow-md scale-105'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cards Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3].map((n) => (
                            <div key={n} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-pulse">
                                <div className="h-64 sm:h-72 bg-slate-200"></div>
                                <div className="p-6 space-y-4">
                                    <div className="h-6 bg-slate-200 rounded w-3/4"></div>
                                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                    <div className="h-10 bg-slate-100 rounded"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredCategories.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-lg mx-auto shadow-sm">
                        <div className="text-5xl mb-4">🏝️</div>
                        <h3 className="text-lg font-bold text-slate-900">Chưa có hạng phòng nào trong danh mục này</h3>
                        <p className="text-xs text-slate-500 mt-2">
                            Vui lòng chọn danh mục khác hoặc quay lại xem toàn bộ danh sách phòng.
                        </p>
                    </div>
                ) : (
                    <RoomSlider rooms={filteredCategories} />
                )}
            </div>
        </section>
    );
}
