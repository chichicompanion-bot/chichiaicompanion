import base64
import html
import logging
import mimetypes
import os
import re
import signal
import time
from collections import OrderedDict, defaultdict, deque
from urllib.parse import quote

import requests
import telebot
from dotenv import load_dotenv
from groq import Groq

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
load_dotenv()

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
VISION_MODEL = os.getenv("VISION_MODEL", "meta-llama/llama-4-scout-17b-16e-instruct")
GREETING_SECONDS = int(os.getenv("GREETING_SECONDS", "20"))
GREETING_ENABLED = os.getenv("GREETING_ENABLED", "false").lower() == "true"
MAX_HISTORY = int(os.getenv("MAX_HISTORY", "8"))
ENABLE_WEB_SEARCH = os.getenv("ENABLE_WEB_SEARCH", "true").lower() == "true"
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "12"))
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "400"))
VISION_MAX_TOKENS = int(os.getenv("VISION_MAX_TOKENS", "900"))
RESPONSE_CACHE_TTL = int(os.getenv("RESPONSE_CACHE_TTL", "600"))
RESPONSE_CACHE_SIZE = int(os.getenv("RESPONSE_CACHE_SIZE", "200"))
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID") or os.getenv("ADMIN_TELEGRAM_CHAT_ID")

if not BOT_TOKEN:
    raise RuntimeError("Missing BOT_TOKEN in .env")
if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY in .env")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode=None)
groq_client = Groq(api_key=GROQ_API_KEY)

last_message_time = {}
conversation_history = defaultdict(lambda: deque(maxlen=MAX_HISTORY))
response_cache = OrderedDict()
forgot_password_requests = set()
pending_password_lookup = {}  # email -> user_chat_id, chờ admin gửi mật khẩu

SYSTEM_PROMPT = """
Bạn là trợ lý hỗ trợ khách hàng của website Trungtammxh (chichiaicompanion.com) - nền tảng dịch vụ mạng xã hội (SMM).

Nhiệm vụ:
- Hỗ trợ tài khoản: đăng ký, đăng nhập, quên mật khẩu.
- Hỗ trợ nạp tiền: nạp thẻ cào, chuyển khoản ngân hàng AB Bank STK 0903722295.
- Hỗ trợ dịch vụ SMM: buff tim, follow, view, comment, share trên các mạng xã hội.
- Hỗ trợ đặt dịch vụ và kiểm tra trạng thái đơn hàng.
- Giải đáp thắc mắc về giá và thời gian thực hiện.
- Nếu gặp lỗi kỹ thuật nghiêm trọng, hướng dẫn liên hệ admin qua Telegram @ngtr_AI_bot.

Quy tắc:
- Luôn trả lời bằng tiếng Việt, thân thiện, ngắn gọn, rõ ràng.
- Chỉ hỗ trợ các vấn đề liên quan đến website Trungtammxh.
- Không bịa đặt giá hoặc thông tin dịch vụ nếu không chắc chắn.
- Nếu người dùng nói quên mật khẩu, yêu cầu họ gửi Gmail/email đã đăng ký để admin hỗ trợ.
""".strip()

LATEST_HINT_PATTERNS = [
    "moi nhat",
    "mới nhất",
    "hom nay",
    "hôm nay",
    "hien tai",
    "hiện tại",
    "bay gio",
    "bây giờ",
    "tin tuc",
    "tin tức",
    "news",
    "latest",
    "today",
    "current",
    "gia",
    "giá",
    "cap nhat",
    "cập nhật",
]

FORGOT_PASSWORD_PATTERNS = [
    "quen mat khau",
    "quên mật khẩu",
    "mat mat khau",
    "mất mật khẩu",
    "quen pass",
    "quên pass",
    "forgot password",
    "reset mat khau",
    "khong dang nhap duoc",
    "không đăng nhập được",
    "khong vao duoc tai khoan",
    "không vào được tài khoản",
]

EMAIL_PATTERN = re.compile(r"^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$", re.IGNORECASE)


def should_search_web(user_text: str) -> bool:
    lowered = user_text.casefold()
    return any(pattern in lowered for pattern in LATEST_HINT_PATTERNS)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_email(value: str) -> str:
    return clean_text(value).lower()


def looks_like_email(value: str) -> bool:
    return bool(EMAIL_PATTERN.fullmatch(normalize_email(value)))


def is_forgot_password_request(user_text: str) -> bool:
    lowered = clean_text(user_text).casefold()
    return any(pattern in lowered for pattern in FORGOT_PASSWORD_PATTERNS)


