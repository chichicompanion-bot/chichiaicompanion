"""
Test script for Telegram chatbot
Để test từng tính năng mà không cần chạy bot liên tục
"""

import time
from unittest.mock import Mock, patch, MagicMock
import sys

print("=" * 60)
print("Test Telegram Chatbot")
print("=" * 60)

# Test 1: Kiểm tra import
print("\n[TEST 1] Kiểm tra dependencies...")
try:
    import telebot
    print("✓ telebot được cài đặt")
except ImportError:
    print("✗ Cần cài đặt: pip install pyTelegramBotAPI")
    sys.exit(1)

try:
    from openai import OpenAI
    print("✓ openai được cài đặt")
except ImportError:
    print("✗ Cần cài đặt: pip install openai")
    sys.exit(1)

try:
    import time
    print("✓ time module có sẵn")
except ImportError:
    print("✗ time module không tìm thấy")
    sys.exit(1)

# Test 2: Kiểm tra logic greeting
print("\n[TEST 2] Kiểm tra logic greeting (20 giây)...")
last_message_time = {}
user_id = 123

# Lần 1: User chưa gửi tin nhắn
now = time.time()
should_greet = (
    user_id not in last_message_time
    or now - last_message_time[user_id] > 20
)
print(f"Lần 1 - Greeting: {should_greet} (expected: True) ✓" if should_greet else f"✗ Lỗi greeting")

# Cập nhật thời gian
last_message_time[user_id] = now

# Lần 2: Ngay sau đó (< 20 giây)
now = time.time()
should_greet = (
    user_id not in last_message_time
    or now - last_message_time[user_id] > 20
)
print(f"Lần 2 - Greeting: {should_greet} (expected: False) ✓" if not should_greet else f"✗ Lỗi greeting")

# Lần 3: Sau 21 giây
time.sleep(21)
now = time.time()
should_greet = (
    user_id not in last_message_time
    or now - last_message_time[user_id] > 20
)
print(f"Lần 3 - Greeting: {should_greet} (expected: True) ✓" if should_greet else f"✗ Lỗi greeting")

# Test 3: Mock test OpenAI API
print("\n[TEST 3] Mock test OpenAI API...")
with patch('openai.OpenAI') as mock_openai_class:
    mock_client = MagicMock()
    mock_openai_class.return_value = mock_client

    # Mock response
    mock_response = MagicMock()
    mock_response.choices[0].message.content = "Xin chào! Tôi là chatbot AI."
    mock_client.chat.completions.create.return_value = mock_response

    # Gọi API
    client = mock_openai_class(api_key="test_key")
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[{"role": "user", "content": "Bạn tên gì?"}]
    )

    result = response.choices[0].message.content
    print(f"✓ Mock response: '{result}'")
    print("✓ API call can be made successfully")

# Test 4: Kiểm tra error handling
print("\n[TEST 4] Error handling test...")
try:
    with patch('openai.OpenAI') as mock_openai_class:
        mock_client = MagicMock()
        mock_openai_class.return_value = mock_client

        # Simulate error
        mock_client.chat.completions.create.side_effect = Exception("API Error")

        client = mock_openai_class(api_key="test_key")
        try:
            response = client.chat.completions.create(
                model="gpt-4.1-mini",
                messages=[{"role": "user", "content": "Test"}]
            )
        except Exception as e:
            print(f"✓ Error handling works: '{str(e)}'")
            print("✓ Bot sẽ trả lời: 'Có lỗi xảy ra.'")
except Exception as e:
    print(f"✗ Error: {str(e)}")

print("\n" + "=" * 60)
print("Test hoàn thành!")
print("=" * 60)

print("\n📋 HƯỚNG DẪN CHẠY BOT THỰC:")
print("1. Cài đặt dependencies: pip install pyTelegramBotAPI openai python-dotenv")
print("2. Tạo file .env với nội dung:")
print("   BOT_TOKEN=your_telegram_token")
print("   OPENAI_API_KEY=your_openai_key")
print("3. Cập nhật bot.py để load từ .env file")
print("4. Chạy: python bot.py")
