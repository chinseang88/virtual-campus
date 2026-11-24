// Unique Interactive 3D Landmarks — One Exclusive Item Per PG17 Floor (Floors 1–6)
(function (global) {
  function box(w, h, d, color, emissive = 0x000000) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color, emissive });
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
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
        createTrojanHorse(),
        createSportsBall(),
        createTeddyBear(),
        createOceanDolphin(),
        createMichelangeloStatue(),
        createWorldGlobe(),
      ];
      for (const item of this.items) {
        item.group.position.copy(item.homePos);
        this.scene.add(item.group);
      }

      // Mount Intel Logo Wall Plaque + Floor Medallion on EVERY floor (1-6)
      this.intelLogos = [];
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
      }
    }

    getMeshes() {
      return this.items.map((it) => it.group);
    }

    findById(id) {
      return this.items.find((it) => it.id === id) || null;
    }

    getNearestItem(pos, maxDist = 3.8) {
      let best = null;
      let bestDist = maxDist;
      for (const it of this.items) {
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
      for (const it of this.items) {
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
