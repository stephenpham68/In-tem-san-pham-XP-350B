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
    ROOT = Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent))
    DIST = ROOT / "dist"
else:
    ROOT = Path(__file__).resolve().parent.parent
    DIST = ROOT / "dist"

PRINTER = "Xprinter XP-350B"
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


def printer_exists():
    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
    handle = c_void_p()
    ok = winspool.OpenPrinterW(PRINTER, byref(handle), None)
    if ok:
        winspool.ClosePrinter(handle)
    return bool(ok)


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
    winspool = ctypes.WinDLL("winspool.drv", use_last_error=True)
    handle = c_void_p()
    if not winspool.OpenPrinterW(PRINTER, byref(handle), None):
        raise OSError("Không tìm thấy máy in XP-350B")
    try:
        info = DocInfo("Tien Uyen label", None, "RAW")
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
        path = urlparse(self.path).path
        if path == "/api/status":
            ready = printer_exists()
            self.send_json(200, {"ready": ready, "message": "XP-350B đã sẵn sàng" if ready else "Không tìm thấy XP-350B"})
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
        if urlparse(self.path).path != "/api/print":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length))
            copies = max(1, min(100, int(body.get("copies", 1))))
            encoded = body["image"].split(",", 1)[1]
            raw_print(png_to_tspl(base64.b64decode(encoded), copies, body.get("settings")))
            self.send_json(200, {"ok": True, "message": f"Đã gửi {copies} hàng tem tới XP-350B"})
        except Exception as error:
            self.send_json(500, {"ok": False, "message": str(error)})

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")


if __name__ == "__main__":
    if is_port_in_use(PORT):
        print(f"He thong da khoi dong tai http://{HOST}:{PORT}. Dang mo trinh duyet...")
        webbrowser.open(f"http://{HOST}:{PORT}")
        sys.exit(0)

    print(f"Tien Uyen Label Printer: http://{HOST}:{PORT}")
    threading.Thread(target=open_browser, daemon=True).start()
    try:
        ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
