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
APP_SHORTCUT = "In Tem San Pham XP-350B.lnk"
UNINSTALL_KEY = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\In-tem-san-pham-XP-350B"


def is_admin():
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except Exception:
        return False


def run_as_admin():
    if getattr(sys, "frozen", False):
        exe = sys.executable
        params = " ".join(f'"{arg}"' for arg in sys.argv[1:])
    else:
        exe = sys.executable
        params = f'"{__file__}" ' + " ".join(f'"{arg}"' for arg in sys.argv[1:])
    ret = ctypes.windll.shell32.ShellExecuteW(None, "runas", exe, params, None, 1)
    if ret > 32:
        sys.exit(0)


def create_shortcut(target_exe, icon_path, shortcut_path):
    try:
        import win32com.client
        shell = win32com.client.Dispatch("WScript.Shell")
        sc = shell.CreateShortCut(str(shortcut_path))
        sc.TargetPath = str(target_exe)
        sc.WorkingDirectory = str(target_exe.parent)
        sc.IconLocation = f"{icon_path},0"
        sc.Description = "Phan mem in tem san pham XP-350B"
        sc.Save()
    except Exception:
        vbs = (
            f'Set w = CreateObject("WScript.Shell")\r\n'
            f'Set s = w.CreateShortcut("{shortcut_path}")\r\n'
            f's.TargetPath = "{target_exe}"\r\n'
            f's.WorkingDirectory = "{target_exe.parent}"\r\n'
            f's.IconLocation = "{icon_path},0"\r\n'
            f's.Save\r\n'
        )
        temp_vbs = Path(os.environ.get("TEMP", ".")) / "mk_sc.vbs"
        temp_vbs.write_text(vbs, encoding="ascii")
        subprocess.run(["cscript", "//nologo", str(temp_vbs)], capture_output=True, creationflags=0x08000000)
        try:
            temp_vbs.unlink(missing_ok=True)
        except Exception:
            pass


def register_uninstall(target_dir, exe_path, ico_path, uninstaller_path):
    # Xoa bo ban ghi trung lap o HKCU de Control Panel chi hien thi duy nhat 1 dong
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Uninstall", 0, winreg.KEY_SET_VALUE) as root:
            winreg.DeleteKey(root, "In-tem-san-pham-XP-350B")
    except Exception:
        pass

    # Dang ky duy nhat vao HKLM (neu co quyen admin) hoac HKCU (neu khong co admin)
    registered = False
    try:
        with winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, UNINSTALL_KEY) as key:
            winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, "In Tem Sản Phẩm 2 Hàng (Xprinter XP-350B)")
            winreg.SetValueEx(key, "DisplayIcon", 0, winreg.REG_SZ, str(ico_path))
            winreg.SetValueEx(key, "DisplayVersion", 0, winreg.REG_SZ, "1.0.0")
            winreg.SetValueEx(key, "Publisher", 0, winreg.REG_SZ, "Open Source Community")
            winreg.SetValueEx(key, "InstallLocation", 0, winreg.REG_SZ, str(target_dir))
            winreg.SetValueEx(key, "UninstallString", 0, winreg.REG_SZ, f'cmd.exe /c "{uninstaller_path}"')
            winreg.SetValueEx(key, "NoModify", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, "NoRepair", 0, winreg.REG_DWORD, 1)
            winreg.SetValueEx(key, "EstimatedSize", 0, winreg.REG_DWORD, 32000)
            registered = True
    except Exception:
        pass

    if not registered:
        try:
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, UNINSTALL_KEY) as key:
                winreg.SetValueEx(key, "DisplayName", 0, winreg.REG_SZ, "In Tem Sản Phẩm 2 Hàng (Xprinter XP-350B)")
                winreg.SetValueEx(key, "DisplayIcon", 0, winreg.REG_SZ, str(ico_path))
                winreg.SetValueEx(key, "DisplayVersion", 0, winreg.REG_SZ, "1.0.0")
                winreg.SetValueEx(key, "Publisher", 0, winreg.REG_SZ, "Open Source Community")
                winreg.SetValueEx(key, "InstallLocation", 0, winreg.REG_SZ, str(target_dir))
                winreg.SetValueEx(key, "UninstallString", 0, winreg.REG_SZ, f'cmd.exe /c "{uninstaller_path}"')
                winreg.SetValueEx(key, "NoModify", 0, winreg.REG_DWORD, 1)
                winreg.SetValueEx(key, "NoRepair", 0, winreg.REG_DWORD, 1)
                winreg.SetValueEx(key, "EstimatedSize", 0, winreg.REG_DWORD, 32000)
        except Exception:
            pass


