# 🏨 Hệ thống Quản lý Khách sạn TA Đà Nẵng

Đồ án tốt nghiệp: hệ thống quản lý khách sạn (PMS) gồm website đặt phòng cho khách, trang quản trị cho nhân viên và ứng dụng di động cho nhân viên.

## ✨ Tính năng chính

**Khách hàng (website)**
- Xem hạng phòng, tiện nghi, khuyến mãi, tin tức; đặt phòng và thanh toán (VietQR / SePay)
- Đặt phòng đoàn / doanh nghiệp (mã công ty)
- Lịch sử đặt phòng, đặt dịch vụ tại phòng, đánh giá
- Chatbot tư vấn (Google Gemini, có chế độ trả lời dự phòng theo luật)

**Quản trị / Lễ tân**
- Sơ đồ phòng, check-in / check-out, đổi phòng, gia hạn, no-show, walk-in
- Đặt phòng đoàn: rooming list, cọc, check-in / out cả đoàn
- Thanh toán, ca trực lễ tân, phiếu chi tiền mặt, báo cáo ca
- Dịch vụ (Kanban), buồng phòng, bảo trì, minibar, đồ thất lạc
- Báo cáo thống kê, thông báo, nhật ký hoạt động (audit log)
- Quản lý nhân viên, khách hàng, ma trận phân quyền theo vai trò (`admin`, `owner`, `manager`, `receptionist`, `guest`)

## 🧱 Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Backend | Python, Django 6, Django REST Framework, SimpleJWT, MySQL |
| Frontend | React 19, Vite, Ant Design, Tailwind CSS, Recharts |
| Mobile (nhân viên) | Expo / React Native (expo-router) |
| Tích hợp | SePay (webhook thanh toán), Gmail SMTP, Google Gemini |

## 📁 Cấu trúc thư mục

```
DATN_Quanlykhachsan/
├── backend/                 # Django REST API
│   ├── core_project/        # settings, urls, pagination
│   ├── apps/
│   │   ├── users/           # tài khoản, phân quyền, audit log
│   │   ├── bookings/        # đặt phòng, đặt đoàn, chatbot, email
│   │   ├── rooms/           # phòng, bảo trì, minibar, đồ thất lạc
│   │   ├── payments/        # thanh toán, webhook, ca trực, phiếu chi
│   │   ├── services/        # dịch vụ và yêu cầu dịch vụ
│   │   ├── notifications/   # thông báo, push
│   │   ├── reports/         # báo cáo thống kê
│   │   ├── reviews/  posts/  contacts/
│   └── utils/
├── frontend/                # Website khách + trang quản trị (React + Vite)
└── mobile_staff/            # Ứng dụng di động cho nhân viên (Expo)
```

Các module lớn trong backend được tách thành package để dễ bảo trì, ví dụ `bookings/views/`, `bookings/group_views/`, `bookings/chatbot_views/`, `bookings/email_service/`, `rooms/views/`, `payments/views/`, `services/views/`, `users/views/`. Mỗi package có `__init__.py` export lại tên cũ nên `from .views import ...` vẫn dùng được.

## 🚀 Cài đặt và chạy

### Yêu cầu
- Python 3.12+
- Node.js 20+
- MySQL (ví dụ XAMPP) và công cụ build cho `mysqlclient`

### 1. Backend

```bash
# Tạo database trong MySQL
CREATE DATABASE ta_hotel_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r backend\requirements.txt

cd backend
copy .env.example .env      # rồi điền giá trị thật vào .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

Thông tin kết nối MySQL (mặc định `root`, không mật khẩu, `127.0.0.1:3306`) nằm trong `backend/core_project/settings.py`. Hãy chỉnh cho đúng máy của bạn.

Biến môi trường trong `backend/.env`:

| Biến | Ý nghĩa |
|---|---|
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD` | Tài khoản Gmail và App Password để gửi email |
| `GEMINI_API_KEY` | API key Google Gemini cho chatbot |
| `SEPAY_WEBHOOK_SECRET` | Khóa xác thực webhook SePay |

### 2. Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # build production
```

Mặc định frontend gọi API tại `http://<hostname>:8000`. Có thể đổi bằng biến `VITE_API_URL` hoặc `VITE_BACKEND_URL` trong `frontend/.env`.

### 3. Mobile (nhân viên)

```bash
cd mobile_staff
npm install
npx expo start
```

## 🔌 Nhóm API chính

| Prefix | Chức năng |
|---|---|
| `/api/auth/`, `/api/users/` | Đăng nhập, đăng ký, hồ sơ, nhân viên, khách, vai trò |
| `/api/rooms/` | Hạng phòng, phòng, bảo trì, minibar, đồ thất lạc |
| `/api/bookings/` | Đặt phòng, đặt đoàn, khuyến mãi, cài đặt khách sạn |
| `/api/payments/` | Thanh toán, ca trực, phiếu chi |
| `/api/services/`, `/api/service-requests/` | Dịch vụ và yêu cầu dịch vụ |
| `/api/notifications/`, `/api/reports/`, `/api/reviews/`, `/api/posts/`, `/api/contacts/` | Phần còn lại |
| `/api/chatbot/ask/` | Chatbot |
| `/api/webhooks/sepay/` | Webhook thanh toán SePay |

## 🔒 Lưu ý bảo mật

- **Không commit** file `backend/.env`, `db.sqlite3`, thư mục `media/` (đã nằm trong `.gitignore`).
- `SECRET_KEY`, `DEBUG = True`, `ALLOWED_HOSTS = ['*']`, `CORS_ALLOW_ALL_ORIGINS = True` trong `settings.py` chỉ phù hợp khi phát triển. Cần đổi trước khi triển khai thật.

## 📄 Giấy phép

Dự án phục vụ mục đích học tập (đồ án tốt nghiệp).

