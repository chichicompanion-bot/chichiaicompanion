import os
import telebot
import time
from openai import OpenAI

BOT_TOKEN = os.environ.get("BOT_TOKEN")
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

bot = telebot.TeleBot(BOT_TOKEN)

# Lưu thời gian nhắn cuối
last_message_time = {}

@bot.message_handler(func=lambda message: True)
def handle_message(message):
    user_id = message.from_user.id
    now = time.time()

    try:
        # Nếu quá 20 giây thì chào lại
        if (
            user_id not in last_message_time
            or now - last_message_time[user_id] > 20
        ):
            bot.reply_to(message, "Xin chào Trí!")

        # Gửi câu hỏi tới AI
        response = client.chat.completions.create(
            model="gpt-4-mini",  # ✓ FIX: gpt-4.1-mini → gpt-4-mini
            messages=[
                {
                    "role": "user",
                    "content": message.text
                }
            ]
        )

        reply_text = response.choices[0].message.content

        # Trả lời AI
        bot.reply_to(message, reply_text)

        # Cập nhật thời gian
        last_message_time[user_id] = now

    except Exception as e:
        # Debug: In lỗi để xem chi tiết
        error_msg = f"Lỗi: {str(e)}"
        print(f"[ERROR] {error_msg}")  # In ra console
        bot.reply_to(message, "Có lỗi xảy ra.")

bot.infinity_polling()
