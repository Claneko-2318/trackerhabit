#!/usr/bin/env python3
"""Avvia il tracker su un indirizzo locale condiviso tra tutte le pagine."""
from __future__ import annotations

import contextlib
import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path

HOST = "127.0.0.1"
PORT = 8765
ROOT = Path(__file__).resolve().parent

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def main() -> None:
    handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(  # noqa: E731
        *args, directory=str(ROOT), **kwargs
    )
    with ReusableTCPServer((HOST, PORT), handler) as server:
        url = f"http://{HOST}:{PORT}/index.html"
        print("Tracker personale avviato.")
        print(f"Apri: {url}")
        print("Per chiudere il tracker, torna qui e premi Ctrl+C.")
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        with contextlib.suppress(KeyboardInterrupt):
            server.serve_forever()


if __name__ == "__main__":
    main()
