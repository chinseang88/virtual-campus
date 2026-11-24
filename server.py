"""Local HTTP + optional live multi-user sync server for PG17 Voxel Tower (zero external dependencies)."""
import json
import os
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PLAYERS = {}
CHAT_LOG = []
LOCK = threading.Lock()
PLAYER_TIMEOUT_SEC = 6.0


class PG17Handler(SimpleHTTPRequestHandler):
    def _send_json(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode('utf-8'))
        except Exception as exc:
            self.send_error(400, str(exc))
            return

        if self.path == '/api/sync':
            pid = str(payload.get('id', ''))[:24]
            now = time.time()
            with LOCK:
                if pid:
                    PLAYERS[pid] = {
                        'id': pid,
                        'name': str(payload.get('name', 'Guest'))[:24],
                        'level': int(payload.get('level', 1)),
                        'x': float(payload.get('x', 28.0)),
                        'y': float(payload.get('y', 2.0)),
                        'z': float(payload.get('z', 26.0)),
                        'yaw': float(payload.get('yaw', 0.0)),
                        'ts': now,
                    }
                stale = [k for k, v in PLAYERS.items() if now - v['ts'] > PLAYER_TIMEOUT_SEC]
                for k in stale:
                    del PLAYERS[k]
                since_id = int(payload.get('sinceChatId', 0))
                new_chats = [c for c in CHAT_LOG if c['id'] > since_id]
                active = list(PLAYERS.values())
            self._send_json(200, {'players': active, 'chats': new_chats})
            return

        if self.path == '/api/chat':
            sender = str(payload.get('sender', 'Guest'))[:32]
            text = str(payload.get('text', ''))[:160]
            target = str(payload.get('target', ''))[:32]
            now = time.time()
            with LOCK:
                cid = (CHAT_LOG[-1]['id'] + 1) if CHAT_LOG else 1
                msg = {'id': cid, 'sender': sender, 'text': text, 'target': target, 'ts': now}
                CHAT_LOG.append(msg)
                if len(CHAT_LOG) > 60:
                    del CHAT_LOG[:-60]
            self._send_json(200, {'ok': True, 'msg': msg})
            return

        self.send_error(404)

    def log_message(self, format, *args):
        pass


if __name__ == '__main__':
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    port = int(os.environ.get('PORT', 8081))
    server = ThreadingHTTPServer(('0.0.0.0', port), PG17Handler)
    print(f'PG17 Voxel Tower running at http://localhost:{port}')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
