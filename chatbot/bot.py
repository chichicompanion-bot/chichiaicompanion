import atexit
import ast
import base64
import html
import json
import logging
import mimetypes
import os
import re
import signal
import sys
import time
from collections import OrderedDict, defaultdict, deque
from datetime import datetime
from urllib.parse import quote
from zoneinfo import ZoneInfo

import requests
import telebot
from dotenv import load_dotenv
from groq import Groq

try:
    from selenium import webdriver
    from selenium.common.exceptions import WebDriverException
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.action_chains import ActionChains
    from selenium.webdriver.common.by import By
    from selenium.webdriver.common.keys import Keys
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.support.ui import WebDriverWait
except Exception:
    webdriver = None
    WebDriverException = None
    Service = None
    Options = None
    ActionChains = None
    By = None
    Keys = None
    EC = None
    WebDriverWait = None

try:
    from webdriver_manager.chrome import ChromeDriverManager
except Exception:
    ChromeDriverManager = None


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
MESSENGER_ENABLED = os.getenv("MESSENGER_ENABLED", "true").lower() == "true"
MESSENGER_LOGIN_WAIT = int(os.getenv("MESSENGER_LOGIN_WAIT", "45"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "12"))
GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "400"))
VISION_MAX_TOKENS = int(os.getenv("VISION_MAX_TOKENS", "900"))
RESPONSE_CACHE_TTL = int(os.getenv("RESPONSE_CACHE_TTL", "600"))
RESPONSE_CACHE_SIZE = int(os.getenv("RESPONSE_CACHE_SIZE", "200"))
LOCAL_TIMEZONE = os.getenv("BOT_TIMEZONE", "Asia/Bangkok")
MESSENGER_PROFILE_DIR = os.getenv(
    "MESSENGER_PROFILE_DIR",
    os.path.join(os.getcwd(), ".messenger_chrome_profile"),
)
MESSENGER_HOME_URL = "https://www.facebook.com/messages/t/"

if not BOT_TOKEN:
    raise RuntimeError("Missing BOT_TOKEN in .env")

if not GROQ_API_KEY:
    raise RuntimeError("Missing GROQ_API_KEY in .env")

bot = telebot.TeleBot(BOT_TOKEN, parse_mode=None)
groq_client = Groq(api_key=GROQ_API_KEY)

last_message_time = {}
conversation_history = defaultdict(lambda: deque(maxlen=MAX_HISTORY))
response_cache = OrderedDict()
driver = None
messenger_error_message = None
MESSENGER_WAIT_SECONDS = int(os.getenv("MESSENGER_WAIT_SECONDS", "20"))

SYSTEM_PROMPT = """
You are a high-quality Telegram assistant.

Rules:
- Reply in the same language as the user unless they ask otherwise.
- Give the direct answer first.
- Be accurate, concise, and structured.
- Never claim certainty when you are not certain.
- If web context is provided, prioritize it for current facts and mention dates when relevant.
- If the question has no reliable basis, say what is unknown instead of inventing.
- For math, coding, and logic, reason carefully.
- If the user asks for dangerous, illegal, or deceptive actions, refuse briefly.
""".strip()

VISION_SYSTEM_PROMPT = """
You are a multimodal study assistant.

Rules:
- Read the image carefully before answering.
- If the image contains a homework problem, first transcribe the important text accurately.
- Then classify the subject and problem type before solving.
- For multiple choice, identify the best option and explain briefly.
- For essay/free response, provide a direct answer and concise essential steps.
- For math and science, keep the final answer consistent with the steps.
- If the image is blurry or missing details, say exactly what is unreadable instead of guessing.
- If the user includes a caption, treat it as additional instruction.
""".strip()

VISION_SUBJECTS = {
    "toan": "Toán",
    "vat_ly": "Vật lý",
    "hoa_hoc": "Hóa học",
    "sinh_hoc": "Sinh học",
    "ngu_van": "Ngữ văn",
    "tieng_anh": "Tiếng Anh",
    "lich_su": "Lịch sử",
    "dia_ly": "Địa lý",
    "tin_hoc": "Tin học",
    "giao_duc_cong_dan": "GDCD",
    "khac": "Khác",
    "khong_ro": "Chưa rõ",
}

