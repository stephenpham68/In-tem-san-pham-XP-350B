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


def get_detected_printer():
    try:
        import win32print
        installed = [p[2] for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
        if PRINTER_DEFAULT in installed:
            return PRINTER_DEFAULT
        for p in installed:
            nl = p.lower()
            if "350b" in nl or "xp-350" in nl or "xp350" in nl or "xprinter" in nl:
                return p
    except Exception:
        pass
    return PRINTER_DEFAULT


def get_active_printer():
    target = get_detected_printer()
    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
    handle = c_void_p()
    if winspool.OpenPrinterW(target, byref(handle), None):
        winspool.ClosePrinter(handle)
        return target
    return None


def printer_exists():
    return get_active_printer() is not None


def png_to_tspl(raw_png, copies, settings=None):
    if settings:
        paper_width = max(20.0, min(82.0, float(settings.get("paperWidth", 76))))
        paper_height = max(5.0, min(100.0, float(settings.get("paperHeight", 22))))
        gap = max(0.0, min(10.0, float(settings.get("gap", 3))))
    else:
        paper_width, paper_height, gap = 76.0, 22.0, 3.0
    image = Image.open(io.BytesIO(raw_png)).convert("RGB")
    expected_size = (round(paper_width * 8), round(paper_height * 8))
    if image.size != expected_size:
        image = image.resize(expected_size, Image.Resampling.LANCZOS)
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
        f"DENSITY 8\r\nCLS\r\nBITMAP 0,0,{row_bytes},{height},0,"
    ).encode("ascii")
    job = head + bytes(raster) + f"\r\nPRINT {copies},1\r\n".encode("ascii")
    return job


def raw_print(payload):
    target_printer = get_active_printer() or PRINTER_DEFAULT
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
            detected = get_active_printer()
            if detected:
                self.send_json(200, {"ready": True, "message": f"{detected} sẵn sàng", "printer": detected})
            else:
                self.send_json(200, {"ready": False, "message": "Chưa kết nối XP-350B (cắm cáp USB)"})
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
            opened = False
            try:
                subprocess.Popen(["explorer.exe", folder_str])
                opened = True
            except Exception:
                try:
                    os.startfile(folder_str)
                    opened = True
                except Exception:
                    pass
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
                    "price": str(body.get("price") or "").strip(),
                    "barcode": str(body.get("barcode") or "").strip(),
                    "copies": max(1, min(100, int(body.get("copies", 1)))),
                    "updatedAt": time.strftime("%Y-%m-%d %H:%M:%S"),
                }
                target_file.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
                self.send_json(200, {"ok": True, "template": record})
            except Exception as error:
                self.send_json(500, {"ok": False, "message": str(error)})
            return

        if path == "/api/print":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = json.loads(self.rfile.read(length))
                copies = max(1, min(100, int(body.get("copies", 1))))
                encoded = body["image"].split(",", 1)[1]
                raw_print(png_to_tspl(base64.b64decode(encoded), copies, body.get("settings")))
                self.send_json(200, {"ok": True, "message": f"Đã gửi {copies} hàng tem tới XP-350B"})
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