def build_admin_password_reset_message(message, email: str) -> str:
    user = message.from_user
    full_name = clean_text(" ".join(part for part in [user.first_name, user.last_name] if part))
    username = f"@{user.username}" if getattr(user, "username", None) else "(khong co)"
    return "\n".join(
        [
            "Yeu cau quen mat khau moi",
            f"Gmail/email: {email}",
            f"Ten Telegram: {full_name or '(khong co)'}",
            f"Username Telegram: {username}",
            f"User ID: {user.id}",
            f"Chat ID: {message.chat.id}",
        ]
    )


def send_password_reset_to_admin(message, email: str) -> tuple[bool, str | None]:
    if not ADMIN_CHAT_ID:
        logger.error("Cannot forward password reset email because ADMIN_CHAT_ID is missing")
        return (
            False,
            "Bot chua duoc cau hinh chat admin. Ban nhan /myid roi them ADMIN_CHAT_ID vao file chatbot/.env.",
        )

    try:
        bot.send_message(ADMIN_CHAT_ID, build_admin_password_reset_message(message, email))
        pending_password_lookup[email] = message.chat.id
    except Exception as exc:
        logger.exception("Failed to forward password reset request: %s", exc)
        return False, "Hiện tại không gửi được yêu cầu. Bạn thử lại sau ít phút nhé."
    return True, None


def handle_forgot_password_flow(message, text: str) -> bool:
    user_id = message.from_user.id

    if user_id in forgot_password_requests:
        email = normalize_email(text)
        if not looks_like_email(email):
            bot.reply_to(
                message,
                "Ban vui long gui dung Gmail/email da dang ky, vi du: ban@gmail.com",
            )
            return True

        ok, error_message = send_password_reset_to_admin(message, email)
        forgot_password_requests.discard(user_id)
        if ok:
            bot.reply_to(
                message,
                "Đã nhận thông tin. Chúng tôi sẽ hỗ trợ bạn sớm nhất có thể.",
            )
        else:
            bot.reply_to(message, error_message or "Hiện tại không gửi được yêu cầu. Bạn thử lại sau ít phút nhé.")
        return True

    if is_forgot_password_request(text):
        forgot_password_requests.add(user_id)
        bot.reply_to(
            message,
            "Bạn vui lòng cung cấp Gmail/email đã đăng ký tài khoản nhé.",
        )
        return True

    return False


def search_duckduckgo(query: str, limit: int = 5) -> list[dict]:
    url = f"https://html.duckduckgo.com/html/?q={quote(query)}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
        )
    }
    response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()

    pattern = re.compile(
        r'<a[^>]*class="result__a"[^>]*href="(?P<link>[^"]+)"[^>]*>(?P<title>.*?)</a>.*?'
        r'<a[^>]*class="result__snippet"[^>]*>(?P<snippet>.*?)</a>',
        re.DOTALL,
    )
    results = []
    for match in pattern.finditer(response.text):
        title = clean_text(html.unescape(re.sub(r"<.*?>", " ", match.group("title"))))
        snippet = clean_text(html.unescape(re.sub(r"<.*?>", " ", match.group("snippet"))))
        link = html.unescape(match.group("link"))
        if title and link:
            results.append({"title": title, "snippet": snippet, "link": link})
        if len(results) >= limit:
            break
    return results


def fetch_web_context(user_text: str) -> str | None:
    if not ENABLE_WEB_SEARCH or not should_search_web(user_text):
        return None

    try:
        results = search_duckduckgo(user_text, limit=5)
    except Exception as exc:
        logger.warning("Web search failed: %s", exc)
        return None

    if not results:
        return None

    lines = ["Thong tin web bo sung:", f"Query: {user_text}"]
    for index, item in enumerate(results, start=1):
        lines.append(f"{index}. {item['title']} | {item['snippet']} | Source: {item['link']}")
    return "\n".join(lines)


def normalize_cache_key(text: str) -> str:
    return clean_text(text).casefold()


def get_cached_response(user_text: str) -> str | None:
    cache_key = normalize_cache_key(user_text)
    cached = response_cache.get(cache_key)
    if not cached:
        return None

    cached_at, value = cached
    if time.time() - cached_at > RESPONSE_CACHE_TTL:
        response_cache.pop(cache_key, None)
        return None

    response_cache.move_to_end(cache_key)
    return value


def set_cached_response(user_text: str, response_text: str) -> None:
    cache_key = normalize_cache_key(user_text)
    response_cache[cache_key] = (time.time(), response_text)
    response_cache.move_to_end(cache_key)
    while len(response_cache) > RESPONSE_CACHE_SIZE:
        response_cache.popitem(last=False)


