// Microsoft Entra ID (Intel SSO) Client Manager
// Supports confidential backend OAuth2 (/auth/login & /auth/auth-response in server.py)
// AND browser MSAL PKCE fallback for static hosting (GitHub Pages / SharePoint).
(function (global) {
  const ENTRA_CONFIG = {
    clientId: '18f74cfa-4147-4a4d-8422-17d197a07b43',
    authority: 'https://login.microsoftonline.com/46c98d88-e344-4ed4-8496-4ed7712e255d',
    redirectPath: '/auth/auth-response',
    scopes: ['openid', 'profile', 'email', 'User.ReadBasic.All'],
  };

  class SSOManager {
    constructor() {
      this.mode = 'detecting'; // 'server' | 'msal-pkce' | 'unavailable'
      this.user = null;
      this.msalApp = null;
      this.lastError = '';
    }

    async init() {
      // 1. Check if server.py OAuth2 backend (/auth/me) is running
      try {
        const resp = await fetch('/auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.configured) {
            this.mode = 'server';
            this.user = data.authenticated && data.user ? data.user : null;
            return this.user;
          }
        }
      } catch (e) { /* static hosting or local file without server.py SSO */ }

      // 2. Fallback to MSAL Browser PKCE (for GitHub Pages / SharePoint SPA)
      if (typeof global.msal !== 'undefined' && global.msal.PublicClientApplication) {
        try {
          const redirectUri = `${window.location.origin}${window.location.pathname}`;
          this.msalApp = new global.msal.PublicClientApplication({
            auth: {
              clientId: ENTRA_CONFIG.clientId,
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
          if (account) {
            this.user = this._accountToUser(account);
          }
          return this.user;
        } catch (err) {
          this.lastError = err && err.message ? err.message : String(err);
        }
      }

      // 3. Zero-dependency Direct PKCE fallback if CDN unavailable
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
              try { localStorage.setItem('vc_direct_sso_user', JSON.stringify(this.user)); } catch (e) { /* ignore */ }
              return this.user;
            }
          }
          const cached = localStorage.getItem('vc_direct_sso_user');
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
      if (this.mode === 'server') {
        window.location.assign('/auth/login');
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
          // Fallback to redirect flow if popup was blocked
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
      throw new Error(this.lastError || 'SSO provider unavailable. Run local server.py or enable MSAL CDN.');
    }

    async signOut() {
      this.user = null;
      try { localStorage.removeItem('vc_direct_sso_user'); } catch (e) { /* ignore */ }
      if (this.mode === 'server') {
        try {
          await fetch('/auth/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (e) { /* ignore */ }
        return;
      }
      if (this.mode === 'msal-pkce' && this.msalApp) {
        const accounts = this.msalApp.getAllAccounts();
        if (accounts && accounts.length > 0) {
          try {
            await this.msalApp.logoutPopup({ account: accounts[0] });
          } catch (e) {
            // Clear local MSAL cache entries if popup canceled/blocked
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith('msal.') || k.includes(ENTRA_CONFIG.clientId)) {
                localStorage.removeItem(k);
              }
            });
          }
        }
      }
    }

    getModeLabel() {
      if (this.mode === 'server') return 'Entra ID OAuth2 (Server Backend)';
      if (this.mode === 'msal-pkce') return 'Entra ID MSAL (Browser PKCE)';
      if (this.mode === 'direct-pkce') return 'Entra ID OAuth2 (Direct PKCE)';
      return 'Offline / Manual Fallback';
    }
  }

  global.PG17SSO = {
    ENTRA_CONFIG,
    SSOManager,
  };
})(window);
