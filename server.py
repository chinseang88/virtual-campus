"""Local HTTP + Microsoft Entra ID SSO + live multi-user sync server for Virtual Intel Campus (zero external deps)."""
import base64
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PLAYERS = {}
CHAT_LOG = []
OAUTH_STATES = {}     # state -> { 'ts': float, 'redirect_uri': str, 'next_url': str }
SSO_SESSIONS = {}     # sid -> { 'user': {...}, 'ts': float }
ONE_TIME_CODES = {}   # sso_code -> { 'user': {...}, 'ts': float }
LOCK = threading.Lock()
PLAYER_TIMEOUT_SEC = 6.0
SESSION_TTL_SEC = 86400.0
ALLOWED_BRIDGE_ORIGINS = {
    'https://chinseang88.github.io',
    'https://ecebuildplus.app.intel.com',
}


def load_env_file(env_path):
    """Load KEY=VALUE pairs from local .env without overwriting existing os.environ."""
    if not os.path.exists(env_path):
        return
    with open(env_path, 'r', encoding='utf-8') as f:
        for raw_line in f:
            line = raw_line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k = k.strip()
            v = v.strip().strip('"').strip("'")
            if k and k not in os.environ:
                os.environ[k] = v


def get_sso_config():
    return {
        'client_id': os.environ.get('CLIENT_ID', '').strip(),
        'client_secret': os.environ.get('CLIENT_SECRET', '').strip(),
        'authority': os.environ.get('AUTHORITY', '').strip().rstrip('/'),
        'redirect_path': os.environ.get('REDIRECT_PATH', '/auth/auth-response').strip() or '/auth/auth-response',
        'scopes': os.environ.get('AUTH_SCOPES', 'User.ReadBasic.All').strip(),
        'public_base_url': os.environ.get('PUBLIC_BASE_URL', '').strip().rstrip('/'),
    }


def decode_jwt_payload(token):
    try:
        parts = token.split('.')
        if len(parts) < 2:
            return {}
        b64 = parts[1].replace('-', '+').replace('_', '/')
        b64 += '=' * ((4 - len(b64) % 4) % 4)
        return json.loads(base64.b64decode(b64).decode('utf-8'))
    except Exception:
        return {}


def is_safe_next_url(next_url, own_origin):
    if not next_url:
        return False
    if next_url.startswith('/') and not next_url.startswith('//'):
        return True
    parsed = urllib.parse.urlparse(next_url)
    origin = f'{parsed.scheme}://{parsed.netloc}'
    return origin == own_origin or origin in ALLOWED_BRIDGE_ORIGINS