def get_telegram_file_bytes(file_id: str) -> tuple[bytes, str]:
    file_info = bot.get_file(file_id)
    downloaded = bot.download_file(file_info.file_path)
    mime_type, _ = mimetypes.guess_type(file_info.file_path)
    if not mime_type:
        mime_type = "image/jpeg"
    return downloaded, mime_type


def encode_image_data_url(file_bytes: bytes, mime_type: str) -> str:
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    return f"data:{mime_type};base64,{encoded}"


def build_messages(user_id: int, user_text: str, web_context: str | None) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if web_context:
        messages.append({"role": "system", "content": web_context})
    messages.extend(conversation_history[user_id])
    messages.append({"role": "user", "content": user_text})
    return messages


def get_ai_response(user_id: int, user_text: str) -> str:
    cached = get_cached_response(user_text)
    if cached is not None:
        return cached

    web_context = fetch_web_context(user_text)
    messages = build_messages(user_id, user_text, web_context)

    try:
        completion = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            temperature=0.1,
            max_tokens=GROQ_MAX_TOKENS,
        )
        result = (completion.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.exception("Groq request failed: %s", exc)
        return "Minh dang gap loi khi xu ly yeu cau. Ban thu lai sau vai giay hoac lien he admin @ngtr_AI_bot."

    if not result:
        return "Minh chua hieu cau hoi. Ban co the hoi lai cu the hon khong?"

    conversation_history[user_id].append({"role": "user", "content": user_text})
    conversation_history[user_id].append({"role": "assistant", "content": result})
    set_cached_response(user_text, result)
    return result


def get_ai_image_response(user_id: int, image_bytes: bytes, mime_type: str, caption: str | None) -> str:
    if len(image_bytes) > 4 * 1024 * 1024:
        return "Anh qua lon (toi da 4MB). Hay gui anh nho hon."

    image_url = encode_image_data_url(image_bytes, mime_type)
    prompt_text = (
        caption.strip()
        if caption
        else "Day la anh chup man hinh. Hay mo ta van de va ho tro nguoi dung lien quan den website Trungtammxh."
    )
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *list(conversation_history[user_id]),
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt_text},
                {"type": "image_url", "image_url": {"url": image_url}},
            ],
        },
    ]

    try:
        completion = groq_client.chat.completions.create(
            model=VISION_MODEL,
            messages=messages,
            temperature=0,
            max_completion_tokens=VISION_MAX_TOKENS,
        )
        result = (completion.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.exception("Groq vision request failed: %s", exc)
        return "Minh chua xu ly duoc anh nay. Hay mo ta van de bang text hoac lien he admin @ngtr_AI_bot."

    if not result:
        return "Minh khong doc duoc noi dung anh. Hay gui anh ro hon hoac mo ta van de."

    history_label = caption.strip() if caption else "[image]"
    conversation_history[user_id].append({"role": "user", "content": f"[image] {history_label}"})
    conversation_history[user_id].append({"role": "assistant", "content": result})
    return result


def handle_shutdown_signal(signum, frame) -> None:
    logger.info("Received shutdown signal %s", signum)
    raise SystemExit(0)


@bot.message_handler(commands=["start"])
def start_command(message):
    payload = ""
    if message.text:
        parts = message.text.split(maxsplit=1)
        if len(parts) > 1:
            payload = parts[1].strip().casefold()

    if payload in {"forgot_password", "reset_password"}:
        forgot_password_requests.add(message.from_user.id)
        bot.reply_to(
            message,
            "Bạn vui lòng cung cấp Gmail/email đã đăng ký tài khoản nhé.",
        )
        return

    first_name = message.from_user.first_name or "ban"
    bot.reply_to(
        message,
        f"Xin chao {first_name}! Toi la tro ly ho tro cua Trungtammxh.\n\n"
        "Ban can ho tro ve van de gi tren website? (Nap tien, dich vu SMM, tai khoan, don hang...)",
    )


@bot.message_handler(commands=["myid"])
def show_my_chat_id(message):
    bot.reply_to(message, f"Chat ID cua ban la: {message.chat.id}")


@bot.message_handler(commands=["cancel"])
def cancel_pending_request(message):
    removed = message.from_user.id in forgot_password_requests
    forgot_password_requests.discard(message.from_user.id)
    if removed:
        bot.reply_to(message, "Da huy yeu cau dang cho. Ban co the nhan lai khi can.")
    else:
        bot.reply_to(message, "Hien khong co yeu cau nao dang cho.")


@bot.message_handler(commands=["send_password"])
def admin_send_password(message):
    if not ADMIN_CHAT_ID or str(message.chat.id) != str(ADMIN_CHAT_ID):
        return
    parts = message.text.strip().split(maxsplit=2)
    if len(parts) < 3:
        bot.reply_to(message, "Dung: /send_password email@gmail.com matkhau")
        return
    email = parts[1].strip().lower()
    password = parts[2].strip()
    target_chat_id = pending_password_lookup.pop(email, None)
    if not target_chat_id:
        bot.reply_to(message, f"Khong tim thay yeu cau cho {email}. Co the nguoi dung da qua lau hoac chua gui yeu cau.")
        return
    try:
        bot.send_message(
            target_chat_id,
            f"Mat khau tai khoan {email} la: {password}\n\nVui long doi mat khau sau khi dang nhap.",
        )
        bot.reply_to(message, f"Da gui mat khau cho nguoi dung ({email}).")
        logger.info("Admin sent password for %s to chat_id %s", email, target_chat_id)
    except Exception as exc:
        logger.exception("Failed to send password to user: %s", exc)
        bot.reply_to(message, "Gui that bai. Nguoi dung co the da khoa bot hoac chat ID khong hop le.")


@bot.message_handler(commands=["reset", "clear"])
def reset_history(message):
    user_id = message.from_user.id
    conversation_history.pop(user_id, None)
    last_message_time.pop(user_id, None)
    forgot_password_requests.discard(user_id)
    bot.reply_to(message, "Da xoa lich su hoi thoai.")


@bot.message_handler(content_types=["photo"])
def handle_photo(message):
    try:
        user_id = message.from_user.id
        caption = message.caption.strip() if message.caption else None
        photo = message.photo[-1]
        image_bytes, mime_type = get_telegram_file_bytes(photo.file_id)
        bot.send_chat_action(message.chat.id, "typing")
        ai_reply = get_ai_image_response(user_id, image_bytes, mime_type, caption)
        bot.reply_to(message, ai_reply)
    except Exception as exc:
        logger.exception("Photo handler failed: %s", exc)
        bot.reply_to(message, "Minh gap loi khi xu ly anh. Hay mo ta van de bang text.")


@bot.message_handler(
    content_types=["document"],
    func=lambda message: bool(
        message.document and getattr(message.document, "mime_type", "").startswith("image/")
    ),
)
def handle_image_document(message):
    try:
        user_id = message.from_user.id
        caption = message.caption.strip() if message.caption else None
        image_bytes, mime_type = get_telegram_file_bytes(message.document.file_id)
        bot.send_chat_action(message.chat.id, "typing")
        ai_reply = get_ai_image_response(user_id, image_bytes, mime_type, caption)
        bot.reply_to(message, ai_reply)
    except Exception as exc:
        logger.exception("Image document handler failed: %s", exc)
        bot.reply_to(message, "Minh gap loi khi xu ly file anh. Hay thu gui lai.")


@bot.message_handler(func=lambda incoming: True)
def handle_message(message):
    try:
        user_id = message.from_user.id
        now = time.time()

        if not message.text:
            return

        text = message.text.strip()
        if not text:
            return

        if handle_forgot_password_flow(message, text):
            last_message_time[user_id] = now
            return

        if (
            GREETING_ENABLED
            and (user_id not in last_message_time or now - last_message_time[user_id] > GREETING_SECONDS)
        ):
            first_name = message.from_user.first_name or "ban"
            bot.reply_to(message, f"Xin chao {first_name}.")

        bot.send_chat_action(message.chat.id, "typing")
        ai_reply = get_ai_response(user_id, text)
        bot.reply_to(message, ai_reply)
        last_message_time[user_id] = now
    except Exception as exc:
        logger.exception("Message handler failed: %s", exc)
        try:
            bot.reply_to(message, "Bot dang gap loi. Ban thu lai sau vai giay.")
        except Exception:
            pass


signal.signal(signal.SIGINT, handle_shutdown_signal)
if hasattr(signal, "SIGTERM"):
    signal.signal(signal.SIGTERM, handle_shutdown_signal)
if hasattr(signal, "SIGBREAK"):
    signal.signal(signal.SIGBREAK, handle_shutdown_signal)


if __name__ == "__main__":
    logger.info("Starting Trungtammxh support bot, model=%s", GROQ_MODEL)
    bot.infinity_polling(timeout=60, long_polling_timeout=60)
