// PG17 Excel (.xlsx / .csv) User Roster, Login & Level-Up Progression Manager
(function (global) {
  const STORAGE_KEY = 'pg17_voxel_roster_v2';
  const ACTIVE_USER_KEY = 'pg17_voxel_active_user_v2';
  const ADMIN_PIN_KEY = 'vcampus_admin_pin_hash_v1';
  const ADMIN_SESSION_KEY = 'vcampus_super_user_v1';

  const LEVEL_ORDER = [1, 2, 3, 4, 5, 6];

  function hashPin(pin) {
    // Simple deterministic salted digest so PIN isn't stored plaintext in localStorage/MQTT
    const str = 'vc_intel_salt_2026:' + String(pin || '');
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 ^= c;
      h1 = Math.imul(h1, 16777619);
      h2 ^= c + (i << 3);
      h2 = Math.imul(h2, 2246822519);
    }
    return ((h1 >>> 0).toString(16).padStart(8, '0')) + ((h2 >>> 0).toString(16).padStart(8, '0'));
  }

  const DEFAULT_PIN_HASH = hashPin('intel88');

  const DEFAULT_USERS = [
    { name: 'Alex',   level: 1, role: 'Visitor (Troy Lobby)' },
    { name: 'Mei',    level: 2, role: 'Sports Lead' },
    { name: 'Kenji',  level: 2, role: 'Track & Ball' },
    { name: 'Amina',  level: 3, role: 'Forest Coach' },
    { name: 'Lucas',  level: 3, role: 'Yoga Studio' },
    { name: 'Priya',  level: 4, role: 'Ocean UX' },
    { name: 'Marcus', level: 4, role: 'PingPong Champ' },
    { name: 'Hana',   level: 5, role: 'Art & Loft' },
    { name: 'Daniel', level: 5, role: 'Gym Regular' },
    { name: 'Mika',   level: 6, role: 'Executive VP' },
    { name: 'Sora',   level: 6, role: 'Site Director' },
  ];

  function parseLevelValue(raw) {
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      return Math.max(1, Math.min(6, Math.round(raw)));
    }
    const str = String(raw || '').trim();
    const match = str.match(/(\d+)/);
    if (!match) return 1;
    const n = parseInt(match[1], 10);
    return Math.max(1, Math.min(6, n));
  }

  function nextUpgradeLevel(currentLevel) {
    for (const l of LEVEL_ORDER) {
      if (l > currentLevel) return l;
    }
    return 6;
  }

  function normalizeRow(row) {
    const keys = Object.keys(row || {});
    let name = '';
    let levelRaw = 1;
    let role = '';

    for (const k of keys) {
      const kl = k.trim().toLowerCase();
      if (kl === 'name' || kl === 'user' || kl === 'username' || kl === 'employee') {
        name = String(row[k] || '').trim();
      } else if (kl === 'floor' || kl === 'level' || kl === 'lvl' || kl === 'access') {
        levelRaw = row[k];
      } else if (kl === 'role' || kl === 'dept' || kl === 'department' || kl === 'title') {
        role = String(row[k] || '').trim();
      }
    }
    if (!name && keys.length >= 1) name = String(row[keys[0]] || '').trim();
    if (levelRaw === 1 && keys.length >= 2) levelRaw = row[keys[1]];
    if (!name) return null;
    return {
      name: name.slice(0, 24),
      level: parseLevelValue(levelRaw),
      role: role.slice(0, 28) || 'Member',
    };
  }

  function parseCsvText(text) {
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    const splitLine = (line) => {
      const out = [];
      let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { inQ = !inQ; continue; }
        if ((ch === ',' || ch === '\t' || ch === ';') && !inQ) {
          out.push(cur.trim()); cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur.trim());
      return out;
    };

    const first = splitLine(lines[0]);
    const looksHeader = first.some((c) => /name|user|floor|level/i.test(c));
    const headers = looksHeader ? first : ['Name', 'Floor', 'Role'];
    const startIdx = looksHeader ? 1 : 0;

    const rows = [];
    for (let i = startIdx; i < lines.length; i++) {
      const cols = splitLine(lines[i]);
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cols[idx] !== undefined ? cols[idx] : ''; });
      const norm = normalizeRow(obj);
      if (norm) rows.push(norm);
    }
    return rows;
  }

  class RosterManager {
    constructor(onChange) {
      this.onChange = onChange;
      this.users = this.loadUsers();
      this.ssoProfile = null;
      const savedActive = localStorage.getItem(ACTIVE_USER_KEY);
      this.activeUserName = savedActive && this.findUser(savedActive)
        ? savedActive
        : (this.users[0] ? this.users[0].name : 'Guest');
      this.pinHash = localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_PIN_HASH;
      this.isSuperUser = sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
    }

    verifyAndUnlockSuperUser(pin) {
      if (hashPin(String(pin || '').trim()) === this.pinHash) {
        this.isSuperUser = true;
        try { sessionStorage.setItem(ADMIN_SESSION_KEY, '1'); } catch (e) { /* ignore */ }
        if (this.onChange) this.onChange();
        return true;
      }
      return false;
    }

    lockSuperUser() {
      this.isSuperUser = false;
      try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (e) { /* ignore */ }
      if (this.onChange) this.onChange();
    }

    changeAdminPin(newPin) {
      if (!this.isSuperUser) return false;
      const clean = String(newPin || '').trim();
      if (clean.length < 4) return false;
      this.pinHash = hashPin(clean);
      try { localStorage.setItem(ADMIN_PIN_KEY, this.pinHash); } catch (e) { /* ignore */ }
      this.save(true);
      return true;
    }

    applyRemotePinHash(remoteHash) {
      if (remoteHash && typeof remoteHash === 'string' && remoteHash.length === 16) {
        this.pinHash = remoteHash;
        try { localStorage.setItem(ADMIN_PIN_KEY, remoteHash); } catch (e) { /* ignore */ }
      }
    }

    loadUsers() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) { /* ignore */ }
      return DEFAULT_USERS.map((u) => ({ ...u }));
    }

    save(broadcast = false) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.users));
        localStorage.setItem(ACTIVE_USER_KEY, this.activeUserName);
      } catch (e) { /* ignore */ }
      if (this.onChange) this.onChange(broadcast);
    }

    findUser(name) {
      const target = String(name || '').trim().toLowerCase();
      return this.users.find((u) => u.name.toLowerCase() === target) || null;
    }

    getActiveUser() {
      const base = this.findUser(this.activeUserName) || this.users[0] || { name: 'Guest', level: 1, role: 'Visitor' };
      const ssoMeta = this.ssoProfile ? { ssoVerified: true, email: this.ssoProfile.email || '' } : {};
      // Super User always has full F1-F6 access while unlocked
      if (this.isSuperUser) {
        return { ...base, ...ssoMeta, level: 6, role: `${base.role || 'Member'} • Super User` };
      }
      return { ...base, ...ssoMeta };
    }

    login(name) {
      const clean = String(name || '').trim();
      if (!clean) return null;
      let u = this.findUser(clean);
      if (!u) {
        // Unknown visitors start at Floor 1 only (not broadcast as an authoritative roster edit)
        u = { name: clean.slice(0, 24), level: 1, role: 'Guest' };
        this.users.push(u);
      }
      this.activeUserName = u.name;
      this.save(false);
      return this.getActiveUser();
    }

    loginWithSso(profile) {
      if (!profile || !profile.name) return null;
      const cleanName = String(profile.name).trim();
      const email = String(profile.email || '').trim();
      const emailLocal = email ? email.split('@')[0] : '';

      // Match existing roster member by full name OR email local-part (preserves Super User floor grant!)
      let u = this.findUser(cleanName) || (emailLocal ? this.findUser(emailLocal) : null);
      if (!u) {
        u = {
          name: cleanName.slice(0, 24),
          level: 1,
          role: profile.role || 'Intel SSO',
        };
        this.users.push(u);
      }
      this.ssoProfile = {
        name: cleanName,
        email,
        role: profile.role || u.role || 'Intel SSO',
        verified: true,
      };
      this.activeUserName = u.name;
      this.save(false);
      return this.getActiveUser();
    }

    logoutSso() {
      this.ssoProfile = null;
      if (this.users[0]) this.activeUserName = this.users[0].name;
      this.save(false);
      return this.getActiveUser();
    }

    addOrUpdateUser(name, level, role = 'Member') {
      if (!this.isSuperUser) return null;
      const clean = String(name || '').trim();
      if (!clean) return null;
      const lvl = parseLevelValue(level);
      const existing = this.findUser(clean);
      if (existing) {
        existing.level = lvl;
        if (role) existing.role = role;
      } else {
        this.users.push({ name: clean.slice(0, 24), level: lvl, role: role || 'Member' });
      }
      this.save(true);
      return this.findUser(clean);
    }

    setUserLevel(name, level) {
      if (!this.isSuperUser) return null;
      const u = this.findUser(name);
      if (!u) return null;
      u.level = parseLevelValue(level);
      this.save(true);
      return u;
    }

    removeUser(name) {
      if (!this.isSuperUser || this.users.length <= 1) return;
      this.users = this.users.filter((u) => u.name.toLowerCase() !== String(name).toLowerCase());
      if (!this.findUser(this.activeUserName) && this.users[0]) {
        this.activeUserName = this.users[0].name;
      }
      this.save(true);
    }

    levelUpUser(name) {
      if (!this.isSuperUser) return null;
      const u = this.findUser(name);
      if (!u) return null;
      const next = nextUpgradeLevel(u.level);
      u.level = next;
      this.save(true);
      return u;
    }

    resetDefaults() {
      if (!this.isSuperUser) return;
      this.users = DEFAULT_USERS.map((u) => ({ ...u }));
      this.activeUserName = this.users[0].name;
      this.save(true);
    }

    async importFile(file) {
      if (!this.isSuperUser) {
        throw new Error('Super User unlock required to upload Excel access lists.');
      }
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      let imported = [];

      if ((ext === 'xlsx' || ext === 'xls') && typeof global.XLSX !== 'undefined') {
        const buf = await file.arrayBuffer();
        const wb = global.XLSX.read(buf, { type: 'array' });
        const sheetName = wb.SheetNames[0];
        const jsonRows = global.XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '' });
        imported = jsonRows.map(normalizeRow).filter(Boolean);
      } else {
        const text = await file.text();
        imported = parseCsvText(text);
      }

      if (imported.length === 0) {
        throw new Error('No valid rows found. Ensure columns include "Name" and "Floor" (or "Level").');
      }

      // Deduplicate by lowercase name (last row wins)
      const map = new Map();
      for (const u of imported) {
        map.set(u.name.toLowerCase(), u);
      }
      this.users = Array.from(map.values());
      if (!this.findUser(this.activeUserName) && this.users[0]) {
        this.activeUserName = this.users[0].name;
      }
      this.save(true);
      return this.users.length;
    }

    exportExcelOrCsv() {
      const rows = this.users.map((u) => ({
        Name: u.name,
        Floor: u.level,
        Role: u.role || 'Member',
      }));

      if (typeof global.XLSX !== 'undefined') {
        const ws = global.XLSX.utils.json_to_sheet(rows);
        const wb = global.XLSX.utils.book_new();
        global.XLSX.utils.book_append_sheet(wb, ws, 'Virtual_Intel_Campus_Users');
        global.XLSX.writeFile(wb, 'virtual_intel_campus_users.xlsx');
        return 'virtual_intel_campus_users.xlsx';
      }

      // Fallback CSV export
      const csv = ['Name,Floor,Role', ...rows.map((r) => `"${r.Name.replace(/"/g, '""')}",${r.Floor},"${r.Role.replace(/"/g, '""')}"`)].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'virtual_intel_campus_users.csv';
      a.click();
      URL.revokeObjectURL(url);
      return 'virtual_intel_campus_users.csv';
    }
  }

  global.PG17Roster = {
    RosterManager,
    LEVEL_ORDER,
    parseLevelValue,
    nextUpgradeLevel,
  };
})(window);
