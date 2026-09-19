@echo off
cd /d "%~dp0"
python -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo Dang cai dat thu vien can thiet (Pillow)...
    pip install Pillow
)
if not exist "dist\index.html" (
    call npm run build
)
start "" "http://127.0.0.1:9638/"
python "agent\server.py"
