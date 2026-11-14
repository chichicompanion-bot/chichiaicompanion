#!/bin/zsh
export PATH="/opt/homebrew/bin:/Users/mac/.gemini/antigravity/scratch/.tools/node-v22.14.0-darwin-arm64/bin:/Users/mac/.gemini/antigravity/scratch/.tools/gh_2.67.0_macOS_arm64/bin:$PATH"
cd "/Users/mac/.gemini/antigravity/scratch/chichiaicompanion" || exit 1

echo "========================================================"
echo "  STROKEGUARD - BAND — AUTO BUILD & PUSH TO GITHUB (MAC)"
echo "========================================================"

if ! gh auth status >/dev/null 2>&1; then
  echo ""
  echo "[!] Bạn chưa đăng nhập GitHub trên máy Mac này."
  echo "[!] Trình duyệt sẽ mở trang GitHub. Hãy nhập mã 8 ký tự hiện bên dưới và bấm Authorize:"
  echo ""
  gh auth login --hostname github.com --git-protocol https --web
  gh auth setup-git
fi

echo ""
echo "[1/3] Đang build bản Production mới nhất ra thư mục web/..."
npm run build

echo ""
echo "[2/3] Đang đóng gói commit Git..."
git add -A
git commit -m "chore: update STROKEGUARD - BAND web dashboard" 2>/dev/null || true

echo ""
echo "[3/3] Đang đẩy thẳng lên GitHub (chichicompanion-bot/chichiaicompanion)..."
git push -u origin main

echo ""
echo "========================================================"
echo "  HOÀN TẤT! Web chichiaicompanion sẽ cập nhật ngay!"
echo "========================================================"
