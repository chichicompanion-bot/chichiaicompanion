# NEXUS HEALTH — Premium Smart Wearable & ESP32 Biomedical Telemetry Dashboard

Hệ thống giao diện giám sát sức khỏe thời gian thực dành cho dự án Khoa học Kỹ thuật: **Vòng tay thông minh sử dụng vi điều khiển ESP32-S3 kết hợp cảm biến quang học MAX30102 và IMU 6 trục MPU6050**.

## Kiến trúc & Tính năng chính

1. **Cinematic Boot Intro (2.5 giây):**
   - Hiệu ứng ánh sáng cyan chuyển động, chữ `NEXUS HEALTH` fade-in kết hợp blur-to-sharp, sóng xung quang học PPG quét ngang màn hình và staggered reveal cho toàn bộ dashboard (hỗ trợ nút **Bỏ qua Intro** và tôn trọng `prefers-reduced-motion`).
2. **7 Thẻ Chỉ Số Sinh Tồn (Metric Cards) với Micro-interactions 3D:**
   - `HEART RATE` (BPM), `BLOOD OXYGEN` (SpO₂ %), `HRV RMSSD` (ms), `SKIN TEMPERATURE` (°C), `STEPS` (bước chân), `SLEEP DURATION` (giờ), và `STRESS INDEX` (/100).
   - Hiệu ứng nghiêng 3D parallax nhẹ theo con trỏ chuột, ánh sáng spotlight trượt trên bề mặt thẻ, mini sparkline SVG và nhãn trạng thái minh bạch (`LIVE`, `DEMO`, `STALE`).
3. **Biểu đồ Phân tích Thời gian thực (`Live Health Analytics`):**
   - Chuyển đổi trực tiếp giữa **Heart Rate**, **SpO₂**, và **HRV** theo các khung thời gian `1 Giờ`, `6 Giờ`, `24 Giờ`, `7 Ngày`.
   - Biểu đồ **Sóng xung Quang học PPG (MAX30102 Photoplethysmography Waveform)** tách biệt kênh Hồng ngoại (IR 880nm) và Đỏ (Red 660nm), ghi rõ là sóng quang học PPG chứ không phải điện tâm đồ ECG y khoa.
4. **Activity Rings & Sleep Architecture:**
   - 3 vòng tròn tiến trình vận động (`Move`, `Exercise`, `Stand`) có hiệu ứng glow và hover chi tiết.
   - Phân tích các giai đoạn giấc ngủ (`Awake`, `REM`, `Light Sleep`, `Deep Sleep`) kèm biểu đồ Hypnogram.
5. **Health Telemetry History & Xuất CSV:**
   - Tìm kiếm, lọc theo chỉ số và ngày đo, phân trang và xuất báo cáo `.csv` chuẩn UTF-8.
6. **Chế độ Kép: `DEMO MODE` & `LIVE ESP32 MODE`:**
   - **DEMO MODE:** Mô phỏng dữ liệu sinh lý có giới hạn hợp lý với nhãn `DEMO SIMULATION` rõ ràng.
   - **LIVE ESP32 MODE:** Nhận gói JSON trực tiếp từ mạch ESP32 qua endpoint `/api/telemetry` (`POST /api/telemetry` từ ESP32 và `GET /api/telemetry` trên giao diện web). Chỉ hiển thị `Connected` khi nhận được gói tin hợp lệ trong vòng 15 giây.

## Cách chạy trên máy cục bộ

```bash
npm install
npm run dev
```

Biên dịch bản Production ra thư mục `web/` (tương thích trực tiếp với cấu hình Vercel `outputDirectory: "web"`):

```bash
npm run build
```
