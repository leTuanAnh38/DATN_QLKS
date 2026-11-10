import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Star, Users } from 'lucide-react';

export default function SimilarRoomsSection({ similarRooms = [] }) {
    if (!similarRooms || similarRooms.length === 0) return null;

    return (
        <section className="py-16 bg-white border-t border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                    <div>
                        <span className="text-xs uppercase font-bold tracking-widest text-amber-600">
                            Khám phá thêm
                        </span>
                        <h3 className="font-serif text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
                            Các hạng phòng nghỉ & Suites tương tự
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Lựa chọn không gian nghỉ dưỡng phù hợp hoàn hảo với phong cách của quý khách.
                        </p>
                    </div>
                    <Link
                        to="/rooms"
                        className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                    >
                        <span>Xem tất cả các hạng phòng</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {similarRooms.map((sRoom) => {
                        const sImg =
                            sRoom.feature_image ||
                            sRoom.images?.[0]?.image_url ||
                            sRoom.images?.[0]?.image ||
                            'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80';
                        const sPrice = Number(sRoom.promo_price || sRoom.base_price || 0);

                        return (
                            <div
                                key={sRoom.id}
                                className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
                            >
                                <Link to={`/rooms/${sRoom.id}`} className="block relative h-56 overflow-hidden">
                                    <img
                                        src={sImg}
                                        alt={sRoom.name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                    />
                                    <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                        {sRoom.size ? `${sRoom.size} M²` : 'LUXURY'}
                                    </span>
                                </Link>

                                <div className="p-6 flex-1 flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                                            <span className="flex items-center gap-1 text-amber-500 font-bold">
                                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                                <span>
                                                    {sRoom.rating
                                                        ? Number(sRoom.rating).toFixed(1)
                                                        : sRoom.average_rating
                                                        ? Number(sRoom.average_rating).toFixed(1)
                                                        : '5.0'}
                                                </span>
                                                {sRoom.reviews_count > 0 && (
                                                    <span className="text-slate-400 font-normal text-[11px]">
                                                        ({sRoom.reviews_count})
                                                    </span>
                                                )}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3.5 h-3.5 text-slate-400" /> {sRoom.capacity || 2} khách
                                            </span>
                                        </div>
                                        <h4 className="font-serif font-bold text-lg text-slate-900 group-hover:text-amber-600 transition mb-2">
                                            <Link to={`/rooms/${sRoom.id}`} className="hover:text-amber-600 transition">
                                                {sRoom.name}
                                            </Link>
                                        </h4>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                                            {sRoom.short_description ||
                                                sRoom.description?.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim() ||
                                                'Không gian nghỉ dưỡng thanh lịch, ngắm trọn bình minh và hoàng hôn biển.'}
                                        </p>
                                    </div>

                                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <div>
                                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">
                                                Từ
                                            </span>
                                            <div className="flex items-baseline gap-1">
                                                <strong className="text-base font-black text-slate-900">
                                                    {sPrice.toLocaleString('vi-VN')}
                                                </strong>
                                                <span className="text-[10px] text-slate-500">VND/đêm</span>
                                            </div>
                                        </div>
                                        <Link
                                            to={`/rooms/${sRoom.id}`}
                                            className="px-3 py-1.5 bg-sky-50 hover:bg-gradient-to-r hover:from-sky-600 hover:to-blue-700 text-sky-800 hover:text-white rounded-xl text-xs font-bold transition shadow-2xs"
                                        >
                                            Xem chi tiết
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

