# In tem sản phẩm Tiến Uyên (Xprinter XP-350B)

Ứng dụng web cục bộ chuyên dụng để in 2 tem sản phẩm song song trên một hàng giấy khổ cuộn 76 mm (kích thước mỗi tem 35 × 22 mm) bằng máy in nhiệt trực tiếp **Xprinter XP-350B**.

---

## 📌 Đặc điểm kỹ thuật

* **Máy in tương thích**: Xprinter XP-350B (hoặc các dòng Xprinter hỗ trợ lệnh TSPL).
* **Độ phân giải**: 203 DPI (8 dots/mm).
* **Khổ cuộn**: 76 mm (608 dots).
* **Kích thước mỗi con tem**: 35 × 22 mm (280 × 176 dots).
* **Số cột**: 2 tem / hàng.
* **Thông số khóa chuẩn thực tế**:
  * Dời ngang X: `-1.5 mm`
  * Dời dọc Y: `+1.5 mm`
  * Khoảng cách giữa 2 tem: `0.4 mm`
  * Khoảng cách hàng (gap): `3.0 mm`
* **Giao thức in**: Gửi lệnh trực tiếp TSPL (RAW printer job) qua `winspool.drv` của Windows, tốc độ in tức thì, không qua hộp thoại in của trình duyệt.

---

## 🚀 Cách chạy ứng dụng

1. Kết nối máy in Xprinter XP-350B vào máy tính qua cổng USB.
2. Nhấp đúp chuột vào file **`start.bat`**.
3. Trình duyệt sẽ tự động mở trang: **`http://127.0.0.1:9638`**.
4. Nhập Tên sản phẩm, Giá bán, Mã vạch (barcode) và bấm **In XP-350B**.

---

## 🛠️ Cài đặt cho máy mới (Dành cho nhân viên)

* Yêu cầu máy tính cài đặt **Python 3.8+** (tích hợp sẵn thư viện và tự cài đặt `Pillow` khi chạy `start.bat` lần đầu).
* Không cần cài đặt Node.js vì thư mục `dist/` giao diện đã được build sẵn.
