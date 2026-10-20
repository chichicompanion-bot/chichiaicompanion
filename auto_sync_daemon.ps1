$ErrorActionPreference = "SilentlyContinue"
$nodePath = "C:\Users\nguye\.gemini\antigravity\scratch\.tools\node\node-v22.14.0-win-x64"
$gitPath = "C:\Users\nguye\.gemini\antigravity\scratch\.tools\git\cmd"
$ghPath = "C:\Users\nguye\.gemini\antigravity\scratch\.tools\gh\bin"
$env:PATH = "$nodePath;$gitPath;$ghPath;$env:PATH"
$repoDir = "C:\Users\nguye\.gemini\antigravity\scratch\chichiaicompanion"

$clientId = "178c6fc778ccc68e1d6a"
$deviceCodeFile = "C:\Users\nguye\.gemini\antigravity\scratch\.tools\gh_device_code.txt"

if (Test-Path $deviceCodeFile) {
    $deviceCode = (Get-Content $deviceCodeFile -Raw).Trim()
    for ($i = 0; $i -lt 180; $i++) {
        Start-Sleep -Seconds 5
        try {
            $poll = Invoke-RestMethod -Method Post -Uri "https://github.com/login/oauth/access_token" -Headers @{ Accept = "application/json" } -Body @{
                client_id = $clientId
                device_code = $deviceCode
                grant_type = "urn:ietf:params:oauth:grant-type:device_code"
            }
            if ($poll.access_token) {
                $token = $poll.access_token
                $token | & "$ghPath\gh.exe" auth login --with-token
                & "$ghPath\gh.exe" auth setup-git
                git -C $repoDir remote set-url origin "https://x-access-token:$token@github.com/chichicompanion-bot/chichiaicompanion.git"
                git -C $repoDir push -u origin main --force
                break
            }
        } catch {}
    }
}

# Continuous auto-build & auto-push loop whenever files in src/ change
$lastHash = ""
while ($true) {
    Start-Sleep -Seconds 6
    $files = Get-ChildItem -Path "$repoDir\src" -Recurse -File
    $curHash = ($files | ForEach-Object { "$($_.FullName):$($_.LastWriteTimeUtc.Ticks)" }) -join "|"
    if ($lastHash -ne "" -and $curHash -ne $lastHash) {
        Set-Location $repoDir
        & "$nodePath\npm.cmd" run build
        Copy-Item -Path "$repoDir\web\*" -Destination "C:\Users\nguye\OneDrive\Desktop\telegram-bot\web" -Recurse -Force
        git -C $repoDir add -A
        git -C $repoDir commit -m "chore: auto-update NEXUS HEALTH web"
        git -C $repoDir push origin main --force
    }
    $lastHash = $curHash
}
