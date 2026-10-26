"""Servidor local de desenvolvimento: igual ao `python -m http.server`, mas sem cache,
para o navegador sempre pegar a versão mais nova dos arquivos."""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
root = Path(__file__).resolve().parent.parent
server = ThreadingHTTPServer(("127.0.0.1", port), partial(NoCacheHandler, directory=str(root)))
print(f"Puzzle Hunt em http://localhost:{port}")
server.serve_forever()
