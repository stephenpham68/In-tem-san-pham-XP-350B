import base64
import ctypes
import io
import json
import mimetypes
import socket
import sys
import threading
import time
import webbrowser
from ctypes import POINTER, Structure, byref, c_bool, c_uint32, c_void_p, c_wchar_p
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

import os
import re
import subprocess
from urllib.parse import parse_qs, unquote, urlparse

from PIL import Image

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

if getattr(sys, "frozen", False):
    EXE_DIR = Path(sys.executable).resolve().parent
    ROOT = Path(getattr(sys, "_MEIPASS", EXE_DIR))
    DIST = ROOT / "dist"
else:
    EXE_DIR = Path(__file__).resolve().parent.parent
    ROOT = Path(__file__).resolve().parent.parent
    DIST = ROOT / "dist"


def get_templates_dir():
    # 1. Thu muc templates canh file chay (neu co quyen ghi - rat tien khi copy nguyen folder)
    local_dir = EXE_DIR / "templates"
    try:
        local_dir.mkdir(parents=True, exist_ok=True)
        test_file = local_dir / ".wtest"
        test_file.write_text("1", encoding="utf-8")
        test_file.unlink()
        return local_dir
    except Exception:
        pass

    # 2. Thu muc Documents cua User (dam bao luon ghi duoc 100% tren moi may Windows)
    docs_dir = Path(os.environ.get("USERPROFILE", ".")) / "Documents" / "InTemXP350B" / "templates"
    docs_dir.mkdir(parents=True, exist_ok=True)
    return docs_dir


TEMPLATES_DIR = get_templates_dir()


def open_folder_in_explorer(folder_path: Path) -> bool:
    folder_str = str(folder_path.resolve())
    opened = False

    # 1. Kỹ thuật 1: win32process với lpDesktop = "winsta0\\default"
    # Đây là kỹ thuật trực tiếp để hiển thị giao diện lên desktop người dùng kể cả khi tiến trình chạy ngầm
    try:
        import win32process
        si = win32process.STARTUPINFO()
        si.lpDesktop = r"winsta0\default"
        win32process.CreateProcess(None, f'explorer.exe "{folder_str}"', None, None, False, 0, None, None, si)
        opened = True
    except Exception:
        pass

    # 2. Kỹ thuật 2: cmd.exe start (lệnh nội bộ của Windows Shell)
    try:
        subprocess.Popen(f'start "" "{folder_str}"', shell=True)
        opened = True
    except Exception:
        pass

    # 3. Kỹ thuật 3: Gọi trực tiếp explorer.exe
    try:
        subprocess.Popen(["explorer.exe", folder_str])
        opened = True
    except Exception:
        pass

    # 4. Kỹ thuật 4: os.startfile
    try:
        os.startfile(folder_str)
        opened = True
    except Exception:
        pass

    return opened