def main():
    if not is_admin():
        run_as_admin()

    try:
        # Kill running instances if open
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

        # Create uninstaller batch script with UTF-8
        uninstaller = TARGET_DIR / "Go-Cai-Dat.bat"
        uninstaller_content = (
            "@echo off\r\n"
            "chcp 65001 >nul\r\n"
            "net session >nul 2>&1\r\n"
            "if %errorLevel% neq 0 (\r\n"
            '    powershell -Command "Start-Process cmd -ArgumentList \'/c \\"\\"%~f0\\"\\"\' -Verb RunAs"\r\n'
            "    exit /b\r\n"
            ")\r\n"
            f"taskkill /F /IM {EXE_NAME} >nul 2>&1\r\n"
            f'reg delete "HKLM\\{UNINSTALL_KEY}" /f >nul 2>&1\r\n'
            f'reg delete "HKCU\\{UNINSTALL_KEY}" /f >nul 2>&1\r\n'
            f'del /F /Q "%PUBLIC%\\Desktop\\{APP_SHORTCUT}" >nul 2>&1\r\n'
            f'del /F /Q "%USERPROFILE%\\Desktop\\{APP_SHORTCUT}" >nul 2>&1\r\n'
            'del /F /Q "%PUBLIC%\\Desktop\\In Tem Tien Uyen (XP-350B).lnk" >nul 2>&1\r\n'
            'del /F /Q "%USERPROFILE%\\Desktop\\In Tem Tien Uyen (XP-350B).lnk" >nul 2>&1\r\n'
            f'powershell -Command "Start-Sleep -Seconds 1; Remove-Item -Path \'{TARGET_DIR}\' -Recurse -Force -ErrorAction SilentlyContinue"\r\n'
            'echo Da go bo phan mem thanh cong!\r\n'
            "timeout /t 2 >nul\r\n"
            "exit /b\r\n"
        )
        uninstaller.write_text(uninstaller_content, encoding="utf-8")

        # Create Desktop shortcuts
        public_desktop = Path(os.environ.get("PUBLIC", r"C:\Users\Public")) / "Desktop"
        user_desktop = Path(os.environ.get("USERPROFILE", "")) / "Desktop"

        if public_desktop.exists():
            create_shortcut(dest_exe, dest_ico, public_desktop / APP_SHORTCUT)
        if user_desktop.exists():
            create_shortcut(dest_exe, dest_ico, user_desktop / APP_SHORTCUT)

        # Xoa shortcut cu neu co
        try:
            (public_desktop / "In Tem Tien Uyen (XP-350B).lnk").unlink(missing_ok=True)
            (user_desktop / "In Tem Tien Uyen (XP-350B).lnk").unlink(missing_ok=True)
        except Exception:
            pass

        # Register in Control Panel
        register_uninstall(TARGET_DIR, dest_exe, dest_ico, uninstaller)

        # Launch the application
        subprocess.Popen([str(dest_exe)], cwd=str(TARGET_DIR))

        ctypes.windll.user32.MessageBoxW(
            0,
            "Cài đặt phần mềm In Tem Sản Phẩm 2 Hàng (XP-350B) thành công!\n\n"
            "- Thư mục: C:\\Program Files\\In-tem-san-pham-XP-350B\n"
            "- Đã tạo biểu tượng ngoài màn hình Desktop.\n"
            "- Quản lý gỡ cài đặt: Control Panel (Programs and Features).\n"
            "- Hệ thống đang tự động mở web tại http://127.0.0.1:9638/...",
            "Cài Đặt Hoàn Tất",
            0x40
        )
    except Exception as err:
        ctypes.windll.user32.MessageBoxW(
            0,
            f"Có lỗi xảy ra trong quá trình cài đặt:\n{err}",
            "Lỗi Cài Đặt",
            0x10
        )


if __name__ == "__main__":
    main()
