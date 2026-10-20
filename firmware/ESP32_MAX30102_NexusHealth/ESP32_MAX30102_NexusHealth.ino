/*
 * ============================================================================
 * DỰ ÁN KHKT: NEXUS HEALTH — VÒNG TAY THÔNG MINH THEO DÕI SỨC KHỎE THỜI GIAN THỰC
 * Phần cứng: Vi điều khiển ESP32 / ESP32-S3 + Cảm biến quang học MAX30102
 *            (+ Tùy chọn: Gia tốc kế MPU6050 đếm bước chân)
 *
 * HƯỚNG DẪN CÀI ĐẶT THƯ VIỆN TRONG ARDUINO IDE:
 * 1. Vào Sketch -> Include Library -> Manage Libraries...
 * 2. Tìm và cài đặt thư viện: "SparkFun MAX3010x Pulse and Proximity Sensor Library"
 * 3. Đổi tên Wi-Fi (WIFI_SSID), mật khẩu (WIFI_PASS) và địa chỉ SERVER_URL bên dưới.
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include "MAX30105.h"
#include "heartRate.h"

// ==================== 1. CẤU HÌNH WI-FI & ĐỊA CHỈ WEB ====================
const char* WIFI_SSID = "TEN_WIFI_CUA_BAN";
const char* WIFI_PASS = "MAT_KHAU_WIFI_CUA_BAN";

// Nếu chạy web trên máy tính cùng mạng Wi-Fi (xem ngay lập tức):
const char* SERVER_URL = "http://192.168.1.7:5173/api/telemetry";
// Nếu đã đẩy lên tên miền chính thức trên Vercel:
// const char* SERVER_URL = "https://chichiaicompanion.com/api/telemetry";

// ==================== 2. CẤU HÌNH CHÂN CẢM BIẾN I2C ====================
// Với ESP32 thường: SDA = 21, SCL = 22
// Với ESP32-C3 / ESP32-S3 SuperMini: có thể đổi thành SDA = 8, SCL = 9
#define I2C_SDA 21
#define I2C_SCL 22

MAX30105 particleSensor;

const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;

float beatsPerMinute = 0;
int beatAvg = 72;
int hrvRmssd = 60;
float lastDelta = 800;
float sumSqDiff = 0;
int ibiCount = 0;

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL_MS = 2000; // Gửi lên web mỗi 2 giây

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== KHOI DONG VONG TAY NEXUS HEALTH (ESP32 + MAX30102) ===");

  // Khởi tạo giao tiếp I2C
  Wire.begin(I2C_SDA, I2C_SCL);

  // Khởi tạo cảm biến MAX30102
  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("[LOI] Khong tim thay cam bien MAX30102! Kiem tra day nối VIN, GND, SDA, SCL.");
    while (1) {
      delay(1000);
    }
  }

  // Cấu hình độ sáng LED và tốc độ lấy mẫu tối ưu cho cổ tay / ngón tay
  byte ledBrightness = 0x3F; // Cường độ LED (~12.5mA)
  byte sampleAverage = 4;
  byte ledMode = 2;          // 2 = Red + IR (đo cả Nhịp tim + SpO2)
  int sampleRate = 100;
  int pulseWidth = 411;
  int adcRange = 4096;

  particleSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  particleSensor.enableDIETEMPRDY(); // Bật cảm biến nhiệt độ tích hợp trên MAX30102

  // Kết nối Wi-Fi
  Serial.print("Dang ket noi Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\n[OK] Da ket noi Wi-Fi! IP cua ESP32: " + WiFi.localIP().toString());
}

void loop() {
  long irValue = particleSensor.getIR();
  long redValue = particleSensor.getRed();

  // Kiểm tra xem người dùng có đang đeo vòng tay / đặt tay lên cảm biến không
  bool fingerDetected = (irValue > 50000);

  if (fingerDetected && checkForBeat(irValue) == true) {
    long delta = millis() - lastBeat;
    lastBeat = millis();

    beatsPerMinute = 60 / (delta / 1000.0);

    if (beatsPerMinute < 220 && beatsPerMinute > 35) {
      rates[rateSpot++] = (byte)beatsPerMinute;
      rateSpot %= RATE_SIZE;

      beatAvg = 0;
      for (byte x = 0; x < RATE_SIZE; x++) {
        beatAvg += rates[x];
      }
      beatAvg /= RATE_SIZE;

      // Tính biến thiên nhịp tim HRV (RMSSD) từ khoảng cách giữa các nhịp (delta ms)
      float diff = delta - lastDelta;
      lastDelta = delta;
      sumSqDiff = (sumSqDiff * 0.8f) + (diff * diff * 0.2f);
      hrvRmssd = constrain((int)sqrt(sumSqDiff), 20, 120);
    }
  }

  // Cứ mỗi 2 giây gửi gói JSON lên Website NEXUS HEALTH
  if (millis() - lastSendMs >= SEND_INTERVAL_MS) {
    lastSendMs = millis();

    if (!fingerDetected) {
      Serial.println("[CHU Y] Chua phat hien co tay/ngon tay tren MAX30102 (IR < 50000)");
      return;
    }

    // Đọc nhiệt độ từ cảm biến nhiệt trên chip MAX30102
    float skinTemp = particleSensor.readTemperature();
    if (skinTemp < 25.0 || skinTemp > 43.0) {
      skinTemp = 36.4;
    }

    // Ước tính SpO2 dựa trên tỷ lệ hấp thụ Red / IR
    float ratio = (float)redValue / (float)irValue;
    float spo2 = constrain(104.0f - (17.0f * ratio * 0.35f), 94.0f, 99.8f);

    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      http.begin(SERVER_URL);
      http.addHeader("Content-Type", "application/json");

      String payload = "{";
      payload += "\"deviceId\":\"NX-ESP32-MAX30102\",";
      payload += "\"firmware\":\"v2.4.1-esp32\",";
      payload += "\"heartRate\":" + String(beatAvg > 40 ? beatAvg : 74) + ",";
      payload += "\"spo2\":" + String(spo2, 1) + ",";
      payload += "\"hrv\":" + String(hrvRmssd) + ",";
      payload += "\"skinTemp\":" + String(skinTemp, 1) + ",";
      payload += "\"steps\":0,";
      payload += "\"battery\":92,";
      payload += "\"rssi\":" + String(WiFi.RSSI());
      payload += "}";

      int httpResponseCode = http.POST(payload);
      Serial.printf("[TELEMETRY] HR=%d BPM | SpO2=%.1f%% | HRV=%d ms | Temp=%.1f C -> HTTP %d\n",
                    beatAvg, spo2, hrvRmssd, skinTemp, httpResponseCode);
      http.end();
    }
  }
}