def seed_sample_template():
    try:
        if not any(TEMPLATES_DIR.glob("*.json")):
            sample_file = TEMPLATES_DIR / "mau_trong_bong_04.json"
            sample_data = {
                "id": "mau_trong_bong_04",
                "name": "Trống Bông 04 (Mẫu chuẩn)",
                "brand": "TIẾN UYÊN",
                "product": "TRỐNG BÔNG 04",
                "price": "320.000đ",
                "barcode": "893751041",
                "copies": 1,
                "updatedAt": "2026-09-19 16:00:00",
            }
            sample_file.write_text(json.dumps(sample_data, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


seed_sample_template()

PRINTER_DEFAULT = "Xprinter XP-350B"
HOST = "127.0.0.1"
PORT = 9638


def is_port_in_use(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex((host, port)) == 0


def open_browser():
    time.sleep(1.2)
    webbrowser.open(f"http://{HOST}:{PORT}")


class DocInfo(Structure):
    _fields_ = [("pDocName", c_wchar_p), ("pOutputFile", c_wchar_p), ("pDataType", c_wchar_p)]


XP350B_KEYWORDS = ("350b", "xp-350", "xp350", "xprinter")
A6_KEYWORDS = ("gp-420", "420d", "420b", "by-482", "482", "xp-4", "450", "460", "470", "490", "gprinter", "beeprt", "hprt", "zebra", "tsc", "a6")
VIRTUAL_PRINTER_KEYWORDS = ("microsoft print to pdf", "adobe pdf", "xps document", "onenote", "fax")


def _is_tspl_driver(name: str, driver: str = "") -> bool:
    combined = f"{name} {driver}".lower()
    return not any(k in combined for k in VIRTUAL_PRINTER_KEYWORDS)


def list_printers():
    items = []
    default_name = ""
    try:
        import win32print
        try:
            default_name = win32print.GetDefaultPrinter()
        except Exception:
            default_name = ""
        flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        raw_printers = win32print.EnumPrinters(flags, None, 2)
        offline_flag = getattr(win32print, "PRINTER_ATTRIBUTE_WORK_OFFLINE", 0x00000400)
        for p in raw_printers:
            name = p.get("pPrinterName") or ""
            driver = p.get("pDriverName") or ""
            port = p.get("pPortName") or ""
            attrs = int(p.get("Attributes") or 0)
            online = not bool(attrs & offline_flag)
            lower = f"{name} {driver}".lower()
            is_virtual = any(k in lower for k in VIRTUAL_PRINTER_KEYWORDS)
            is_xp350b = any(k in lower for k in XP350B_KEYWORDS)
            is_a6 = (not is_xp350b) and (not is_virtual) and any(k in lower for k in A6_KEYWORDS)
            items.append({
                "name": name,
                "driver": driver,
                "port": port,
                "online": online,
                "isDefault": name == default_name,
                "isVirtual": is_virtual,
                "supportsTspl": _is_tspl_driver(name, driver),
                "isXp350b": is_xp350b,
                "isA6": is_a6,
            })
    except Exception:
        pass
    return items


def _pick_best_printer(printers, predicate, fallback_exact=None):
    if fallback_exact:
        exact_online = [p for p in printers if p["name"] == fallback_exact and p["online"]]
        if exact_online:
            return exact_online[0]["name"]
    matched = [p for p in printers if predicate(p)]
    if matched:
        matched.sort(key=lambda p: (
            0 if p["online"] else 1,
            0 if "usb" in (p["port"] or "").lower() else 1,
            0 if p["name"] == fallback_exact else 1,
        ))
        return matched[0]["name"]
    return None


def get_detected_printer():
    printers = list_printers()
    picked = _pick_best_printer(printers, lambda p: p["isXp350b"], PRINTER_DEFAULT)
    return picked or PRINTER_DEFAULT


def get_recommended_a6_printer():
    printers = list_printers()
    picked = _pick_best_printer(printers, lambda p: p["isA6"])
    if picked:
        return picked
    non_xp = _pick_best_printer(printers, lambda p: not p["isXp350b"] and not p["isVirtual"])
    return non_xp or ""


def get_active_printer(target_name=None):
    target = (target_name or "").strip() or get_detected_printer()
    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
    handle = c_void_p()
    if winspool.OpenPrinterW(target, byref(handle), None):
        winspool.ClosePrinter(handle)
        return target
    return None


def printer_exists(target_name=None):
    return get_active_printer(target_name) is not None


def _apply_rotation(image, rotate):
    transpose_enum = getattr(Image, "Transpose", Image)
    if rotate == 90:
        return image.transpose(transpose_enum.ROTATE_90)
    if rotate == 270:
        return image.transpose(transpose_enum.ROTATE_270)
    if rotate == 180:
        return image.transpose(transpose_enum.ROTATE_180)
    return image


def png_to_tspl(raw_png, copies, settings=None):
    if settings:
        paper_width = max(20.0, min(120.0, float(settings.get("paperWidth", 76))))
        paper_height = max(5.0, min(220.0, float(settings.get("paperHeight", 22))))
        gap = max(0.0, min(15.0, float(settings.get("gap", 3))))
        density = max(1, min(15, int(settings.get("density", 8))))
        rotate = int(settings.get("rotate", 0) or 0)
    else:
        paper_width, paper_height, gap, density, rotate = 76.0, 22.0, 3.0, 8, 0
    image = _apply_rotation(Image.open(io.BytesIO(raw_png)).convert("RGB"), rotate)
    expected_size = (round(paper_width * 8), round(paper_height * 8))
    if image.size != expected_size:
        resampling = getattr(Image, "Resampling", Image)
        image = image.resize(expected_size, resampling.LANCZOS)
    gray = image.convert("L")
    width, height = gray.size
    row_bytes = (width + 7) // 8
    # TSPL BITMAP uses 0 for a printed (black) dot and 1 for an unprinted
    # (white) dot. Start with a white canvas, then clear bits for dark pixels.
    raster = bytearray([0xFF]) * (row_bytes * height)
    pixels = gray.load()
    for y in range(height):
        for x in range(width):
            if pixels[x, y] < 150:
                raster[y * row_bytes + x // 8] &= ~(0x80 >> (x % 8))
    head = (
        f"SIZE {paper_width:g} mm,{paper_height:g} mm\r\nGAP {gap:g} mm,0 mm\r\nREFERENCE 0,0\r\nDIRECTION 1\r\n"
        f"DENSITY {density}\r\nCLS\r\nBITMAP 0,0,{row_bytes},{height},0,"
    ).encode("ascii")
    job = head + bytes(raster) + f"\r\nPRINT {copies},1\r\n".encode("ascii")
    return job


def raw_print(payload, printer_name=None):
    target_printer = get_active_printer(printer_name) or (printer_name or PRINTER_DEFAULT)
    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
    handle = c_void_p()
    if not winspool.OpenPrinterW(target_printer, byref(handle), None):
        raise OSError(f"Không tìm thấy máy in '{target_printer}'. Vui lòng cắm cáp USB và kiểm tra máy in.")
    try:
        info = DocInfo("XP-350B Dual Label", None, "RAW")
        if not winspool.StartDocPrinterW(handle, 1, byref(info)):
            raise OSError("Không thể tạo lệnh in")
        try:
            winspool.StartPagePrinter(handle)
            buffer = ctypes.create_string_buffer(payload)
            written = c_uint32()
            if not winspool.WritePrinter(handle, buffer, len(payload), byref(written)):
                raise OSError("Không thể gửi dữ liệu tới máy in")
            winspool.EndPagePrinter(handle)
        finally:
            winspool.EndDocPrinter(handle)
    finally:
        winspool.ClosePrinter(handle)


def gdi_print(raw_png, copies, printer_name, settings=None):
    import win32ui
    from PIL import ImageWin

    rotate = int((settings or {}).get("rotate", 0) or 0)
    image = _apply_rotation(Image.open(io.BytesIO(raw_png)).convert("RGB"), rotate)

    target_printer = get_active_printer(printer_name) or printer_name or get_detected_printer()
    hdc = win32ui.CreateDC()
    hdc.CreatePrinterDC(target_printer)
    try:
        printable_w = hdc.GetDeviceCaps(8)   # HORZRES
        printable_h = hdc.GetDeviceCaps(10)  # VERTRES
        img_w, img_h = image.size
        scale = min(printable_w / img_w, printable_h / img_h)
        draw_w = max(1, int(round(img_w * scale)))
        draw_h = max(1, int(round(img_h * scale)))
        offset_x = (printable_w - draw_w) // 2
        offset_y = (printable_h - draw_h) // 2

        dib = ImageWin.Dib(image)
        hdc.StartDoc("Label Print Job")
        try:
            for _ in range(copies):
                hdc.StartPage()
                dib.draw(hdc.GetHandleOutput(), (offset_x, offset_y, offset_x + draw_w, offset_y + draw_h))
                hdc.EndPage()
        finally:
            hdc.EndDoc()
    finally:
        hdc.DeleteDC()


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, value):
        data = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/status":
            params = parse_qs(parsed.query)
            req_printer = params.get("printer", [""])[0].strip() or None
            detected = get_active_printer(req_printer)
            if detected:
                printers = list_printers()
                matched = next((p for p in printers if p["name"] == detected), None)
                if matched and not matched["online"]:
                    self.send_json(200, {"ready": False, "message": f"{detected} đang Offline (kiểm tra nguồn/cáp USB)", "printer": detected})
                else:
                    self.send_json(200, {"ready": True, "message": f"{detected} sẵn sàng", "printer": detected})
            else:
                label = req_printer or "XP-350B"
                self.send_json(200, {"ready": False, "message": f"Chưa kết nối {label} (cắm cáp USB)"})
            return
        if path == "/api/printers":
            printers = list_printers()
            self.send_json(200, {
                "ok": True,
                "printers": printers,
                "recommendedXp350b": get_detected_printer(),
                "recommendedA6": get_recommended_a6_printer(),
            })
            return
        if path == "/api/templates":
            templates = []
            for f in sorted(TEMPLATES_DIR.glob("*.json"), key=os.path.getmtime, reverse=True):
                try:
                    data = json.loads(f.read_text(encoding="utf-8"))
                    if "id" not in data:
                        data["id"] = f.stem
                    templates.append(data)
                except Exception:
                    continue
            self.send_json(200, {"ok": True, "templates": templates, "folder": str(TEMPLATES_DIR.resolve())})
            return

        relative = unquote(path.lstrip("/")) or "index.html"
        file_path = (DIST / relative).resolve()
        if not str(file_path).startswith(str(DIST.resolve())) or not file_path.is_file():
            file_path = DIST / "index.html"
        if not file_path.is_file():
            self.send_error(503, "Chưa build giao diện")
            return
        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(file_path.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/templates/open-folder":
            folder_str = str(TEMPLATES_DIR.resolve())
            opened = open_folder_in_explorer(TEMPLATES_DIR)
            self.send_json(200, {"ok": True, "opened": opened, "folder": folder_str})
            return

        if path == "/api/templates":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length))
                raw_id = str(body.get("id") or "").strip()
                if not raw_id:
                    # Tao id moi tu ten hoac timestamp
                    slug = re.sub(r"[^a-zA-Z0-9]", "", body.get("product", ""))[:12]
                    raw_id = f"tpl_{int(time.time())}_{slug}" if slug else f"tpl_{int(time.time())}"
                safe_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_id).strip("_") or f"tpl_{int(time.time())}"
                target_file = TEMPLATES_DIR / f"{safe_id}.json"

                record = {
                    "id": safe_id,
                    "name": str(body.get("name") or body.get("product") or "Mẫu tem").strip(),
                    "brand": str(body.get("brand") or "").strip(),
                    "product": str(body.get("product") or "").strip(),
                    "subText": str(body.get("subText") or "").strip(),
                    "nameLayout": str(body.get("nameLayout") or "single").strip(),
                    "price": str(body.get("price") or "").strip(),
                    "barcode": str(body.get("barcode") or "").strip(),
                    "textNote": str(body.get("textNote") or ""),
                    "textOptions": body.get("textOptions") if isinstance(body.get("textOptions"), dict) else None,
                    "copies": max(1, min(100, int(body.get("copies", 1)))),
                    "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                if record["textOptions"] is None:
                    record.pop("textOptions", None)
                if not record["textNote"]:
                    record.pop("textNote", None)
                target_file.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                self.send_json(200, {"ok": True, "template": record})
            except Exception as error:
                self.send_json(500, {"ok": False, "message": str(error)})
            return

        if path == "/api/templates/batch-delete":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length))
                ids = body.get("ids", [])
                deleted = []
                for raw_id in ids:
                    safe_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", str(raw_id)).strip("_")
                    if safe_id:
                        target_file = TEMPLATES_DIR / f"{safe_id}.json"
                        if target_file.is_file():
                            try:
                                target_file.unlink()
                                deleted.append(safe_id)
                            except Exception:
                                pass
                self.send_json(200, {"ok": True, "count": len(deleted), "deleted": deleted})
            except Exception as error:
                self.send_json(500, {"ok": False, "message": str(error)})
            return

        if path == "/api/print":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length))
                copies = max(1, min(100, int(body.get("copies", 1))))
                target_printer = str(body.get("printer") or "").strip() or None
                print_mode = str(body.get("printMode") or "auto").strip().lower()
                settings = body.get("settings")
                images = body.get("images")
                if not isinstance(images, list) or not images:
                    images = [body["image"]]

                effective_printer = target_printer or get_detected_printer()
                if print_mode == "auto":
                    use_gdi = not _is_tspl_driver(effective_printer)
                else:
                    use_gdi = print_mode == "gdi"

                for img_data in images:
                    encoded = img_data.split(",", 1)[1] if "," in img_data else img_data
                    raw_bytes = base64.b64decode(encoded)
                    if use_gdi:
                        gdi_print(raw_bytes, copies, effective_printer, settings)
                    else:
                        raw_print(png_to_tspl(raw_bytes, copies, settings), effective_printer)

                unit = "tờ/nhãn" if len(images) > 1 else "lệnh"
                self.send_json(200, {
                    "ok": True,
                    "message": f"Đã gửi {len(images)} {unit} (×{copies} bản) tới {effective_printer}",
                    "printer": effective_printer,
                })
            except Exception as error:
                self.send_json(500, {"ok": False, "message": str(error)})
            return

        self.send_error(404)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/templates":
            try:
                params = parse_qs(parsed.query)
                raw_id = params.get("id", [""])[0]
                safe_id = re.sub(r"[^a-zA-Z0-9_\-]", "_", raw_id).strip("_")
                target_file = TEMPLATES_DIR / f"{safe_id}.json"
                if target_file.is_file():
                    target_file.unlink()
                    self.send_json(200, {"ok": True, "deleted": safe_id})
                else:
                    self.send_json(404, {"ok": False, "message": "Không tìm thấy file mẫu"})
            except Exception as error:
                self.send_json(500, {"ok": False, "message": str(error)})
            return
        self.send_error(404)

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


if __name__ == "__main__":
    if is_port_in_use(PORT):
        print(f"He thong da khoi dong tai http://{HOST}:{PORT}. Dang mo trinh duyet...")
        webbrowser.open(f"http://{HOST}:{PORT}")
        sys.exit(0)

    print(f"XP-350B Dual Label Printer: http://{HOST}:{PORT}")
    threading.Thread(target=open_browser, daemon=True).start()
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
