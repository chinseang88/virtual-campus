// Unique Interactive 3D Landmarks — 3 Exclusive Interactive Items Per Virtual Intel Campus Floor (Floors 1–6)
(function (global) {
  function box(w, h, d, color, emissive = 0x000000) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color, emissive });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function addGlowRing(root, radius = 1.0, color = 0xfde047) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 0.78, radius, 32),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    root.add(ring);
    return ring;
  }

  function tagItem(group, id) {
    group.userData.itemId = id;
    group.traverse((child) => {
      child.userData.itemId = id;
    });
  }

  // Floor 1: Golden Trojan Horse ("Troy Horse")
  function createTrojanHorse() {
    const root = new THREE.Group();
    const wood = 0x9c6234;
    const darkWood = 0x5c3618;
    const gold = 0xf59e0b;

    // Wheeled base platform
    const base = box(2.2, 0.22, 3.2, darkWood);
    base.position.set(0, 0.26, 0);
    root.add(base);

    const wheels = [];
    [[-1.15, 0.25, -1.1], [1.15, 0.25, -1.1], [-1.15, 0.25, 1.1], [1.15, 0.25, 1.1]].forEach(([wx, wy, wz]) => {
      const w = box(0.24, 0.5, 0.5, 0x3b2313);
      w.position.set(wx, wy, wz);
      root.add(w);
      wheels.push(w);
    });

    // Legs
    [[-0.55, 0.85, -0.85], [0.55, 0.85, -0.85], [-0.55, 0.85, 0.85], [0.55, 0.85, 0.85]].forEach(([lx, ly, lz]) => {
      const leg = box(0.36, 1.1, 0.36, wood);
      leg.position.set(lx, ly, lz);
      root.add(leg);
    });

    // Hollow wooden body
    const body = box(1.5, 1.15, 2.35, wood);
    body.position.set(0, 1.75, 0);
    root.add(body);

    // Side hatch door (pivots open when activated!)
    const hatchPivot = new THREE.Group();
    hatchPivot.position.set(0.76, 1.45, 0);
    const hatch = box(0.12, 0.72, 1.0, darkWood);
    hatch.position.set(0, 0.36, 0);
    hatchPivot.add(hatch);
    root.add(hatchPivot);

    // Golden saddle trim
    const saddle = box(1.56, 0.18, 0.7, gold, 0x332000);
    saddle.position.set(0, 2.34, 0);
    root.add(saddle);

    // Neck + Head group (nods!)
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 2.15, -0.95);
    const neck = box(0.75, 1.05, 0.72, wood);
    neck.position.set(0, 0.5, -0.2);
    neck.rotation.x = 0.28;
    headPivot.add(neck);

    const mane = box(0.22, 0.95, 0.25, gold);
    mane.position.set(0, 0.65, 0.12);
    mane.rotation.x = 0.28;
    headPivot.add(mane);

    const head = box(0.72, 0.62, 1.15, wood);
    head.position.set(0, 1.05, -0.62);
    head.rotation.x = 0.22;
    headPivot.add(head);

    const earL = box(0.16, 0.28, 0.16, darkWood);
    earL.position.set(-0.24, 1.42, -0.25);
    const earR = earL.clone();
    earR.position.x = 0.24;
    headPivot.add(earL, earR);
    root.add(headPivot);

    // Tail
    const tail = box(0.24, 0.95, 0.24, darkWood);
    tail.position.set(0, 1.6, 1.28);
    tail.rotation.x = 0.3;
    root.add(tail);

    tagItem(root, 'trojan_horse');
    return {
      id: 'trojan_horse',
      level: 1,
      name: 'Trojan Horse (Troy)',
      actionLabel: 'Roll & Open Secret Hatch',
      group: root,
      homePos: new THREE.Vector3(15.5, 2, 20.5),
      radius: 1.8,
      activeTimer: 0,
      phase: 0,
      trigger(fx) {
        this.activeTimer = 3.2;
        fx.playTone(196, 0.18, 0.08, 'triangle');
        setTimeout(() => fx.playTone(293.66, 0.22, 0.08, 'triangle'), 120);
        return '🐴 The Wooden Trojan Horse rolls forward and opens its secret hatch!';
      },
      update(dt) {
        if (this.activeTimer > 0) {
          this.activeTimer -= dt;
          this.phase += dt * 4.5;
          const roll = Math.sin(this.phase) * 1.4;
          root.position.z = this.homePos.z + roll;
          headPivot.rotation.x = Math.sin(this.phase * 2) * 0.25;
          hatchPivot.rotation.z = -0.85;
          wheels.forEach((w) => { w.rotation.x = roll * 2.2; });
        } else {
          root.position.z += (this.homePos.z - root.position.z) * Math.min(1, dt * 4);
          headPivot.rotation.x *= 0.9;
          hatchPivot.rotation.z *= 0.9;
        }
      },
    };
  }

  // Floor 2: HD Kickable Sports Ball ("Ball that can kick")
  function createSportsBall() {
    const root = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    for (let y = 0; y <= 256; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
    ctx.fillStyle = '#0f172a';
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        if ((row + col) % 2 === 0) {
          ctx.beginPath();
          ctx.arc(col * 64 + 32, row * 64 + 32, 18, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    const ballTex = new THREE.CanvasTexture(c);
    ballTex.anisotropy = 8;

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 32, 24),
      new THREE.MeshLambertMaterial({ map: ballTex })
    );
    sphere.castShadow = true;
    root.add(sphere);

    tagItem(root, 'soccer_ball');
    return {
      id: 'soccer_ball',
      level: 2,
      name: 'Sports Soccer Ball',
      actionLabel: 'Kick Ball',
      group: root,
      homePos: new THREE.Vector3(52.5, 8.46, 20.5),
      vel: new THREE.Vector3(0, 0, 0),
      radius: 0.75,
      kickCooldown: 0,
      trigger(fx, playerPos) {
        const dx = root.position.x - playerPos.x;
        const dz = root.position.z - playerPos.z;
        const len = Math.hypot(dx, dz) || 1;
        this.vel.set((dx / len) * 11.5, 4.8, (dz / len) * 11.5);
        this.kickCooldown = 0.35;
        fx.playTone(135, 0.11, 0.12, 'sine');
        return '⚽ Goal-bound kick! The Sports Ball rockets across the turf pitch!';
      },
      update(dt, playerPos, fx, onMsg) {
        if (this.kickCooldown > 0) this.kickCooldown -= dt;

        // Auto-kick when player walks right into the ball!
        if (playerPos && Math.abs(playerPos.y - 8) < 1.2 && this.kickCooldown <= 0) {
          const dist = Math.hypot(playerPos.x - root.position.x, playerPos.z - root.position.z);
          if (dist < 0.95) {
            const msg = this.trigger(fx, playerPos);
            if (onMsg) onMsg(msg);
          }
        }

        // Physics inside L2 East Sports Turf room (x: 42.6..61.8, z: 8.6..32.8)
        this.vel.y -= 16 * dt;
        root.position.addScaledVector(this.vel, dt);

        const floorY = 8.46;
        if (root.position.y <= floorY) {
          root.position.y = floorY;
          if (Math.abs(this.vel.y) > 1.0) {
            this.vel.y = -this.vel.y * 0.58;
            fx.playTone(110, 0.06, 0.04, 'sine');
          } else {
            this.vel.y = 0;
          }
          this.vel.x *= Math.pow(0.25, dt);
          this.vel.z *= Math.pow(0.25, dt);
        }

        if (root.position.x < 42.8) { root.position.x = 42.8; this.vel.x = Math.abs(this.vel.x) * 0.8; }
        if (root.position.x > 61.6) { root.position.x = 61.6; this.vel.x = -Math.abs(this.vel.x) * 0.8; }
        if (root.position.z < 8.8)  { root.position.z = 8.8;  this.vel.z = Math.abs(this.vel.z) * 0.8; }
        if (root.position.z > 32.6) { root.position.z = 32.6; this.vel.z = -Math.abs(this.vel.z) * 0.8; }

        sphere.rotation.x += this.vel.z * dt * 1.4;
        sphere.rotation.z -= this.vel.x * dt * 1.4;
      },
    };
  }

  // Floor 3: Walking Teddy Bear ("Bear Bear that can move")
  function createTeddyBear() {
    const root = new THREE.Group();
    const fur = 0x8d5524;
    const bellyColor = 0xe6b88a;

    const torso = box(0.9, 0.95, 0.68, fur);
    torso.position.set(0, 1.05, 0);
    root.add(torso);

    const belly = box(0.58, 0.62, 0.12, bellyColor);
    belly.position.set(0, 1.02, 0.32);
    root.add(belly);

    const head = box(0.86, 0.78, 0.76, fur);
    head.position.set(0, 1.92, 0);
    root.add(head);

    const snout = box(0.4, 0.28, 0.22, bellyColor);
    snout.position.set(0, 1.82, 0.42);
    const nose = box(0.16, 0.12, 0.08, 0x1e293b);
    nose.position.set(0, 1.9, 0.54);
    const eyeL = box(0.11, 0.11, 0.08, 0x0f172a);
    eyeL.position.set(-0.2, 2.02, 0.39);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.2;
    const earL = box(0.28, 0.28, 0.16, fur);
    earL.position.set(-0.36, 2.34, 0);
    const earR = earL.clone();
    earR.position.x = 0.36;
    root.add(snout, nose, eyeL, eyeR, earL, earR);

    const armGeo = new THREE.BoxGeometry(0.3, 0.7, 0.3);
    armGeo.translate(0, -0.3, 0);
    const armMat = new THREE.MeshLambertMaterial({ color: fur });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.6, 1.42, 0);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.6, 1.42, 0);

    const legGeo = new THREE.BoxGeometry(0.34, 0.58, 0.38);
    legGeo.translate(0, -0.29, 0);
    const leftLeg = new THREE.Mesh(legGeo, armMat);
    leftLeg.position.set(-0.24, 0.58, 0);
    const rightLeg = new THREE.Mesh(legGeo, armMat);
    rightLeg.position.set(0.24, 0.58, 0);
    root.add(leftArm, rightArm, leftLeg, rightLeg);

    tagItem(root, 'bear_bear');
    return {
      id: 'bear_bear',
      level: 3,
      name: 'Forest Bear Bear',
      actionLabel: 'Dance & Follow',
      group: root,
      homePos: new THREE.Vector3(15.5, 14, 20.5),
      radius: 1.2,
      excitedTimer: 0,
      walkPhase: 0,
      waypoint: new THREE.Vector3(15.5, 14, 20.5),
      waitTimer: 0.5,
      trigger(fx) {
        this.excitedTimer = 5.0;
        fx.playTone(523.25, 0.12, 0.09, 'sine');
        setTimeout(() => fx.playTone(659.25, 0.16, 0.09, 'sine'), 100);
        return '🧸 Bear Bear waves happily and waddles around the Forest Lounge!';
      },
      update(dt, playerPos) {
        if (this.excitedTimer > 0) this.excitedTimer -= dt;

        // Pick gentle patrol points inside Forest Lounge (x: 8..23, z: 10..30)
        if (this.excitedTimer > 0 && playerPos && Math.abs(playerPos.y - 14) < 1.5 && playerPos.x <= 25) {
          this.waypoint.set(
            Math.max(8, Math.min(23, playerPos.x)),
            14,
            Math.max(10, Math.min(30, playerPos.z))
          );
        } else {
          this.waitTimer -= dt;
          if (this.waitTimer <= 0) {
            this.waitTimer = 2.5 + Math.random() * 2.5;
            this.waypoint.set(9 + Math.random() * 13, 14, 10 + Math.random() * 19);
          }
        }

        const dx = this.waypoint.x - root.position.x;
        const dz = this.waypoint.z - root.position.z;
        const dist = Math.hypot(dx, dz);
        const speed = this.excitedTimer > 0 ? 3.2 : 1.5;

        if (dist > 1.2) {
          const nx = dx / dist;
          const nz = dz / dist;
          root.position.x += nx * speed * dt;
          root.position.z += nz * speed * dt;
          root.rotation.y = Math.atan2(nx, nz);
          this.walkPhase += dt * speed * 3.0;
          const swing = Math.sin(this.walkPhase) * 0.65;
          leftLeg.rotation.x = swing;
          rightLeg.rotation.x = -swing;
          leftArm.rotation.x = this.excitedTimer > 0 ? -2.2 + Math.sin(this.walkPhase * 2) * 0.4 : -swing * 0.7;
          rightArm.rotation.x = this.excitedTimer > 0 ? -2.2 - Math.sin(this.walkPhase * 2) * 0.4 : swing * 0.7;
          root.position.y = 14 + (this.excitedTimer > 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.28 : 0);
        } else {
          leftLeg.rotation.x *= 0.85;
          rightLeg.rotation.x *= 0.85;
          if (this.excitedTimer > 0) {
            this.walkPhase += dt * 7;
            leftArm.rotation.x = -2.3 + Math.sin(this.walkPhase) * 0.5;
            rightArm.rotation.x = -2.3 - Math.sin(this.walkPhase) * 0.5;
            root.position.y = 14 + Math.abs(Math.sin(this.walkPhase)) * 0.25;
          } else {
            leftArm.rotation.x *= 0.85;
            rightArm.rotation.x *= 0.85;
            root.position.y = 14;
          }
        }
      },
    };
  }

  // Floor 4: Ocean Jumping Dolphin Fountain
  function createOceanDolphin() {
    const root = new THREE.Group();
    const pool = box(2.8, 0.35, 2.8, 0x0284c7);
    pool.position.set(0, 0.18, 0);
    root.add(pool);

    const rim = box(3.1, 0.25, 3.1, 0xe0f2fe);
    rim.position.set(0, 0.12, 0);
    root.add(rim);

    const dolphinPivot = new THREE.Group();
    dolphinPivot.position.set(0, 1.35, 0);

    const body = box(0.6, 0.55, 1.75, 0x38bdf8);
    const belly = box(0.45, 0.16, 1.4, 0xf0f9ff);
    belly.position.set(0, -0.22, 0);
    const snout = box(0.28, 0.22, 0.5, 0x38bdf8);
    snout.position.set(0, -0.05, -1.05);
    const fin = box(0.14, 0.45, 0.38, 0x0369a1);
    fin.position.set(0, 0.42, 0.1);
    fin.rotation.x = 0.35;
    const tail = box(0.78, 0.14, 0.42, 0x0369a1);
    tail.position.set(0, 0.06, 0.98);
    dolphinPivot.add(body, belly, snout, fin, tail);
    root.add(dolphinPivot);

    tagItem(root, 'ocean_dolphin');
    return {
      id: 'ocean_dolphin',
      level: 4,
      name: 'Ocean Sky Dolphin',
      actionLabel: 'Leap & Splash',
      group: root,
      homePos: new THREE.Vector3(15.5, 20, 14.5),
      radius: 1.8,
      leapTimer: 0,
      phase: 0,
      trigger(fx) {
        this.leapTimer = 3.0;
        fx.playTone(620, 0.15, 0.08, 'sine');
        setTimeout(() => fx.playTone(880, 0.22, 0.08, 'sine'), 110);
        return '🐬 The Ocean Dolphin leaps and splashes across the Coastal Lounge!';
      },
      update(dt) {
        this.phase += dt * (this.leapTimer > 0 ? 5.5 : 1.6);
        if (this.leapTimer > 0) this.leapTimer -= dt;
        const amp = this.leapTimer > 0 ? 0.95 : 0.2;
        dolphinPivot.position.y = 1.45 + Math.sin(this.phase) * amp;
        dolphinPivot.rotation.y = -this.phase * 0.5;
        dolphinPivot.rotation.x = Math.cos(this.phase) * (this.leapTimer > 0 ? 0.45 : 0.12);
      },
    };
  }

  // Floor 5: Statue of Michelangelo (Marble Sculpture on Rotating Pedestal)
  function createMichelangeloStatue() {
    const root = new THREE.Group();
    const marble = 0xf8fafc;
    const shadeMarble = 0xe2e8f0;

    // Museum pedestal
    const plinth = box(1.9, 0.85, 1.9, 0x334155);
    plinth.position.set(0, 0.42, 0);
    const goldRing = box(1.96, 0.12, 1.96, 0xf59e0b, 0x3b2600);
    goldRing.position.set(0, 0.88, 0);
    root.add(plinth, goldRing);

    // Rotating sculpture turntable
    const figure = new THREE.Group();
    figure.position.set(0, 0.96, 0);

    const legL = box(0.28, 1.05, 0.3, marble);
    legL.position.set(-0.18, 0.52, 0.04);
    const legR = box(0.28, 1.05, 0.3, shadeMarble);
    legR.position.set(0.2, 0.52, -0.06);
    const torso = box(0.68, 0.95, 0.38, marble);
    torso.position.set(0, 1.48, 0);
    const drape = box(0.32, 1.15, 0.42, shadeMarble);
    drape.position.set(-0.24, 1.45, 0.04);
    drape.rotation.z = 0.12;

    // Classic contrapposto arms (one raised to shoulder, one relaxed)
    const armL = box(0.24, 0.78, 0.24, marble);
    armL.position.set(-0.46, 1.75, 0.12);
    armL.rotation.x = -0.8;
    const armR = box(0.24, 0.85, 0.24, marble);
    armR.position.set(0.46, 1.48, 0);

    const head = box(0.46, 0.52, 0.46, marble);
    head.position.set(0, 2.24, 0);
    const curls = box(0.54, 0.24, 0.52, shadeMarble);
    curls.position.set(0, 2.48, -0.02);

    figure.add(legL, legR, torso, drape, armL, armR, head, curls);
    root.add(figure);

    tagItem(root, 'michelangelo_statue');
    return {
      id: 'michelangelo_statue',
      level: 5,
      name: 'Statue of Michelangelo',
      actionLabel: 'Rotate Pedestal & Spotlight',
      group: root,
      homePos: new THREE.Vector3(16.5, 26, 17.5),
      radius: 1.6,
      spinTimer: 0,
      trigger(fx) {
        this.spinTimer = 4.0;
        fx.playTone(392, 0.22, 0.08, 'triangle');
        setTimeout(() => fx.playTone(493.88, 0.25, 0.08, 'triangle'), 140);
        setTimeout(() => fx.playTone(587.33, 0.3, 0.08, 'triangle'), 280);
        return '🗿 The Statue of Michelangelo rotates on its illuminated gallery turntable!';
      },
      update(dt) {
        if (this.spinTimer > 0) {
          this.spinTimer -= dt;
          figure.rotation.y += dt * 2.8;
          goldRing.material.emissive.setHex(0x78350f);
        } else {
          figure.rotation.y += dt * 0.25;
          goldRing.material.emissive.setHex(0x3b2600);
        }
      },
    };
  }

  // Floor 6: HD Spinning Holographic World Globe (Map Theme Sky Atrium)
  function createWorldGlobe() {
    const root = new THREE.Group();
    const ped = box(1.6, 0.65, 1.6, 0x1e293b);
    ped.position.set(0, 0.32, 0);
    const goldRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.06, 0.07, 16, 48),
      new THREE.MeshLambertMaterial({ color: 0xf59e0b, emissive: 0x451a03 })
    );
    goldRing.position.set(0, 1.7, 0);
    root.add(ped, goldRing);

    const gc = document.createElement('canvas');
    gc.width = 1024;
    gc.height = 512;
    const gctx = gc.getContext('2d');
    gctx.fillStyle = '#0284c7';
    gctx.fillRect(0, 0, 1024, 512);
    // Latitude / Longitude holographic grid
    gctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
    gctx.lineWidth = 2;
    for (let x = 0; x <= 1024; x += 64) { gctx.beginPath(); gctx.moveTo(x, 0); gctx.lineTo(x, 512); gctx.stroke(); }
    for (let y = 0; y <= 512; y += 64) { gctx.beginPath(); gctx.moveTo(0, y); gctx.lineTo(1024, y); gctx.stroke(); }
    // Stylized HD continents (Americas, Eurasia/Africa, SE Asia/Penang, Australia)
    gctx.fillStyle = '#4ade80';
    [
      [210, 150, 95, 70], [260, 290, 55, 95],
      [540, 145, 160, 75], [530, 275, 70, 95],
      [740, 175, 130, 80], [770, 275, 38, 36], [835, 355, 75, 50],
    ].forEach(([cx, cy, rx, ry]) => {
      gctx.beginPath(); gctx.ellipse(cx, cy, rx, ry, 0.2, 0, Math.PI * 2); gctx.fill();
    });
    // Glowing Malaysia / PG17 marker
    gctx.fillStyle = '#fde047';
    gctx.beginPath(); gctx.arc(765, 265, 10, 0, Math.PI * 2); gctx.fill();

    const globeTex = new THREE.CanvasTexture(gc);
    globeTex.anisotropy = 8;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(0.84, 32, 24),
      new THREE.MeshLambertMaterial({ map: globeTex, emissive: 0x082f49 })
    );
    globe.position.set(0, 1.7, 0);
    globe.castShadow = true;
    root.add(globe);

    tagItem(root, 'world_globe');
    return {
      id: 'world_globe',
      level: 6,
      name: 'Virtual Intel Campus World Globe',
      actionLabel: 'Turbo-Spin Map Globe',
      group: root,
      homePos: new THREE.Vector3(34.0, 32, 27.0),
      radius: 1.7,
      turboTimer: 0,
      trigger(fx) {
        this.turboTimer = 4.0;
        fx.playTone(587.33, 0.15, 0.09, 'triangle');
        setTimeout(() => fx.playTone(783.99, 0.2, 0.09, 'triangle'), 100);
        setTimeout(() => fx.playTone(1046.5, 0.3, 0.09, 'triangle'), 200);
        return '🌍 The Executive World Globe spins at warp speed under the VIP Skylight!';
      },
      update(dt) {
        if (this.turboTimer > 0) {
          this.turboTimer -= dt;
          globe.rotation.y += dt * 7.5;
          globe.position.y = 1.85 + Math.sin(this.turboTimer * 8) * 0.18;
          goldRing.rotation.y -= dt * 3.2;
        } else {
          globe.rotation.y += dt * 0.65;
          globe.position.y = 1.65;
          goldRing.rotation.y += dt * 0.2;
        }
      },
    };
  }

  // =========================================================================
  // 12 Additional Theme-Matched Interactive Items (2 New Per Floor = 3/Floor)
  // =========================================================================

  // Floor 1 Item 2: VIP Visitor Check-In Kiosk (Main Reception L2)
  function createCheckinKiosk() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.05, 0x00c7fd);
    const base = box(1.15, 0.22, 0.9, 0x1e293b);
    base.position.set(0, 0.11, 0);
    const pillar = box(0.42, 1.35, 0.36, 0x334155);
    pillar.position.set(0, 0.85, 0);
    const screenFrame = box(1.05, 0.78, 0.16, 0x0f172a);
    screenFrame.position.set(0, 1.65, 0.08);
    screenFrame.rotation.x = -0.25;
    const screen = box(0.9, 0.62, 0.05, 0x00c7fd, 0x0369a1);
    screen.position.set(0, 1.65, 0.15);
    screen.rotation.x = -0.25;

    const badge = box(0.45, 0.58, 0.06, 0xfde047, 0x78350f);
    badge.position.set(0, 2.25, 0.12);
    badge.visible = false;
    root.add(base, pillar, screenFrame, screen, badge);

    tagItem(root, 'checkin_kiosk');
    return {
      id: 'checkin_kiosk',
      level: 1,
      name: 'VIP Check-In Kiosk',
      actionLabel: 'Print Visitor Pass',
      group: root,
      homePos: new THREE.Vector3(49.0, 2, 26.5),
      radius: 1.2,
      activeTimer: 0,
      trigger(fx) {
        this.activeTimer = 3.2;
        badge.visible = true;
        fx.playTone(587.33, 0.1, 0.09, 'sine');
        setTimeout(() => fx.playTone(880, 0.16, 0.09, 'sine'), 110);
        return '🪪 Printed a glowing Virtual Intel Campus Visitor Badge at Reception!';
      },
      update(dt) {
        ring.material.opacity = 0.4 + Math.sin(performance.now() * 0.004) * 0.18;
        if (this.activeTimer > 0) {
          this.activeTimer -= dt;
          badge.visible = true;
          badge.position.y = 2.25 + Math.sin(this.activeTimer * 5) * 0.12;
          badge.rotation.y += dt * 4.5;
          screen.material.emissive.setHex(0x0284c7);
        } else {
          badge.visible = false;
          screen.material.emissive.setHex(0x0369a1);
        }
      },
    };
  }

  // Floor 1 Item 3: Intel Innovation Drone Pad (Lift Lobby LL)
  function createDronePad() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.15, 0x38bdf8);
    const pad = box(1.4, 0.14, 1.4, 0x1e293b);
    pad.position.set(0, 0.07, 0);
    const beacon = box(0.95, 0.06, 0.95, 0x0068b5, 0x003a70);
    beacon.position.set(0, 0.16, 0);
    root.add(pad, beacon);

    const drone = new THREE.Group();
    drone.position.set(0, 1.15, 0);
    const core = box(0.52, 0.2, 0.52, 0xf8fafc, 0x0284c7);
    const cam = box(0.2, 0.14, 0.16, 0x00c7fd, 0x0077b6);
    cam.position.set(0, -0.05, 0.28);
    drone.add(core, cam);

    const rotors = [];
    [[-0.36, 0.12, -0.36], [0.36, 0.12, -0.36], [-0.36, 0.12, 0.36], [0.36, 0.12, 0.36]].forEach(([rx, ry, rz]) => {
      const arm = box(0.28, 0.06, 0.08, 0x334155);
      arm.position.set(rx * 0.65, 0.04, rz * 0.65);
      const blade = box(0.38, 0.03, 0.07, 0x38bdf8, 0x0284c7);
      blade.position.set(rx, ry, rz);
      drone.add(arm, blade);
      rotors.push(blade);
    });
    root.add(drone);

    tagItem(root, 'intel_drone_pad');
    return {
      id: 'intel_drone_pad',
      level: 1,
      name: 'Intel Innovation Drone Pad',
      actionLabel: 'Launch Patrol Drone',
      group: root,
      homePos: new THREE.Vector3(34.0, 2, 15.5),
      radius: 1.25,
      flightTimer: 0,
      phase: 0,
      trigger(fx) {
        this.flightTimer = 4.0;
        fx.playTone(440, 0.12, 0.07, 'sawtooth');
        setTimeout(() => fx.playTone(659.25, 0.18, 0.08, 'triangle'), 120);
        return '🛸 Intel Innovation Drone lifts off for a Lobby figure-8 aerial scan!';
      },
      update(dt) {
        this.phase += dt * (this.flightTimer > 0 ? 5.0 : 2.2);
        rotors.forEach((b) => { b.rotation.y += dt * (this.flightTimer > 0 ? 28 : 10); });
        ring.material.opacity = 0.45 + Math.sin(this.phase) * 0.2;
        if (this.flightTimer > 0) {
          this.flightTimer -= dt;
          drone.position.x = Math.sin(this.phase * 0.7) * 1.15;
          drone.position.z = Math.sin(this.phase * 1.4) * 0.75;
          drone.position.y = 2.0 + Math.sin(this.phase * 1.8) * 0.28;
          drone.rotation.y = this.phase * 0.8;
        } else {
          drone.position.x += (0 - drone.position.x) * Math.min(1, dt * 5);
          drone.position.z += (0 - drone.position.z) * Math.min(1, dt * 5);
          drone.position.y = 1.15 + Math.sin(this.phase) * 0.12;
          drone.rotation.y += dt * 0.6;
        }
      },
    };
  }

  // Floor 2 Item 2: Electronic Track Sprint Timer (Running Track L1)
  function createSprintTimer() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.15, 0xeab308);
    const postL = box(0.22, 2.2, 0.22, 0x334155);
    postL.position.set(-0.95, 1.1, 0);
    const postR = box(0.22, 2.2, 0.22, 0x334155);
    postR.position.set(0.95, 1.1, 0);
    const beam = box(2.2, 0.52, 0.34, 0x0f172a);
    beam.position.set(0, 2.25, 0);
    const ledL = box(0.32, 0.28, 0.38, 0xef4444, 0x7f1d1d);
    ledL.position.set(-0.55, 2.25, 0);
    const ledM = box(0.32, 0.28, 0.38, 0xfacc15, 0x713f12);
    ledM.position.set(0, 2.25, 0);
    const ledR = box(0.32, 0.28, 0.38, 0x22c55e, 0x14532d);
    ledR.position.set(0.55, 2.25, 0);
    root.add(postL, postR, beam, ledL, ledM, ledR);

    tagItem(root, 'sprint_timer');
    return {
      id: 'sprint_timer',
      level: 2,
      name: 'Track Sprint Timer Gate',
      actionLabel: 'Start 3-2-1 Sprint Countdown',
      group: root,
      homePos: new THREE.Vector3(21.5, 8, 16.5),
      radius: 1.35,
      raceTimer: 0,
      trigger(fx) {
        this.raceTimer = 3.5;
        fx.playTone(440, 0.12, 0.08, 'square');
        setTimeout(() => fx.playTone(440, 0.12, 0.08, 'square'), 450);
        setTimeout(() => fx.playTone(880, 0.28, 0.1, 'square'), 900);
        return '⏱️ Track Sprint Countdown: READY... SET... GO! Sprint lap timer started!';
      },
      update(dt) {
        ring.material.opacity = 0.4 + Math.sin(performance.now() * 0.005) * 0.2;
        if (this.raceTimer > 0) {
          this.raceTimer -= dt;
          const elapsed = 3.5 - this.raceTimer;
          ledL.material.emissive.setHex(elapsed < 0.45 ? 0xdc2626 : 0x220000);
          ledM.material.emissive.setHex(elapsed >= 0.45 && elapsed < 0.9 ? 0xca8a04 : 0x221100);
          ledR.material.emissive.setHex(elapsed >= 0.9 ? 0x22c55e : 0x052e16);
        } else {
          ledL.material.emissive.setHex(0x450a0a);
          ledM.material.emissive.setHex(0x422006);
          ledR.material.emissive.setHex(0x14532d);
        }
      },
    };
  }

  // Floor 2 Item 3: Basketball Arcade Hoop (Sports L2 Corner)
  function createArcadeHoop() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.15, 0xf97316);
    const stand = box(0.28, 2.35, 0.28, 0x1e293b);
    stand.position.set(0, 1.18, -0.55);
    const board = box(1.45, 0.95, 0.14, 0xf8fafc);
    board.position.set(0, 2.45, -0.4);
    const square = box(0.55, 0.42, 0.16, 0xef4444, 0x7f1d1d);
    square.position.set(0, 2.35, -0.39);
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.05, 10, 24),
      new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x7c2d12 })
    );
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(0, 2.1, -0.02);
    const bball = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 14),
      new THREE.MeshLambertMaterial({ color: 0xea580c })
    );
    bball.position.set(0, 0.3, 0.55);
    bball.castShadow = true;
    root.add(stand, board, square, hoop, bball);

    tagItem(root, 'arcade_hoop');
    return {
      id: 'arcade_hoop',
      level: 2,
      name: 'Basketball Arcade Hoop',
      actionLabel: 'Shoot 3-Pointer',
      group: root,
      homePos: new THREE.Vector3(45.0, 8, 28.5),
      radius: 1.3,
      shotTimer: 0,
      trigger(fx) {
        this.shotTimer = 1.6;
        fx.playTone(329.63, 0.1, 0.08, 'triangle');
        setTimeout(() => fx.playTone(523.25, 0.16, 0.1, 'triangle'), 450);
        setTimeout(() => fx.playTone(783.99, 0.24, 0.1, 'sine'), 650);
        return '🏀 SWISH! Nothing but net on the Floor 2 Basketball Arcade Hoop (+3 pts)!';
      },
      update(dt) {
        ring.material.opacity = 0.4 + Math.sin(performance.now() * 0.004) * 0.18;
        if (this.shotTimer > 0) {
          this.shotTimer -= dt;
          const t = 1 - this.shotTimer / 1.6; // 0..1
          bball.rotation.x -= dt * 10;
          if (t < 0.55) {
            const p = t / 0.55;
            bball.position.z = 0.55 * (1 - p) - 0.02 * p;
            bball.position.y = 0.3 + Math.sin(p * Math.PI * 0.72) * 2.55;
          } else {
            const p = (t - 0.55) / 0.45;
            bball.position.z = -0.02 + p * 0.57;
            bball.position.y = Math.max(0.3, 2.25 * (1 - p) + 0.3 * p);
          }
        } else {
          bball.position.set(0, 0.3 + Math.abs(Math.sin(performance.now() * 0.003)) * 0.12, 0.55);
        }
      },
    };
  }

  // Floor 3 Item 2: Zen Singing Bowl & Bonsai Altar (Yoga Studio L2)
  function createZenSingingBowl() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 0.95, 0x4ade80);
    const stand = box(0.95, 0.58, 0.95, 0x78350f);
    stand.position.set(0, 0.29, 0);
    const bowl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.18, 0.24, 18),
      new THREE.MeshLambertMaterial({ color: 0xfbbf24, emissive: 0x451a03 })
    );
    bowl.position.set(-0.18, 0.7, 0.12);
    const trunk = box(0.14, 0.52, 0.14, 0x5c3618);
    trunk.position.set(0.22, 0.84, -0.14);
    const leaf1 = box(0.55, 0.28, 0.55, 0x22c55e, 0x052e16);
    leaf1.position.set(0.22, 1.15, -0.14);
    const leaf2 = box(0.38, 0.22, 0.38, 0x4ade80, 0x064e3b);
    leaf2.position.set(0.26, 1.36, -0.14);
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.04, 8, 28),
      new THREE.MeshBasicMaterial({ color: 0x86efac, transparent: true, opacity: 0.65 })
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.set(0, 0.9, 0);
    root.add(stand, bowl, trunk, leaf1, leaf2, aura);

    tagItem(root, 'zen_singing_bowl');
    return {
      id: 'zen_singing_bowl',
      level: 3,
      name: 'Zen Singing Bowl & Bonsai',
      actionLabel: 'Strike Singing Bowl',
      group: root,
      homePos: new THREE.Vector3(52.0, 14, 13.8),
      radius: 1.15,
      chimeTimer: 0,
      trigger(fx) {
        this.chimeTimer = 3.8;
        fx.playTone(432, 0.8, 0.09, 'sine');
        setTimeout(() => fx.playTone(648, 0.7, 0.06, 'sine'), 180);
        return '🪷 Resonant 432Hz Zen chime echoes peacefully across the Forest Yoga Studio!';
      },
      update(dt) {
        if (this.chimeTimer > 0) {
          this.chimeTimer -= dt;
          const s = 1 + Math.sin(this.chimeTimer * 8) * 0.35;
          aura.scale.set(s, s, 1);
          aura.position.y = 0.85 + (3.8 - this.chimeTimer) * 0.22;
          aura.material.opacity = Math.max(0.15, this.chimeTimer / 3.8);
          bowl.material.emissive.setHex(0xb45309);
        } else {
          aura.scale.set(1, 1, 1);
          aura.position.y = 0.78 + Math.sin(performance.now() * 0.002) * 0.06;
          aura.material.opacity = 0.35;
          bowl.material.emissive.setHex(0x451a03);
        }
        ring.material.opacity = 0.4 + Math.sin(performance.now() * 0.003) * 0.16;
      },
    };
  }

  // Floor 3 Item 3: Turbo Spin Bike Challenge (Spin & Turf Studio L2)
  function createSpinBike() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.05, 0x22d3ee);
    const base = box(0.62, 0.12, 1.35, 0x1e293b);
    base.position.set(0, 0.06, 0);
    const seatPost = box(0.12, 0.75, 0.12, 0x475569);
    seatPost.position.set(0, 0.46, -0.42);
    const seat = box(0.32, 0.12, 0.38, 0x0f172a);
    seat.position.set(0, 0.88, -0.44);
    const barPost = box(0.12, 0.9, 0.12, 0x475569);
    barPost.position.set(0, 0.55, 0.38);
    const handle = box(0.68, 0.1, 0.14, 0x22c55e, 0x052e16);
    handle.position.set(0, 1.02, 0.38);
    const flywheel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.12, 20),
      new THREE.MeshLambertMaterial({ color: 0x38bdf8, emissive: 0x0369a1 })
    );
    flywheel.rotation.z = Math.PI / 2;
    flywheel.position.set(0, 0.45, 0.42);
    const spoke = box(0.16, 0.62, 0.08, 0xfde047);
    flywheel.add(spoke);
    root.add(base, seatPost, seat, barPost, handle, flywheel);

    tagItem(root, 'spin_bike');
    return {
      id: 'spin_bike',
      level: 3,
      name: 'Turbo Spin Bike',
      actionLabel: 'Pedal Sprint Interval',
      group: root,
      homePos: new THREE.Vector3(52.0, 14, 29.5),
      radius: 1.2,
      turboTimer: 0,
      trigger(fx) {
        this.turboTimer = 3.5;
        fx.playTone(330, 0.1, 0.08, 'sawtooth');
        setTimeout(() => fx.playTone(440, 0.12, 0.08, 'sawtooth'), 100);
        setTimeout(() => fx.playTone(554.37, 0.18, 0.08, 'sawtooth'), 200);
        return '🚴 Sprint Interval activated! Hit 120 RPM on the Forest Spin Bike!';
      },
      update(dt) {
        const rpm = this.turboTimer > 0 ? 18.0 : 1.5;
        if (this.turboTimer > 0) {
          this.turboTimer -= dt;
          flywheel.material.emissive.setHex(0x0284c7);
        } else {
          flywheel.material.emissive.setHex(0x0c4a6e);
        }
        flywheel.rotation.x += dt * rpm;
        ring.material.opacity = 0.4 + Math.sin(performance.now() * 0.005) * 0.2;
      },
    };
  }

  // Floor 4 Item 2: Glowing Coral Reef Aquarium (Kelp Lounge L1)
  function createCoralAquarium() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.2, 0x38bdf8);
    const stand = box(1.85, 0.65, 1.05, 0x0f172a);
    stand.position.set(0, 0.32, 0);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 1.15, 0.95),
      new THREE.MeshLambertMaterial({ color: 0x0ea5e9, emissive: 0x082f49, transparent: true, opacity: 0.42 })
    );
    glass.position.set(0, 1.24, 0);
    const cap = box(1.85, 0.14, 1.05, 0x1e293b);
    cap.position.set(0, 1.88, 0);
    const coral1 = box(0.28, 0.45, 0.28, 0xf43f5e, 0x881337);
    coral1.position.set(-0.45, 0.88, 0.1);
    const coral2 = box(0.24, 0.58, 0.24, 0xf97316, 0x7c2d12);
    coral2.position.set(0.45, 0.94, -0.1);
    const coral3 = box(0.32, 0.35, 0.25, 0xa855f7, 0x581c87);
    coral3.position.set(0, 0.84, 0.15);

    const fishes = [];
    [0xfacc15, 0xfb7185, 0x34d399].forEach((c, i) => {
      const f = box(0.26, 0.14, 0.12, c, c);
      f.position.set((i - 1) * 0.4, 1.25 + i * 0.14, 0);
      root.add(f);
      fishes.push({ mesh: f, offset: i * 2.1 });
    });
    root.add(stand, glass, cap, coral1, coral2, coral3);

    tagItem(root, 'coral_aquarium');
    return {
      id: 'coral_aquarium',
      level: 4,
      name: 'Coral Reef Aquarium',
      actionLabel: 'Feed Tropical Fish',
      group: root,
      homePos: new THREE.Vector3(20.5, 20, 29.5),
      radius: 1.35,
      feedTimer: 0,
      phase: 0,
      trigger(fx) {
        this.feedTimer = 4.0;
        fx.playTone(523.25, 0.1, 0.07, 'sine');
        setTimeout(() => fx.playTone(659.25, 0.12, 0.07, 'sine'), 90);
        setTimeout(() => fx.playTone(783.99, 0.18, 0.07, 'sine'), 180);
        return '🐠 Fed the glowing Coral Reef Aquarium! The clownfish dart excitedly!';
      },
      update(dt) {
        this.phase += dt * (this.feedTimer > 0 ? 5.2 : 1.5);
        if (this.feedTimer > 0) this.feedTimer -= dt;
        fishes.forEach((f, idx) => {
          const a = this.phase + f.offset;
          f.mesh.position.x = Math.cos(a) * 0.56;
          f.mesh.position.z = Math.sin(a) * 0.22;
          f.mesh.position.y = 1.25 + Math.sin(a * 2 + idx) * 0.18;
          f.mesh.rotation.y = -a + Math.PI / 2;
        });
        ring.material.opacity = 0.42 + Math.sin(this.phase) * 0.18;
      },
    };
  }

  // Floor 4 Item 3: Auto Ping-Pong Ball Cannon (Relax Corner L2)
  function createPingPongCannon() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.0, 0xfb923c);
    const tripod = box(0.75, 0.72, 0.75, 0x334155);
    tripod.position.set(0, 0.36, 0);
    const hopper = box(0.62, 0.52, 0.62, 0x0284c7);
    hopper.position.set(0, 0.98, 0);
    const barrel = box(0.24, 0.24, 0.78, 0x0f172a);
    barrel.position.set(0, 0.95, 0.45);
    barrel.rotation.x = -0.25;
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 14, 12),
      new THREE.MeshLambertMaterial({ color: 0xf97316, emissive: 0x9a3412 })
    );
    ball.position.set(0, 1.05, 0.82);
    root.add(tripod, hopper, barrel, ball);

    tagItem(root, 'pingpong_cannon');
    return {
      id: 'pingpong_cannon',
      level: 4,
      name: 'Ping-Pong Rally Cannon',
      actionLabel: 'Launch Practice Rally',
      group: root,
      homePos: new THREE.Vector3(50.0, 20, 23.5),
      radius: 1.2,
      fireTimer: 0,
      trigger(fx) {
        this.fireTimer = 2.6;
        fx.playTone(720, 0.08, 0.09, 'sine');
        setTimeout(() => fx.playTone(860, 0.08, 0.07, 'sine'), 240);
        setTimeout(() => fx.playTone(720, 0.08, 0.07, 'sine'), 480);
        return '🏓 Ping-Pong Cannon fires rapid practice topspin shots across the Relax Corner!';
      },
      update(dt) {
        if (this.fireTimer > 0) {
          this.fireTimer -= dt;
          const cyc = ((2.6 - this.fireTimer) * 2.2) % 1;
          ball.position.z = 0.7 + cyc * 2.4;
          ball.position.y = 0.4 + Math.abs(Math.sin(cyc * Math.PI * 2)) * 0.95;
          root.rotation.y = Math.sin(this.fireTimer * 3) * 0.35;
        } else {
          ball.position.set(0, 1.05, 0.82);
          root.rotation.y += dt * 0.35;
        }
        ring.material.opacity = 0.4 + Math.sin(performance.now() * 0.004) * 0.18;
      },
    };
  }

  // Floor 5 Item 2: Heavy Punching Bag & Gym Bell (Main Gym Rig L2)
  function createPunchingBag() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.15, 0xef4444);
    const frame = box(0.24, 2.75, 0.24, 0x334155);
    frame.position.set(-0.85, 1.38, 0);
    const arm = box(1.15, 0.22, 0.24, 0x475569);
    arm.position.set(-0.35, 2.68, 0);
    const bell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 0.1, 18),
      new THREE.MeshLambertMaterial({ color: 0xfacc15, emissive: 0x713f12 })
    );
    bell.rotation.z = Math.PI / 2;
    bell.position.set(-0.7, 1.9, 0.16);

    const bagPivot = new THREE.Group();
    bagPivot.position.set(0.1, 2.58, 0);
    const chain = box(0.08, 0.5, 0.08, 0x94a3b8);
    chain.position.set(0, -0.25, 0);
    const bag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 1.35, 16),
      new THREE.MeshLambertMaterial({ color: 0xdc2626, emissive: 0x450a0a })
    );
    bag.position.set(0, -1.15, 0);
    bag.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.33, 0.33, 0.18, 16),
      new THREE.MeshLambertMaterial({ color: 0xf8fafc })
    );
    stripe.position.set(0, -0.85, 0);
    bagPivot.add(chain, bag, stripe);
    root.add(frame, arm, bell, bagPivot);

    tagItem(root, 'punching_bag');
    return {
      id: 'punching_bag',
      level: 5,
      name: 'Heavy Punching Bag & Bell',
      actionLabel: 'Throw Power Combo',
      group: root,
      homePos: new THREE.Vector3(47.0, 26, 20.0),
      radius: 1.35,
      swingAmp: 0,
      phase: 0,
      trigger(fx) {
        this.swingAmp = 0.72;
        this.phase = 0;
        fx.playTone(110, 0.12, 0.14, 'triangle');
        setTimeout(() => fx.playTone(987.77, 0.45, 0.08, 'sine'), 140);
        return '🥊 POW! DING-DING! You hammered the Heavy Bag and rang the Gym Round Bell!';
      },
      update(dt) {
        if (this.swingAmp > 0.02) {
          this.phase += dt * 7.5;
          this.swingAmp *= Math.pow(0.42, dt);
          bagPivot.rotation.z = Math.sin(this.phase) * this.swingAmp;
          bagPivot.rotation.x = Math.cos(this.phase * 0.7) * this.swingAmp * 0.4;
        } else {
          bagPivot.rotation.z = Math.sin(performance.now() * 0.0018) * 0.04;
          bagPivot.rotation.x = 0;
        }
        ring.material.opacity = 0.4 + Math.sin(performance.now() * 0.004) * 0.18;
      },
    };
  }

  // Floor 5 Item 3: Industrial Synth Jukebox (Loft Co-Work L1)
  function createEspressoJukebox() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.05, 0xf87171);
    const body = box(1.1, 1.65, 0.72, 0x1e293b);
    body.position.set(0, 0.82, 0);
    const trim = box(1.18, 0.18, 0.78, 0xf59e0b, 0x451a03);
    trim.position.set(0, 1.66, 0);
    const grille = box(0.84, 0.56, 0.08, 0x334155);
    grille.position.set(0, 0.45, 0.35);

    const bars = [];
    const barColors = [0xef4444, 0xf97316, 0xfacc15, 0x22c55e, 0x38bdf8];
    barColors.forEach((c, i) => {
      const b = box(0.12, 0.45, 0.08, c, c);
      b.position.set((i - 2) * 0.17, 1.22, 0.36);
      root.add(b);
      bars.push(b);
    });
    const vinyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20),
      new THREE.MeshLambertMaterial({ color: 0x0f172a })
    );
    vinyl.position.set(0, 1.78, 0);
    root.add(body, trim, grille, vinyl);

    tagItem(root, 'espresso_jukebox');
    return {
      id: 'espresso_jukebox',
      level: 5,
      name: 'Industrial Synth Jukebox',
      actionLabel: 'Drop Loft Beat',
      group: root,
      homePos: new THREE.Vector3(10.5, 26, 27.5),
      radius: 1.2,
      playTimer: 0,
      phase: 0,
      trigger(fx) {
        this.playTimer = 4.2;
        const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 659.25];
        notes.forEach((n, idx) => {
          setTimeout(() => fx.playTone(n, 0.14, 0.08, 'square'), idx * 120);
        });
        return '🎵 The Industrial Synth Jukebox drops an energetic Loft chill-wave beat!';
      },
      update(dt) {
        this.phase += dt * (this.playTimer > 0 ? 11.0 : 2.5);
        if (this.playTimer > 0) this.playTimer -= dt;
        vinyl.rotation.y += dt * (this.playTimer > 0 ? 6.5 : 0.8);
        bars.forEach((b, i) => {
          const amp = this.playTimer > 0 ? (0.45 + Math.abs(Math.sin(this.phase + i * 0.9)) * 1.15) : (0.35 + Math.abs(Math.sin(this.phase + i)) * 0.25);
          b.scale.y = amp;
        });
        ring.material.opacity = 0.4 + Math.sin(this.phase * 0.5) * 0.18;
      },
    };
  }

  // Floor 6 Item 2: Holographic City Flight Radar (City Map Sky Lounge L1)
  function createFlightRadar() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.15, 0xfb923c);
    const consoleBase = box(1.5, 0.78, 1.5, 0x1e293b);
    consoleBase.position.set(0, 0.39, 0);
    const mapPlate = box(1.32, 0.08, 1.32, 0x0c4a6e, 0x082f49);
    mapPlate.position.set(0, 0.82, 0);

    // Mini glowing skyline towers
    const b1 = box(0.18, 0.45, 0.18, 0xfb923c, 0x9a3412);
    b1.position.set(-0.32, 1.06, -0.2);
    const b2 = box(0.22, 0.65, 0.22, 0xfacc15, 0x854d0e);
    b2.position.set(0.25, 1.16, 0.18);
    const b3 = box(0.16, 0.36, 0.16, 0x38bdf8, 0x075985);
    b3.position.set(-0.18, 1.0, 0.35);

    const radarDish = box(1.18, 0.06, 0.08, 0x38bdf8, 0x0284c7);
    radarDish.position.set(0, 0.9, 0);
    root.add(consoleBase, mapPlate, b1, b2, b3, radarDish);

    tagItem(root, 'flight_radar');
    return {
      id: 'flight_radar',
      level: 6,
      name: 'City Flight Radar',
      actionLabel: 'Scan Campus Airspace',
      group: root,
      homePos: new THREE.Vector3(9.5, 32, 27.5),
      radius: 1.35,
      scanTimer: 0,
      trigger(fx) {
        this.scanTimer = 3.8;
        fx.playTone(1046.5, 0.09, 0.07, 'sine');
        setTimeout(() => fx.playTone(1318.5, 0.14, 0.07, 'sine'), 160);
        return '📡 City Flight Radar sweeps Penang airspace — Virtual Intel Campus telemetry nominal!';
      },
      update(dt) {
        const speed = this.scanTimer > 0 ? 7.5 : 1.4;
        if (this.scanTimer > 0) this.scanTimer -= dt;
        radarDish.rotation.y += dt * speed;
        ring.material.opacity = 0.42 + Math.sin(performance.now() * 0.005) * 0.2;
      },
    };
  }

  // Floor 6 Item 3: Interactive 3D Terrain Sandtable (Terrain Map Sky Lounge L2)
  function createTerrainSandtable() {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.2, 0x4ade80);
    const table = box(1.75, 0.72, 1.35, 0x334155);
    table.position.set(0, 0.36, 0);
    const frame = box(1.82, 0.1, 1.42, 0xf59e0b, 0x451a03);
    frame.position.set(0, 0.75, 0);

    const hills = [];
    [
      [-0.45, 0.36, -0.25, 0x22c55e],
      [0.0, 0.62, 0.0, 0x16a34a],
      [0.45, 0.44, 0.2, 0x4ade80],
      [-0.2, 0.28, 0.32, 0x0ea5e9],
    ].forEach(([hx, hh, hz, hc]) => {
      const m = box(0.42, hh, 0.42, hc, 0x052e16);
      m.position.set(hx, 0.8 + hh / 2, hz);
      root.add(m);
      hills.push({ mesh: m, baseY: 0.8 + hh / 2 });
    });

    const beacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18, 0),
      new THREE.MeshLambertMaterial({ color: 0xfde047, emissive: 0xca8a04 })
    );
    beacon.position.set(0, 1.78, 0);
    root.add(table, frame, beacon);

    tagItem(root, 'terrain_sandtable');
    return {
      id: 'terrain_sandtable',
      level: 6,
      name: '3D Terrain Sandtable',
      actionLabel: 'Pulse Topo Elevation',
      group: root,
      homePos: new THREE.Vector3(53.5, 32, 20.5),
      radius: 1.35,
      waveTimer: 0,
      phase: 0,
      trigger(fx) {
        this.waveTimer = 3.8;
        fx.playTone(392, 0.14, 0.08, 'triangle');
        setTimeout(() => fx.playTone(587.33, 0.18, 0.08, 'triangle'), 120);
        return '🗺️ 3D Topographic Terrain Sandtable illuminates elevation contours across the Sky Lounge!';
      },
      update(dt) {
        this.phase += dt * (this.waveTimer > 0 ? 7.0 : 2.0);
        if (this.waveTimer > 0) this.waveTimer -= dt;
        const amp = this.waveTimer > 0 ? 0.22 : 0.04;
        hills.forEach((h, i) => {
          h.mesh.position.y = h.baseY + Math.sin(this.phase + i * 1.1) * amp;
        });
        beacon.rotation.y += dt * (this.waveTimer > 0 ? 5.0 : 1.5);
        beacon.position.y = 1.78 + Math.sin(this.phase) * 0.12;
        ring.material.opacity = 0.42 + Math.sin(this.phase) * 0.18;
      },
    };
  }

  // =========================================================================
  // 3 Universal Interactive Tools Per Floor (Circuit Reader, Team Meeting, Cheers)
  // =========================================================================

  function createCircuitTerminal(lvl) {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.0, 0x00c7fd);
    const desk = box(1.15, 0.72, 0.75, 0x0f172a);
    desk.position.set(0, 0.36, 0);
    const stand = box(0.24, 0.55, 0.2, 0x334155);
    stand.position.set(0, 0.92, -0.05);
    const monitor = box(1.05, 0.68, 0.12, 0x0068b5, 0x003a70);
    monitor.position.set(0, 1.38, 0);
    const screenGlow = box(0.9, 0.52, 0.04, 0x38bdf8, 0x0284c7);
    screenGlow.position.set(0, 1.38, 0.06);
    const ticker = box(0.75, 0.1, 0.05, 0xfde047, 0x854d0e);
    ticker.position.set(0, 1.54, 0.08);
    root.add(desk, stand, monitor, screenGlow, ticker);

    const id = `circuit_terminal_f${lvl.level}`;
    tagItem(root, id);
    return {
      id,
      level: lvl.level,
      isToolStation: true,
      toolAction: 'open_circuit',
      name: 'Circuit News Terminal',
      actionLabel: 'Read circuit.intel.com',
      group: root,
      homePos: new THREE.Vector3(28.5, lvl.standY, 11.5),
      radius: 1.25,
      pulse: 0,
      trigger(fx) {
        this.pulse = 2.0;
        fx.playTone(587.33, 0.1, 0.07, 'sine');
        setTimeout(() => fx.playTone(880, 0.14, 0.07, 'sine'), 90);
        return `📰 Opened circuit.intel.com Reader on Floor ${lvl.level}!`;
      },
      update(dt) {
        this.pulse = Math.max(0, this.pulse - dt);
        ticker.position.x = Math.sin(performance.now() * 0.003) * 0.08;
        screenGlow.material.emissive.setHex(this.pulse > 0 ? 0x0ea5e9 : 0x0284c7);
        ring.material.opacity = 0.42 + Math.sin(performance.now() * 0.004) * 0.18;
      },
    };
  }

  function createMeetingHub(lvl) {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.1, 0x4ade80);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.72, 0.72, 16),
      new THREE.MeshLambertMaterial({ color: 0x1e293b })
    );
    base.position.set(0, 0.36, 0);
    const tableTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.88, 0.1, 18),
      new THREE.MeshLambertMaterial({ color: 0x0ea5e9, emissive: 0x0c4a6e })
    );
    tableTop.position.set(0, 0.76, 0);
    const holo = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshLambertMaterial({ color: 0x4ade80, emissive: 0x15803d })
    );
    holo.position.set(0, 1.35, 0);
    root.add(base, tableTop, holo);

    const id = `meeting_hub_f${lvl.level}`;
    tagItem(root, id);
    return {
      id,
      level: lvl.level,
      isToolStation: true,
      toolAction: 'start_meeting',
      name: 'Team Meeting Huddle Hub',
      actionLabel: 'Gather All People',
      group: root,
      homePos: new THREE.Vector3(39.0, lvl.standY, 11.5),
      radius: 1.3,
      activeTimer: 0,
      trigger(fx) {
        this.activeTimer = 4.0;
        fx.playTone(440, 0.12, 0.08, 'triangle');
        setTimeout(() => fx.playTone(554.37, 0.14, 0.08, 'triangle'), 100);
        setTimeout(() => fx.playTone(659.25, 0.2, 0.08, 'triangle'), 200);
        return `👥 Team Meeting summoned on Floor ${lvl.level} — gathering everyone!`;
      },
      update(dt) {
        const spd = this.activeTimer > 0 ? 5.5 : 1.4;
        if (this.activeTimer > 0) this.activeTimer -= dt;
        holo.rotation.y += dt * spd;
        holo.position.y = 1.35 + Math.sin(performance.now() * 0.004) * 0.12;
        ring.material.opacity = 0.45 + Math.sin(performance.now() * 0.005) * 0.2;
      },
    };
  }

  function createCheersCannon(lvl) {
    const root = new THREE.Group();
    const ring = addGlowRing(root, 1.05, 0xfde047);
    const stand = box(0.95, 0.45, 0.95, 0x312e81);
    stand.position.set(0, 0.22, 0);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.34, 0.95, 16),
      new THREE.MeshLambertMaterial({ color: 0xf59e0b, emissive: 0x78350f })
    );
    barrel.position.set(0, 0.9, 0);
    barrel.rotation.x = -0.18;
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshLambertMaterial({ color: 0xf472b6, emissive: 0x9d174d })
    );
    star.position.set(0, 1.62, 0);
    root.add(stand, barrel, star);

    const id = `cheers_cannon_f${lvl.level}`;
    tagItem(root, id);
    return {
      id,
      level: lvl.level,
      isToolStation: true,
      toolAction: 'trigger_cheers',
      name: 'Celebrate & Cheers Station',
      actionLabel: 'Celebrate & Cheers!',
      group: root,
      homePos: new THREE.Vector3(38.5, lvl.standY, 27.0),
      radius: 1.3,
      boomTimer: 0,
      trigger(fx) {
        this.boomTimer = 3.5;
        fx.playTone(523.25, 0.12, 0.09, 'triangle');
        setTimeout(() => fx.playTone(659.25, 0.12, 0.09, 'triangle'), 90);
        setTimeout(() => fx.playTone(783.99, 0.14, 0.09, 'triangle'), 180);
        setTimeout(() => fx.playTone(1046.5, 0.25, 0.1, 'triangle'), 270);
        return `🥂 CHEERS! Confetti & celebration triggered on Floor ${lvl.level}!`;
      },
      update(dt) {
        const spin = this.boomTimer > 0 ? 8.5 : 1.6;
        if (this.boomTimer > 0) this.boomTimer -= dt;
        star.rotation.y += dt * spin;
        star.position.y = 1.62 + Math.sin(performance.now() * 0.006) * 0.16;
        ring.material.opacity = 0.45 + Math.sin(performance.now() * 0.005) * 0.2;
      },
    };
  }

  // HD Intel Logo Plaque + Floor Medallion for Every Floor (F1-F6)
  function createIntelFloorTextures(lvl) {
    // 1. Wall Architectural Sign (1024x320)
    const wc = document.createElement('canvas');
    wc.width = 1024;
    wc.height = 320;
    const ctx = wc.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(10, 10, 1004, 300, 28);
    ctx.fill();
    ctx.strokeStyle = '#0068B5';
    ctx.lineWidth = 14;
    ctx.stroke();

    // Blue accent bar on left
    ctx.fillStyle = '#0068B5';
    ctx.fillRect(36, 44, 18, 232);

    // Draw crisp "intel" wordmark + cyan dot over 'i'
    ctx.fillStyle = '#0068B5';
    ctx.font = 'bold 148px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('intel.', 86, 204);
    // Signature Intel cyan square dot over the 'i'
    ctx.fillStyle = '#00C7FD';
    ctx.fillRect(92, 66, 28, 28);

    // Floor label on the right side
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 38px "Segoe UI", Arial, sans-serif';
    ctx.fillText('VIRTUAL INTEL CAMPUS', 495, 134);
    ctx.fillStyle = '#475569';
    ctx.font = '600 32px "Segoe UI", Arial, sans-serif';
    ctx.fillText(`FLOOR ${lvl.level} • ${lvl.shortName}`, 495, 196);

    const wallTex = new THREE.CanvasTexture(wc);
    wallTex.anisotropy = 8;

    // 2. Floor Medallion Plaque (1024x384)
    const fc = document.createElement('canvas');
    fc.width = 1024;
    fc.height = 384;
    const fctx = fc.getContext('2d');
    fctx.fillStyle = '#0f172a';
    fctx.beginPath();
    fctx.roundRect(12, 12, 1000, 360, 42);
    fctx.fill();
    fctx.strokeStyle = '#00C7FD';
    fctx.lineWidth = 12;
    fctx.stroke();

    fctx.fillStyle = '#ffffff';
    fctx.font = 'bold 165px "Segoe UI", Arial, sans-serif';
    fctx.fillText('intel.', 80, 236);
    fctx.fillStyle = '#00C7FD';
    fctx.fillRect(88, 86, 32, 32);

    fctx.fillStyle = '#38bdf8';
    fctx.font = 'bold 40px "Segoe UI", Arial, sans-serif';
    fctx.fillText('VIRTUAL INTEL CAMPUS', 500, 174);
    fctx.fillStyle = '#cbd5e1';
    fctx.font = '600 32px "Segoe UI", Arial, sans-serif';
    fctx.fillText(`FLOOR ${lvl.level} • ${lvl.shortName}`, 500, 234);

    const floorTex = new THREE.CanvasTexture(fc);
    floorTex.anisotropy = 8;

    return { wallTex, floorTex };
  }

  class UniqueItemManager {
    constructor(scene, levels = []) {
      this.scene = scene;
      this.items = [
        // Floor 1 (3 Interactive Items)
        createTrojanHorse(),
        createCheckinKiosk(),
        createDronePad(),
        // Floor 2 (3 Interactive Items)
        createSportsBall(),
        createSprintTimer(),
        createArcadeHoop(),
        // Floor 3 (3 Interactive Items)
        createTeddyBear(),
        createZenSingingBowl(),
        createSpinBike(),
        // Floor 4 (3 Interactive Items)
        createOceanDolphin(),
        createCoralAquarium(),
        createPingPongCannon(),
        // Floor 5 (3 Interactive Items)
        createMichelangeloStatue(),
        createPunchingBag(),
        createEspressoJukebox(),
        // Floor 6 (3 Interactive Items)
        createWorldGlobe(),
        createFlightRadar(),
        createTerrainSandtable(),
      ];
      for (const item of this.items) {
        item.group.position.copy(item.homePos);
        this.scene.add(item.group);
      }

      // Mount Intel Logo Wall Plaque + Floor Medallion + 3 Universal Interactive Tools on EVERY floor (1-6)
      this.intelLogos = [];
      this.toolStations = [];
      for (const lvl of levels) {
        const { wallTex, floorTex } = createIntelFloorTextures(lvl);

        // Wall sign centered above Lift Lobby doors (facing South +Z)
        const wallSign = new THREE.Mesh(
          new THREE.PlaneGeometry(4.6, 1.44),
          new THREE.MeshBasicMaterial({ map: wallTex })
        );
        wallSign.position.set(34.0, lvl.standY + 3.1, 8.15);
        this.scene.add(wallSign);

        // Floor medallion right in front of the elevators (facing Up +Y)
        const floorMedallion = new THREE.Mesh(
          new THREE.PlaneGeometry(3.8, 1.42),
          new THREE.MeshBasicMaterial({ map: floorTex })
        );
        floorMedallion.rotation.x = -Math.PI / 2;
        floorMedallion.position.set(34.0, lvl.standY + 0.03, 11.4);
        this.scene.add(floorMedallion);

        this.intelLogos.push({ standY: lvl.standY, wallSign, floorMedallion });

        // Spawn 3 Interactive Tools on EVERY floor (Circuit Reader, Team Meeting Hub, Cheers Cannon)
        const stations = [
          createCircuitTerminal(lvl),
          createMeetingHub(lvl),
          createCheersCannon(lvl),
        ];
        for (const st of stations) {
          st.group.position.copy(st.homePos);
          this.scene.add(st.group);
          this.toolStations.push(st);
        }
      }
    }

    getAllInteractive() {
      return [...this.items, ...this.toolStations];
    }

    getMeshes() {
      return this.getAllInteractive().map((it) => it.group);
    }

    findById(id) {
      return this.getAllInteractive().find((it) => it.id === id) || null;
    }

    getByLevel(level) {
      return this.items.filter((it) => it.level === level);
    }

    getToolsByLevel(level) {
      return this.toolStations.filter((st) => st.level === level);
    }

    getNearestItem(pos, maxDist = 3.8) {
      let best = null;
      let bestDist = maxDist;
      for (const it of this.getAllInteractive()) {
        if (Math.abs(it.group.position.y - pos.y) > 2.8) continue;
        const d = Math.hypot(it.group.position.x - pos.x, it.group.position.z - pos.z);
        if (d < bestDist) {
          bestDist = d;
          best = it;
        }
      }
      return best;
    }

    update(dt, playerPos, fx, sliceMaxY, onMsg) {
      for (const it of this.getAllInteractive()) {
        if (sliceMaxY !== null && it.homePos.y > sliceMaxY + 0.5) {
          it.group.visible = false;
          continue;
        }
        it.group.visible = true;
        it.update(dt, playerPos, fx, onMsg);
      }
      for (const lg of this.intelLogos) {
        const vis = sliceMaxY === null || lg.standY <= sliceMaxY;
        lg.wallSign.visible = vis;
        lg.floorMedallion.visible = vis;
      }
    }
  }

  global.PG17Items = { UniqueItemManager };
})(window);
