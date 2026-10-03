import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import postService from '../../services/postService';

const quillFormats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'color', 'background',
    'blockquote', 'code-block',
    'link', 'image',
];

// Hàm chuyển đổi tiếng Việt có dấu thành slug không dấu cho SEO
export function generateVietnameseSlug(text) {
    if (!text) return '';
    let slug = text.toLowerCase();
    slug = slug.replace(/đ/g, 'd');
    slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    slug = slug.replace(/[^a-z0-9\s-]/g, '');
    slug = slug.trim().replace(/\s+/g, '-').replace(/-+/g, '-');
    return slug;
}

export default function PostManagement() {
    const [posts, setPosts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [alertMessage, setAlertMessage] = useState(null);

    // Form data state
    const [formData, setFormData] = useState({
        title: '',
        slug: '',
        category: 'du_lich',
        author: 'Ban Biên Tập',
        status: 'published',
        summary: '',
        content: '',
        thumbnail: null,
    });
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [isAutoSlug, setIsAutoSlug] = useState(true);
    const fileInputRef = useRef(null);
    const quillRef = useRef(null);
    const [isUploadingImage, setIsUploadingImage] = useState(false);

    // =========================================================================
    // CUSTOM IMAGE HANDLER CHO REACT-QUILL (Tránh lưu ảnh Base64 vào Database)
    // =========================================================================
    const imageHandler = useCallback(() => {
        // 1. Mở hộp thoại chọn file gốc của trình duyệt
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/png, image/jpeg, image/jpg, image/webp, image/gif');
        input.click();

        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;

            // Kiểm tra dung lượng ảnh (tối đa 10MB)
            if (file.size > 10 * 1024 * 1024) {
                alert('Dung lượng ảnh vượt quá giới hạn 10MB. Vui lòng chọn ảnh nhỏ hơn.');
                return;
            }

            try {
                setIsUploadingImage(true);
                // 2. Gửi API POST /api/upload-image/ với key là "image"
                const res = await postService.uploadContentImage(file);

                if (res.success && res.url) {
                    // 3. Lấy đối tượng Quill editor từ quillRef
                    const quill = quillRef.current?.getEditor();
                    if (quill) {
                        // Xác định vị trí con trỏ chuột hiện tại
                        const range = quill.getSelection(true);
                        const index = range ? range.index : quill.getLength();

                        // 4. Chèn URL tuyệt đối vào đúng vị trí con trỏ chuột
                        quill.insertEmbed(index, 'image', res.url);

                        // Di chuyển con trỏ ra sau bức ảnh vừa chèn
                        quill.setSelection(index + 1);
                    }
                } else {
                    alert(res.message || 'Tải ảnh lên máy chủ thất bại.');
                }
            } catch (error) {
                console.error('Lỗi khi tải ảnh vào bài viết:', error);
                alert('Có lỗi xảy ra khi kết nối máy chủ để tải ảnh lên.');
            } finally {
                setIsUploadingImage(false);
            }
        };
    }, []);

    // Cấu hình Toolbar cho ReactQuill gắn custom imageHandler
    const quillModules = useMemo(() => ({
        toolbar: {
            container: [
                [{ header: [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ list: 'ordered' }, { list: 'bullet' }],
                [{ color: [] }, { background: [] }],
                ['blockquote', 'code-block'],
                ['link', 'image'],
                ['clean'],
            ],
            handlers: {
                image: imageHandler,
            },
        },
    }), [imageHandler]);

    // 1. Tải danh sách bài viết & chuyên mục
    const fetchPosts = async () => {
        setIsLoading(true);
        const params = { all: 1 };
        if (searchTerm) params.q = searchTerm;
        if (categoryFilter !== 'all') params.category = categoryFilter;
        if (statusFilter !== 'all') params.status = statusFilter;

        const res = await postService.getPosts(params);
        if (res.success) {
            setPosts(res.posts || []);
        }
        setIsLoading(false);
    };

    const fetchCategories = async () => {
        const res = await postService.getCategories();
        if (res.success && res.categories) {
            setCategories(res.categories);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchPosts();
    }, [categoryFilter, statusFilter]);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchPosts();
    };

    // 2. Mở form thêm mới
    const handleOpenCreate = () => {
        setSelectedPost(null);
        setFormData({
            title: '',
            slug: '',
            category: categories.length > 0 ? categories[0].value : 'du_lich',
            author: 'Ban Biên Tập',
            status: 'published',
            summary: '',
            content: '',
            thumbnail: null,
        });
        setThumbnailPreview(null);
        setIsAutoSlug(true);
        setIsFormModalOpen(true);
    };

    // 3. Mở form chỉnh sửa
    const handleOpenEdit = async (post) => {
        setSelectedPost(post);
        // Tải chi tiết bài viết (đầy đủ nội dung content)
        const res = await postService.getPostDetail(post.id);
        const detail = res.success && res.post ? res.post : post;

        setFormData({
            title: detail.title || '',
            slug: detail.slug || '',
            category: detail.category || 'du_lich',
            author: detail.author || 'Ban Biên Tập',
            status: detail.status || 'published',
            summary: detail.summary || '',
            content: detail.content || '',
            thumbnail: null,
        });
        setThumbnailPreview(detail.thumbnail_url || detail.thumbnail || null);
        setIsAutoSlug(false);
        setIsFormModalOpen(true);
    };

    // 4. Mở modal xác nhận xóa
    const handleOpenDelete = (post) => {
        setSelectedPost(post);
        setIsDeleteModalOpen(true);
    };

    // 5. Thay đổi tiêu đề -> Tự động sinh Slug nếu isAutoSlug = true
    const handleTitleChange = (e) => {
        const titleVal = e.target.value;
        setFormData((prev) => ({
            ...prev,
            title: titleVal,
            slug: isAutoSlug ? generateVietnameseSlug(titleVal) : prev.slug,
        }));
    };

    // 6. Xử lý tải ảnh preview
    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData((prev) => ({ ...prev, thumbnail: file }));
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleRemoveThumbnail = () => {
        setFormData((prev) => ({ ...prev, thumbnail: null }));
        setThumbnailPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // 7. Submit Form Thêm / Sửa
    const handleSubmitForm = async (e) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            alert('Vui lòng nhập tiêu đề bài viết.');
            return;
        }

        setIsSubmitting(true);
        const postData = new FormData();
        postData.append('title', formData.title.trim());
        postData.append('slug', (formData.slug || generateVietnameseSlug(formData.title)).trim());
        postData.append('category', formData.category);
        postData.append('author', formData.author.trim() || 'Ban Biên Tập');
        postData.append('status', formData.status);
        postData.append('summary', formData.summary.trim());
        postData.append('content', formData.content || '');

        if (formData.thumbnail instanceof File) {
            postData.append('thumbnail', formData.thumbnail);
        }

        let res;
        if (selectedPost) {
            res = await postService.updatePost(selectedPost.id, postData);
        } else {
            res = await postService.createPost(postData);
        }
        setIsSubmitting(false);

        if (res.success) {
            setIsFormModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: selectedPost
                    ? `Đã cập nhật bài viết "${formData.title}" thành công!`
                    : `Tạo bài viết mới "${formData.title}" thành công!`,
            });
            fetchPosts();
            setTimeout(() => setAlertMessage(null), 3500);
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Thao tác bài viết thất bại. Vui lòng thử lại.',
            });
            setTimeout(() => setAlertMessage(null), 4000);
        }
    };

    // 8. Xác nhận xóa bài viết
    const handleConfirmDelete = async () => {
        if (!selectedPost) return;
        setIsSubmitting(true);
        const res = await postService.deletePost(selectedPost.id);
        setIsSubmitting(false);

        if (res.success) {
            setIsDeleteModalOpen(false);
            setAlertMessage({
                type: 'success',
                text: `Đã xóa bài viết "${selectedPost.title}" khỏi hệ thống!`,
            });
            fetchPosts();
            setTimeout(() => setAlertMessage(null), 3500);
        } else {
            setAlertMessage({
                type: 'error',
                text: res.message || 'Không thể xóa bài viết.',
            });
            setTimeout(() => setAlertMessage(null), 3500);
        }
    };

    // Thống kê nhanh
    const totalPosts = posts.length;
    const publishedCount = posts.filter((p) => p.status === 'published').length;
    const draftCount = posts.filter((p) => p.status === 'draft').length;
    const totalViews = posts.reduce((sum, p) => sum + (p.view_count || 0), 0);

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            return new Date(dateStr).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Banner & Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight">
                        Quản Lý Tin Tức & Bài Viết
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Biên soạn các cẩm nang du lịch, ẩm thực, thông báo sự kiện và các gói khuyến mãi đặc quyền cho khách sạn.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={fetchPosts}
                        className="px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <span className={isLoading ? "animate-spin inline-block" : "inline-block"}>🔄</span>
                        <span className="hidden sm:inline">Làm Mới</span>
                    </button>
                    <a
                        href="/news"
                        target="_blank"
                        rel="noreferrer"
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                        title="Xem trang tin tức ngoài website"
                    >
                        <span>🌐</span>
                        <span className="hidden sm:inline">Xem Trang Khách</span>
                    </a>
                    <button
                        type="button"
                        onClick={handleOpenCreate}
                        className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer"
                    >
                        <span>＋</span>
                        <span>Viết Bài Mới</span>
                    </button>
                </div>
            </div>

            {/* Alert Message Toast */}
            {alertMessage && (
                <div
                    className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between shadow-xs transition-all ${
                        alertMessage.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <span>{alertMessage.type === 'success' ? '✓' : '⚠️'}</span>
                        <span>{alertMessage.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAlertMessage(null)}
                        className="text-slate-400 hover:text-slate-700 font-bold ml-4"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                        📰
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tổng bài viết</span>
                        <span className="text-xl font-black text-slate-900 leading-tight">{totalPosts}</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                        🟢
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Đang hiển thị</span>
                        <span className="text-xl font-black text-emerald-600 leading-tight">{publishedCount}</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shrink-0">
                        📝
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Bản nháp</span>
                        <span className="text-xl font-black text-amber-600 leading-tight">{draftCount}</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-xl shrink-0">
                        👁️
                    </div>
                    <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Lượt đọc tin</span>
                        <span className="text-xl font-black text-purple-600 leading-tight">{totalViews.toLocaleString('vi-VN')}</span>
                    </div>
                </div>
            </div>

            {/* Bộ lọc & Tìm kiếm */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
                <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative w-full md:w-96">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm bài viết theo tiêu đề, tác giả..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
                    </div>

                    {/* Filter Dropdowns */}
                    <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="all">Tất cả Chuyên mục</option>
                            {categories.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="all">Tất cả Trạng thái</option>
                            <option value="published">🟢 Hiển thị</option>
                            <option value="draft">🟡 Bản nháp</option>
                        </select>

                        {(searchTerm || categoryFilter !== 'all' || statusFilter !== 'all') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchTerm('');
                                    setCategoryFilter('all');
                                    setStatusFilter('all');
                                    fetchPosts();
                                }}
                                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                            >
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>
                </form>
            </div>

            {/* BẢNG DANH SÁCH BÀI VIẾT (TABLE) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-3 px-4 w-16 text-center">Ảnh</th>
                                <th className="py-3 px-4 min-w-[280px]">Tiêu đề & Tóm tắt</th>
                                <th className="py-3 px-4 whitespace-nowrap">Chuyên mục</th>
                                <th className="py-3 px-4 whitespace-nowrap">Tác giả</th>
                                <th className="py-3 px-4 whitespace-nowrap text-center">Trạng thái</th>
                                <th className="py-3 px-4 whitespace-nowrap text-center">Lượt xem</th>
                                <th className="py-3 px-4 whitespace-nowrap">Ngày đăng</th>
                                <th className="py-3 px-4 text-right whitespace-nowrap">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                        Đang tải dữ liệu bài viết...
                                    </td>
                                </tr>
                            ) : posts.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-slate-500 font-medium">
                                        <div className="text-3xl mb-2">📭</div>
                                        Không tìm thấy bài viết nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                posts.map((post) => (
                                    <tr key={post.id} className="hover:bg-slate-50/60 transition group">
                                        {/* Ảnh bìa */}
                                        <td className="py-3 px-4 text-center">
                                            <div className="w-14 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                                {post.thumbnail_url ? (
                                                    <img
                                                        src={post.thumbnail_url}
                                                        alt={post.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                                    />
                                                ) : (
                                                    <span className="text-base text-slate-400">🖼️</span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Cột Tiêu đề hiển thị chữ in đậm và ngay bên dưới là dòng Tóm tắt màu xám nhạt */}
                                        <td className="py-3 px-4">
                                            <div className="space-y-0.5">
                                                <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition">
                                                    {post.title}
                                                </h3>
                                                <p className="text-[11px] text-slate-400 line-clamp-1">
                                                    {post.summary || 'Chưa có tóm tắt bài viết.'}
                                                </p>
                                                <span className="text-[10px] font-mono text-slate-400 block">
                                                    slug: /{post.slug}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Cột Chuyên mục dùng Badge màu xám bo góc */}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 shadow-2xs">
                                                {post.category_display || post.category}
                                            </span>
                                        </td>

                                        {/* Tác giả */}
                                        <td className="py-3 px-4 whitespace-nowrap text-slate-600 font-medium">
                                            <span className="flex items-center gap-1.5">
                                                <span className="text-slate-400 text-[10px]">✍️</span>
                                                <span>{post.author || 'Ban Biên Tập'}</span>
                                            </span>
                                        </td>

                                        {/* Trạng thái */}
                                        <td className="py-3 px-4 whitespace-nowrap text-center">
                                            {post.status === 'published' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    Hiển thị
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                    Bản nháp
                                                </span>
                                            )}
                                        </td>

                                        {/* Lượt xem */}
                                        <td className="py-3 px-4 whitespace-nowrap text-center font-bold text-slate-700">
                                            {post.view_count || 0}
                                        </td>

                                        {/* Ngày đăng */}
                                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                                            {formatDate(post.created_at)}
                                        </td>

                                        {/* Cột Hành động có nút Sửa và Xóa */}
                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {post.status === 'published' && (
                                                    <a
                                                        href={`/news/${post.slug}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center text-xs transition cursor-pointer"
                                                        title="Xem bài viết trên web khách"
                                                    >
                                                        👁️
                                                    </a>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEdit(post)}
                                                    className="w-7 h-7 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 flex items-center justify-center text-xs transition cursor-pointer"
                                                    title="Chỉnh sửa bài viết"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenDelete(post)}
                                                    className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs transition cursor-pointer"
                                                    title="Xóa bài viết"
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* MODAL THÊM / SỬA BÀI VIẾT (FORM CHIA GRID) */}
            {/* ========================================================================= */}
            {isFormModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-4xl p-6 sm:p-7 shadow-2xl border border-slate-100 my-8">
                        {/* Header Modal */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                                    {selectedPost ? 'CHỈNH SỬA BÀI VIẾT' : 'BIÊN SOẠN BÀI VIẾT MỚI'}
                                </span>
                                <h3 className="text-xl font-bold text-slate-900">
                                    {selectedPost ? `Chỉnh sửa: "${selectedPost.title}"` : 'Thêm Bài Viết Mới Vào Khách Sạn'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFormModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-sm transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmitForm} className="mt-5 space-y-5">
                            {/* HÀNG 1: TIÊU ĐỀ VÀ SLUG */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Tiêu đề bài viết <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={handleTitleChange}
                                        placeholder="Ví dụ: Top 5 Trải Nghiệm Nghỉ Dưỡng Thượng Lưu"
                                        className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-bold text-slate-700">
                                            Đường dẫn tĩnh (Slug SEO) <span className="text-rose-500">*</span>
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const auto = generateVietnameseSlug(formData.title);
                                                setFormData((prev) => ({ ...prev, slug: auto }));
                                                setIsAutoSlug(true);
                                            }}
                                            className="text-[10px] text-blue-600 hover:underline font-semibold"
                                        >
                                            ↻ Tạo lại theo tiêu đề
                                        </button>
                                    </div>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-3 text-xs text-slate-400 font-mono select-none">
                                            /news/
                                        </span>
                                        <input
                                            type="text"
                                            required
                                            value={formData.slug}
                                            onChange={(e) => {
                                                setIsAutoSlug(false);
                                                setFormData({ ...formData, slug: e.target.value });
                                            }}
                                            placeholder="top-5-trai-nghiem-nghi-duong"
                                            className="w-full pl-16 pr-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* HÀNG 2: CHUYÊN MỤC, TÁC GIẢ, TRẠNG THÁI */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Chuyên mục bài viết
                                    </label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                                    >
                                        {categories.map((c) => (
                                            <option key={c.value} value={c.value}>
                                                {c.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Tác giả biên soạn
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.author}
                                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                        placeholder="Ví dụ: Ban Biên Tập, Chef David Trần..."
                                        className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Trạng thái xuất bản
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition cursor-pointer"
                                    >
                                        <option value="published">🟢 Hiển thị (Công khai cho khách xem)</option>
                                        <option value="draft">🟡 Bản nháp (Chỉ nội bộ xem)</option>
                                    </select>
                                </div>
                            </div>

                            {/* ẢNH BÌA: UPLOAD FILE PREVIEW */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Ảnh bìa bài viết (Thumbnail)
                                </label>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-dashed border-slate-200">
                                    {thumbnailPreview ? (
                                        <div className="relative w-36 h-24 rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 group">
                                            <img
                                                src={thumbnailPreview}
                                                alt="Preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRemoveThumbnail}
                                                className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-bold transition"
                                            >
                                                ✕ Xóa ảnh
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-36 h-24 rounded-xl border border-slate-200 bg-white flex flex-col items-center justify-center text-slate-400 shrink-0">
                                            <span className="text-2xl mb-1">🖼️</span>
                                            <span className="text-[10px]">Chưa có ảnh</span>
                                        </div>
                                    )}

                                    <div className="space-y-1.5 flex-1">
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleThumbnailChange}
                                            className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                        />
                                        <p className="text-[11px] text-slate-400">
                                            Hỗ trợ định dạng JPG, PNG, WEBP. Khuyến nghị tỷ lệ 16:9 (khoảng 1200x675px) để bài viết hiển thị đẹp nhất.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* TÓM TẮT NỘI DUNG: DÙNG TEXTAREA */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Tóm tắt nội dung bài viết
                                </label>
                                <textarea
                                    rows={2}
                                    value={formData.summary}
                                    onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                                    placeholder="Tóm tắt ngắn gọn khoảng 1-2 câu để hiển thị trên danh sách bài viết và tối ưu thẻ meta SEO..."
                                    className="w-full px-3.5 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                                />
                            </div>

                            {/* NỘI DUNG CHI TIẾT: SỬ DỤNG REACT-QUILL */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-700">
                                        Nội dung chi tiết bài viết (Rich Text Editor)
                                    </label>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        💡 Ảnh chèn sẽ tự động tải lên máy chủ (không dùng chuỗi Base64)
                                    </span>
                                </div>
                                <div className="relative border border-slate-200 rounded-2xl overflow-hidden bg-white">
                                    {isUploadingImage && (
                                        <div className="absolute inset-0 bg-white/85 backdrop-blur-xs flex items-center justify-center gap-2 z-20 text-xs font-bold text-blue-600">
                                            <span className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
                                            <span>Đang tải ảnh lên máy chủ và chèn vào bài viết...</span>
                                        </div>
                                    )}
                                    <ReactQuill
                                        ref={quillRef}
                                        theme="snow"
                                        value={formData.content}
                                        onChange={(val) => setFormData((prev) => ({ ...prev, content: val }))}
                                        modules={quillModules}
                                        formats={quillFormats}
                                        placeholder="Bắt đầu soạn thảo nội dung chi tiết bài viết, chèn ảnh, đề mục, định dạng văn bản tại đây..."
                                        className="h-72 mb-11"
                                    />
                                </div>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Hủy bỏ
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-600/30 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Đang lưu bài viết...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>✓</span>
                                            <span>{selectedPost ? 'Lưu Thay Đổi' : 'Đăng Bài Viết'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL XÁC NHẬN XÓA BÀI VIẾT */}
            {/* ========================================================================= */}
            {isDeleteModalOpen && selectedPost && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-slate-100 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto">
                            🗑️
                        </div>
                        <div className="text-center space-y-1">
                            <h3 className="text-base font-bold text-slate-900">
                                Xác nhận xóa bài viết?
                            </h3>
                            <p className="text-xs text-slate-500">
                                Bạn có chắc chắn muốn xóa bài viết{' '}
                                <strong className="text-slate-900">"{selectedPost.title}"</strong>? Thao tác này không thể hoàn tác.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={() => setIsDeleteModalOpen(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleConfirmDelete}
                                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                ) : (
                                    <span>Xóa vĩnh viễn</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
