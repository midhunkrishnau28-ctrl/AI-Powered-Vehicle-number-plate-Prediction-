# Setup and Run the ANPR ML Service
if (-not (Test-Path ".venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv .venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& .\.venv\Scripts\Activate.ps1

Write-Host "Installing requirements..." -ForegroundColor Cyan
pip install -r requirements.txt
pip install paddlepaddle

Write-Host "Starting Uvicorn Server..." -ForegroundColor Green
python -m uvicorn service.app:app --host 127.0.0.1 --port 8001
