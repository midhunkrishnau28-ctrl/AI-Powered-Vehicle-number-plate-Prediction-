# Load environment variables from .env
if (Test-Path ".env") {
    Get-Content .env | Where-Object { $_ -match "=" -and $_ -notmatch "^#" } | ForEach-Object {
        $name, $value = $_.Split('=', 2)
        [System.Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim())
    }
}

$port = [System.Environment]::GetEnvironmentVariable("PORT")
if (-not $port) { $port = "5000" }

Write-Host "Checking for existing processes on port $port..." -ForegroundColor Cyan
$existingProcess = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($existingProcess) {
    Write-Host "Found process $existingProcess on port $port. Killing it..." -ForegroundColor Yellow
    Stop-Process -Id $existingProcess -Force -ErrorAction SilentlyContinue
}

$npmPath = Get-Command npm.cmd | Select-Object -ExpandProperty Source
Write-Host "Starting the Kerala AI Police application on port $port..." -ForegroundColor Green
Start-Process $npmPath -ArgumentList "run dev" -NoNewWindow
Start-Sleep -Seconds 5
Start-Process "http://localhost:$port"
