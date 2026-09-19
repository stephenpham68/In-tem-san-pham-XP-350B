import os
import sys
import ctypes
import shutil
import subprocess
import winreg
from pathlib import Path

TARGET_DIR = Path(r"C:\Program Files\In-tem-san-pham-XP-350B")
EXE_NAME = "InTemXP350B.exe"
ICO_NAME = "app.ico"
APP_TITLE = "In Tem Tiến Uyên (XP-350B)"
UNINSTALL_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\In-tem-san-pham-XP-350B"

def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False

def run_as_admin():
    exe = sys.executable
    params = " ".join(f'"{arg}"' for arg in sys.argv[1:])
    ctypes.windll.shell32.ShellExecuteW(None, "runas", exe, params, None, 1)
    sys.exit(0)

def create_shortcut(target_exe, icon_path, shortcut_path):
    vbs = f"""
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "{shortcut_path}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "{target_exe}"
oLink.WorkingDirectory = "{target_exe.parent}"
oLink.IconLocation = "{icon_path}, 0"
oLink.Description = "Phần mềm in tem nhãn Xprinter XP-350B"
oLink.Save
"""
    vbs_path = Path(os.environ.get("TEMP", ".")) / "create_shortcut.vbs"
    vbs_path.write_text(vbs, encoding="utf-8")
    subprocess.run(["cscript", "//nologo", str(vbs_path)], capture_output=True, creationflags=0x08000000)
    try:
        vbs_path.unlink(missing_ok=True)
    except Exception:
        pass

def register_uninstall(target_dir, exe_path, ico_path, uninstaller_path):
    try:
        with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, UNINSTALL_KEY) as key:
            winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, "In Tem Sản Phẩm XP-350B (Tiến Uyên)")
            winreg.SetValueEx(key, "DisplayIcon", 0, winreg.REG_SZ, str(ico_path))
            winreg.SetValueEx(key, "DisplayVersion", 0, winreg.REG_SZ, "1.0.0")
            winreg.SetValueEx(key, "Publisher", 0, winreg.REG_SZ, "Tiến Uyên")
            winreg.SetValueEx(key, "InstallLocation", 0, winreg.REG_SZ, str(target_dir))
            winreg.SetValueEx(key, "UninstallString", 0, winreg.REG_SZ, f'cmd.exe /c "{uninstaller_path}"')
            winreg.SetValueEx(key, "NoModify", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, "NoRepair", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, "EstimatedSize", 0, winreg.REG_DWORD, 16000)
    except Exception as e:
        pass

def main():
    if not is_admin():
        run_as_admin()

    subprocess.run(["taskkill", "/F", "/IM", EXE_NAME], capture_output=True, creationflags=0x08000000)

    if getattr(sys, "frozen", False):
        src_dir = Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent))
    else:
        src_dir = Path(__file__).resolve().parent.parent

    src_exe = src_dir / EXE_NAME
    if not src_exe.is_file():
        src_exe = src_dir / "dist" / EXE_NAME
    src_ico = src_dir / ICO_NAME

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    dest_exe = TARGET_DIR / EXE_NAME
    dest_ico = TARGET_DIR / ICO_NAME

    if src_exe.is_file():
        shutil.copy2(str(src_exe), str(dest_exe))
    if src_ico.is_file():
        shutil.copy2(str(src_ico), str(dest_ico))

    uninstaller = TARGET_DIR / "Go-Cai-Dat.bat"
    uninstaller_content = f"""@echo off
chcp 65001 >nul
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)
taskkill /F /IM {EXE_NAME} >nul 2>&1
reg delete "HKLM\\{UNINSTALL_KEY}" /f >nul 2>&1
del /F /Q "%PUBLIC%\\Desktop\\{APP_TITLE}.lnk" >nul 2>&1
del /F /Q "%USERPROFILE%\\Desktop\\{APP_TITLE}.lnk" >nul 2>&1
powershell -Command "Start-Sleep -Seconds 1; Remove-Item -Path '{TARGET_DIR}' -Recurse -Force -ErrorAction SilentlyContinue"
msg * "Da go bo phan mem In Tem XP-350B thanh cong khoi may tinh!" >nul 2>&1
exit /b
"""
    uninstaller.write_text(uninstaller_content, encoding="ascii")

    public_desktop = Path(os.environ.get("PUBLIC", r"C:\Users\Public")) / "Desktop"
    user_desktop = Path(os.environ.get("USERPROFILE", "")) / "Desktop"

    shortcut_name = f"{APP_TITLE}.lnk"
    if public_desktop.exists():
        create_shortcut(dest_exe, dest_ico, public_desktop / shortcut_name)
    if user_desktop.exists():
        create_shortcut(dest_exe, dest_ico, user_desktop / shortcut_name)

    register_uninstall(TARGET_DIR, dest_exe, dest_ico, uninstaller)

    subprocess.Popen([str(dest_exe)], cwd=str(TARGET_DIR))

    ctypes.windll.user32.MessageBoxW(
        0,
        "Đã cài đặt phần mềm In Tem XP-350B thành công!\n\n"
        "- Đã tạo biểu tượng ngoài màn hình Desktop.\n"
        "- Có thể gỡ cài đặt trong Control Panel (Programs and Features).\n"
        "- Đang mở giao diện in tại http://127.0.0.1:9638/...",
        "Cài Đặt Thành Công - Tiến Uyên",
        0x40
    )

if __name__ == "__main__":
    main()
