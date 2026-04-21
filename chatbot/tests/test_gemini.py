#!/usr/bin/env python3
import logging

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s [%(levelname)s] %(message)s")

print("=" * 70)
print("TEST GEMINI API")
print("=" * 70)

# Test 1: Import
print("\n[1] Import google.genai...")
try:
    from google import genai
    print("✓ Import thành công")
except Exception as e:
    print(f"✗ Import lỗi: {type(e).__name__}: {e}")
    exit(1)

# Test 2: Tạo client
print("\n[2] Tạo Gemini client...")
GEMINI_API_KEY = "AIzaSyBqA8vU3NxhqmPVkN9UidgaaLWiHJPF25M"
GEMINI_MODEL = "gemini-2.0-flash"

try:
    client = genai.Client(api_key=GEMINI_API_KEY)
    print(f"✓ Client tạo thành công")
    print(f"  - API Key: {GEMINI_API_KEY[:20]}...")
    print(f"  - Model: {GEMINI_MODEL}")
except Exception as e:
    print(f"✗ Client lỗi: {type(e).__name__}: {e}")
    exit(1)

# Test 3: Kiểm tra phương thức
print("\n[3] Kiểm tra phương thức gọi API...")
print(f"  - Có 'responses': {hasattr(client, 'responses')}")
print(f"  - Có 'models': {hasattr(client, 'models')}")

# Test 4: Test gọi API
print("\n[4] Test gọi Gemini API...")
test_text = "Xin chào!"

try:
    if hasattr(client, "responses"):
        print("  → Dùng client.responses.create(...)")
        response = client.responses.create(
            model=GEMINI_MODEL,
            input=test_text,
        )
    elif hasattr(client, "models"):
        print("  → Dùng client.models.generate_content(...)")
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=test_text,
        )
    else:
        raise RuntimeError("Không có phương thức nào")

    print("✓ API call thành công")
    print(f"  - Response type: {type(response)}")
    print(f"  - Response: {response}")

    # Extract text
    text = None
    if hasattr(response, "output_text"):
        text = response.output_text
    elif hasattr(response, "text"):
        text = response.text
    elif hasattr(response, "output"):
        text = response.output
    elif hasattr(response, "outputs"):
        text = response.outputs

    if text:
        print(f"  - Text length: {len(str(text))}")
        print(f"  - Text (first 100 chars): {str(text)[:100]}")
    else:
        print("  ✗ Không thể extract text từ response")

except Exception as e:
    print(f"✗ API call lỗi: {type(e).__name__}")
    print(f"  Message: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 70)
