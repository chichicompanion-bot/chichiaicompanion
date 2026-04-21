"""
Diagnostic script - Kiểm tra tất cả vấn đề của bot
"""

import sys

print("=" * 70)
print("DIAGNOSTIC BOT TELEGRAM")
print("=" * 70)

# Test 1: Import các dependencies
print("\n[1] Kiểm tra dependencies...")
try:
    import telebot
    print("✓ telebot installed")
except ImportError as e:
    print(f"✗ telebot: {e}")
    sys.exit(1)

try:
    from openai import OpenAI
    print("✓ openai installed")
except ImportError as e:
    print(f"✗ openai: {e}")
    sys.exit(1)

# Test 2: Kiểm tra credentials
print("\n[2] Kiểm tra credentials...")
import os
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

if BOT_TOKEN and len(BOT_TOKEN) > 20:
    print(f"✓ BOT_TOKEN có độ dài: {len(BOT_TOKEN)}")
else:
    print("✗ BOT_TOKEN không hợp lệ")

if OPENAI_API_KEY and len(OPENAI_API_KEY) > 20:
    print(f"✓ OPENAI_API_KEY có độ dài: {len(OPENAI_API_KEY)}")
else:
    print("✗ OPENAI_API_KEY không hợp lệ")

# Test 3: Test OpenAI API connection
print("\n[3] Test kết nối OpenAI API...")
try:
    client = OpenAI(api_key=OPENAI_API_KEY)
    print("✓ OpenAI client khởi tạo thành công")
except Exception as e:
    print(f"✗ OpenAI client error: {e}")
    sys.exit(1)

# Test 4: Test OpenAI API call
print("\n[4] Test gọi OpenAI API (gpt-4-mini)...")
try:
    response = client.chat.completions.create(
        model="gpt-4-mini",
        messages=[
            {
                "role": "user",
                "content": "Bạn có phải chatbot không?"
            }
        ],
        max_tokens=10
    )
    result = response.choices[0].message.content
    print(f"✓ OpenAI API hoạt động!")
    print(f"   Response: '{result}'")
except Exception as e:
    print(f"✗ OpenAI API error: {str(e)}")
    print(f"   Error type: {type(e).__name__}")

    # Check error chi tiết
    if "invalid_request_error" in str(e).lower():
        print("   → Có thể API key hoặc model name sai")
    elif "authentication_error" in str(e).lower():
        print("   → API key không hợp lệ hoặc đã hết hạn")
    elif "rate_limit_error" in str(e).lower():
        print("   → Vượt quá rate limit hoặc hết quota")

# Test 5: Test Telegram Bot connection
print("\n[5] Test kết nối Telegram Bot...")
try:
    bot = telebot.TeleBot(BOT_TOKEN)
    bot_info = bot.get_me()
    print(f"✓ Telegram Bot hoạt động!")
    print(f"   Bot name: @{bot_info.username}")
    print(f"   Bot ID: {bot_info.id}")
except Exception as e:
    print(f"✗ Telegram Bot error: {str(e)}")
    print(f"   Error type: {type(e).__name__}")
    if "invalid" in str(e).lower():
        print("   → Token không hợp lệ hoặc sai định dạng")
    elif "unauthorized" in str(e).lower():
        print("   → Token không hợp lệ")

print("\n" + "=" * 70)
print("DIAGNOSTIC HOÀN THÀNH")
print("=" * 70)

print("\n📋 HƯỚNG DẪN TIẾP THEO:")
print("1. Nếu tất cả ✓ (xanh): Bot sẽ hoạt động bình thường")
print("2. Nếu có ✗ (đỏ): Báo lỗi cho tôi để fix")
print("3. Chạy bot bằng: python bot.py")
