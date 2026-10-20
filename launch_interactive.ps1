$env:PATH = "C:\Users\nguye\.gemini\antigravity\scratch\.tools\git\cmd;C:\Users\nguye\.gemini\antigravity\scratch\.tools\gcm;C:\Users\nguye\.gemini\antigravity\scratch\.tools\node\node-v22.14.0-win-x64;" + $env:PATH
Stop-Process -Name "git-credential-manager" -Force -ErrorAction SilentlyContinue
& "C:\Users\nguye\.gemini\antigravity\scratch\.tools\gcm\git-credential-manager.exe" github login --web
git -C "C:\Users\nguye\.gemini\antigravity\scratch\chichiaicompanion" push -u origin main --force
Start-Sleep -Seconds 5
Start-Process "C:\Users\nguye\AppData\Local\CocCoc\Browser\Application\browser.exe" -ArgumentList "https://chichiaicompanion.com"