VISION_PROBLEM_TYPES = {
    "multiple_choice": "Trắc nghiệm",
    "essay": "Tự luận",
    "mixed": "Hỗn hợp",
    "unknown": "Chưa rõ",
}

LATEST_HINT_PATTERNS = [
    "mới nhất",
    "hôm nay",
    "hiện tại",
    "bây giờ",
    "tin tức",
    "news",
    "latest",
    "today",
    "current",
    "giá",
    "score",
    "thời tiết",
    "cập nhật",
]


def should_search_web(user_text: str) -> bool:
    lowered = user_text.lower()
    return any(pattern in lowered for pattern in LATEST_HINT_PATTERNS)


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


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

    lines = ["Fresh web context:", f"Query: {user_text}"]
    for index, item in enumerate(results, start=1):
        lines.append(
            f"{index}. {item['title']} | {item['snippet']} | Source: {item['link']}"
        )
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


def safe_eval_math(expression: str) -> float:
    allowed_binary_ops = {
        ast.Add: lambda a, b: a + b,
        ast.Sub: lambda a, b: a - b,
        ast.Mult: lambda a, b: a * b,
        ast.Div: lambda a, b: a / b,
        ast.Mod: lambda a, b: a % b,
        ast.Pow: lambda a, b: a ** b,
    }
    allowed_unary_ops = {
        ast.UAdd: lambda value: value,
        ast.USub: lambda value: -value,
    }

    def visit(node):
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return node.value
        if isinstance(node, ast.BinOp) and type(node.op) in allowed_binary_ops:
            return allowed_binary_ops[type(node.op)](visit(node.left), visit(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in allowed_unary_ops:
            return allowed_unary_ops[type(node.op)](visit(node.operand))
        raise ValueError("Unsupported math expression")

    parsed = ast.parse(expression, mode="eval")
    return visit(parsed)


def try_exact_math_answer(user_text: str) -> str | None:
    normalized = user_text.lower().strip()
    replacements = [
        "bằng bao nhiêu",
        "bao nhiêu",
        "kết quả",
        "là bao nhiêu",
        "la bao nhieu",
        "ket qua",
        "=",
        "?",
    ]
    for item in replacements:
        normalized = normalized.replace(item, " ")

    if not re.fullmatch(r"[\d\s\+\-\*\/\(\)\.\%]{3,}", normalized.strip()):
        return None

    expression = clean_text(normalized)
    if not expression:
        return None

    try:
        value = safe_eval_math(expression)
    except Exception:
        return None

    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


def try_exact_datetime_answer(user_text: str) -> str | None:
    lowered = user_text.casefold()
    asks_time = any(item in lowered for item in ["mấy giờ", "may gio", "what time", "current time"])
    asks_date = any(item in lowered for item in ["hôm nay ngày mấy", "hom nay ngay may", "today date", "ngày hôm nay"])
    if not asks_time and not asks_date:
        return None

    try:
        timezone = ZoneInfo(LOCAL_TIMEZONE)
        now = datetime.now(timezone)
    except Exception:
        now = datetime.now()

    if asks_time:
        return now.strftime("%H:%M:%S")
    if asks_date:
        return now.strftime("%d/%m/%Y")
    return None


def try_fast_path_answer(user_text: str) -> str | None:
    for resolver in (try_exact_math_answer, try_exact_datetime_answer):
        result = resolver(user_text)
        if result is not None:
            return result
    return get_cached_response(user_text)


def close_messenger_driver() -> None:
    global driver

    if driver is None:
        return

    try:
        driver.quit()
    except Exception:
        pass
    finally:
        driver = None


def handle_shutdown_signal(signum, frame) -> None:
    logger.info("Received shutdown signal %s", signum)
    close_messenger_driver()
    raise SystemExit(0)


def clear_profile_lock_files() -> None:
    lock_filenames = [
        "lockfile",
        "SingletonLock",
        "SingletonSocket",
        "SingletonCookie",
    ]
    for filename in lock_filenames:
        filepath = os.path.join(MESSENGER_PROFILE_DIR, filename)
        try:
            if os.path.exists(filepath):
                os.remove(filepath)
        except Exception:
            continue


def build_chrome_options():
    if Options is None:
        return None

    chrome_options = Options()
    chrome_options.add_argument(f"--user-data-dir={MESSENGER_PROFILE_DIR}")
    chrome_options.add_argument("--profile-directory=Default")
    chrome_options.add_argument("--disable-notifications")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_argument("--no-first-run")
    chrome_options.add_argument("--no-default-browser-check")
    return chrome_options


def create_chrome_driver(chrome_options):
    try:
        return webdriver.Chrome(options=chrome_options)
    except Exception:
        if ChromeDriverManager is None or Service is None:
            raise
        return webdriver.Chrome(
            service=Service(ChromeDriverManager().install()),
            options=chrome_options,
        )


def ensure_messenger_driver() -> bool:
    global driver
    global messenger_error_message

    if not MESSENGER_ENABLED:
        messenger_error_message = (
            "Messenger đang bị tắt trong cấu hình. "
            "Đặt MESSENGER_ENABLED=true trong .env rồi chạy lại bot."
        )
        return False

    if driver is not None:
        try:
            _ = driver.current_url
            return True
        except Exception:
            driver = None

    if webdriver is None:
        messenger_error_message = (
            "Chưa cài Selenium. Chạy: pip install -r requirements.txt"
        )
        logger.error("Selenium is not installed but MESSENGER_ENABLED=true")
        return False

    try:
        os.makedirs(MESSENGER_PROFILE_DIR, exist_ok=True)
        chrome_options = build_chrome_options()

        try:
            driver = create_chrome_driver(chrome_options)
        except Exception:
            clear_profile_lock_files()
            driver = create_chrome_driver(chrome_options)
        if (
            "messenger.com" not in driver.current_url
            and "facebook.com/messages" not in driver.current_url
        ):
            driver.get(MESSENGER_HOME_URL)
        logger.info(
            "Messenger opened. Please log in within %s seconds.", MESSENGER_LOGIN_WAIT
        )
        time.sleep(MESSENGER_LOGIN_WAIT)
        messenger_error_message = None
        return True
    except Exception as exc:
        messenger_error_message = (
            "Không mở được Chrome cho Messenger. "
            f"Lỗi: {exc}"
        )
        logger.exception("Cannot start Messenger driver: %s", exc)
        driver = None
        return False


def open_messenger_home(wait) -> None:
    current_url = ""
    try:
        current_url = driver.current_url
    except Exception:
        current_url = ""

    if (
        "messenger.com" in current_url
        or "facebook.com/messages" in current_url
    ):
        return

    driver.get(MESSENGER_HOME_URL)
    wait.until(
        lambda current_driver: (
            "messenger.com" in current_driver.current_url
            or "facebook.com/messages" in current_driver.current_url
        )
    )


def is_messenger_conversation_url(url: str) -> bool:
    return "/messages/t/" in url or "messenger.com/t/" in url


def first_visible_element(wait, selectors):
    for selector in selectors:
        try:
            element = wait.until(EC.presence_of_element_located(selector))
            if element.is_displayed():
                return element
        except Exception:
            continue
    return None


def send_messenger_message(name: str, message: str) -> bool:
    global messenger_error_message

    if not ensure_messenger_driver():
        return False

    if WebDriverWait is None or EC is None:
        messenger_error_message = "Thiếu selenium wait utilities. Chạy lại pip install -r requirements.txt"
        return False

    try:
        wait = WebDriverWait(driver, MESSENGER_WAIT_SECONDS)
        open_messenger_home(wait)

        search_box = first_visible_element(
            wait,
            [
                (By.CSS_SELECTOR, "input[placeholder='Tìm kiếm trên Messenger']"),
                (By.CSS_SELECTOR, "input[placeholder='Search Messenger']"),
                (
                    By.XPATH,
                    "//input[@placeholder='Tìm kiếm trên Messenger' or @placeholder='Search Messenger']",
                ),
            ],
        )
        if search_box is None:
            messenger_error_message = "Không tìm thấy ô tìm kiếm của Messenger."
            return False

        search_box.click()
        search_box.send_keys(Keys.CONTROL, "a")
        search_box.send_keys(Keys.DELETE)
        search_box.send_keys(name)

        user_selectors = [
            (By.XPATH, "(//a[contains(@href, '/messages/t/') or contains(@href, '/t/')])[1]"),
            (By.XPATH, "(//div[@role='listbox']//a[contains(@href, '/messages/t/') or contains(@href, '/t/')])[1]"),
            (By.XPATH, "(//ul//a[contains(@href, '/messages/t/') or contains(@href, '/t/')])[1]"),
        ]
        user = None
        for selector in user_selectors:
            try:
                user = wait.until(EC.element_to_be_clickable(selector))
                break
            except Exception:
                continue

        if user is None:
            messenger_error_message = f"Không tìm thấy người nhận '{name}' trên Messenger."
            return False

        href = user.get_attribute("href") or ""
        if "/messages/t/" not in href and "/t/" not in href:
            messenger_error_message = "Kết quả tìm kiếm không phải cuộc trò chuyện Messenger."
            return False

        driver.execute_script("arguments[0].click();", user)
        wait.until(lambda current_driver: is_messenger_conversation_url(current_driver.current_url))

        current_url = driver.current_url
        if not is_messenger_conversation_url(current_url):
            messenger_error_message = "Không mở được đúng cửa sổ chat Messenger."
            return False

        composer_selectors = [
            (By.XPATH, "//div[@role='textbox' and @contenteditable='true']"),
            (By.XPATH, "//div[@contenteditable='true' and @aria-label='Nhắn tin']"),
            (By.XPATH, "//div[@contenteditable='true' and @aria-label='Message']"),
            (By.XPATH, "//p[@data-lexical-text='true']/ancestor::div[@contenteditable='true'][1]"),
            (By.CSS_SELECTOR, "div[role='textbox'][contenteditable='true']"),
            (By.CSS_SELECTOR, "div[contenteditable='true'][aria-label='Message']"),
            (By.CSS_SELECTOR, "div[contenteditable='true'][aria-label='Nhắn tin']"),
        ]
        message_box = None
        for selector in composer_selectors:
            try:
                message_box = wait.until(EC.presence_of_element_located(selector))
                if message_box.is_displayed():
                    break
                message_box = None
            except Exception:
                continue

        if not message_box:
            messenger_error_message = "Đã mở Messenger nhưng không tìm thấy ô nhập tin nhắn."
            logger.error("Messenger input box not found")
            return False

        wait.until(lambda _: message_box.is_displayed() and message_box.is_enabled())
        driver.execute_script("arguments[0].focus();", message_box)
        try:
            message_box.click()
        except Exception:
            driver.execute_script("arguments[0].click();", message_box)

        try:
            message_box.send_keys(message)
        except Exception:
            if ActionChains is None:
                messenger_error_message = "Không nhập được nội dung vào ô chat Messenger."
                return False
            ActionChains(driver).move_to_element(message_box).click().send_keys(message).perform()

        message_box.send_keys(Keys.ENTER)
        messenger_error_message = None
        return True
    except Exception as exc:
        messenger_error_message = f"Gửi Messenger lỗi: {exc}"
        logger.exception("Messenger send failed: %s", exc)
        return False


def build_messages(user_id: int, user_text: str, web_context: str | None) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if web_context:
        messages.append(
            {
                "role": "system",
                "content": (
                    "Use the following web context for recent facts. "
                    "If it conflicts with old knowledge, prefer the web context.\n\n"
                    f"{web_context}"
                ),
            }
        )

    messages.extend(conversation_history[user_id])
    messages.append({"role": "user", "content": user_text})
    return messages


def build_vision_prompt(caption: str | None) -> str:
    base_prompt = """
Hãy phân tích ảnh bài tập này và trả về đúng một JSON object với schema:
{
  "subject": "toan|vat_ly|hoa_hoc|sinh_hoc|ngu_van|tieng_anh|lich_su|dia_ly|tin_hoc|giao_duc_cong_dan|khac|khong_ro",
  "problem_type": "multiple_choice|essay|mixed|unknown",
  "transcription": "chép lại nội dung chính trong ảnh, ngắn gọn nhưng đủ ý",
  "question_summary": "tóm tắt đề bài",
  "choices": ["A....", "B...."],
  "answers": [
    {
      "question": "Câu 1",
      "answer": "A",
      "solution": ""
    }
  ],
  "final_answer": "đáp án cuối cùng, ngắn gọn và trực tiếp",
  "reasoning": "lời giải ngắn gọn, rõ ràng",
  "unreadable_parts": "ghi rõ phần nào mờ hoặc thiếu, nếu không có thì để chuỗi rỗng",
  "confidence": 0.0
}

Quy tắc:
- Chỉ trả về JSON, không thêm markdown.
- Nếu là trắc nghiệm, mỗi câu phải có một item trong answers theo dạng {"question":"Câu 1","answer":"A","solution":""}.
- Nếu là tự luận, mỗi câu phải có một item trong answers theo dạng {"question":"Câu 1","answer":"<đáp án ngắn>","solution":"<lời giải ngắn>"}.
- Nếu là hỗn hợp, vẫn tách riêng từng câu trong answers.
- Nếu ảnh không đủ rõ, vẫn trả về JSON nhưng nói rõ unreadable_parts, không đoán bừa.
- Ưu tiên tiếng Việt.
- Không viết dài dòng.
""".strip()
    if caption:
        return f"{base_prompt}\n\nYêu cầu thêm của người dùng: {caption.strip()}"
    return base_prompt


def normalize_vision_subject(subject: str | None) -> str:
    if not subject:
        return VISION_SUBJECTS["khong_ro"]

    normalized = clean_text(subject).casefold().replace(" ", "_")
    return VISION_SUBJECTS.get(normalized, clean_text(subject))


def normalize_problem_type(problem_type: str | None) -> str:
    if not problem_type:
        return VISION_PROBLEM_TYPES["unknown"]
    return VISION_PROBLEM_TYPES.get(clean_text(problem_type).casefold(), clean_text(problem_type))


def infer_subject_from_text(text: str) -> str:
    lowered = text.casefold()
    subject_rules = [
        (("sin", "cos", "hàm số", "phương trình", "hình học", "đạo hàm", "toán"), VISION_SUBJECTS["toan"]),
        (("vật lý", "gia tốc", "điện trường", "lực", "công suất"), VISION_SUBJECTS["vat_ly"]),
        (("hóa học", "phản ứng", "mol", "hcl", "naoh", "h2so4"), VISION_SUBJECTS["hoa_hoc"]),
        (("sinh học", "gen", "tế bào", "di truyền", "sinh vật"), VISION_SUBJECTS["sinh_hoc"]),
        (("ngữ văn", "phân tích", "đoạn văn", "nghị luận", "tác phẩm"), VISION_SUBJECTS["ngu_van"]),
        (("tiếng anh", "english", "choose the best answer", "grammar", "reading"), VISION_SUBJECTS["tieng_anh"]),
        (("lịch sử", "chiến tranh", "cách mạng", "năm", "sự kiện"), VISION_SUBJECTS["lich_su"]),
        (("địa lý", "bản đồ", "khí hậu", "dân số", "vùng"), VISION_SUBJECTS["dia_ly"]),
        (("tin học", "python", "pascal", "thuật toán", "lập trình"), VISION_SUBJECTS["tin_hoc"]),
        (("gdcd", "công dân", "pháp luật", "đạo đức"), VISION_SUBJECTS["giao_duc_cong_dan"]),
    ]
    for keywords, label in subject_rules:
        if any(keyword in lowered for keyword in keywords):
            return label
    return VISION_SUBJECTS["khong_ro"]


def parse_vision_payload(raw_text: str) -> dict | None:
    try:
        parsed = json.loads(raw_text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    match = re.search(r"\{.*\}", raw_text, re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return None
    return None


def normalize_answer_items(payload: dict) -> list[dict]:
    raw_items = payload.get("answers")
    if not isinstance(raw_items, list):
        return []

    items = []
    for index, item in enumerate(raw_items, start=1):
        if not isinstance(item, dict):
            continue
        question = clean_text(str(item.get("question", ""))) or f"Câu {index}"
        answer = clean_text(str(item.get("answer", "")))
        solution = clean_text(str(item.get("solution", "")))
        if answer or solution:
            items.append(
                {
                    "question": question,
                    "answer": answer,
                    "solution": solution,
                }
            )
    return items


def format_answer_items(problem_type: str, answer_items: list[dict]) -> list[str]:
    lines = []
    normalized_type = clean_text(problem_type).casefold()

    for item in answer_items:
        question = item["question"]
        answer = item["answer"]
        solution = item["solution"]

        if normalized_type == VISION_PROBLEM_TYPES["multiple_choice"].casefold():
            if answer:
                lines.append(f"{question}: {answer}")
            elif solution:
                lines.append(f"{question}: {solution}")
            continue

        if answer:
            lines.append(f"{question}: {answer}")
        else:
            lines.append(f"{question}:")

        if solution:
            lines.append(solution)

    return lines


def format_study_response(payload: dict) -> str:
    subject = normalize_vision_subject(payload.get("subject"))
    problem_type = normalize_problem_type(payload.get("problem_type"))
    transcription = clean_text(str(payload.get("transcription", "")))
    summary = clean_text(str(payload.get("question_summary", "")))
    final_answer = clean_text(str(payload.get("final_answer", "")))
    reasoning = clean_text(str(payload.get("reasoning", "")))
    unreadable = clean_text(str(payload.get("unreadable_parts", "")))
    try:
        confidence = float(payload.get("confidence", 0))
    except Exception:
        confidence = 0
    choices = payload.get("choices") or []
    answer_items = normalize_answer_items(payload)

    if subject == VISION_SUBJECTS["khong_ro"]:
        subject = infer_subject_from_text(" ".join([transcription, summary, final_answer, reasoning]))

    if answer_items:
        lines = format_answer_items(problem_type, answer_items)
    else:
        lines = [f"Môn: {subject}", f"Dạng bài: {problem_type}"]
        if final_answer:
            lines.append(f"Đáp án: {final_answer}")
        if reasoning:
            lines.append(f"Lời giải: {reasoning}")

        if transcription:
            lines.append(f"Đề bài: {transcription}")
        elif summary:
            lines.append(f"Tóm tắt: {summary}")

        if choices:
            cleaned_choices = [clean_text(str(item)) for item in choices if clean_text(str(item))]
            if cleaned_choices:
                lines.append("Lựa chọn:")
                lines.extend(f"- {item}" for item in cleaned_choices)

    if 0 < confidence < 0.6:
        lines.append("Độ chắc chắn thấp: Ảnh có thể chưa đủ rõ, bạn nên gửi ảnh rõ hơn để kiểm tra lại.")
    if unreadable:
        lines.append(f"Lưu ý ảnh mờ/thiếu: {unreadable}")

    return "\n".join(lines)


def get_ai_response(user_id: int, user_text: str) -> str:
    fast_answer = try_fast_path_answer(user_text)
    if fast_answer is not None:
        return fast_answer

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
        return (
            "Mình đang gặp lỗi khi gọi AI. "
            "Bạn thử lại sau vài giây hoặc kiểm tra API key/model."
        )

    if not result:
        return "Mình chưa tạo được câu trả lời hợp lệ. Bạn hãy hỏi lại ngắn hơn hoặc cụ thể hơn."

    conversation_history[user_id].append({"role": "user", "content": user_text})
    conversation_history[user_id].append({"role": "assistant", "content": result})
    set_cached_response(user_text, result)
    return result


def get_ai_image_response(user_id: int, image_bytes: bytes, mime_type: str, caption: str | None) -> str:
    if len(image_bytes) > 4 * 1024 * 1024:
        return "Ảnh quá lớn cho model vision hiện tại. Hãy gửi ảnh dưới 4MB hoặc chụp/crop lại rõ hơn."

    image_url = encode_image_data_url(image_bytes, mime_type)
    prompt_text = build_vision_prompt(caption)
    messages = [
        {"role": "system", "content": VISION_SYSTEM_PROMPT},
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
            response_format={"type": "json_object"},
        )
        result = (completion.choices[0].message.content or "").strip()
    except Exception as exc:
        logger.exception("Groq vision request failed: %s", exc)
        return (
            "Mình chưa xử lý được ảnh này. "
            "Hãy thử gửi ảnh rõ hơn hoặc kiểm tra model vision/API key."
        )

    if not result:
        return "Mình chưa đọc được nội dung ảnh một cách chắc chắn. Hãy gửi ảnh rõ hơn hoặc thêm mô tả ngắn."

    payload = parse_vision_payload(result)
    if payload:
        formatted_result = format_study_response(payload)
    else:
        formatted_result = result

    history_label = caption.strip() if caption else "[image]"
    conversation_history[user_id].append({"role": "user", "content": f"[image] {history_label}"})
    conversation_history[user_id].append({"role": "assistant", "content": formatted_result})
    return formatted_result


@bot.message_handler(commands=["start"])
def start_command(message):
    first_name = message.from_user.first_name or "bạn"
    bot.reply_to(message, f"Xin chào {first_name}. Mời bạn đặt câu hỏi.")


@bot.message_handler(commands=["reset", "clear"])
def reset_history(message):
    user_id = message.from_user.id
    conversation_history.pop(user_id, None)
    last_message_time.pop(user_id, None)
    bot.reply_to(message, "Đã xóa ngữ cảnh hội thoại của bạn.")


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
        bot.reply_to(
            message,
            "Mình gặp lỗi khi xử lý ảnh này. Hãy thử gửi lại ảnh rõ hơn hoặc kèm yêu cầu trong caption.",
        )


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
        bot.reply_to(
            message,
            "Mình gặp lỗi khi xử lý file ảnh này. Hãy thử gửi ảnh dưới dạng photo hoặc file ảnh nhỏ hơn.",
        )


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

        lowered = text.lower()
        if lowered.startswith("nhắn "):
            try:
                data = text[5:]
                name, msg_text = data.split(":", 1)
                ok = send_messenger_message(name.strip(), msg_text.strip())
                bot.reply_to(
                    message,
                    "Đã gửi Messenger." if ok else messenger_error_message or "Gửi Messenger thất bại.",
                )
            except ValueError:
                bot.reply_to(message, "Sai cú pháp. Ví dụ: nhắn Nam: chúc ngủ ngon")
            return

        if (
            GREETING_ENABLED
            and (user_id not in last_message_time or now - last_message_time[user_id] > GREETING_SECONDS)
        ):
            first_name = message.from_user.first_name or "bạn"
            bot.reply_to(message, f"Xin chào {first_name}.")

        ai_reply = get_ai_response(user_id, text)
        bot.reply_to(message, ai_reply)
        last_message_time[user_id] = now
    except Exception as exc:
        logger.exception("Message handler failed: %s", exc)
        try:
            bot.reply_to(
                message,
                "Bot đang gặp lỗi nội bộ khi xử lý tin nhắn này. Bạn thử lại sau vài giây.",
            )
        except Exception:
            pass


atexit.register(close_messenger_driver)
signal.signal(signal.SIGINT, handle_shutdown_signal)
if hasattr(signal, "SIGTERM"):
    signal.signal(signal.SIGTERM, handle_shutdown_signal)
if hasattr(signal, "SIGBREAK"):
    signal.signal(signal.SIGBREAK, handle_shutdown_signal)


if __name__ == "__main__":
    logger.info(
        "Starting Telegram bot with model=%s, web_search=%s, messenger=%s",
        GROQ_MODEL,
        ENABLE_WEB_SEARCH,
        MESSENGER_ENABLED,
    )
    bot.infinity_polling(timeout=60, long_polling_timeout=60)
