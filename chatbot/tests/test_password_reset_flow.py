import importlib.util
import os
import pathlib
import sys
import types
import unittest
from unittest.mock import MagicMock


def load_bot_module():
    bot_path = pathlib.Path(__file__).resolve().parents[1] / "bot.py"

    fake_bot_instance = MagicMock()
    fake_bot_instance.message_handler.side_effect = lambda *args, **kwargs: (lambda func: func)

    fake_telebot = types.ModuleType("telebot")
    fake_telebot.TeleBot = MagicMock(return_value=fake_bot_instance)

    fake_dotenv = types.ModuleType("dotenv")
    fake_dotenv.load_dotenv = MagicMock()

    fake_groq_client = MagicMock()
    fake_groq = types.ModuleType("groq")
    fake_groq.Groq = MagicMock(return_value=fake_groq_client)

    previous_modules = {
        "telebot": sys.modules.get("telebot"),
        "dotenv": sys.modules.get("dotenv"),
        "groq": sys.modules.get("groq"),
    }
    previous_env = {key: os.environ.get(key) for key in ["BOT_TOKEN", "GROQ_API_KEY", "ADMIN_CHAT_ID"]}

    sys.modules["telebot"] = fake_telebot
    sys.modules["dotenv"] = fake_dotenv
    sys.modules["groq"] = fake_groq
    os.environ["BOT_TOKEN"] = "test-token"
    os.environ["GROQ_API_KEY"] = "test-groq-key"
    os.environ.pop("ADMIN_CHAT_ID", None)

    spec = importlib.util.spec_from_file_location("tested_bot_module", bot_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    for name, value in previous_modules.items():
        if value is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = value

    for key, value in previous_env.items():
        if value is None:
            os.environ.pop(key, None)
        else:
            os.environ[key] = value

    return module


def make_message(text: str, user_id: int = 1001):
    from_user = types.SimpleNamespace(
        id=user_id,
        first_name="Tri",
        last_name="Nguyen",
        username="tri_admin",
    )
    return types.SimpleNamespace(text=text, chat=types.SimpleNamespace(id=user_id), from_user=from_user)


class PasswordResetFlowTest(unittest.TestCase):
    def setUp(self):
        self.bot_module = load_bot_module()
        self.bot_module.bot.reply_to.reset_mock()
        self.bot_module.bot.send_message.reset_mock()

    def test_detects_forgot_password_intent(self):
        self.assertTrue(self.bot_module.is_forgot_password_request("Mình quên mật khẩu rồi"))
        self.assertFalse(self.bot_module.is_forgot_password_request("Tôi muốn hỏi giá dịch vụ"))

    def test_requests_email_after_forgot_password_message(self):
        message = make_message("quen mat khau")

        handled = self.bot_module.handle_forgot_password_flow(message, message.text)

        self.assertTrue(handled)
        self.assertIn(message.from_user.id, self.bot_module.forgot_password_requests)
        self.bot_module.bot.reply_to.assert_called_once()
        reply_text = self.bot_module.bot.reply_to.call_args.args[1]
        self.assertIn("Gmail/email", reply_text)

    def test_rejects_invalid_email_when_waiting_for_reply(self):
        message = make_message("khong phai email")
        self.bot_module.forgot_password_requests.add(message.from_user.id)

        handled = self.bot_module.handle_forgot_password_flow(message, message.text)

        self.assertTrue(handled)
        self.assertIn(message.from_user.id, self.bot_module.forgot_password_requests)
        reply_text = self.bot_module.bot.reply_to.call_args.args[1]
        self.assertIn("Gmail/email", reply_text)

    def test_forwards_valid_email_to_admin(self):
        message = make_message("user@gmail.com")
        self.bot_module.forgot_password_requests.add(message.from_user.id)
        self.bot_module.ADMIN_CHAT_ID = "998877"

        handled = self.bot_module.handle_forgot_password_flow(message, message.text)

        self.assertTrue(handled)
        self.assertNotIn(message.from_user.id, self.bot_module.forgot_password_requests)
        self.bot_module.bot.send_message.assert_called_once()
        send_args = self.bot_module.bot.send_message.call_args.args
        self.assertEqual(send_args[0], "998877")
        self.assertIn("user@gmail.com", send_args[1])


if __name__ == "__main__":
    unittest.main()
