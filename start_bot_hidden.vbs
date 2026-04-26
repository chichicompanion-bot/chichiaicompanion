Set oShell = CreateObject("WScript.Shell")
oShell.Run "cmd /c cd /d ""C:\Users\Administrator\OneDrive\Desktop\telegram-bot"" && call .venv\Scripts\activate && watchmedo auto-restart --patterns=""*.py"" --recursive -- python chatbot\bot.py", 0, False
