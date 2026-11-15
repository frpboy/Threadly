"""Mock Sentry ingest server for release-path crash-capture qualification.

Receives envelope POSTs at /api/<project_id>/envelope/ exactly where the
Sentry Android SDK sends them, stores each decompressed envelope as
env-<n>.bin in the output directory, and answers 200 like real ingest.
Loopback-only, synthetic CI use; never proxies anywhere.
"""
import argparse, gzip, http.server, os, re, socketserver, sys

class Handler(http.server.BaseHTTPRequestHandler):
    out_dir = "."
    counter = 0

    def log_message(self, fmt, *args):
        sys.stderr.write("mock-ingest: " + fmt % args + "\n")

    def _json(self, code, body):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._json(200, "{}")
        else:
            self._json(404, "{}")

    def do_POST(self):
        if not re.fullmatch(r"/api/\d+/envelope/", self.path or ""):
            self._json(404, "{}")
            return
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length)
        if (self.headers.get("Content-Encoding") or "").lower() == "gzip":
            body = gzip.decompress(body)
        type(self).counter += 1
        name = os.path.join(self.out_dir, "env-%03d.bin" % type(self).counter)
        with open(name, "wb") as f:
            f.write(body)
        sys.stderr.write("mock-ingest: stored %s (%d bytes)\n" % (name, len(body)))
        self._json(200, '{"id":"0123456789abcdef0123456789abcdef"}')

class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["serve"])
    ap.add_argument("--port", type=int, default=8971)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    Handler.out_dir = args.out
    with Server(("127.0.0.1", args.port), Handler) as srv:
        sys.stderr.write("mock-ingest: listening on 127.0.0.1:%d, out=%s\n" % (args.port, args.out))
        srv.serve_forever()

if __name__ == "__main__":
    main()
