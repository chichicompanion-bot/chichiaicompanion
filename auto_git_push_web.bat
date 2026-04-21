# Auto Git Push Script for Windows
# This script will auto-commit and push changes in the 'web' folder every time you run it.
# You can set up a file watcher to run this script automatically when files change.

cd /d "%~dp0"
cd web
cd ..

git add web/*
git commit -m "Auto-update web code" 2>nul
git push
