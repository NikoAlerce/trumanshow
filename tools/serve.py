"""Static dev server with CORS + no-cache headers (behaves like an IPFS gateway).

python tools/serve.py [port]   -> serves the project root, open /dist/index.html

Dev only: POST /__capture?name=file.jpg stores the request body in captures/
(used to grab the cover image straight from the WebGL canvas).
"""
import http.server
import re
import socketserver
import sys
from functools import partial
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
CAPTURES = ROOT / "captures"


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".webp": "image/webp",
        ".bin": "application/octet-stream",
    }

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        url = urlparse(self.path)
        if url.path != "/__capture":
            self.send_error(404)
            return
        name = parse_qs(url.query).get("name", ["capture.jpg"])[0]
        name = re.sub(r"[^A-Za-z0-9_.-]", "_", name)[:64] or "capture.jpg"
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0 or length > 40 * 1024 * 1024:
            self.send_error(400)
            return
        data = self.rfile.read(length)
        CAPTURES.mkdir(exist_ok=True)
        (CAPTURES / name).write_bytes(data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("127.0.0.1", port), partial(Handler, directory=str(ROOT))) as httpd:
        print(f"serving {ROOT} on http://127.0.0.1:{port}")
        httpd.serve_forever()
