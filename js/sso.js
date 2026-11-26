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
      throw new Error('SSO provider unavailable. Run local server.py or enable MSAL CDN.');
    }

    async signOut() {
      this.user = null;
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
      return 'Offline / Manual Fallback';
    }
  }

  global.PG17SSO = {
    ENTRA_CONFIG,
    SSOManager,
  };
})(window);
