# 🏨 TA HOTEL STAFF - ỨNG DỤNG DI ĐỘNG HIỆN TRƯỜNG (REACT NATIVE / EXPO)

Ứng dụng di động chuyên biệt dành riêng cho **Nhân viên tác nghiệp hiện trường** của Khách sạn TA Hotel:
- 🧹 **Buồng phòng (Housekeeping)**: Sơ đồ phòng theo tầng, nút 1 chạm đổi trạng thái phòng (Trống <-> Đang dọn), kiểm kê Minibar kèm tính tiền đền bù hư hại tài sản.
- 🚗 **Đội xe / Vận chuyển (Driver / Transport)**: Lọc riêng các cuốc xe đón tiễn sân bay, thuê xe đưa đón của khách, nút gọi điện thoại 1 chạm cho khách, nhận cuốc và cập nhật lộ trình.
- 🍽️ **Phục vụ & Gọi món (F&B / Services)**: Tiếp nhận order món ăn, đồ uống, spa, giặt ủi, hẹn giờ phục vụ khách.
- 🛠️ **Kỹ thuật & Bảo trì (Technician)**: Tiếp nhận sự cố hỏng hóc thiết bị, cập nhật linh kiện & chi phí sửa chữa, tự động bàn giao buồng phòng dọn dẹp.
- 🔔 **Chuông báo & Đẩy thông báo (Push Notifications)**: Rung chuông màn hình khóa trên iPhone 14 Pro khi có nhiệm vụ gấp.

---

## 📱 HƯỚNG DẪN CHẠY VÀ KẾT NỐI VỚI IPHONE 14 PRO

### 1. Khởi động Backend Django (Bắt buộc chạy với 0.0.0.0)
Mở terminal tại thư mục `backend` và chạy:
```bash
..\venv\Scripts\activate
python manage.py runserver 0.0.0.0:8000
```
*(Tham số `0.0.0.0:8000` giúp backend cho phép các thiết bị ngoại vi như iPhone 14 Pro kết nối qua mạng nội bộ Wi-Fi).*

---

### 2. Khởi động ứng dụng Expo
Mở terminal mới tại thư mục `mobile_staff`:
```bash
cd d:\DATN_Quanlykhachsan\mobile_staff
npx expo start
```

> **Mẹo khi dùng khác mạng Wi-Fi hoặc 4G:**
> Nếu iPhone 14 Pro dùng 4G/LTE hoặc khác mạng Wi-Fi với máy tính, bạn có thể chạy chế độ Tunnel:
> ```bash
> npx expo start --tunnel
> ```

---

### 3. Mở trên iPhone 14 Pro
1. Tải ứng dụng **Expo Go** từ App Store trên iPhone 14 Pro.
2. Mở ứng dụng **Camera** mặc định của iPhone 14 Pro, quét mã **QR Code** xuất hiện trên cửa sổ Terminal máy tính.
3. Bấm vào thông báo *"Open in Expo Go"* để mở ứng dụng.

---

### 4. Đăng nhập ca trực
- **Tài khoản Tài xế / Phục vụ:** Đăng nhập bằng tài khoản có role `service_staff`. Ứng dụng sẽ tự động mở tab **"Đội xe"** hiển thị danh sách cuốc xe đón tiễn sân bay.
- **Tài khoản Buồng phòng:** Đăng nhập bằng tài khoản role `housekeeper`.
- **Tài khoản Kỹ thuật:** Đăng nhập bằng tài khoản role `technician`.
- **Đổi địa chỉ IP máy tính:** Tại màn hình đăng nhập, bấm nút **"Cấu hình Máy chủ"** góc trên để kiểm tra hoặc cập nhật IP LAN máy tính của bạn (Mặc định: `http://172.20.10.5:8000/api`).
