import json
import os
from urllib.parse import parse_qs, urlparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from snapshot import build_accerciser_snapshot, build_debug_snapshot, build_raw_snapshot, build_snapshot
from input import click, fill, open_browser, press, scroll, shutdown_browser


HOST = os.environ.get("WORKSPACE_AUTOMATION_HOST", "0.0.0.0")
PORT = int(os.environ.get("WORKSPACE_AUTOMATION_PORT", "8765"))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        if path == "/health":
            self._json(200, {"ok": True, "service": "agent-automation"})
            return
        if path == "/snapshot":
            mode = (query.get("mode") or ["expanded"])[0]
            self._json(200, build_snapshot(mode))
            return
        if path == "/raw_snapshot":
            self._json(200, build_raw_snapshot())
            return
        if path == "/accerciser_snapshot":
            self._json(200, build_accerciser_snapshot())
            return
        if path == "/debug_snapshot":
            mode = (query.get("mode") or ["expanded"])[0]
            self._json(200, build_debug_snapshot(mode))
            return
        self._json(404, {"ok": False, "message": "Not found"})

    def do_POST(self):
        body = self._body()
        try:
            if self.path == "/click":
                self._json(200, click(str(body.get("snapshot_id", "")), str(body.get("ref", ""))))
                return
            if self.path == "/fill":
                self._json(
                    200,
                    fill(
                        str(body.get("snapshot_id", "")),
                        str(body.get("ref", "")),
                        str(body.get("text", "")),
                        str(body.get("mode", "replace")),
                    ),
                )
                return
            if self.path == "/press":
                self._json(200, press(str(body.get("keys", ""))))
                return
            if self.path == "/scroll":
                self._json(200, scroll(str(body.get("direction", "down")), str(body.get("amount", "small"))))
                return
            if self.path == "/open_browser":
                url = body.get("url")
                self._json(200, open_browser(url if isinstance(url, str) and url.strip() else None))
                return
            if self.path == "/shutdown_browser":
                self._json(200, shutdown_browser())
                return
            self._json(404, {"ok": False, "message": "Not found"})
        except Exception as error:
            self._json(400, {"ok": False, "message": str(error)})


if __name__ == "__main__":
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
