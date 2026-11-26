// High-Resolution Procedural 64x64 PG17 Campus Texture Atlas (1024x1024) & Block Registry
(function (global) {
  const TILE_SIZE = 64;
  const ATLAS_COLS = 16;
  const ATLAS_ROWS = 16;

  function hash(x, y, seed) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function hexToRgb(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  function clamp(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
  }

  // Draws onto a 64x64 tile using crisp per-pixel procedural detail
  function fillTile(ctx, tx, ty, baseHex, variance, seed, patternFn) {
    const ox = tx * TILE_SIZE;
    const oy = ty * TILE_SIZE;
    const [r0, g0, b0] = hexToRgb(baseHex);
    const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
    const d = img.data;

    for (let y = 0; y < TILE_SIZE; y++) {
      for (let x = 0; x < TILE_SIZE; x++) {
        let r = r0, g = g0, b = b0, a = 255;
        // Multi-scale noise for crisp HD surface grain
        const fine = (hash(x, y, seed) - 0.5) * 2 * variance;
        const coarse = (hash(x >> 2, y >> 2, seed + 99) - 0.5) * variance * 0.7;
        r += fine + coarse;
        g += fine + coarse;
        b += fine + coarse;
        if (patternFn) {
          const mod = patternFn(x, y, r, g, b);
          if (mod) {
            r = mod[0]; g = mod[1]; b = mod[2];
            if (mod.length > 3) a = mod[3];
          }
        }
        const i = (y * TILE_SIZE + x) * 4;
        d[i] = clamp(r);
        d[i + 1] = clamp(g);
        d[i + 2] = clamp(b);
        d[i + 3] = clamp(a);
      }
    }
    ctx.putImageData(img, ox, oy);
  }

  function drawCustomTile(ctx, tx, ty, drawFn) {
    const ox = tx * TILE_SIZE;
    const oy = ty * TILE_SIZE;
    ctx.save();
    ctx.translate(ox, oy);
    drawFn(ctx, TILE_SIZE);
    ctx.restore();
  }

  function createAtlas() {
    const canvas = document.createElement('canvas');
    canvas.width = TILE_SIZE * ATLAS_COLS;
    canvas.height = TILE_SIZE * ATLAS_ROWS;
    const ctx = canvas.getContext('2d');

    // 0: Campus Grass (cozy pastel RPG turf, smooth & lush)
    drawCustomTile(ctx, 0, 0, (c, s) => {
      c.fillStyle = '#7ed957';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#6ec848';
      c.fillRect(0, 0, s / 2, s / 2);
      c.fillRect(s / 2, s / 2, s / 2, s / 2);
      c.fillStyle = '#9be876';
      [[14, 18], [46, 14], [22, 48], [50, 44]].forEach(([bx, by]) => {
        c.fillRect(bx, by, 3, 6);
        c.fillRect(bx + 5, by + 2, 3, 5);
      });
    });

    // 1: Campus Plaza Pavement (clean RPG stone tiles)
    drawCustomTile(ctx, 1, 0, (c, s) => {
      c.fillStyle = '#cfd8e3';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#94a3b8';
      c.lineWidth = 2;
      c.strokeRect(1, 1, s / 2 - 2, s / 2 - 2);
      c.strokeRect(s / 2 + 1, 1, s / 2 - 2, s / 2 - 2);
      c.strokeRect(1, s / 2 + 1, s / 2 - 2, s / 2 - 2);
      c.strokeRect(s / 2 + 1, s / 2 + 1, s / 2 - 2, s / 2 - 2);
    });

    // 2: Concrete Structural Wall / Pillar (clean stylized RPG trim)
    drawCustomTile(ctx, 2, 0, (c, s) => {
      c.fillStyle = '#edf2f7';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#94a3b8';
      c.lineWidth = 3;
      c.strokeRect(1.5, 1.5, s - 3, s - 3);
      c.fillStyle = '#cbd5e1';
      c.fillRect(0, s - 6, s, 6);
    });

    // 3: Raw Industrial Concrete (Level 5)
    fillTile(ctx, 3, 0, '#5f6672', 3, 4, (x, y, r, g, b) => {
      if (y % 32 === 0 || x % 64 === 0) return [r - 16, g - 16, b - 16];
      return null;
    });

    // 4: Curtain Glass Window (100% crisp solid frame + clean half-transparent tinted pane)
    drawCustomTile(ctx, 4, 0, (c, s) => {
      c.clearRect(0, 0, s, s);
      // Clean half-transparent tinted sky glass center
      c.fillStyle = 'rgba(56, 189, 248, 0.48)';
      c.fillRect(0, 0, s, s);
      // Diagonal soft glass shine
      c.fillStyle = 'rgba(240, 249, 255, 0.38)';
      c.beginPath();
      c.moveTo(8, 26); c.lineTo(26, 8); c.lineTo(34, 8); c.lineTo(8, 34);
      c.closePath();
      c.fill();
      // 100% solid architectural frame + cross mullion so walls vs doorways are always sharp
      c.strokeStyle = '#334155';
      c.lineWidth = 6;
      c.strokeRect(3, 3, s - 6, s - 6);
      c.fillStyle = '#cbd5e1';
      c.fillRect(4, 4, s - 8, 3);
      c.fillRect(4, s - 7, s - 8, 3);
    });

    // 5: Lobby Diamond-Tiled Marble (sleek RPG Center floor!)
    drawCustomTile(ctx, 5, 0, (c, s) => {
      c.fillStyle = '#f1f5f9';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#cbd5e1';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(s / 2, 4); c.lineTo(s - 4, s / 2); c.lineTo(s / 2, s - 4); c.lineTo(4, s / 2);
      c.closePath();
      c.stroke();
      c.fillStyle = '#bae6fd';
      c.fillRect(s / 2 - 4, s / 2 - 4, 8, 8);
    });

    // 6: Warm Oak Wood Planks (staggered parquet planks)
    fillTile(ctx, 6, 0, '#c48d54', 6, 7, (x, y, r, g, b) => {
      const grain = Math.sin(x * 0.15 + Math.sin(y * 0.4) * 1.5) * 5;
      if (y % 16 === 0) return [r - 28, g - 22, b - 16];
      const row = Math.floor(y / 16);
      if ((row % 2 === 0 && x === 32) || (row % 2 === 1 && (x === 14 || x === 50))) return [r - 24, g - 18, b - 14];
      return [r + grain, g + grain * 0.8, b + grain * 0.5];
    });

    // 7: Dark Timber / Desk Frame
    fillTile(ctx, 7, 0, '#4f3524', 5, 8, (x, y, r, g, b) => {
      if (y % 16 === 0) return [r - 16, g - 12, b - 9];
      return null;
    });

    // 8: Sports Running Track (Terracotta + crisp lane markings)
    fillTile(ctx, 8, 0, '#c85a32', 5, 9, (x, y) => {
      if (y <= 2 || y >= 61) return [248, 250, 252];
      if (y === 31 || y === 32) return [254, 240, 220];
      return null;
    });

    // 9: Sports Blue Court Floor
    fillTile(ctx, 9, 0, '#1e88c9', 4, 10, (x, y) => {
      if (x <= 2 || x >= 61) return [224, 242, 254];
      return null;
    });

    // 10: Green Indoor Turf (Sports Pitch & Gym Functional Zone)
    fillTile(ctx, 10, 0, '#449e38', 9, 11, (x, y) => {
      if (y >= 30 && y <= 33) return [240, 253, 244];
      return null;
    });

    // 11: Yellow Pantry Cabinet
    drawCustomTile(ctx, 11, 0, (c, s) => {
      c.fillStyle = '#eab308';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#a16207';
      c.lineWidth = 3;
      c.strokeRect(2, 2, s / 2 - 4, s - 4);
      c.strokeRect(s / 2 + 2, 2, s / 2 - 4, s - 4);
      c.fillStyle = '#334155';
      c.fillRect(22, 24, 4, 16);
      c.fillRect(38, 24, 4, 16);
    });

    // 12: Teal Accent Wall
    fillTile(ctx, 12, 0, '#2aa3ad', 5, 13, (x, y, r, g, b) => {
      if (y <= 2 || y >= 61) return [r - 22, g - 22, b - 22];
      return null;
    });

    // 13: Forest Sage Carpet
    fillTile(ctx, 13, 0, '#8ba878', 7, 14, (x, y, r, g, b) => {
      if (((x >> 2) + (y >> 2)) % 4 === 0) return [r + 10, g + 10, b + 8];
      return null;
    });

    // 14: Forest Botanical Wall Mural (HD palm leaves!)
    drawCustomTile(ctx, 14, 0, (c, s) => {
      c.fillStyle = '#e5ece0';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#4f8556';
      c.beginPath(); c.ellipse(18, 34, 14, 24, -0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6da368';
      c.beginPath(); c.ellipse(46, 38, 12, 22, 0.3, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#365e3b';
      c.fillRect(16, 40, 4, 24);
      c.fillRect(44, 44, 4, 20);
    });

    // 15: Forest Dark Green Acoustic Disc / Booth
    fillTile(ctx, 15, 0, '#3a5a40', 6, 16, (x, y, r, g, b) => {
      if (x <= 2 || y <= 2 || x >= 61 || y >= 61) return [r - 18, g - 18, b - 18];
      return null;
    });

    // Row 1 (16..31)
    // 16: Ocean Sky-Blue Wall with HD Porthole
    drawCustomTile(ctx, 0, 1, (c, s) => {
      c.fillStyle = '#68b4e3';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#e0f2fe';
      c.beginPath(); c.arc(32, 32, 20, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1e78b4';
      c.beginPath(); c.arc(32, 32, 15, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.45)';
      c.beginPath(); c.arc(26, 26, 5, 0, Math.PI * 2); c.fill();
    });

    // 17: Ocean Mosaic Tile
    fillTile(ctx, 1, 1, '#1d78a6', 12, 18, (x, y) => {
      if (x % 16 === 0 || y % 16 === 0) return [219, 234, 254];
      return null;
    });

    // 18: Ocean Aqua / Kelp Ceiling Baffle
    fillTile(ctx, 2, 1, '#5eead4', 8, 19, (x, y) => {
      if ((y >> 3) % 2 === 0) return [101, 188, 70];
      return null;
    });

    // 19: Ocean Navy Booth
    fillTile(ctx, 3, 1, '#1e3a5f', 6, 20, (x, y, r, g, b) => {
      if (x <= 2 || y <= 2 || x >= 61 || y >= 61) return [15, 23, 42];
      if (y === 32) return [30, 58, 95];
      return null;
    });

    // 20: Industrial Red Booth
    fillTile(ctx, 4, 1, '#dc2626', 7, 21, (x, y) => {
      if (x <= 2 || y <= 2 || x >= 61 || y >= 61) return [127, 29, 29];
      if (y >= 30 && y <= 33) return [185, 28, 28];
      return null;
    });

    // 21: Charcoal Carpet / Gym Mat
    fillTile(ctx, 5, 1, '#2d323b', 5, 22, (x, y, r, g, b) => {
      if (hash(x, y, 221) > 0.85) return [r + 12, g + 12, b + 12];
      return null;
    });

    // 22: Map Orange / Terracotta Ceiling & Accent
    drawCustomTile(ctx, 6, 1, (c, s) => {
      c.fillStyle = '#ea7b46';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#f59e6c';
      c.beginPath(); c.arc(28, 28, 16, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(46, 42, 10, 0, Math.PI * 2); c.fill();
    });

    // 23: Map City Skyline Mural (HD!)
    drawCustomTile(ctx, 7, 1, (c, s) => {
      c.fillStyle = '#f8fafc';
      c.fillRect(0, 0, s, s);
      const bldgs = [
        [4, 22, 12, 42, '#ec4899'],
        [18, 12, 12, 52, '#3b82f6'],
        [32, 26, 12, 38, '#10b981'],
        [46, 16, 14, 48, '#f59e0b'],
      ];
      bldgs.forEach(([bx, by, bw, bh, col]) => {
        c.fillStyle = col;
        c.fillRect(bx, by, bw, bh);
        c.fillStyle = 'rgba(255,255,255,0.65)';
        for (let wy = by + 4; wy < 54; wy += 8) {
          c.fillRect(bx + 3, wy, 2, 4);
          c.fillRect(bx + 7, wy, 2, 4);
        }
      });
    });

    // 24: Map Lime-Green Terrain Ceiling / Wall
    drawCustomTile(ctx, 8, 1, (c, s) => {
      c.fillStyle = '#6eb82b';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#a3e635';
      c.lineWidth = 3;
      c.beginPath(); c.ellipse(30, 30, 22, 14, 0.3, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#228b22';
      c.beginPath(); c.ellipse(34, 34, 12, 8, -0.2, 0, Math.PI * 2); c.stroke();
    });

    // 25: LED Ceiling / Bright Light Panel
    drawCustomTile(ctx, 9, 1, (c, s) => {
      c.fillStyle = '#cbd5e1';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#fffdeb';
      c.fillRect(6, 6, s - 12, s - 12);
    });

    // 26: Elevator / Lift Steel Door (HD brushed metal + indicator!)
    drawCustomTile(ctx, 10, 1, (c, s) => {
      c.fillStyle = '#94a3b8';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#64748b';
      c.fillRect(0, 0, s, 6);
      c.fillRect(0, 0, 4, s);
      c.fillRect(s - 4, 0, 4, s);
      c.fillStyle = '#1e293b';
      c.fillRect(30, 6, 4, s - 6);
      c.fillStyle = '#4ade80';
      c.fillRect(46, 10, 10, 6);
    });

    // 27: Staircase Step Tile (crisp nosing)
    fillTile(ctx, 11, 1, '#cbd5e1', 5, 28, (x, y) => {
      if (y <= 3 || y >= 60) return [71, 85, 105];
      if (y >= 4 && y <= 9) return [250, 204, 21];
      return null;
    });

    // 28: Ping Pong Table Top
    drawCustomTile(ctx, 12, 1, (c, s) => {
      c.fillStyle = '#dc2626';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#f8fafc';
      c.lineWidth = 4;
      c.strokeRect(2, 2, s - 4, s - 4);
      c.fillStyle = '#e2e8f0';
      c.fillRect(0, 30, s, 4);
    });

    // 29: Gym Equipment / Steel Frame
    drawCustomTile(ctx, 13, 1, (c, s) => {
      c.fillStyle = '#1e293b';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#94a3b8';
      c.fillRect(14, 0, 6, s);
      c.fillRect(44, 0, 6, s);
      c.fillStyle = '#38bdf8';
      c.fillRect(22, 18, 20, 24);
    });

    // 30: Coffee Machine / Espresso Bar
    drawCustomTile(ctx, 14, 1, (c, s) => {
      c.fillStyle = '#334155';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#e2e8f0';
      c.fillRect(10, 8, 44, 22);
      c.fillStyle = '#f59e0b';
      c.fillRect(18, 36, 10, 10);
      c.fillRect(36, 36, 10, 10);
      c.fillStyle = '#0f172a';
      c.fillRect(8, 50, 48, 14);
    });

    // 31: Locker / Cubby Wall
    drawCustomTile(ctx, 15, 1, (c, s) => {
      c.fillStyle = '#b48a5a';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#4a321c';
      c.lineWidth = 3;
      for (let gx = 0; gx < s; gx += 16) {
        for (let gy = 0; gy < s; gy += 21) {
          c.strokeRect(gx, gy, 16, 21);
        }
      }
    });

    // Row 2 (32..38)
    // 32: Gold / VIP Trim Block
    fillTile(ctx, 0, 2, '#f59e0b', 6, 33, (x, y) => {
      if (x <= 2 || y <= 2 || x >= 61 || y >= 61) return [180, 83, 9];
      if (x >= 10 && x <= 20 && y >= 10 && y <= 20) return [254, 243, 199];
      return null;
    });

    // 33: Rattan / Woven Lantern
    drawCustomTile(ctx, 1, 2, (c, s) => {
      c.fillStyle = '#d4a373';
      c.fillRect(0, 0, s, s);
      c.strokeStyle = '#8c5e34';
      c.lineWidth = 3;
      for (let i = -s; i < s * 2; i += 12) {
        c.beginPath(); c.moveTo(i, 0); c.lineTo(i + s, s); c.stroke();
        c.beginPath(); c.moveTo(i + s, 0); c.lineTo(i, s); c.stroke();
      }
      c.fillStyle = '#fef08a';
      c.beginPath(); c.arc(32, 32, 12, 0, Math.PI * 2); c.fill();
    });

    // 34: Yoga Mat
    fillTile(ctx, 2, 2, '#6366f1', 4, 35, (x, y) => {
      if (x <= 3 || x >= 60 || y <= 3 || y >= 60) return [129, 140, 248];
      return null;
    });

    // 35: Security Access Gate
    drawCustomTile(ctx, 3, 2, (c, s) => {
      c.clearRect(0, 0, s, s);
      c.fillStyle = 'rgba(239, 68, 68, 0.38)';
      c.fillRect(0, 0, s, s);
      c.fillStyle = 'rgba(254, 202, 202, 0.92)';
      for (let y = 8; y < s; y += 14) c.fillRect(0, y, s, 3);
      c.strokeStyle = 'rgba(185, 28, 28, 0.95)';
      c.lineWidth = 4;
      c.strokeRect(2, 2, s - 4, s - 4);
    });

    // 36: Indoor Plant
    drawCustomTile(ctx, 4, 2, (c, s) => {
      c.fillStyle = '#2d6a4f';
      c.fillRect(0, 0, s, s);
      c.fillStyle = '#52b788';
      c.beginPath(); c.arc(22, 22, 12, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(42, 26, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#784a2a';
      c.fillRect(10, 48, 44, 16);
    });

    // 37: White Lounge Chair / Table Top
    fillTile(ctx, 5, 2, '#f1f5f9', 3, 38, (x, y) => {
      if (x <= 2 || y <= 2 || x >= 61 || y >= 61) return [203, 213, 225];
      return null;
    });

    // 38: Exposed Dark Industrial Ceiling
    fillTile(ctx, 6, 2, '#1f2937', 4, 39, (x, y) => {
      if ((y >= 16 && y <= 20) || (y >= 44 && y <= 48)) return [75, 85, 99];
      return null;
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 8;
    tex.flipY = false;
    return tex;
  }

  const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    PLAZA: 2,
    CONCRETE: 3,
    RAW_CONCRETE: 4,
    GLASS: 5,
    MARBLE: 6,
    WOOD: 7,
    DARK_WOOD: 8,
    TRACK: 9,
    SPORTS_BLUE: 10,
    TURF: 11,
    YELLOW_CAB: 12,
    TEAL_WALL: 13,
    SAGE_CARPET: 14,
    FOREST_MURAL: 15,
    FOREST_DARK: 16,
    OCEAN_WALL: 17,
    OCEAN_MOSAIC: 18,
    KELP_BAFFLE: 19,
    NAVY_BOOTH: 20,
    RED_BOOTH: 21,
    CHARCOAL_FLOOR: 22,
    MAP_ORANGE: 23,
    CITY_MURAL: 24,
    MAP_GREEN: 25,
    LED_LIGHT: 26,
    ELEVATOR: 27,
    STAIR: 28,
    PINGPONG: 29,
    GYM_MACHINE: 30,
    COFFEE_BAR: 31,
    LOCKER: 32,
    GOLD_TRIM: 33,
    RATTAN_LAMP: 34,
    YOGA_MAT: 35,
    ACCESS_GATE: 36,
    PLANT: 37,
    WHITE_DESK: 38,
    DARK_CEILING: 39,
  };

  const BLOCK_INFO = {
    [BLOCKS.AIR]:           { name: 'Air', solid: false, transparent: true },
    [BLOCKS.GRASS]:         { name: 'Campus Grass', solid: true, all: 0, color: '#4f8a3c' },
    [BLOCKS.PLAZA]:         { name: 'Plaza Pavement', solid: true, all: 1, color: '#9aa3ad' },
    [BLOCKS.CONCRETE]:      { name: 'Campus Concrete', solid: true, all: 2, color: '#d8dde3' },
    [BLOCKS.RAW_CONCRETE]:  { name: 'Industrial Concrete', solid: true, all: 3, color: '#5a6069' },
    [BLOCKS.GLASS]:         { name: 'Curtain Glass', solid: true, transparent: true, all: 4, color: '#87cef0' },
    [BLOCKS.MARBLE]:        { name: 'Lobby Marble', solid: true, all: 5, color: '#ebe7df' },
    [BLOCKS.WOOD]:          { name: 'Warm Oak Wood', solid: true, all: 6, color: '#c28b52' },
    [BLOCKS.DARK_WOOD]:     { name: 'Dark Timber', solid: true, all: 7, color: '#4f3524' },
    [BLOCKS.TRACK]:         { name: 'Running Track Lane', solid: true, all: 8, color: '#c85a32' },
    [BLOCKS.SPORTS_BLUE]:   { name: 'Sports Court Blue', solid: true, all: 9, color: '#1e88c9' },
    [BLOCKS.TURF]:          { name: 'Indoor Sports Turf', solid: true, all: 10, color: '#449e38' },
    [BLOCKS.YELLOW_CAB]:    { name: 'Yellow Pantry Cabinet', solid: true, all: 11, color: '#eab308' },
    [BLOCKS.TEAL_WALL]:     { name: 'Teal Accent Wall', solid: true, all: 12, color: '#2aa3ad' },
    [BLOCKS.SAGE_CARPET]:   { name: 'Forest Sage Carpet', solid: true, all: 13, color: '#8ba878' },
    [BLOCKS.FOREST_MURAL]:  { name: 'Botanical Forest Mural', solid: true, all: 14, color: '#cfe0c4' },
    [BLOCKS.FOREST_DARK]:   { name: 'Forest Acoustic Panel', solid: true, all: 15, color: '#3a5a40' },
    [BLOCKS.OCEAN_WALL]:    { name: 'Ocean Porthole Wall', solid: true, all: 16, color: '#68b4e3' },
    [BLOCKS.OCEAN_MOSAIC]:  { name: 'Ocean Mosaic Tile', solid: true, all: 17, color: '#1d78a6' },
    [BLOCKS.KELP_BAFFLE]:   { name: 'Kelp Wave Baffle', solid: true, all: 18, color: '#5eead4' },
    [BLOCKS.NAVY_BOOTH]:    { name: 'Navy Lounge Booth', solid: true, all: 19, color: '#1e3a5f' },
    [BLOCKS.RED_BOOTH]:     { name: 'Industrial Red Booth', solid: true, all: 20, color: '#dc2626' },
    [BLOCKS.CHARCOAL_FLOOR]:{ name: 'Charcoal Gym/Carpet', solid: true, all: 21, color: '#2d323b' },
    [BLOCKS.MAP_ORANGE]:    { name: 'Map Terracotta Panel', solid: true, all: 22, color: '#ea7b46' },
    [BLOCKS.CITY_MURAL]:    { name: 'City Skyline Mural', solid: true, all: 23, color: '#f8fafc' },
    [BLOCKS.MAP_GREEN]:     { name: 'Terrain Map Panel', solid: true, all: 24, color: '#6eb82b' },
    [BLOCKS.LED_LIGHT]:     { name: 'LED Ceiling Panel', solid: true, all: 25, emissive: true, color: '#fef9c3' },
    [BLOCKS.ELEVATOR]:      { name: 'Lift Lobby Door', solid: true, all: 26, color: '#94a3b8' },
    [BLOCKS.STAIR]:         { name: 'Stair Step', solid: true, all: 27, color: '#cbd5e1' },
    [BLOCKS.PINGPONG]:      { name: 'Ping Pong Table', solid: true, all: 28, color: '#dc2626' },
    [BLOCKS.GYM_MACHINE]:   { name: 'Gym Station', solid: true, all: 29, color: '#1e293b' },
    [BLOCKS.COFFEE_BAR]:    { name: 'Espresso Station', solid: true, all: 30, color: '#334155' },
    [BLOCKS.LOCKER]:        { name: 'Locker Cubbies', solid: true, all: 31, color: '#b48a5a' },
    [BLOCKS.GOLD_TRIM]:     { name: 'VIP Gold Trim', solid: true, all: 32, color: '#f59e0b' },
    [BLOCKS.RATTAN_LAMP]:   { name: 'Rattan Pendant Lamp', solid: true, all: 33, emissive: true, color: '#d4a373' },
    [BLOCKS.YOGA_MAT]:      { name: 'Yoga Studio Mat', solid: true, all: 34, color: '#6366f1' },
    [BLOCKS.ACCESS_GATE]:   { name: 'Access Lock Barrier', solid: true, transparent: true, all: 35, color: '#ef4444' },
    [BLOCKS.PLANT]:         { name: 'Indoor Plant', solid: true, all: 36, color: '#2d6a4f' },
    [BLOCKS.WHITE_DESK]:    { name: 'White Table / Desk', solid: true, all: 37, color: '#f1f5f9' },
    [BLOCKS.DARK_CEILING]:  { name: 'Industrial Duct Ceiling', solid: true, all: 38, color: '#1f2937' },
  };

  const HOTBAR_BLOCKS = [
    BLOCKS.WHITE_DESK,
    BLOCKS.WOOD,
    BLOCKS.GLASS,
    BLOCKS.PLANT,
    BLOCKS.LED_LIGHT,
    BLOCKS.RED_BOOTH,
    BLOCKS.TURF,
    BLOCKS.GOLD_TRIM,
    BLOCKS.COFFEE_BAR,
  ];

  global.VoxelTextures = {
    TILE_SIZE,
    ATLAS_COLS,
    ATLAS_ROWS,
    BLOCKS,
    BLOCK_INFO,
    HOTBAR_BLOCKS,
    createAtlas,
  };
})(window);
