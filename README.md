# 🖨️ Phần mềm In Tem Sản Phẩm XP-350B (Tiến Uyên)

Ứng dụng chuyên dụng in 2 tem sản phẩm song song trên một hàng giấy khổ cuộn **76 mm** (kích thước mỗi tem **35 × 22 mm**) dành cho máy in nhiệt trực tiếp **Xprinter XP-350B**. Tự động mở giao diện web tại `http://127.0.0.1:9638/`.

---

## ⚡ TẢI NHANH BỘ CÀI ĐẶT (CHO MÁY NHÂN VIÊN)

Bấm vào link bên dưới để tải trực tiếp file `.exe` về máy tính:

| Loại bộ cài | Link tải trực tiếp | Mô tả & Hướng dẫn |
| :--- | :--- | :--- |
| **Bản Cài Đặt Tự Động** *(Khuyên dùng)* | 📥 [**TẢI BẢN SETUP (Setup-InTem-XP350B.exe)**](https://github.com/stephenpham68/In-tem-san-pham-XP-350B/raw/main/Setup-InTem-XP350B.exe) | Tải về nhấp đúp chạy: Tự động cài vào `C:\Program Files\In-tem-san-pham-XP-350B`, tạo **Icon ngoài Desktop**, tự mở web và có trong **Control Panel** để gỡ cài đặt bất kỳ lúc nào. |
| **Bản Portable (Chạy ngay)** | 📥 [**TẢI BẢN PORTABLE (InTemXP350B.exe)**](https://github.com/stephenpham68/In-tem-san-pham-XP-350B/raw/main/InTemXP350B.exe) | Tải về bấm mở là chạy ngay lập tức, không cần cài đặt. |

> 💡 **Lưu ý**: Sau khi cài đặt, nhân viên chỉ cần nhấp vào biểu tượng **"In Tem Tiến Uyên (XP-350B)"** ngoài Desktop là trình duyệt sẽ tự động mở giao diện in tại `http://127.0.0.1:9638/`.

---

## 📌 Thông số kỹ thuật đã khóa chuẩn (Thực tế)

* **Máy in tương thích**: Xprinter XP-350B (kết nối USB).
* **Khổ giấy**: Cuộn 76 mm, 2 tem/hàng, mỗi tem 35 × 22 mm, gap hàng 3.0 mm.
* **Tọa độ căn chỉnh chuẩn vàng**:
  * Dời ngang X: `-1.5 mm`
  * Dời dọc Y: `+1.5 mm`
  * Khoảng cách 2 tem: `0.4 mm`
* **Tính năng lưu cấu hình riêng**:
  * Máy mỗi nhân viên nếu có xê dịch nhẹ có thể chỉnh trong mục `⚙ Tùy chỉnh vị trí in (Offset) ▼` rồi bấm **"💾 Lưu cấu hình"** để lưu riêng cho máy đó.
  * Bấm **"↺ Mặc định"** để quay về thông số chuẩn vàng ban đầu.
* **Gỡ cài đặt**:
  * Vào **Control Panel** -> **Programs and Features** -> Chọn **In Tem Sản Phẩm XP-350B (Tiến Uyên)** -> Bấm **Uninstall**.

---

## 🛠️ Dành cho lập trình viên (Chạy từ mã nguồn)

1. Cài đặt Python 3.8+ và Node.js.
2. Cài đặt thư viện Python: `pip install Pillow`
3. Cài đặt frontend: `npm install`
4. Build giao diện: `npm run build`
5. Khởi động server: chạy file `start.bat` hoặc lệnh `python agent/server.py`.
