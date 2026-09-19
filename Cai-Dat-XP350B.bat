@echo off
chcp 65001 >nul
title Cai Dat Phan Mem In Tem Tien Uyen XP-350B

:: Kiem tra quyen Administrator (neu chua co thi yeu cau)
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Dang yeu cau quyen Administrator de cai dat vao Program Files...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

set "TARGET=C:\Program Files\In-tem-san-pham-XP-350B"
set "SRC=%~dp0"
set "REG_HKLM=HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\In-tem-san-pham-XP-350B"
set "REG_HKCU=HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\In-tem-san-pham-XP-350B"

echo ========================================================
echo   CAI DAT PHAN MEM IN TEM SAN PHAM XP-350B (TIEN UYEN)
echo ========================================================
echo.

:: Tat ung dung cu neu dang chay
taskkill /F /IM InTemXP350B.exe >nul 2>&1

:: Tao thu muc cai dat
if not exist "%TARGET%" mkdir "%TARGET%"

:: Sao chep file chay va icon
echo [1/4] Dang sao chep file ung dung vao %TARGET%...
if exist "%SRC%InTemXP350B.exe" (
    copy /Y "%SRC%InTemXP350B.exe" "%TARGET%\InTemXP350B.exe" >nul
) else if exist "%SRC%dist\InTemXP350B.exe" (
    copy /Y "%SRC%dist\InTemXP350B.exe" "%TARGET%\InTemXP350B.exe" >nul
)

if exist "%SRC%app.ico" (
    copy /Y "%SRC%app.ico" "%TARGET%\app.ico" >nul
)

:: Tao file go cai dat
echo [2/4] Dang tao bo go cai dat (Uninstaller)...
(
echo @echo off
echo chcp 65001 ^>nul
echo net session ^>nul 2^>^&1
echo if %%errorLevel%% neq 0 (
echo     powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%%~f0\"\"' -Verb RunAs"
echo     exit /b
echo )
echo taskkill /F /IM InTemXP350B.exe ^>nul 2^>^&1
echo reg delete "%REG_HKLM%" /f ^>nul 2^>^&1
echo reg delete "%REG_HKCU%" /f ^>nul 2^>^&1
echo del /F /Q "%PUBLIC%\Desktop\In Tem Tiến Uyên (XP-350B).lnk" ^>nul 2^>^&1
echo del /F /Q "%USERPROFILE%\Desktop\In Tem Tiến Uyên (XP-350B).lnk" ^>nul 2^>^&1
echo timeout /t 1 ^>nul
echo powershell -Command "Start-Sleep -Seconds 1; Remove-Item -Path '%TARGET%' -Recurse -Force -ErrorAction SilentlyContinue"
echo echo ===================================================
echo echo Da go bo phan mem In Tem XP-350B thanh cong!
echo echo ===================================================
echo pause
) > "%TARGET%\Go-Cai-Dat.bat"

:: Dang ky Control Panel Uninstall (Programs and Features)
echo [3/4] Dang dang ky vao Control Panel (Programs and Features)...
reg add "%REG_HKLM%" /v "DisplayName" /t REG_SZ /d "In Tem Sản Phẩm XP-350B (Tiến Uyên)" /f >nul 2>&1
reg add "%REG_HKLM%" /v "DisplayIcon" /t REG_SZ /d "%TARGET%\app.ico" /f >nul 2>&1
reg add "%REG_HKLM%" /v "DisplayVersion" /t REG_SZ /d "1.0.0" /f >nul 2>&1
reg add "%REG_HKLM%" /v "Publisher" /t REG_SZ /d "Tiến Uyên" /f >nul 2>&1
reg add "%REG_HKLM%" /v "InstallLocation" /t REG_SZ /d "%TARGET%" /f >nul 2>&1
reg add "%REG_HKLM%" /v "UninstallString" /t REG_SZ /d "cmd.exe /c \"\"%TARGET%\Go-Cai-Dat.bat\"\"" /f >nul 2>&1
reg add "%REG_HKLM%" /v "NoModify" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "%REG_HKLM%" /v "NoRepair" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "%REG_HKLM%" /v "EstimatedSize" /t REG_DWORD /d 32000 /f >nul 2>&1

reg add "%REG_HKCU%" /v "DisplayName" /t REG_SZ /d "In Tem Sản Phẩm XP-350B (Tiến Uyên)" /f >nul 2>&1
reg add "%REG_HKCU%" /v "DisplayIcon" /t REG_SZ /d "%TARGET%\app.ico" /f >nul 2>&1
reg add "%REG_HKCU%" /v "DisplayVersion" /t REG_SZ /d "1.0.0" /f >nul 2>&1
reg add "%REG_HKCU%" /v "Publisher" /t REG_SZ /d "Tiến Uyên" /f >nul 2>&1
reg add "%REG_HKCU%" /v "InstallLocation" /t REG_SZ /d "%TARGET%" /f >nul 2>&1
reg add "%REG_HKCU%" /v "UninstallString" /t REG_SZ /d "cmd.exe /c \"\"%TARGET%\Go-Cai-Dat.bat\"\"" /f >nul 2>&1
reg add "%REG_HKCU%" /v "NoModify" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "%REG_HKCU%" /v "NoRepair" /t REG_DWORD /d 1 /f >nul 2>&1
reg add "%REG_HKCU%" /v "EstimatedSize" /t REG_DWORD /d 32000 /f >nul 2>&1

:: Tao Shortcut tren Desktop
echo [4/4] Dang tao bieu tuong Desktop Shortcut...
powershell -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$sc = $ws.CreateShortcut([System.Environment]::GetFolderPath('Desktop') + '\In Tem Tiến Uyên (XP-350B).lnk'); " ^
  "$sc.TargetPath = '%TARGET%\InTemXP350B.exe'; " ^
  "$sc.WorkingDirectory = '%TARGET%'; " ^
  "if (Test-Path '%TARGET%\app.ico') { $sc.IconLocation = '%TARGET%\app.ico,0' }; " ^
  "$sc.Save(); " ^
  "$pubDesktop = [System.Environment]::GetFolderPath('CommonDesktopDirectory'); " ^
  "if (Test-Path $pubDesktop) { " ^
  "  $scPub = $ws.CreateShortcut($pubDesktop + '\In Tem Tiến Uyên (XP-350B).lnk'); " ^
  "  $scPub.TargetPath = '%TARGET%\InTemXP350B.exe'; " ^
  "  $scPub.WorkingDirectory = '%TARGET%'; " ^
  "  if (Test-Path '%TARGET%\app.ico') { $scPub.IconLocation = '%TARGET%\app.ico,0' }; " ^
  "$scPub.Save(); " ^
  "}"

echo.
echo ========================================================
echo   CAI DAT HOAN TAT THANH CONG!
echo   Thu muc: %TARGET%
echo   Bieu tuong: Ngoai man hinh Desktop
echo   Quan ly go cai dat: Control Panel -> Programs and Features
echo ========================================================
echo.

:: Khoi dong ung dung
echo Dang khoi dong ung dung tai http://127.0.0.1:9638/...
start "" "%TARGET%\InTemXP350B.exe"

timeout /t 3 >nul
