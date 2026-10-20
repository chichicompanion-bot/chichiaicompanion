@echo off
chcp 65001 >nul
title NEXUS HEALTH — AUTO BUILD & PUSH TO GITHUB
set "PATH=C:\Users\nguye\.gemini\antigravity\scratch\.tools\node\node-v22.14.0-win-x64;C:\Users\nguye\.gemini\antigravity\scratch\.tools\git\cmd;C:\Users\nguye\.gemini\antigravity\scratch\.tools\gh\bin;%PATH%"
cd /d "C:\Users\nguye\.gemini\antigravity\scratch\chichiaicompanion"

echo ========================================================
echo   NEXUS HEALTH - BIOMEDICAL TELEMETRY DASHBOARD
echo   Dang kiem tra dang nhap GitHub...
echo ========================================================

gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [!] Ban chua dang nhap GitHub tren may nay.
    echo [!] Trinh duyet se mo trang GitHub. Hay nhap ma 8 ky tu hien ben duoi va bam Authorize:
    echo.
    gh auth login --hostname github.com --git-protocol https --web
    gh auth setup-git
)

echo.
echo [1/3] Dang build ban Production moi nhat ra thu muc web/...
call npm run build

echo.
echo [2/3] Dang dong goi commit Git...
git add -A
git commit -m "chore: update NEXUS HEALTH web dashboard" 2>nul

echo.
echo [3/3] Dang day thang len GitHub (chichicompanion-bot/chichiaicompanion)...
git push -u origin main --force

echo.
echo ========================================================
echo   HOAN TAT! Web chichiaicompanion.com se cap nhat ngay!
echo ========================================================
pause
