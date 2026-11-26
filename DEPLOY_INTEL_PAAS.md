# Deploying Virtual Intel Campus (`github.com/chinseang88/virtual-campus`) to `https://ecebuildplus.app.intel.com/`

Because Microsoft Entra App `18f74cfa-4147-4a4d-8422-17d197a07b43` only whitelists `https://ecebuildplus.app.intel.com/auth/auth-response`, Microsoft Entra SSO works cleanly as soon as the backend runs on `ecebuildplus.app.intel.com`.

## Option A: Deploy `virtual-campus` Directly to `ecebuildplus.app.intel.com` (Standalone)

`server.py` uses **Python 3 standard library only** (`Procfile`, `Dockerfile`, and `requirements.txt` are included).

1. **Pull the repo on your Intel build host / PaaS workspace:**
   ```bash
   git clone https://github.com/chinseang88/virtual-campus.git
   cd virtual-campus
   ```
2. **Set the Entra ID environment variables in your PaaS / container settings (never commit `.env` to Git):**
   - `CLIENT_ID=18f74cfa-4147-4a4d-8422-17d197a07b43`
   - `CLIENT_SECRET=<your-entra-client-secret>`
   - `AUTHORITY=https://login.microsoftonline.com/46c98d88-e344-4ed4-8496-4ed7712e255d`
   - `REDIRECT_PATH=/auth/auth-response`
   - `AUTH_SCOPES=User.ReadBasic.All`
   - `PUBLIC_BASE_URL=https://ecebuildplus.app.intel.com`
3. **Start command:**
   - Cloud Foundry (`cf push ecebuildplus`): uses `Procfile` (`web: python server.py`, bound automatically to `$PORT`).
   - Docker / OpenShift: `docker build -t virtual-campus .` and run container with those env vars.
4. Open `https://ecebuildplus.app.intel.com/` → `[U]` → **Entra ID SSO** (`Mode: Entra ID OAuth2 (Server Backend — Ready)`).

---

## Option B: Keep Your Existing App on `ecebuildplus.app.intel.com` & Connect GitHub Pages

If `https://ecebuildplus.app.intel.com/` already hosts another Flask/FastAPI service and you want **`https://chinseang88.github.io/virtual-campus/?sso=https://ecebuildplus.app.intel.com`** to sign in using it:

1. Ensure your `ecebuildplus` backend exposes CORS-enabled endpoints for `https://chinseang88.github.io`:
   - `GET /auth/me` → `{ "configured": true, "authenticated": false }`
   - `GET /auth/login?next=https://chinseang88.github.io/virtual-campus/` → after `/auth/auth-response`, generates a short-lived one-time code and redirects to `https://chinseang88.github.io/virtual-campus/#sso_code=<code>`
   - `GET /auth/exchange?code=<code>` → returns `{ "authenticated": true, "user": { "name": ..., "email": ..., "role": ..., "verified": true } }` (see `server.py` for the full reference implementation).
2. Or serve the static files from `virtual-campus` under `/virtual-campus/` on `ecebuildplus.app.intel.com` alongside `/auth/login`, `/auth/auth-response`, and `/auth/me`.
