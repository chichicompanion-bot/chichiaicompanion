@echo off
chcp 65001 >nul
title NEXUS HEALTH — LIVE DEV SERVER (AUTO RELOAD)
set "PATH=C:\Users\nguye\.gemini\antigravity\scratch\.tools\node\node-v22.14.0-win-x64;C:\Users\nguye\.gemini\antigravity\scratch\.tools\git\cmd;%PATH%"
cd /d "C:\Users\nguye\.gemini\antigravity\scratch\chichiaicompanion"
start "" "http://localhost:5173"
npm run dev
