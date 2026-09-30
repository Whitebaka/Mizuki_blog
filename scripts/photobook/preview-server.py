#!/usr/bin/env python3
"""LAN-only static acceptance preview. Serve a built dist directory, never source."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class PreviewHandler(SimpleHTTPRequestHandler):
    def list_directory(self, path):
        self.send_error(404)
        return None

    def end_headers(self):
        self.send_header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--directory',required=True)
    parser.add_argument('--bind',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=4321)
    args=parser.parse_args()
    server=ThreadingHTTPServer((args.bind,args.port),partial(PreviewHandler,directory=args.directory))
    server.serve_forever()
