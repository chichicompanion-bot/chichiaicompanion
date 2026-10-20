Set-Clipboard -Value "60E8-F11C"
Start-Process "C:\Users\nguye\AppData\Local\CocCoc\Browser\Application\browser.exe" -ArgumentList "https://github.com/login/device"
$gitPath = "C:\Users\nguye\.gemini\antigravity\scratch\.tools\git\cmd"
$ghPath = "C:\Users\nguye\.gemini\antigravity\scratch\.tools\gh\bin"
$env:PATH = "$gitPath;$ghPath;$env:PATH"
for ($i = 0; $i -lt 180; $i++) {
    Start-Sleep -Seconds 4
    try {
        $poll = Invoke-RestMethod -Method Post -Uri "https://github.com/login/oauth/access_token" -Headers @{ Accept = "application/json" } -Body @{
            client_id = "178c6fc778ccc68e1d6a"
            device_code = "4d86b0701b79e54d0fba3b5c38c4701fdbcad65a"
            grant_type = "urn:ietf:params:oauth:grant-type:device_code"
        }
        if ($poll.access_token) {
            $token = $poll.access_token
            git -C "C:\Users\nguye\.gemini\antigravity\scratch\chichiaicompanion" remote set-url origin "https://x-access-token:$token@github.com/chichicompanion-bot/chichiaicompanion.git"
            git -C "C:\Users\nguye\.gemini\antigravity\scratch\chichiaicompanion" push -u origin main --force
            Start-Sleep -Seconds 4
            Start-Process "C:\Users\nguye\AppData\Local\CocCoc\Browser\Application\browser.exe" -ArgumentList "https://chichiaicompanion.com"
            break
        }
    } catch {}
}
