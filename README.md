# 🏨 Hệ Thống Quản Lý Khách Sạn TA Đà Nẵng (TA Hotel Management System - PMS)

> **Đồ Án Tốt Nghiệp**  
> **Đề tài**: Xây dựng Hệ sinh thái Quản lý Khách sạn Đa nền tảng (Property Management System) tích hợp Trợ lý ảo AI & Thanh toán tự động thời gian thực.  
> **Kiến trúc**: Monorepo gồm **Web Khách hàng (Client Portal)**, **Web Quản trị Khách sạn (Admin / PMS Web)** và **Ứng dụng Di động Nhân viên (Mobile Staff App)**.

---

## 📌 Mục Lục

1. [Tổng Quan Hệ Sinh Thái](#-tổng-quan-hệ-sinh-thái)
2. [Kiến Trúc & Công Nghệ Sử Dụng](#-kiến-trúc--công-nghệ-sử-dụng)
3. [Phân Hệ & Danh Sách Tính Năng Nghiệp Vụ](#-phân-hệ--danh-sách-tính-năng-nghiệp-vụ)
   - [1. Cổng Khách Hàng (Client Portal)](#1-cổng-khách-hàng-client-portal)
   - [2. Hệ Thống Quản Trị & Lễ Tân (Admin PMS Web)](#2-hệ-thống-quản-trị--lễ-tân-admin-pms-web)
   - [3. Ứng Dụng Di Động Cho Nhân Viên (Mobile Staff App)](#3-ứng-dụng-di-động-cho-nhân-viên-mobile-staff-app)
4. [Cấu Trúc Thư Mục Dự Án](#-cấu-trúc-thư-mục-dự-án)
5. [Hướng Dẫn Cài Đặt & Chạy Môi Trường Local](#-hướng-dẫn-cài-đặt--chạy-môi-trường-local)
6. [Cấu Hình Biến Môi Trường (.env)](#-cấu-hình-biến-môi-trường-env)
7. [Tích Hợp Bên Thứ Ba](#-tích-hợp-bên-thứ-ba)
8. [Triển Khai Cloud & CI/CD (Railway)](#-triển-khai-cloud--cicd-railway)
9. [Danh Mục RESTful API Chính](#-danh-mục-restful-api-chính)
10. [Tài Khoản Dùng Thử Mẫu (Demo Accounts)](#-tài-khoản-dùng-thử-mẫu-demo-accounts)

---

## 🌐 Tổng Quan Hệ Sinh Thái

Hệ thống Quản lý Khách sạn TA Đà Nẵng được thiết kế nhằm số hóa toàn diện quy trình vận hành khách sạn 4-5 sao, loại bỏ thao tác thủ công, liên kết liền mạch giữa khách lưu trú, bộ phận tiếp đón lễ tân và nhân viên hiện trường (buồng phòng, bảo trì, F&B, vận chuyển).

```
                            ┌──────────────────────────────────────────────┐
                            │      HỆ THỐNG QUẢN LÝ KHÁCH SẠN TA ĐÀ NẴNG   │
                            └──────────────────────┬───────────────────────┘
                                                   │
         ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
         │                                         │                                         │
         ▼                                         ▼                                         ▼
┌──────────────────┐                     ┌──────────────────┐                     ┌──────────────────┐
│   CLIENT WEB     │                     │    ADMIN PMS     │                     │   MOBILE STAFF   │
│ (Khách Đặt Phòng)│                     │(Lễ Tân & Quản Lý)│                     │(Nhân Viên Nghiệp Vụ)│
└────────┬─────────┘                     └────────┬─────────┘                     └────────┬─────────┘
         │                                         │                                         │
         └─────────────────────────────────────────┼─────────────────────────────────────────┘
                                                   │ RESTful API / JSON / Webhook
                                                   ▼
                                  ┌──────────────────────────────────┐
                                  │       BACKEND API (DJANGO REST)  │
                                  │  - Core Logic & State Machines   │
                                  │  - AI Chatbot Engine (Gemini)    │
                                  │  - Webhook Processor (SePay)     │
                                  └────────────────┬─────────────────┘
                                                   │
                      ┌────────────────────────────┼────────────────────────────┐
                      ▼                            ▼                            ▼
             ┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
             │ MySQL Database   │         │ SePay / VietQR   │         │ Google Gemini AI │
             │ (Data Storage)   │         │ (Auto Payment)   │         │ (Chatbot 24/7)   │
             └──────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## 🧱 Kiến Trúc & Công Nghệ Sử Dụng

| Thành Phần | Công Nghệ & Thư Viện Chính | Mô Tả |
|---|---|---|
| **Backend API** | **Python 3.12**, **Django 6**, **Django REST Framework (DRF)** | Kiến trúc ứng dụng phân tầng (Modular Apps), xác thực JWT (`rest_framework_simplejwt`), mã hóa bảo mật, phân trang tự động, xử lý giao dịch cơ sở dữ liệu ACID. |
| **Cơ sở dữ liệu** | **MySQL 8.0+** / **PyMySQL** / `mysqlclient` | Bảng quan hệ chuẩn hóa 3NF, lưu trữ cấu hình khách sạn, lịch sử phòng, hóa đơn và nhật ký kiểm toán (Audit Logs). |
| **Frontend Web** | **React 19**, **Vite 6+**, **Tailwind CSS v4**, **Ant Design**, **Lucide Icons** | Giao diện Single Page Application (SPA), tối ưu hiệu năng render, quản trị trạng thái toàn cục với Zustand/Context API, hiển thị biểu đồ phân tích trực quan với **Recharts**. |
| **Mobile App** | **React Native**, **Expo SDK 52+**, **Expo Router (File-based Routing)**, **TypeScript** | Ứng dụng di động dành cho nhân viên phục vụ, hỗ trợ xử lý hàng đợi ngoại tuyến (Offline Queue), thông báo thời gian thực, tích hợp camera & haptics. |
| **AI Assistant** | **Google Gemini API** (`gemini-1.5-flash` / Generative AI) | Trợ lý ảo tư vấn đặt phòng tự động, đọc hiểu ngữ cảnh khách sạn, tích hợp cơ chế Rule-based Fallback đảm bảo hoạt động liên tục 100%. |
| **Cổng Thanh Toán** | **VietQR** (Chuẩn Napas247) & **SePay Webhook** | Tạo mã QR thanh toán động theo đơn phòng, tự động đối soát giao dịch ngân hàng theo thời gian thực (Real-time Webhook & Polling). |
| **Cloud & DevOps** | **Railway Cloud PaaS**, **Gunicorn**, **WhiteNoise**, **Nixpacks/Railpack** | Tự động hóa quy trình CI/CD từ GitHub repo `main`, cấp phát SSL HTTPS tự động, tối ưu phân phối tài nguyên tĩnh. |

---

## 🌟 Phân Hệ & Danh Sách Tính Năng Nghiệp Vụ

### 1. Cổng Khách Hàng (Client Portal)
* **Khám Phá & Tra Cứu Phòng**: Xem danh mục hạng phòng (Standard, Superior, Deluxe, Suite, Presidential Suite) với hình ảnh sắc nét, danh sách tiện nghi, chính sách hủy phòng, sức chứa tối đa.
* **Đặt Phòng Cá Nhân (B2C Booking)**: Kiểm tra tình trạng phòng trống theo thời gian thực (Check-in / Check-out), áp dụng mã giảm giá / khuyến mãi (Coupon/Voucher), tự động tính toán thuế VAT và phí dịch vụ.
* **Đặt Phòng Đoàn & Doanh Nghiệp (Corporate B2B Booking)**:
  * Nhập mã đối tác doanh nghiệp (**Corporate Code**) để kích hoạt mức chiết khấu độc quyền theo hợp đồng đã ký kết.
  * Tùy chọn linh hoạt số lượng cho nhiều hạng phòng khác nhau trong một đơn hàng lớn.
  * **Tính năng Dán nhanh từ Excel / Clipboard**: Cho phép sao chép danh sách nhân sự từ Excel/Google Sheets rồi dán (`Ctrl + V`) vào hệ thống; hệ thống tự động bóc tách **Họ tên**, **Số CCCD/Hộ chiếu**, **Giới tính**, **Ngày sinh (dd/mm/yyyy)** và tự động chia đều vào các phòng theo đúng sức chứa tối đa (`capacity`).
  * Tùy chọn xuất Hóa đơn GTGT (VAT) điện tử gửi về email kế toán công ty.
  * Lựa chọn chính sách chi trả phát sinh tại phòng: *Khách tự trả (Room Only)* hoặc *Công ty bao trọn gói (All Inclusive)*.
  * Linh hoạt hình thức thanh toán: *Đặt cọc 50%* hoặc *Thanh toán toàn bộ 100%*.
* **Thanh Toán Tức Thì Qua VietQR**: Hệ thống tạo mã QR động chứa sẵn số tài khoản, số tiền và mã nội dung chuyển khoản duy nhất; tự động bắt tín hiệu thanh toán qua webhook trong vòng 3 giây mà không cần nhân viên can thiệp.
* **Trợ Lý Ảo AI Chatbot (Gemini)**: Trò chuyện và tư vấn bằng ngôn ngữ tự nhiên, gợi ý phòng trống, báo giá, hướng dẫn tiện ích khách sạn, hỗ trợ 24/7.
* **Cổng Thông Tin & Dịch Vụ Khách Lưu Trú**:
  * Tra cứu lịch sử đặt phòng, xem chi tiết hóa đơn điện tử.
  * Đặt dịch vụ trực tuyến tại phòng (Room Service): Menu ẩm thực F&B, đồ uống, đặt lịch Spa & Massage, đặt xe đưa đón sân bay.
  * Đánh giá và chấm điểm sao (Reviews & Feedback) sau khi hoàn tất kỳ nghỉ.

---

### 2. Hệ Thống Quản Trị & Lễ Tân (Admin PMS Web)
* **Bảng Điều Khiển Tổng Quan (Executive Dashboard)**:
  * Thống kê trực quan: Doanh thu thực tế, Doanh thu dự kiến, Tỷ lệ lấp đầy phòng (Occupancy Rate), Giá phòng bình quân (ADR), Doanh thu trên mỗi phòng sẵn có (RevPAR).
  * Biểu đồ doanh thu theo tuần/tháng/năm, tỷ lệ cơ cấu nguồn khách (Vãng lai, Đặt trước, Khách đoàn).
* **Sơ Đồ Phòng Trực Quan (Room Matrix & Timeline)**:
  * Trực quan hóa toàn bộ số phòng khách sạn theo từng tầng.
  * Mã màu trạng thái tiêu chuẩn: `Trống sạch`, `Trống bẩn`, `Đang có khách`, `Đã đặt trước`, `Đang bảo trì/Khóa`, `Quá giờ trả phòng`.
  * Thao tác 1-click: Xem chi tiết phòng, nhận phòng nhanh, đổi phòng, dọn phòng, xem lịch sử khách lưu trú.
* **Tiếp Đón Tại Quầy & Đặt Phòng (Front Desk & Walk-in)**:
  * Tiếp đón khách vãng lai (Walk-in) nhận phòng tức thì hôm nay và Đặt phòng giữ chỗ trước trong tương lai.
  * Tự động tra cứu hồ sơ khách hàng cũ (Guest Profile) theo Số điện thoại hoặc CCCD/Hộ chiếu để tự điền dữ liệu.
  * **Thanh Tìm Kiếm & Lọc Danh Mục Dịch Vụ Thông Minh**: Tích hợp thanh tìm kiếm tức thì theo từ khóa, các nút lọc danh mục (`Ẩm thực`, `Spa`, `Đưa đón`, `Tiện ích`), gợi ý 1-click thêm nhanh dịch vụ vào phòng mà không bị che khuất màn hình.
* **Nghiệp Vụ Lễ Tân Chuyên Sâu**:
  * Check-in / Check-out đơn lẻ và theo đoàn.
  * Đổi phòng cho khách (Room Move) với lý do và cập nhật folio tức thì.
  * Gia hạn thời gian lưu trú (Extend Stay).
  * Xử lý khách không đến (No-show) và hoàn/hủy cọc theo quy định.
  * Tự động tính phụ thu Check-in sớm và Check-out trễ theo cấu hình cài đặt của khách sạn.
* **Quản Lý Đặt Phòng Đoàn (Corporate & Group Management)**:
  * Quản lý Master Folio chung cho toàn đoàn, tách hóa đơn lẻ cho từng phòng khi có yêu cầu.
  * Quản lý danh sách thành viên đoàn (Rooming List), hỗ trợ tính năng dán nhanh từ file Excel cho toàn đoàn hoặc từng phòng riêng lẻ.
  * Quản lý công nợ và tiền đặt cọc đoàn.
* **Quản Lý Ca Trực & Két Tiền Lễ Tân (Shift & Cash Management)**:
  * Mở ca trực, bàn giao ca, đối soát số dư tiền mặt đầu ca và cuối ca.
  * Lập Phiếu Chi tiền mặt tại quầy (Payout Voucher) phục vụ hoàn tiền cọc, chi phí khẩn cấp, mua vật phẩm phục vụ khách.
  * In và xuất biên bản tổng kết bàn giao ca trực.
* **Quản Lý Dịch Vụ & Điều Phối F&B (Service Request Kanban)**:
  * Bảng Kanban trực quan theo các cột: `Chờ tiếp nhận` $\rightarrow$ `Đang chuẩn bị` $\rightarrow$ `Đang phục vụ` $\rightarrow$ `Đã hoàn thành` $\rightarrow$ `Đã hủy`.
  * Tự động kết chuyển chi phí vào Hóa đơn (Folio) của phòng tương ứng.
* **Quản Lý Buồng Phòng & Bảo Trì (Housekeeping & Maintenance)**:
  * Danh sách phân công dọn buồng, theo dõi tiến độ dọn phòng sạch/bẩn.
  * Lập phiếu báo hỏng trang thiết bị trong phòng, phân công kỹ thuật viên sửa chữa, ghi nhận chi phí vật tư thay thế.
* **Quản Lý Minibar & Đồ Thất Lạc (Lost & Found)**:
  * Danh mục vật phẩm Minibar từng phòng, kiểm kê lượng tiêu thụ khi khách làm thủ tục trả phòng.
  * Lập biên bản tiếp nhận đồ thất lạc của khách (hình ảnh, vị trí tìm thấy, thời gian), theo dõi quy trình bàn giao hoàn trả.
* **Báo Cáo Thống Kê & Tài Chính (Analytics & Reports)**:
  * Báo cáo doanh thu tiền phòng, doanh thu dịch vụ, báo cáo công nợ đối tác doanh nghiệp.
  * **Tính năng Xuất Báo Cáo Sang Excel (CSV)**: Tích hợp mã hóa UTF-8 BOM chuẩn hiển thị tiếng Việt có dấu 100%, bảo đảm không lỗi font trên Microsoft Excel.
* **Quản Lý Nhân Sự & Phân Quyền Ma Trận (RBAC)**:
  * Phân quyền nghiêm ngặt theo vai trò: `Quản trị viên (Admin)`, `Chủ khách sạn (Owner)`, `Quản lý (Manager)`, `Lễ tân (Receptionist)`, `Nhân viên buồng phòng/Kỹ thuật`, `Khách hàng (Guest)`.
  * **Nhật Ký Kiểm Toán Hệ Thống (Audit Logs)**: Ghi vết chi tiết mọi hành vi tạo, sửa, xóa, hủy phòng, giao dịch tài chính kèm IP, thời gian và người thực hiện.

---

### 3. Ứng Dụng Di Động Cho Nhân Viên (Mobile Staff App)
Ứng dụng di động chuyên dụng phát triển trên nền tảng **React Native / Expo**, kết nối trực tiếp với backend Cloud, cung cấp không gian làm việc di động cho nhân viên hiện trường:

1. **Tab Buồng Phòng (Housekeeping)**:
   * Xem danh sách các phòng cần dọn dẹp theo tầng và mức độ ưu tiên (khách sắp check-in, khách đang ở).
   * Chuyển trạng thái phòng tức thì: `Bẩn` $\rightarrow$ `Đang dọn` $\rightarrow$ `Đã sạch` $\rightarrow$ `Sẵn sàng đón khách`.
   * Ghi nhận tiêu thụ đồ uống Minibar trực tiếp ngay tại phòng.
2. **Tab Dịch Vụ & F&B (Services)**:
   * Tiếp nhận thông báo đơn gọi món hoặc dịch vụ phòng từ khách hàng.
   * Tính năng gom nhóm xe đẩy F&B theo tầng, hẹn giờ SLA phục vụ, xử lý hàng đợi ngoại tuyến (Offline Queue) khi mất sóng Wi-Fi trong thang máy.
3. **Tab Kỹ Thuật & Bảo Trì (Maintenance)**:
   * Tiếp nhận các phiếu báo hỏng thiết bị từ Lễ tân hoặc Buồng phòng.
   * Chụp ảnh hiện trạng trước/sau khi sửa chữa và cập nhật trạng thái hoàn thành.
4. **Tab Đồ Thất Lạc (Lost & Found)**:
   * Chụp ảnh vật phẩm khách để quên, lưu trữ thông tin phòng và chuyển biên bản về bộ phận Lễ tân xử lý.
5. **Tab Đội Xe Vận Chuyển (Transport)**:
   * Lịch trình xe đưa đón sân bay (Maybach / Limousine), thông tin chuyến bay và danh sách hành khách đón tiễn.
6. **Tab Cá Nhân & Cấu Hình Máy Chủ (Profile & Server Config)**:
   * Xem thông tin ca trực cá nhân.
   * Cho phép linh hoạt chuyển đổi URL API máy chủ giữa Local Development và Cloud Production Railway ngay trên ứng dụng.

---

## 📁 Cấu Trúc Thư Mục Dự Án

```
DATN_Quanlykhachsan/
├── backend/                                # Phân hệ Backend API (Django REST Framework)
│   ├── core_project/                       # Cấu hình dự án trung tâm
│   │   ├── settings.py                     # Thiết lập Database, CORS, JWT, Logging, Railway
│   │   ├── urls.py                         # Điều hướng URL chính của toàn bộ hệ thống
│   │   ├── wsgi.py / asgi.py
│   │   └── pagination.py                   # Cấu hình phân trang chuẩn hóa
│   ├── apps/                               # Các Module chức năng nghiệp vụ (Pluggable Apps)
│   │   ├── users/                          # Quản lý tài khoản, phân quyền RBAC, Audit Log
│   │   ├── rooms/                          # Hạng phòng, phòng, tiện nghi, bảo trì, minibar, đồ thất lạc
│   │   ├── bookings/                       # Đặt phòng cá nhân, đặt đoàn, rooming list, chatbot, email
│   │   │   ├── views/                      # Tách module views xử lý đặt phòng cá nhân
│   │   │   ├── group_views/                # Xử lý đặt phòng đoàn & đối tác doanh nghiệp
│   │   │   ├── chatbot_views/              # Xử lý hội thoại AI Gemini & rule-based
│   │   │   └── email_service/              # Dịch vụ gửi email thông báo tự động
│   │   ├── payments/                       # Thanh toán VietQR, SePay Webhook, ca trực, phiếu chi
│   │   ├── services/                       # Quản lý dịch vụ khách sạn & yêu cầu gọi món Kanban
│   │   ├── notifications/                  # Hệ thống thông báo thời gian thực
│   │   ├── reports/                        # Báo cáo thống kê doanh thu, RevPAR, ADR, xuất Excel
│   │   ├── reviews/                        # Đánh giá & phản hồi từ khách hàng
│   │   ├── posts/                          # Tin tức, cẩm nang du lịch, bài viết blog
│   │   └── contacts/                       # Tiếp nhận và xử lý liên hệ từ khách
│   ├── requirements.txt                    # Danh sách thư viện Python
│   ├── railway.json / nixpacks.toml        # Cấu hình triển khai tự động lên Railway Cloud
│   └── manage.py
│
├── frontend/                               # Phân hệ Web Khách Hàng & Quản Trị (React 19 + Vite)
│   ├── src/
│   │   ├── components/                     # Các UI Component tái sử dụng
│   │   │   ├── admin/                      # Component quản trị, biểu đồ, bảng biểu
│   │   │   │   └── modals/                 # Hệ thống Modal nghiệp vụ (Booking, Group, Walk-in, Check-in...)
│   │   │   ├── client/                     # Component trang khách (HeroBanner, Confirmation, Modal...)
│   │   │   └── layout/                     # Navbar, Footer, Sidebar điều hướng
│   │   ├── pages/                          # Các trang màn hình giao diện
│   │   │   ├── client/                     # Home, Rooms, DetailRoom, CorporateBooking, Checkout, Profile...
│   │   │   ├── admin/                      # Dashboard, BookingManagement, RoomManagement, Analytics...
│   │   │   └── auth/                       # Trang đăng nhập, đăng ký
│   │   ├── services/                       # Lớp gọi API tập trung qua Axios (api.js, roomService, bookingService...)
│   │   ├── store/                          # Quản lý State toàn cục (authStore, hotelSettingStore...)
│   │   └── utils/                          # Hàm tiện ích format tiền tệ, ngày tháng, media URL
│   ├── package.json
│   ├── vite.config.js                      # Cấu hình Vite build & proxy
│   └── railway.json                        # Cấu hình triển khai Frontend lên Railway
│
└── mobile_staff/                           # Phân hệ Ứng Dụng Di Động Nhân Viên (React Native + Expo)
    ├── src/
    │   ├── app/                            # File-based routing (Expo Router)
    │   │   ├── (tabs)/                     # 6 Tab chức năng: housekeeping, services, maintenance, lost_found, transport, profile
    │   │   ├── login.tsx                   # Màn hình đăng nhập nhân viên
    │   │   └── _layout.tsx
    │   ├── api/                            # Cấu hình kết nối API & Network Interceptor (config.ts)
    │   └── components/                     # Component giao diện di động
    ├── package.json
    └── app.json                            # Cấu hình Expo Project & App Permissions
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Môi Trường Local

### Yêu Cầu Tiên Quyết
* **Python**: Phiên bản 3.12 trở lên.
* **Node.js**: Phiên bản 20 trở lên (khuyên dùng LTS) & npm.
* **Cơ sở dữ liệu**: MySQL 8.0+ (hoặc qua XAMPP / WampServer / Docker MySQL).

---

### Bước 1: Khởi Tạo Cơ Sở Dữ Liệu MySQL
Mở MySQL Command Line hoặc phpMyAdmin và tạo database mới:
```sql
CREATE DATABASE ta_hotel_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

### Bước 2: Cài Đặt & Chạy Backend (Django API)

1. **Mở terminal tại thư mục gốc và kích hoạt môi trường ảo Python**:
   ```powershell
   # Tạo môi trường ảo
   python -m venv venv

   # Kích hoạt môi trường ảo (Windows PowerShell)
   venv\Scripts\activate
   # Hoặc trên Linux/macOS:
   # source venv/bin/activate
   ```

2. **Cài đặt các gói phụ thuộc**:
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Cấu hình file môi trường**:
   ```powershell
   cd backend
   copy .env.example .env    # Trên Linux/macOS: cp .env.example .env
   ```
   *Mở file `.env` vừa tạo và điền các thông tin kết nối MySQL, Secret Key và Email.*

4. **Chạy Migration & Tạo tài khoản Superuser**:
   ```bash
   python manage.py migrate
   python manage.py createsuperuser
   ```

5. **Khởi chạy máy chủ Backend**:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```
   *Backend API sẵn sàng tại: `http://localhost:8000` (Swagger / Django Admin tại: `http://localhost:8000/admin`).*

---

### Bước 3: Cài Đặt & Chạy Frontend (React + Vite)

1. **Mở terminal mới, điều hướng vào thư mục `frontend`**:
   ```bash
   cd frontend
   npm install
   ```

2. **Tạo file cấu hình môi trường**:
   ```powershell
   copy .env.example .env    # Trên Linux/macOS: cp .env.example .env
   ```
   *(Mặc định frontend tự trỏ về `http://localhost:8000/api` khi chạy local).*

3. **Khởi chạy máy chủ phát triển (Development Server)**:
   ```bash
   npm run dev
   ```
   *Website sẵn sàng tại: `http://localhost:5173`.*

---

### Bước 4: Cài Đặt & Khởi Chạy Mobile App (Staff)

1. **Mở terminal mới, điều hướng vào thư mục `mobile_staff`**:
   ```bash
   cd mobile_staff
   npm install
   ```

2. **Khởi chạy ứng dụng với Expo**:
   ```bash
   npx expo start
   ```
   * Dùng điện thoại quét mã QR bằng ứng dụng **Expo Go** (Android/iOS) để trải nghiệm thực tế.
   * Hoặc nhấn phím `w` để mở xem nhanh trên trình duyệt web.

---

## ⚙️ Cấu Hình Biến Môi Trường (.env)

### Backend (`backend/.env`)
```ini
# Cấu hình Django
SECRET_KEY=django-insecure-your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=*

# Kết nối Cơ sở dữ liệu MySQL (Mặc định XAMPP)
DB_NAME=ta_hotel_db
DB_USER=root
DB_PASSWORD=
DB_HOST=127.0.0.1
DB_PORT=3306

# Cấu hình CORS & Frontend
FRONTEND_URL=http://localhost:5173
CORS_ALLOW_ALL_ORIGINS=True

# Tích hợp Email thông báo (Gmail App Password)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-16-char-app-password

# Trợ lý ảo AI Google Gemini
GEMINI_API_KEY=AIzaSy...your-gemini-api-key

# Cổng thanh toán SePay Webhook
SEPAY_WEBHOOK_SECRET=your-sepay-secret-token
```

### Frontend (`frontend/.env`)
```ini
VITE_API_URL=http://localhost:8000/api
VITE_BACKEND_URL=http://localhost:8000
```

---

## 🔌 Tích Hợp Bên Thứ Ba

### 1. Cổng Thanh Toán Ngân Hàng Tự Động (VietQR & SePay Webhook)
* **Luồng hoạt động**:
  1. Khi khách nhấn xác nhận đặt phòng, frontend tạo mã QR chuẩn VietQR (chứa Số tài khoản ngân hàng, Số tiền, và Mã giao dịch duy nhất `BK...` hoặc `GRP...`).
  2. Khách mở ứng dụng ngân hàng bất kỳ (Vietcombank, MBBank, Techcombank...) quét mã và chuyển tiền.
  3. Cổng SePay nhận biến động số dư và bắn Webhook `POST /api/payments/webhook/sepay/` về hệ thống.
  4. Hệ thống kiểm tra chữ ký xác thực (`SEPAY_WEBHOOK_SECRET`), đối soát mã hóa đơn, tự động chuyển trạng thái đơn sang **ĐÃ THANH TOÁN (CONFIRMED/PAID)** và gửi email thông báo xác nhận thành công cho khách hàng ngay lập tức.

### 2. Trợ Lý Ảo Google Gemini AI
* Sử dụng mô hình `gemini-1.5-flash` được fine-tune prompt với dữ liệu chuyên ngành khách sạn.
* Hỗ trợ giải đáp: thông tin phòng, tiện nghi, quy định nhận/trả phòng, giá dịch vụ, chính sách cọc.
* Tích hợp bộ quy tắc dự phòng (Rule-based Fallback) tự động trả lời các câu hỏi phổ biến khi đường truyền API quốc tế gặp sự cố.

### 3. Dịch Vụ Thông Báo Email Tự Động (Gmail SMTP)
* Tự động gửi email xác nhận đặt phòng thành công kèm mã QR Check-in.
* Gửi hợp đồng đặt phòng đoàn và thông tin xuất hóa đơn VAT điện tử.
* Thông báo nhắc lịch nhận phòng trước ngày đến 24 giờ.

---

## ☁️ Triển Khai Cloud & CI/CD (Railway)

Hệ thống được cấu hình sẵn sàng triển khai trên nền tảng **Railway Cloud** theo mô hình Monorepo:

* **Backend Service**:
  * Sử dụng builder **RAILPACK** kết hợp file `backend/railway.json`.
  * Khởi chạy qua Gunicorn: `gunicorn core_project.wsgi:application --bind 0.0.0.0:$PORT --workers 3`.
  * Tự động nhận diện biến môi trường MySQL Database nội bộ của Railway (`MYSQL_URL`).
* **Frontend Service**:
  * Cấu hình qua `frontend/railway.json`.
  * Lệnh build: `npm run build`, phục vụ qua static server: `npm run start`.
* **Quy trình CI/CD tự động**:
  * Bất kỳ commit nào được đẩy lên nhánh `main` của kho lưu trữ GitHub sẽ tự động kích hoạt tiến trình Build & Deploy trên Railway trong khoảng 1-2 phút mà không làm gián đoạn hệ thống.

---

## 📡 Danh Mục RESTful API Chính

| Nhóm API | Endpoint Prefix | Nghiệp Vụ Chính |
|---|---|---|
| **Xác thực & Người dùng** | `/api/auth/`, `/api/users/` | Đăng ký, Đăng nhập JWT, Quản lý hồ sơ cá nhân, Danh sách nhân viên, Khách hàng, Phân quyền vai trò |
| **Hạng phòng & Phòng** | `/api/rooms/` | Danh mục hạng phòng, Danh sách phòng, Tình trạng buồng phòng, Phiếu bảo trì thiết bị, Quản lý đồ thất lạc |
| **Đặt phòng & Khách đoàn** | `/api/bookings/` | Kiểm tra phòng trống, Đặt phòng lẻ, Đặt phòng đoàn (`/group/`), Rooming List, Check-in / Check-out, Hủy phòng, Đổi phòng, Gia hạn |
| **Thanh toán & Thu chi** | `/api/payments/` | Cấu hình VietQR ngân hàng, Quản lý ca trực lễ tân (`/shifts/`), Lập phiếu chi tiền mặt (`/payouts/`), Webhook SePay |
| **Dịch vụ & Tiện ích** | `/api/services/`, `/api/service-requests/` | Danh mục dịch vụ/món ăn, Bảng điều phối yêu cầu dịch vụ phòng (Kanban), Kiểm kê Minibar |
| **Báo cáo & Thống kê** | `/api/reports/` | Doanh thu, RevPAR, ADR, Công suất buồng phòng, Xuất báo cáo tài chính ra file Excel (CSV UTF-8 BOM) |
| **Trợ lý ảo AI** | `/api/chatbot/ask/` | Nhận câu hỏi từ khách hàng, phân tích ngữ cảnh và trả lời tư vấn phòng/dịch vụ qua Google Gemini |
| **Marketing & Tương tác** | `/api/promotions/`, `/api/posts/`, `/api/reviews/`, `/api/contacts/` | Quản lý mã giảm giá Voucher, Bài viết cẩm nang du lịch, Đánh giá sao của khách hàng, Form liên hệ |
| **Cài đặt Khách sạn** | `/api/hotel-settings/` | Cấu hình giờ check-in/out quy định, tỷ lệ cọc đoàn, thuế VAT, phí dịch vụ |

---

## 👥 Tài Khoản Dùng Thử Mẫu (Demo Accounts)

Sau khi chạy lệnh `python manage.py migrate` và nhập dữ liệu mẫu (hoặc tạo qua trang Quản trị), bạn có thể sử dụng các tài khoản demo sau:

| Vai Trò | Tên Đăng Nhập / Email | Quyền Hạn Nghiệp Vụ |
|---|---|---|
| **Quản Trị Viên (Admin)** | `admin` | Toàn quyền kiểm soát hệ thống, cấu hình khách sạn, phân quyền nhân sự, xem toàn bộ báo cáo doanh thu & audit logs |
| **Quản Lý (Manager)** | `manager` | Quản lý vận hành phòng, duyệt đơn đặt đoàn, kiểm tra ca trực lễ tân, quản lý chương trình khuyến mãi |
| **Lễ Tân (Receptionist)** | `receptionist` | Xem sơ đồ phòng, check-in, check-out, tiếp đón khách walk-in, đổi phòng, lập phiếu chi, thu tiền ca trực |
| **Nhân Viên Buồng Phòng** | `housekeeper` | Đăng nhập trên Mobile App để nhận nhiệm vụ dọn phòng, kiểm kê minibar, báo đồ thất lạc |
| **Khách Hàng (Customer)** | `guest` | Đặt phòng trên website, đặt món dịch vụ phòng, xem lịch sử đặt và đánh giá chất lượng |

---

## 📄 Bản Quyền & Giấy Phép

* Dự án được xây dựng và phát triển phục vụ mục đích **Đồ Án Tốt Nghiệp Chuyên Ngành Công Nghệ Thông Tin**.
* Mọi hành vi sao chép phục vụ mục đích thương mại cần có sự đồng ý của tác giả.
