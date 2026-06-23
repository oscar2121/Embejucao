# Setup and start Expo for React Native project
# 1. Add Android platform‑tools to PATH for this session
$env:PATH += ";C:\Users\oscar\AppData\Local\Android\Sdk\platform-tools"

# 2. Verify adb version
Write-Host "=== ADB version ==="
adb version

# 3. List connected devices
Write-Host "=== Connected devices ==="
adb devices

# 4. Free port 8081 if it is used
$tcp = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($tcp) {
    foreach ($conn in $tcp) {
        $processId = $conn.OwningProcess
        Write-Host "Killing process $processId that is using port 8081..."
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Port 8081 is already free."
}

# 5. Reverse ports for Metro and Expo
Write-Host "Setting up adb reverse..."
adb reverse tcp:8081 tcp:8081
adb reverse tcp:19000 tcp:19000
adb reverse tcp:19001 tcp:19001

# 6. Change to project directory
Set-Location "C:\Users\oscar\OneDrive\Desktop\files"

# 7. Start Expo server (tunnel mode) in background
Write-Host "Starting Expo server (tunnel mode)…"
Start-Process -NoNewWindow -FilePath "npx" -ArgumentList "expo","start","--tunnel","--android"
