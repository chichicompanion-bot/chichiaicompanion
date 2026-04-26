# Chatbot

Thu muc nay chua phan chatbot Python de de quan ly rieng voi web.

File chinh:
- `bot.py`: bot Telegram
- `dev_runner.py`: watcher tu restart khi sua code
- `diagnostic.py`: script kiem tra
- `requirements.txt`: dependency
- `tests/`: cac file test

Chay bot:

```powershell
cd chatbot
pip install -r requirements.txt
python dev_runner.py
```

Luu y:
- Hien tai cac file goc van con o root de tranh lam gay moi truong dang chay.
- Tu gio minh nen sua va chay phien ban trong thu muc `chatbot/`.
- Luong quen mat khau moi:
  - Nguoi dung nhan "quen mat khau" cho bot, bot se yeu cau Gmail/email dang ky.
  - Sau khi nguoi dung gui email, bot se chuyen thong tin do qua Telegram cho admin.
  - Can cau hinh `ADMIN_CHAT_ID` trong `chatbot/.env`.
  - De lay chat ID, nhan lenh `/myid` cho bot roi copy gia tri tra ve vao `ADMIN_CHAT_ID`.
