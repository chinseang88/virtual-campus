// PG17 Multi-Level Voxel Building Generator (Levels 1, 4, 5, 6, 7, 8)
(function (global) {
  const { BLOCKS, BLOCK_INFO } = global.VoxelTextures;

  const WORLD_W = 68;
  const WORLD_H = 44;
  const WORLD_D = 42;
  const FLOOR_HEIGHT = 6;

  // Continuous Floors 1-6 matching PG17 themes, Fitness Centers & Unique Interactive Landmarks
  const PG17_LEVELS = [
    {
      index: 0,
      level: 1,
      code: 'F1',
      shortName: 'Main Lobby (ML)',
      theme: 'Welcome Lobby & Trojan Horse Atrium',
      uniqueItem: 'Trojan Horse • VIP Kiosk • Drone Pad',
      upgradeNote: 'Base Campus Entry, Reception & 3 Interactive Items',
      floorY: 1,
      standY: 2,
      accent: '#94a3b8',
    },
    {
      index: 1,
      level: 2,
      code: 'F2',
      shortName: 'Sports Theme',
      uniqueItem: 'Soccer Ball • Sprint Timer • Arcade Hoop',
      upgradeNote: 'Unlocks Running Track, Blue Court, Turf Pitch & 3 Sports Items',
      theme: 'Track, Turf Pitch & Sports Lounge',
      floorY: 7,
      standY: 8,
      accent: '#eab308',
    },
    {
      index: 2,
      level: 3,
      code: 'F3',
      shortName: 'Forest Theme',
      uniqueItem: 'Bear Bear • Zen Bowl • Spin Bike',
      upgradeNote: 'Unlocks Forest Lounge, Yoga & Spin Studios + 3 Items',
      theme: 'Forest Lounge & Fitness Studio Rooms',
      floorY: 13,
      standY: 14,
      accent: '#4ade80',
    },
    {
      index: 3,
      level: 4,
      code: 'F4',
      shortName: 'Ocean Theme',
      uniqueItem: 'Ocean Dolphin • Coral Aquarium • Ping-Pong Cannon',
      upgradeNote: 'Unlocks Coastal & Kelp Lounges, Relax Corner & 3 Ocean Items',
      theme: 'Ocean Lounge & Fitness Relax Corner',
      floorY: 19,
      standY: 20,
      accent: '#38bdf8',
    },
    {
      index: 4,
      level: 5,
      code: 'F5',
      shortName: 'Industrial Theme',
      uniqueItem: 'Michelangelo • Punching Bag • Synth Jukebox',
      upgradeNote: 'Unlocks Loft Co-Work, Main Gym & 3 Industrial Items',
      theme: 'Industrial Loft & Main Fitness Gym',
      floorY: 25,
      standY: 26,
      accent: '#f87171',
    },
    {
      index: 5,
      level: 6,
      code: 'F6',
      shortName: 'Map Theme',
      uniqueItem: 'World Globe • Flight Radar • Terrain Sandtable',
      upgradeNote: 'Top Floor: Dual-Map Sky Lounges, VIP Skylight & 3 Map Items',
      theme: 'Executive Dual-Map Sky Lounge',
      floorY: 31,
      standY: 32,
      accent: '#fb923c',
    },
  ];

  class VoxelWorld {
    constructor() {
      this.w = WORLD_W;
      this.h = WORLD_H;
      this.d = WORLD_D;
      this.data = new Uint8Array(this.w * this.h * this.d);
      this.gatePositions = []; // Dynamic access-barrier coordinates per floor transition
      this.pois = [];
      this.maxAllowedLevel = 1;
      this.buildPG17();
      this.applyAccessLevel(1);
    }

    idx(x, y, z) {
      return (y * this.d + z) * this.w + x;
    }

    inBounds(x, y, z) {
      return x >= 0 && x < this.w && y >= 0 && y < this.h && z >= 0 && z < this.d;
    }

    get(x, y, z) {
      if (!this.inBounds(x, y, z)) return BLOCKS.AIR;
      return this.data[this.idx(x, y, z)];
    }

    getRaw(x, y, z) {
      return this.get(x, y, z);
    }

    set(x, y, z, block) {
      if (!this.inBounds(x, y, z)) return;
      this.data[this.idx(x, y, z)] = block;
    }

    fill(x1, y1, z1, x2, y2, z2, block) {
      for (let y = y1; y <= y2; y++) {
        for (let z = z1; z <= z2; z++) {
          for (let x = x1; x <= x2; x++) {
            this.set(x, y, z, block);
          }
        }
      }
    }

    isSolid(x, y, z) {
      const b = this.get(x, y, z);
      return !!(BLOCK_INFO[b] && BLOCK_INFO[b].solid);
    }

    isOpaque(x, y, z) {
      const b = this.get(x, y, z);
      const info = BLOCK_INFO[b];
      return !!(info && info.solid && !info.transparent);
    }

    addPOI(name, x, y, z, level) {
      this.pois.push({ name, x, y, z, level });
    }

    // Update physical laser gates on the staircase leading above maxLevel
    applyAccessLevel(maxLevel) {
      this.maxAllowedLevel = maxLevel;
      for (const g of this.gatePositions) {
        const locked = g.targetLevel > maxLevel;
        const blk = locked ? BLOCKS.ACCESS_GATE : BLOCKS.AIR;
        this.fill(g.x1, g.y1, g.z1, g.x2, g.y2, g.z2, blk);
      }
    }

    getMaxAllowedFloorObj(userLevel = this.maxAllowedLevel) {
      let best = PG17_LEVELS[0];
      for (const lvl of PG17_LEVELS) {
        if (lvl.level <= userLevel) best = lvl;
      }
      return best;
    }

    getFloorAtY(y) {
      let best = PG17_LEVELS[0];
      for (const lvl of PG17_LEVELS) {
        if (y >= lvl.floorY) best = lvl;
      }
      return best;
    }

    // Stairwell UP & DOWN trigger zones for smooth Pokemon-style floor transitions
    getStairZones() {
      const zones = [];
      for (let i = 0; i < PG17_LEVELS.length; i++) {
        const lvl = PG17_LEVELS[i];
        if (i < PG17_LEVELS.length - 1) {
          const nextLvl = PG17_LEVELS[i + 1];
          const isEven = i % 2 === 0;
          zones.push({
            dir: 'up',
            fromLevel: lvl.level,
            toLevel: nextLvl.level,
            standY: lvl.standY,
            minX: isEven ? 29.8 : 34.8,
            maxX: isEven ? 33.2 : 38.2,
            minZ: isEven ? 23.2 : 18.5,
            maxZ: isEven ? 24.8 : 20.2,
            spawnX: isEven ? 31.5 : 36.5,
            spawnY: nextLvl.standY,
            spawnZ: isEven ? 17.4 : 25.8,
            spawnYaw: isEven ? 0 : Math.PI,
            markerX: isEven ? 31.5 : 36.5,
            markerZ: isEven ? 24.5 : 19.0,
          });
        }
        if (i > 0) {
          const prevLvl = PG17_LEVELS[i - 1];
          const prevEven = (i - 1) % 2 === 0;
          zones.push({
            dir: 'down',
            fromLevel: lvl.level,
            toLevel: prevLvl.level,
            standY: lvl.standY,
            minX: prevEven ? 29.8 : 34.8,
            maxX: prevEven ? 33.2 : 38.2,
            minZ: prevEven ? 19.2 : 22.2,
            maxZ: prevEven ? 21.2 : 24.2,
            spawnX: prevEven ? 31.5 : 36.5,
            spawnY: prevLvl.standY,
            spawnZ: prevEven ? 26.4 : 17.4,
            spawnYaw: prevEven ? Math.PI : 0,
            markerX: prevEven ? 31.5 : 36.5,
            markerZ: prevEven ? 20.0 : 23.5,
          });
        }
      }
      return zones;
    }

    buildPG17() {
      // 0. Base Campus Grounds
      this.fill(0, 0, 0, this.w - 1, 0, this.d - 1, BLOCKS.PLAZA);
      this.fill(0, 1, 0, this.w - 1, 1, this.d - 1, BLOCKS.GRASS);
      // Paved campus arrival plaza & driveway on South side
      this.fill(3, 1, 34, 64, 1, 41, BLOCKS.PLAZA);
      this.fill(26, 1, 35, 41, 1, 41, BLOCKS.MARBLE);
      // Campus perimeter trees / hedges
      for (let x = 2; x <= 65; x += 5) {
        if (x < 24 || x > 43) {
          this.set(x, 2, 3, BLOCKS.PLANT);
          this.set(x, 2, 39, BLOCKS.PLANT);
        }
      }

      // 1. Build structural shell + core for all 6 PG17 levels
      for (const lvl of PG17_LEVELS) {
        this.buildLevelShell(lvl);
      }

      // 2. Rooftop Crown above Level 8 (y = 37..40)
      this.fill(4, 37, 6, 63, 37, 34, BLOCKS.CONCRETE);
      // Glass skylight atrium over central LL core on Level 8
      this.fill(27, 37, 10, 40, 37, 29, BLOCKS.GLASS);
      this.fill(4, 38, 6, 63, 38, 6, BLOCKS.GOLD_TRIM);
      this.fill(4, 38, 34, 63, 38, 34, BLOCKS.GOLD_TRIM);
      this.fill(4, 38, 6, 4, 38, 34, BLOCKS.GOLD_TRIM);
      this.fill(63, 38, 6, 63, 38, 34, BLOCKS.GOLD_TRIM);

      // 3. Build each PG17 Level's unique themed floorplan & furniture
      this.buildLevel1Lobby(PG17_LEVELS[0]);
      this.buildLevel4Sports(PG17_LEVELS[1]);
      this.buildLevel5Forest(PG17_LEVELS[2]);
      this.buildLevel6Ocean(PG17_LEVELS[3]);
      this.buildLevel7Industrial(PG17_LEVELS[4]);
      this.buildLevel8Map(PG17_LEVELS[5]);

      // 4. Re-carve all stairwell shafts & railings after themed floor/ceiling finishes
      this.carveStairCutouts();
    }

    carveStairCutouts() {
      for (let i = 1; i < PG17_LEVELS.length; i++) {
        const lvl = PG17_LEVELS[i];
        const y0 = lvl.floorY;
        const prevEven = (i - 1) % 2 === 0;
        if (prevEven) {
          this.fill(30, y0, 20, 32, y0, 24, BLOCKS.AIR);
          this.fill(29, y0 + 1, 20, 29, y0 + 1, 25, BLOCKS.GLASS);
          this.fill(33, y0 + 1, 20, 33, y0 + 1, 25, BLOCKS.GLASS);
          this.fill(30, y0 + 1, 25, 32, y0 + 1, 25, BLOCKS.GLASS);
        } else {
          this.fill(35, y0, 19, 37, y0, 23, BLOCKS.AIR);
          this.fill(34, y0 + 1, 18, 34, y0 + 1, 23, BLOCKS.GLASS);
          this.fill(38, y0 + 1, 18, 38, y0 + 1, 23, BLOCKS.GLASS);
          this.fill(35, y0 + 1, 18, 37, y0 + 1, 18, BLOCKS.GLASS);
        }
      }
    }

    buildLevelShell(lvl) {
      const y0 = lvl.floorY;
      const yTop = y0 + 5;
      const yCeil = y0 + 6;

      // Base structural floor slab
      this.fill(4, y0, 6, 63, y0, 34, BLOCKS.CONCRETE);
      // Clear interior volume
      this.fill(5, y0 + 1, 7, 62, yTop, 33, BLOCKS.AIR);

      // Perimeter walls: full-height glass backdrop on North (z=6); crisp cutaway half-walls (curb + glass) on S/E/W
      for (let x = 4; x <= 63; x++) {
        const isCorner = x === 4 || x === 63;
        const isNorthMullion = x === 26 || x === 41;
        for (let y = y0 + 1; y <= yTop; y++) {
          this.set(x, y, 6, (isCorner || isNorthMullion) ? BLOCKS.CONCRETE : BLOCKS.GLASS);
        }
        if (isCorner) {
          for (let y = y0 + 1; y <= yTop; y++) this.set(x, y, 34, BLOCKS.CONCRETE);
        } else {
          this.set(x, y0 + 1, 34, BLOCKS.CONCRETE);
          this.set(x, y0 + 2, 34, BLOCKS.GLASS);
        }
      }
      for (let z = 6; z <= 34; z++) {
        const isCorner = z === 6 || z === 34;
        if (isCorner) {
          for (let y = y0 + 1; y <= yTop; y++) {
            this.set(4, y, z, BLOCKS.CONCRETE);
            this.set(63, y, z, BLOCKS.CONCRETE);
          }
        } else {
          this.set(4, y0 + 1, z, BLOCKS.CONCRETE);
          this.set(4, y0 + 2, z, BLOCKS.GLASS);
          this.set(63, y0 + 1, z, BLOCKS.CONCRETE);
          this.set(63, y0 + 2, z, BLOCKS.GLASS);
        }
      }

      // Open-office wing dividers separating L1 | LL | L2 (solid curb + framed glass above, wide open doorways!)
      for (let z = 7; z <= 33; z++) {
        const inNorthDoor = z >= 10 && z <= 15;
        const inSouthDoor = z >= 26 && z <= 31;
        if (!inNorthDoor && !inSouthDoor) {
          this.set(26, y0 + 1, z, BLOCKS.CONCRETE);
          this.set(26, y0 + 2, z, BLOCKS.GLASS);
          this.set(41, y0 + 1, z, BLOCKS.CONCRETE);
          this.set(41, y0 + 2, z, BLOCKS.GLASS);
        }
      }

      // Central Lift Bank (North side of LL: x=28..39, z=7..8)
      this.fill(28, y0 + 1, 7, 39, yTop, 7, BLOCKS.CONCRETE);
      [29, 32, 35, 38].forEach((ex) => {
        this.fill(ex, y0 + 1, 8, ex + 1, y0 + 3, 8, BLOCKS.ELEVATOR);
        this.fill(ex, y0 + 4, 8, ex + 1, yTop, 8, BLOCKS.CONCRETE);
      });

      // Switchback Stairwell connecting this level to the next level (if not top floor)
      if (lvl.index < PG17_LEVELS.length - 1) {
        const nextLvl = PG17_LEVELS[lvl.index + 1];
        const isEven = lvl.index % 2 === 0;

        if (isEven) {
          // West flight: x=30..32, climbs South (z=24) -> North (z=19)
          for (let k = 0; k < 5; k++) {
            this.fill(30, y0 + 1, 24 - k, 32, y0 + 1 + k, 24 - k, BLOCKS.STAIR);
          }
          // Upper floor cutout at yCeil will be opened when next level runs, so carve cutout on next floor:
          // Store cutout info on next floor by opening it after next floor's slab is laid (done below!)
          // Access gate sits right at bottom of stairs (z=25)
          this.gatePositions.push({
            x1: 30, y1: y0 + 1, z1: 25,
            x2: 32, y2: y0 + 4, z2: 25,
            fromLevel: lvl.level,
            targetLevel: nextLvl.level,
          });
        } else {
          // East flight: x=35..37, climbs North (z=19) -> South (z=24)
          for (let k = 0; k < 5; k++) {
            this.fill(35, y0 + 1, 19 + k, 37, y0 + 1 + k, 19 + k, BLOCKS.STAIR);
          }
          this.gatePositions.push({
            x1: 35, y1: y0 + 1, z1: 18,
            x2: 37, y2: y0 + 4, z2: 18,
            fromLevel: lvl.level,
            targetLevel: nextLvl.level,
          });
        }
      }

      // Carve stairwell landing cutout in THIS floor's slab from the flight arriving from below
      if (lvl.index > 0) {
        const prevEven = (lvl.index - 1) % 2 === 0;
        if (prevEven) {
          // West flight arrived at z=19, open z=20..24 in x=30..32
          this.fill(30, y0, 20, 32, y0, 24, BLOCKS.AIR);
          // Safety glass guardrails around cutout (keep z=19 open to step off!)
          this.fill(29, y0 + 1, 20, 29, y0 + 1, 25, BLOCKS.GLASS);
          this.fill(33, y0 + 1, 20, 33, y0 + 1, 25, BLOCKS.GLASS);
          this.fill(30, y0 + 1, 25, 32, y0 + 1, 25, BLOCKS.GLASS);
        } else {
          // East flight arrived at z=24, open z=19..23 in x=35..37
          this.fill(35, y0, 19, 37, y0, 23, BLOCKS.AIR);
          // Safety glass guardrails (keep z=24 open to step off!)
          this.fill(34, y0 + 1, 18, 34, y0 + 1, 23, BLOCKS.GLASS);
          this.fill(38, y0 + 1, 18, 38, y0 + 1, 23, BLOCKS.GLASS);
          this.fill(35, y0 + 1, 18, 37, y0 + 1, 18, BLOCKS.GLASS);
        }
      }

      // Standard LED lights in LL Lift Lobby
      this.set(30, yTop, 11, BLOCKS.LED_LIGHT);
      this.set(37, yTop, 11, BLOCKS.LED_LIGHT);
      this.set(30, yTop, 29, BLOCKS.LED_LIGHT);
      this.set(37, yTop, 29, BLOCKS.LED_LIGHT);
    }

    // Helper: place a 2x2 table + chairs
    placeCafeTable(cx, y, cz, tableBlk = BLOCKS.WHITE_DESK, chairBlk = BLOCKS.NAVY_BOOTH) {
      this.set(cx, y, cz, tableBlk);
      this.set(cx + 1, y, cz, tableBlk);
      this.set(cx, y, cz + 1, tableBlk);
      this.set(cx + 1, y, cz + 1, tableBlk);
      // Chairs on opposite sides
      this.set(cx - 1, y, cz, chairBlk);
      this.set(cx + 2, y, cz + 1, chairBlk);
    }

    // Helper: open-concept pantry counter + coffee machines (low height for clear sightlines)
    placePantry(x1, x2, zWall, y, cabBlk, backsplashBlk) {
      const zFront = zWall === 7 ? 8 : zWall - 1;
      this.fill(x1, y, zWall, x2, y + 1, zWall, backsplashBlk);
      this.fill(x1, y, zFront, x2, y, zFront, cabBlk);
      // Twin espresso / coffee machines on counter
      for (let x = x1 + 1; x <= x2 - 1; x += 3) {
        this.set(x, y + 1, zFront, BLOCKS.COFFEE_BAR);
      }
    }

    // =========================================================================
    // LEVEL 1: Main Lobby (ML) — Open Atrium & Check-In
    // =========================================================================
    buildLevel1Lobby(lvl) {
      const y = lvl.standY;
      // Polished marble across entire ground floor
      this.fill(5, lvl.floorY, 7, 62, lvl.floorY, 33, BLOCKS.MARBLE);
      // Grand South entrance opening (x=30..37, z=34)
      this.fill(30, y, 34, 37, y + 3, 34, BLOCKS.AIR);
      this.fill(29, y, 34, 29, y + 1, 34, BLOCKS.GOLD_TRIM);
      this.fill(38, y, 34, 38, y + 1, 34, BLOCKS.GOLD_TRIM);

      // ML Reception & Security Zone (Center & East ML, open sightlines)
      this.fill(44, y, 22, 54, y, 23, BLOCKS.DARK_WOOD);
      this.fill(44, y + 1, 22, 54, y + 1, 22, BLOCKS.WHITE_DESK);
      this.fill(46, y, 16, 52, y + 1, 16, BLOCKS.TEAL_WALL); // Open Intel Welcome Counter
      this.fill(47, y + 1, 17, 51, y + 1, 17, BLOCKS.LED_LIGHT);

      // Visitor Lounge & Open Co-Work in West Wing (L1) — keep (14..17, 19..22) clear for Trojan Horse!
      this.fill(7, y, 10, 10, y, 11, BLOCKS.NAVY_BOOTH);
      this.fill(7, y, 14, 10, y, 15, BLOCKS.NAVY_BOOTH);
      this.placeCafeTable(9, y, 26, BLOCKS.WHITE_DESK, BLOCKS.NAVY_BOOTH);
      this.placeCafeTable(19, y, 26, BLOCKS.WHITE_DESK, BLOCKS.NAVY_BOOTH);
      this.set(6, y, 8, BLOCKS.PLANT);
      this.set(6, y, 32, BLOCKS.PLANT);
      this.set(61, y, 8, BLOCKS.PLANT);
      this.set(61, y, 32, BLOCKS.PLANT);

      // Sleek glass turnstile gates in LL
      for (let x = 27; x <= 40; x += 3) {
        this.set(x, y, 29, BLOCKS.GLASS);
      }

      this.addPOI('Floor 1 Main Lobby (ML)', 34, y, 30, 1);
      this.addPOI('Floor 1 ML Reception', 49, y, 25, 1);
      this.addPOI('Floor 1 Trojan Horse Atrium', 15, y, 20, 1);
    }

    // =========================================================================
    // FLOOR 2: Sports Theme (Open Track, Blue Court & Turf Pitch)
    // =========================================================================
    buildLevel4Sports(lvl) {
      const y = lvl.standY;
      const yCeil = lvl.floorY + 5;

      // L1 West: Blue Curved Court + Running Track Lanes + Yellow Pantry
      this.fill(5, lvl.floorY, 7, 17, lvl.floorY, 33, BLOCKS.SPORTS_BLUE);
      this.fill(18, lvl.floorY, 7, 25, lvl.floorY, 33, BLOCKS.TRACK);
      this.fill(6, yCeil, 10, 16, yCeil, 28, BLOCKS.SPORTS_BLUE);
      this.placePantry(7, 15, 7, y, BLOCKS.YELLOW_CAB, BLOCKS.WHITE_DESK);
      this.fill(8, y, 15, 10, y, 21, BLOCKS.WHITE_DESK);
      this.fill(6, y, 15, 6, y, 22, BLOCKS.NAVY_BOOTH);
      this.placeCafeTable(12, y, 25, BLOCKS.WHITE_DESK, BLOCKS.NAVY_BOOTH);

      // LL Center: Amber/Gold Sports Lift Lobby
      this.fill(27, lvl.floorY, 9, 40, lvl.floorY, 33, BLOCKS.CHARCOAL_FLOOR);
      this.fill(27, lvl.floorY, 27, 40, lvl.floorY, 31, BLOCKS.TRACK);

      // L2 East: Open Green Turf Pitch
      this.fill(42, lvl.floorY, 7, 62, lvl.floorY, 33, BLOCKS.TURF);
      this.fill(42, yCeil, 7, 62, yCeil, 33, BLOCKS.DARK_CEILING);
      this.fill(46, yCeil, 11, 58, yCeil, 11, BLOCKS.LED_LIGHT);
      this.fill(46, yCeil, 28, 58, yCeil, 28, BLOCKS.LED_LIGHT);
      this.fill(46, yCeil, 11, 46, yCeil, 28, BLOCKS.LED_LIGHT);
      this.fill(58, yCeil, 11, 58, yCeil, 28, BLOCKS.LED_LIGHT);
      this.fill(43, y, 7, 61, y, 7, BLOCKS.TEAL_WALL);
      this.placeCafeTable(45, y, 10, BLOCKS.WHITE_DESK, BLOCKS.TEAL_WALL);
      this.placeCafeTable(57, y, 10, BLOCKS.WHITE_DESK, BLOCKS.TEAL_WALL);
      this.placeCafeTable(57, y, 29, BLOCKS.WHITE_DESK, BLOCKS.TEAL_WALL);

      this.addPOI('Floor 2 Sports Running Track', 21, y, 20, 2);
      this.addPOI('Floor 2 Sports Blue Lounge', 11, y, 18, 2);
      this.addPOI('Floor 2 Turf Pitch & Ball', 52, y, 20, 2);
    }

    // =========================================================================
    // FLOOR 3: Forest Theme + Open-Concept Fitness Studios
    // =========================================================================
    buildLevel5Forest(lvl) {
      const y = lvl.standY;
      const yCeil = lvl.floorY + 5;

      // L1 West: Open Forest Botanical Lounge
      this.fill(5, lvl.floorY, 7, 25, lvl.floorY, 33, BLOCKS.SAGE_CARPET);
      this.fill(5, y, 10, 5, y + 1, 30, BLOCKS.FOREST_MURAL);
      for (let z = 10; z <= 30; z += 6) {
        for (let x = 8; x <= 22; x += 6) {
          this.fill(x - 1, yCeil, z - 1, x + 1, yCeil, z + 1, BLOCKS.FOREST_DARK);
          this.set(x, yCeil - 1, z, BLOCKS.RATTAN_LAMP);
        }
      }
      this.placePantry(8, 16, 7, y, BLOCKS.WOOD, BLOCKS.WHITE_DESK);
      this.placeCafeTable(9, y, 12, BLOCKS.WOOD, BLOCKS.WHITE_DESK);
      this.placeCafeTable(18, y, 12, BLOCKS.WOOD, BLOCKS.WHITE_DESK);
      this.fill(8, y, 25, 13, y, 26, BLOCKS.FOREST_DARK);
      this.fill(8, y, 29, 13, y, 30, BLOCKS.FOREST_DARK);
      this.fill(18, y, 26, 22, y, 29, BLOCKS.WOOD);
      this.set(6, y, 9, BLOCKS.PLANT);
      this.set(6, y, 31, BLOCKS.PLANT);

      // LL Center: Forest Lift Lobby
      this.fill(27, lvl.floorY, 9, 40, lvl.floorY, 33, BLOCKS.SAGE_CARPET);
      this.set(28, y, 15, BLOCKS.PLANT);
      this.set(39, y, 15, BLOCKS.PLANT);

      // L2 East: Open-Glass Yoga Studio + Spin & Turf Studio
      this.fill(42, lvl.floorY, 7, 62, lvl.floorY, 20, BLOCKS.WOOD);
      this.fill(42, lvl.floorY, 21, 62, lvl.floorY, 33, BLOCKS.CHARCOAL_FLOOR);
      this.fill(48, lvl.floorY, 27, 61, lvl.floorY, 32, BLOCKS.TURF);
      for (let x = 42; x <= 62; x++) {
        if (x < 50 || x > 54) this.set(x, y, 20, BLOCKS.GLASS);
      }
      this.fill(45, y, 7, 59, y, 7, BLOCKS.LOCKER);
      [46, 51, 56].forEach((mx) => {
        this.fill(mx, y, 11, mx + 2, y, 12, BLOCKS.YOGA_MAT);
        this.fill(mx, y, 15, mx + 2, y, 16, BLOCKS.YOGA_MAT);
      });
      for (let z = 22; z <= 26; z += 2) {
        for (let x = 46; x <= 58; x += 4) {
          this.set(x, y, z, BLOCKS.GYM_MACHINE);
        }
      }

      this.addPOI('Floor 3 Forest Lounge (Bear Bear)', 15, y, 20, 3);
      this.addPOI('Floor 3 Yoga Studio', 52, y, 14, 3);
      this.addPOI('Floor 3 Spin & Turf Studio', 52, y, 27, 3);
    }

    // =========================================================================
    // FLOOR 4: Ocean Theme + Open Fitness Relax Corner & Lockers
    // =========================================================================
    buildLevel6Ocean(lvl) {
      const y = lvl.standY;
      const yCeil = lvl.floorY + 5;

      // L1 West: Open Coastal Zone (North) + Kelp Wave Lounge (South)
      this.fill(5, lvl.floorY, 7, 25, lvl.floorY, 33, BLOCKS.WOOD);
      this.fill(5, y, 7, 5, y + 1, 20, BLOCKS.OCEAN_WALL);
      this.placePantry(8, 16, 7, y, BLOCKS.WOOD, BLOCKS.OCEAN_MOSAIC);
      this.fill(6, y, 12, 8, y, 17, BLOCKS.NAVY_BOOTH);
      this.placeCafeTable(20, y, 13, BLOCKS.WHITE_DESK, BLOCKS.OCEAN_WALL);
      for (let z = 22; z <= 32; z += 3) {
        this.fill(6, yCeil, z, 24, yCeil, z + 1, BLOCKS.KELP_BAFFLE);
      }
      this.fill(8, y, 24, 15, y, 25, BLOCKS.WOOD);
      this.fill(8, y, 29, 15, y, 30, BLOCKS.WOOD);
      this.fill(18, y, 24, 23, y, 25, BLOCKS.TEAL_WALL);

      // LL Center: Ocean Lift Lobby
      this.fill(27, lvl.floorY, 9, 40, lvl.floorY, 33, BLOCKS.MARBLE);
      this.fill(27, lvl.floorY, 10, 40, lvl.floorY, 15, BLOCKS.OCEAN_MOSAIC);

      // L2 East: Open Relax Corner, Low Lockers & Frosted Glass Wash Zones
      this.fill(42, lvl.floorY, 7, 62, lvl.floorY, 33, BLOCKS.WOOD);
      this.fill(43, lvl.floorY, 7, 62, lvl.floorY, 15, BLOCKS.OCEAN_MOSAIC);
      this.fill(44, y, 7, 54, y, 7, BLOCKS.LOCKER);
      this.fill(44, y, 11, 52, y, 11, BLOCKS.LOCKER);
      for (let x = 56; x <= 62; x += 3) {
        this.fill(x, y, 7, x, y + 1, 14, BLOCKS.GLASS);
      }
      this.fill(44, y, 21, 47, y, 22, BLOCKS.WHITE_DESK);
      this.fill(44, y, 27, 47, y, 28, BLOCKS.WHITE_DESK);
      this.fill(53, y, 19, 55, y, 22, BLOCKS.PINGPONG);
      this.fill(53, y, 25, 55, y, 28, BLOCKS.PINGPONG);
      this.fill(58, y, 29, 60, y, 30, BLOCKS.TURF);

      this.addPOI('Floor 4 Ocean Dolphin Lounge', 15, y, 15, 4);
      this.addPOI('Floor 4 Kelp Wave Bar', 13, y, 27, 4);
      this.addPOI('Floor 4 Ping-Pong Relax Corner', 51, y, 23, 4);
    }

    // =========================================================================
    // FLOOR 5: Industrial Open-Office Loft + Unobstructed Main Gym
    // =========================================================================
    buildLevel7Industrial(lvl) {
      const y = lvl.standY;
      const yCeil = lvl.floorY + 5;

      this.fill(5, yCeil, 7, 25, yCeil, 33, BLOCKS.DARK_CEILING);
      this.fill(42, yCeil, 7, 62, yCeil, 33, BLOCKS.DARK_CEILING);
      this.fill(27, yCeil, 9, 40, yCeil, 17, BLOCKS.DARK_CEILING);
      this.fill(27, yCeil, 26, 40, yCeil, 33, BLOCKS.DARK_CEILING);
      for (let x = 8; x <= 60; x += 8) {
        this.set(x, yCeil, 12, BLOCKS.LED_LIGHT);
        this.set(x, yCeil, 24, BLOCKS.LED_LIGHT);
        this.set(x, yCeil, 30, BLOCKS.LED_LIGHT);
      }

      // L1 West: Open Co-Work Loft + Red Booths + Michelangelo Statue Gallery
      this.fill(5, lvl.floorY, 7, 25, lvl.floorY, 33, BLOCKS.CHARCOAL_FLOOR);
      this.fill(5, y, 8, 5, y + 1, 32, BLOCKS.RAW_CONCRETE);
      this.fill(6, y, 11, 9, y, 12, BLOCKS.RED_BOOTH);
      this.fill(6, y, 15, 9, y, 16, BLOCKS.RED_BOOTH);
      this.fill(6, y, 19, 9, y, 20, BLOCKS.RED_BOOTH);
      this.fill(7, y, 13, 8, y, 14, BLOCKS.WOOD);
      this.fill(7, y, 17, 8, y, 18, BLOCKS.WOOD);
      // Open-office co-work tables around Michelangelo Statue (15..18, 16..19)
      this.fill(14, y, 11, 22, y, 12, BLOCKS.WOOD);
      this.fill(14, y, 22, 22, y, 23, BLOCKS.WOOD);
      this.placePantry(10, 20, 33, y, BLOCKS.YELLOW_CAB, BLOCKS.RAW_CONCRETE);
      this.placeCafeTable(15, y, 27, BLOCKS.WOOD, BLOCKS.CHARCOAL_FLOOR);

      // LL Center: Raw Concrete Industrial Lift Lobby
      this.fill(27, lvl.floorY, 9, 40, lvl.floorY, 33, BLOCKS.RAW_CONCRETE);

      // L2 East: Wide-Open Main Gym (turf workout zone completely clear overhead for Punching Bag visibility!)
      this.fill(42, lvl.floorY, 7, 62, lvl.floorY, 33, BLOCKS.CHARCOAL_FLOOR);
      this.fill(44, lvl.floorY, 10, 50, lvl.floorY, 30, BLOCKS.TURF);
      // Sleek low corner rack stations at North (z=12) & South (z=28) — NO blocking overhead slab!
      this.fill(45, y, 12, 45, y + 1, 12, BLOCKS.GYM_MACHINE);
      this.fill(49, y, 12, 49, y + 1, 12, BLOCKS.GYM_MACHINE);
      this.fill(45, y, 28, 45, y + 1, 28, BLOCKS.GYM_MACHINE);
      this.fill(49, y, 28, 49, y + 1, 28, BLOCKS.GYM_MACHINE);
      for (let z = 12; z <= 28; z += 4) {
        this.set(53, y, z, BLOCKS.GYM_MACHINE);
      }
      for (let z = 10; z <= 30; z += 3) {
        this.set(60, y, z, BLOCKS.GYM_MACHINE);
      }

      this.addPOI('Floor 5 Michelangelo Gallery', 16, y, 17, 5);
      this.addPOI('Floor 5 Loft Co-Work & Pantry', 17, y, 26, 5);
      this.addPOI('Floor 5 Main Fitness Gym', 55, y, 20, 5);
    }

    // =========================================================================
    // FLOOR 6: Map Theme (Open-Concept Sky Atrium & Co-Work Lounges)
    // =========================================================================
    buildLevel8Map(lvl) {
      const y = lvl.standY;
      const yCeil = lvl.floorY + 5;

      // L1 West: Open City Map Sky Lounge
      this.fill(5, lvl.floorY, 7, 25, lvl.floorY, 33, BLOCKS.WOOD);
      this.fill(5, y, 9, 5, y + 1, 31, BLOCKS.CITY_MURAL);
      this.fill(7, yCeil, 9, 14, yCeil, 18, BLOCKS.MAP_ORANGE);
      this.fill(16, yCeil, 19, 23, yCeil, 30, BLOCKS.MAP_ORANGE);
      this.placePantry(8, 17, 7, y, BLOCKS.WOOD, BLOCKS.WHITE_DESK);
      this.fill(7, y, 14, 9, y, 19, BLOCKS.MAP_ORANGE);
      this.placeCafeTable(13, y, 15, BLOCKS.WHITE_DESK, BLOCKS.MAP_ORANGE);
      this.placeCafeTable(13, y, 24, BLOCKS.WHITE_DESK, BLOCKS.MAP_ORANGE);
      this.placeCafeTable(20, y, 20, BLOCKS.WHITE_DESK, BLOCKS.MAP_ORANGE);

      // LL Center: VIP Open Glass Sky Atrium (center x=34, z=27 holds World Globe!)
      this.fill(27, lvl.floorY, 9, 40, lvl.floorY, 33, BLOCKS.MARBLE);
      this.fill(27, y, 9, 27, y + 1, 9, BLOCKS.GOLD_TRIM);
      this.fill(40, y, 9, 40, y + 1, 9, BLOCKS.GOLD_TRIM);
      this.fill(27, y, 33, 27, y + 1, 33, BLOCKS.GOLD_TRIM);
      this.fill(40, y, 33, 40, y + 1, 33, BLOCKS.GOLD_TRIM);

      // L2 East: Open Terrain Map Executive Sky Lounge
      this.fill(42, lvl.floorY, 7, 62, lvl.floorY, 33, BLOCKS.CHARCOAL_FLOOR);
      this.fill(62, y, 10, 62, y + 1, 30, BLOCKS.MAP_GREEN);
      this.fill(44, yCeil, 9, 52, yCeil, 19, BLOCKS.MAP_GREEN);
      this.fill(53, yCeil, 20, 60, yCeil, 30, BLOCKS.MAP_GREEN);
      this.placePantry(46, 56, 7, y, BLOCKS.WOOD, BLOCKS.OCEAN_MOSAIC);
      this.fill(44, y, 14, 46, y, 20, BLOCKS.FOREST_DARK);
      this.fill(44, y, 24, 46, y, 30, BLOCKS.FOREST_DARK);
      this.fill(50, y, 15, 57, y, 17, BLOCKS.WOOD);
      this.fill(50, y, 24, 57, y, 26, BLOCKS.WOOD);
      this.set(60, y, 10, BLOCKS.PLANT);
      this.set(60, y, 30, BLOCKS.PLANT);

      this.addPOI('Floor 6 City Map Lounge', 14, y, 20, 6);
      this.addPOI('Floor 6 VIP Globe Atrium', 34, y, 27, 6);
      this.addPOI('Floor 6 Terrain Map Lounge', 53, y, 20, 6);
    }
  }

  global.PG17_LEVELS = PG17_LEVELS;
  global.FLOOR_HEIGHT = FLOOR_HEIGHT;
  global.VoxelWorld = VoxelWorld;
})(window);
