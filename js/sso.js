// Microsoft Entra ID (Intel SSO) Client Manager
// Supports:
//   1. Direct confidential OAuth2 backend (/auth/login & /auth/auth-response in server.py)
//   2. Cross-origin SSO Bridge (?sso=https://ecebuildplus.app.intel.com)
//   3. Browser MSAL / WebCrypto PKCE fallback (if SPA redirect URI is registered)
(function (global) {
  const ENTRA_CONFIG = {
    clientId: '18f74cfa-4147-4a4d-8422-17d197a07b43',
    authority: 'https://login.microsoftonline.com/46c98d88-e344-4ed4-8496-4ed7712e255d',
    redirectPath: '/auth/auth-response',
    scopes: ['openid', 'profile', 'email', 'User.ReadBasic.All'],
  };
  const BRIDGE_KEY = 'vc_sso_bridge_url';
  const SPA_CLIENT_KEY = 'vc_spa_client_id';
  const DIRECT_USER_KEY = 'vc_direct_sso_user';

  class SSOManager {
    constructor() {
      this.mode = 'detecting'; // 'server' | 'bridge' | 'msal-pkce' | 'direct-pkce' | 'blocked-origin' | 'unavailable'
      this.user = null;
      this.msalApp = null;
      this.bridgeUrl = '';
      this.customClientId = '';
      this.canLaunchEntra = false;
      this.lastError = '';
    }

    setConfig({ bridgeUrl = '', clientId = '' }) {
      try {
        if (bridgeUrl) localStorage.setItem(BRIDGE_KEY, bridgeUrl.replace(/\/+$/, ''));
        else localStorage.removeItem(BRIDGE_KEY);
        if (clientId) localStorage.setItem(SPA_CLIENT_KEY, clientId.trim());
        else localStorage.removeItem(SPA_CLIENT_KEY);
      } catch (e) { /* ignore */ }
    }

    async init() {
      // Check URL params / saved config for SSO bridge or custom SPA Client ID
      try {
        const qs = new URLSearchParams(window.location.search);
        const paramBridge = qs.get('sso');
        const paramCid = qs.get('sso_client_id');
        if (paramBridge && paramBridge.startsWith('http')) {
          this.bridgeUrl = paramBridge.replace(/\/+$/, '');
          localStorage.setItem(BRIDGE_KEY, this.bridgeUrl);
        } else {
          this.bridgeUrl = (localStorage.getItem(BRIDGE_KEY) || '').replace(/\/+$/, '');
        }
        if (paramCid) {
          this.customClientId = paramCid.trim();
          localStorage.setItem(SPA_CLIENT_KEY, this.customClientId);
        } else {
          this.customClientId = (localStorage.getItem(SPA_CLIENT_KEY) || '').trim();
        }
      } catch (e) { /* ignore */ }

      const activeClientId = this.customClientId || ENTRA_CONFIG.clientId;

      // 1. Check if current host serves server.py OAuth2 backend (/auth/me)
      try {
        const resp = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.configured) {
            this.mode = 'server';
            this.canLaunchEntra = true;
            this.user = data.authenticated && data.user ? data.user : null;
            return this.user;
          }
        }
      } catch (e) { /* static hosting without local /auth/me */ }

      // 2. Check SSO Bridge return hash (#sso_code=...) or saved bridge URL (e.g. https://ecebuildplus.app.intel.com)
      if (this.bridgeUrl) {
        try {
          const hashStr = window.location.hash.replace(/^#/, '');
          const hp = new URLSearchParams(hashStr);
          const ssoCode = hp.get('sso_code');
          if (ssoCode) {
            window.history.replaceState({}, '', window.location.pathname + window.location.search);
            const exResp = await fetch(`${this.bridgeUrl}/auth/exchange?code=${encodeURIComponent(ssoCode)}`, { cache: 'no-store' });
            if (exResp.ok) {
              const exData = await exResp.json();
              if (exData && exData.authenticated && exData.user) {
                this.user = exData.user;
                try { localStorage.setItem(DIRECT_USER_KEY, JSON.stringify(this.user)); } catch (e) { /* ignore */ }
              }
            }
          }
          const checkResp = await fetch(`${this.bridgeUrl}/auth/me`, { cache: 'no-store' });
          if (checkResp.ok) {
            const info = await checkResp.json();
            if (info && info.configured) {
              this.mode = 'bridge';
              this.canLaunchEntra = true;
              if (!this.user) {
                const cached = localStorage.getItem(DIRECT_USER_KEY);
                if (cached) this.user = JSON.parse(cached);
              }
              return this.user;
            }
          }
        } catch (e) { /* bridge unreachable or lacks /auth/me CORS */ }
      }

      // 3. Static GitHub Pages without SPA-registered Client ID cannot use 18f74cfa-... (Microsoft throws AADSTS50011)
      if (!this.customClientId) {
        this.mode = 'blocked-origin';
        this.canLaunchEntra = false;
        return null;
      }

      // 4. Custom SPA Client ID provided -> use MSAL Browser PKCE
      if (typeof global.msal !== 'undefined' && global.msal.PublicClientApplication) {
        try {
          const redirectUri = `${window.location.origin}${window.location.pathname}`;
          this.msalApp = new global.msal.PublicClientApplication({
            auth: {
              clientId: activeClientId,
              authority: ENTRA_CONFIG.authority,
              redirectUri,
            },
            cache: {
              cacheLocation: 'localStorage',
              storeAuthStateInCookie: false,
            },
          });
          if (typeof this.msalApp.initialize === 'function') {
            await this.msalApp.initialize();
          }
          const redirectResp = await this.msalApp.handleRedirectPromise();
          let account = redirectResp && redirectResp.account ? redirectResp.account : null;
          if (!account) {
            const accounts = this.msalApp.getAllAccounts();
            if (accounts && accounts.length > 0) account = accounts[0];
          }
          this.mode = 'msal-pkce';
          this.canLaunchEntra = true;
          if (account) {
            this.user = this._accountToUser(account);
          }
          return this.user;
        } catch (err) {
          this.lastError = err && err.message ? err.message : String(err);
        }
      }

      // 4. Zero-dependency Direct PKCE fallback if CDN blocked
      if (window.crypto && window.crypto.subtle) {
        this.mode = 'direct-pkce';
        try {
          const qs = new URLSearchParams(window.location.search);
          const code = qs.get('code');
          const state = qs.get('state');
          const savedState = sessionStorage.getItem('vc_pkce_state');
          const verifier = sessionStorage.getItem('vc_pkce_verifier');
          if (code && state && savedState === state && verifier) {
            sessionStorage.removeItem('vc_pkce_state');
            sessionStorage.removeItem('vc_pkce_verifier');
            window.history.replaceState({}, '', window.location.pathname);
            const form = new URLSearchParams({
              client_id: ENTRA_CONFIG.clientId,
              grant_type: 'authorization_code',
              code,
              redirect_uri: `${window.location.origin}${window.location.pathname}`,
              code_verifier: verifier,
              scope: ENTRA_CONFIG.scopes.join(' '),
            });
            const tokResp = await fetch(`${ENTRA_CONFIG.authority}/oauth2/v2.0/token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: form.toString(),
            });
            const tok = await tokResp.json();
            if (tok && tok.id_token) {
              const payloadB64 = tok.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
              const claims = JSON.parse(atob(payloadB64));
              const email = claims.preferred_username || claims.email || '';
              this.user = {
                name: claims.name || (email ? email.split('@')[0] : 'Intel User'),
                email,
                role: claims.jobTitle || 'Intel SSO',
                provider: 'intel-entra-pkce',
                verified: true,
              };
              try { localStorage.setItem(DIRECT_USER_KEY, JSON.stringify(this.user)); } catch (e) { /* ignore */ }
              return this.user;
            }
          }
          const cached = localStorage.getItem(DIRECT_USER_KEY);
          if (cached) this.user = JSON.parse(cached);
        } catch (err) {
          this.lastError = err && err.message ? err.message : String(err);
        }
        return this.user;
      }

      this.mode = 'unavailable';
      return null;
    }

    _accountToUser(account) {
      const claims = account.idTokenClaims || {};
      const email = account.username || claims.preferred_username || claims.email || '';
      const displayName = account.name || claims.name || (email ? email.split('@')[0] : 'Intel User');
      return {
        name: displayName,
        email,
        role: claims.jobTitle || 'Intel SSO',
        provider: 'intel-entra-pkce',
        verified: true,
      };
    }

    async _startDirectPkceRedirect() {
      const bytes = new Uint8Array(32);
      window.crypto.getRandomValues(bytes);
      const b64url = (arr) => btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      const verifier = b64url(bytes);
      const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
      const challenge = b64url(new Uint8Array(digest));
      const state = b64url(window.crypto.getRandomValues(new Uint8Array(16)));
      try {
        sessionStorage.setItem('vc_pkce_verifier', verifier);
        sessionStorage.setItem('vc_pkce_state', state);
      } catch (e) { /* ignore */ }
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const qs = new URLSearchParams({
        client_id: ENTRA_CONFIG.clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        response_mode: 'query',
        scope: ENTRA_CONFIG.scopes.join(' '),
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });
      window.location.assign(`${ENTRA_CONFIG.authority}/oauth2/v2.0/authorize?${qs.toString()}`);
      return { redirected: true };
    }

    async signIn() {
      this.lastError = '';
      if (this.mode === 'blocked-origin' && !this.customClientId) {
        throw new Error('Entra ID App 18f74cfa-... rejects github.io (AADSTS50011). Click ⚙️ to set an SPA Client ID, host server.py on ecebuildplus.app.intel.com, or sign in with your @intel.com email above.');
      }
      if (this.mode === 'server') {
        const nextUrl = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/auth/login?next=${nextUrl}`);
        return { redirected: true };
      }
      if (this.mode === 'bridge' && this.bridgeUrl) {
        const ret = encodeURIComponent(`${window.location.origin}${window.location.pathname}`);
        window.location.assign(`${this.bridgeUrl}/auth/login?next=${ret}`);
        return { redirected: true };
      }
      if (this.mode === 'msal-pkce' && this.msalApp) {
        try {
          const res = await this.msalApp.loginPopup({
            scopes: ENTRA_CONFIG.scopes,
            prompt: 'select_account',
          });
          if (res && res.account) {
            this.user = this._accountToUser(res.account);
            return { user: this.user };
          }
        } catch (err) {
          const msg = err && err.message ? err.message : String(err);
          if (msg.includes('popup') || msg.includes('block')) {
            await this.msalApp.loginRedirect({
              scopes: ENTRA_CONFIG.scopes,
              prompt: 'select_account',
            });
            return { redirected: true };
          }
          this.lastError = msg;
          throw err;
        }
      }
      if (window.crypto && window.crypto.subtle) {
        return this._startDirectPkceRedirect();
      }
      throw new Error(this.lastError || 'SSO provider unavailable.');
    }

    async signOut() {
      this.user = null;
      try { localStorage.removeItem(DIRECT_USER_KEY); } catch (e) { /* ignore */ }
      if (this.mode === 'server') {
        try {
          await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (e) { /* ignore */ }
        return;
      }
      if (this.mode === 'bridge' && this.bridgeUrl) {
        try {
          await fetch(`${this.bridgeUrl}/auth/logout`, { method: 'POST' });
        } catch (e) { /* ignore */ }
        return;
      }
      if (this.mode === 'msal-pkce' && this.msalApp) {
        const accounts = this.msalApp.getAllAccounts();
        if (accounts && accounts.length > 0) {
          try {
            await this.msalApp.logoutPopup({ account: accounts[0] });
          } catch (e) {
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith('msal.') || k.includes(this.customClientId || ENTRA_CONFIG.clientId)) {
                localStorage.removeItem(k);
              }
            });
          }
        }
      }
    }

    getModeLabel() {
      if (this.mode === 'server') return 'Entra ID OAuth2 (Server Backend — Ready)';
      if (this.mode === 'bridge') return `Entra ID Bridge (${this.bridgeUrl})`;
      if (this.mode === 'msal-pkce') return 'Entra ID MSAL (Custom SPA Client ID)';
      if (this.mode === 'direct-pkce') return 'Entra ID OAuth2 (Direct PKCE)';
      if (this.mode === 'blocked-origin') return 'GitHub Pages: Use @intel.com login above, or ⚙️ set SPA ID / ecebuildplus bridge';
      return 'Offline / Name Login';
    }
  }

  global.PG17SSO = {
    ENTRA_CONFIG,
    SSOManager,
  };
})(window);