class PG17Handler(SimpleHTTPRequestHandler):
    def _cors_headers(self):
        origin = self.headers.get('Origin', '')
        if origin in ALLOWED_BRIDGE_ORIGINS:
            return [
                ('Access-Control-Allow-Origin', origin),
                ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
                ('Access-Control-Allow-Headers', 'Content-Type'),
                ('Vary', 'Origin'),
            ]
        return []

    def _send_json(self, code, obj, extra_headers=None):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        for k, v in self._cors_headers():
            self.send_header(k, v)
        if extra_headers:
            for k, v in extra_headers:
                self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _redirect(self, location, extra_headers=None):
        self.send_response(302)
        self.send_header('Location', location)
        self.send_header('Cache-Control', 'no-store')
        if extra_headers:
            for k, v in extra_headers:
                self.send_header(k, v)
        self.end_headers()

    def _get_origin(self, cfg=None):
        if cfg and cfg.get('public_base_url'):
            return cfg['public_base_url']
        host = self.headers.get('X-Forwarded-Host') or self.headers.get('Host') or 'localhost:8081'
        proto = self.headers.get('X-Forwarded-Proto', '').strip().lower()
        if not proto:
            is_local = host.startswith('localhost') or host.startswith('127.0.0.1')
            proto = 'http' if is_local else 'https'
        return f'{proto}://{host}'

    def _get_sid(self):
        raw_cookie = self.headers.get('Cookie', '')
        if not raw_cookie:
            return None
        c = SimpleCookie()
        try:
            c.load(raw_cookie)
        except Exception:
            return None
        m = c.get('vc_sso_sid')
        return m.value if m else None

    def _get_session_user(self):
        sid = self._get_sid()
        if not sid:
            return None
        with LOCK:
            sess = SSO_SESSIONS.get(sid)
            if not sess:
                return None
            if time.time() - sess['ts'] > SESSION_TTL_SEC:
                del SSO_SESSIONS[sid]
                return None
            return sess['user']

    def _handle_auth_login(self, cfg, query_str=''):
        if not (cfg['client_id'] and cfg['client_secret'] and cfg['authority']):
            self._redirect('/?sso_error=' + urllib.parse.quote('Entra SSO env vars not configured in .env'))
            return
        qs = urllib.parse.parse_qs(query_str)
        own_origin = self._get_origin(cfg)
        raw_next = qs.get('next', [''])[0]
        next_url = raw_next if is_safe_next_url(raw_next, own_origin) else '/'

        state = secrets.token_urlsafe(24)
        redirect_uri = own_origin + cfg['redirect_path']
        now = time.time()
        with LOCK:
            for k in [k for k, v in OAUTH_STATES.items() if now - v['ts'] > 600]:
                del OAUTH_STATES[k]
            OAUTH_STATES[state] = {'ts': now, 'redirect_uri': redirect_uri, 'next_url': next_url}

        scope_str = f"openid profile email {cfg['scopes']}".strip()
        params = urllib.parse.urlencode({
            'client_id': cfg['client_id'],
            'response_type': 'code',
            'redirect_uri': redirect_uri,
            'response_mode': 'query',
            'scope': scope_str,
            'state': state,
            'prompt': 'select_account',
        })
        self._redirect(f"{cfg['authority']}/oauth2/v2.0/authorize?{params}")

    def _handle_auth_callback(self, cfg, query_str):
        qs = urllib.parse.parse_qs(query_str)
        if 'error' in qs:
            err = qs.get('error_description', qs.get('error', ['SSO failed']))[0]
            self._redirect('/?sso_error=' + urllib.parse.quote(err[:220]))
            return

        code = qs.get('code', [''])[0]
        state = qs.get('state', [''])[0]
        with LOCK:
            st_info = OAUTH_STATES.pop(state, None)
        if not code or not st_info:
            self._redirect('/?sso_error=' + urllib.parse.quote('Invalid or expired SSO state. Please try again.'))
            return

        next_url = st_info.get('next_url') or '/'
        token_url = f"{cfg['authority']}/oauth2/v2.0/token"
        scope_str = f"openid profile email {cfg['scopes']}".strip()
        form = urllib.parse.urlencode({
            'client_id': cfg['client_id'],
            'client_secret': cfg['client_secret'],
            'grant_type': 'authorization_code',
            'code': code,
            'redirect_uri': st_info['redirect_uri'],
            'scope': scope_str,
        }).encode('utf-8')

        try:
            req = urllib.request.Request(
                token_url,
                data=form,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
            with urllib.request.urlopen(req, timeout=12) as resp:
                tokens = json.loads(resp.read().decode('utf-8'))
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode('utf-8', errors='ignore')
            self._redirect('/?sso_error=' + urllib.parse.quote(f'Token exchange failed ({exc.code}): {detail[:160]}'))
            return
        except Exception as exc:
            self._redirect('/?sso_error=' + urllib.parse.quote(f'Token error: {exc}'))
            return

        claims = decode_jwt_payload(tokens.get('id_token', ''))
        graph_user = {}
        access_token = tokens.get('access_token', '')
        if access_token:
            try:
                greq = urllib.request.Request(
                    'https://graph.microsoft.com/v1.0/me?$select=displayName,mail,userPrincipalName,jobTitle,id',
                    headers={'Authorization': f'Bearer {access_token}'},
                )
                with urllib.request.urlopen(greq, timeout=8) as gresp:
                    graph_user = json.loads(gresp.read().decode('utf-8'))
            except Exception:
                graph_user = {}

        email = (
            graph_user.get('mail')
            or graph_user.get('userPrincipalName')
            or claims.get('preferred_username')
            or claims.get('email')
            or ''
        )
        display_name = (
            graph_user.get('displayName')
            or claims.get('name')
            or (email.split('@')[0] if email else 'Intel User')
        )
        user_obj = {
            'name': str(display_name)[:48],
            'email': str(email)[:80],
            'role': str(graph_user.get('jobTitle') or claims.get('jobTitle') or 'Intel SSO')[:48],
            'provider': 'intel-entra-sso',
            'verified': True,
        }

        sid = secrets.token_urlsafe(32)
        now = time.time()
        with LOCK:
            SSO_SESSIONS[sid] = {'user': user_obj, 'ts': now}

        cookie_val = f'vc_sso_sid={sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400'
        own_origin = self._get_origin(cfg)
        if next_url.startswith('http') and not next_url.startswith(own_origin):
            one_time = secrets.token_urlsafe(24)
            with LOCK:
                for k in [k for k, v in ONE_TIME_CODES.items() if now - v['ts'] > 120]:
                    del ONE_TIME_CODES[k]
                ONE_TIME_CODES[one_time] = {'user': user_obj, 'ts': now}
            sep = '#' if '#' not in next_url else '&'
            self._redirect(f'{next_url}{sep}sso_code={urllib.parse.quote(one_time)}', extra_headers=[('Set-Cookie', cookie_val)])
            return

        self._redirect(next_url, extra_headers=[('Set-Cookie', cookie_val)])

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in self._cors_headers():
            self.send_header(k, v)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        cfg = get_sso_config()

        if parsed.path == '/auth/me':
            configured = bool(cfg['client_id'] and cfg['client_secret'] and cfg['authority'])
            user = self._get_session_user()
            self._send_json(200, {
                'configured': configured,
                'authenticated': bool(user),
                'mode': 'server-confidential',
                'clientId': cfg['client_id'],
                'authority': cfg['authority'],
                'redirectPath': cfg['redirect_path'],
                'user': user,
            })
            return

        if parsed.path == '/auth/exchange':
            qs = urllib.parse.parse_qs(parsed.query)
            one_time = qs.get('code', [''])[0]
            with LOCK:
                entry = ONE_TIME_CODES.pop(one_time, None)
            if not entry or (time.time() - entry['ts'] > 120):
                self._send_json(401, {'authenticated': False, 'error': 'Invalid or expired SSO code'})
                return
            self._send_json(200, {'authenticated': True, 'user': entry['user']})
            return

        if parsed.path == '/auth/login':
            self._handle_auth_login(cfg, parsed.query)
            return

        if parsed.path == cfg['redirect_path'] or parsed.path == '/auth/auth-response':
            self._handle_auth_callback(cfg, parsed.query)
            return

        if parsed.path == '/auth/logout':
            sid = self._get_sid()
            if sid:
                with LOCK:
                    SSO_SESSIONS.pop(sid, None)
            self._redirect('/', extra_headers=[('Set-Cookie', 'vc_sso_sid=; Path=/; HttpOnly; Max-Age=0')])
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/auth/logout':
            sid = self._get_sid()
            if sid:
                with LOCK:
                    SSO_SESSIONS.pop(sid, None)
            self._send_json(200, {'ok': True}, extra_headers=[('Set-Cookie', 'vc_sso_sid=; Path=/; HttpOnly; Max-Age=0')])
            return

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
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(base_dir)
    load_env_file(os.path.join(base_dir, '.env'))
    port = int(os.environ.get('PORT', 8081))
    server = ThreadingHTTPServer(('0.0.0.0', port), PG17Handler)
    cfg = get_sso_config()
    sso_state = 'ENABLED' if (cfg['client_id'] and cfg['client_secret'] and cfg['authority']) else 'UNCONFIGURED'
    print(f'Virtual Intel Campus running at http://localhost:{port} (Entra SSO: {sso_state}, Redirect: {cfg["redirect_path"]})')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
