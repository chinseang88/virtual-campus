// PG17 Voxel Avatars, Multi-Floor Collision, Clickable NPC Dialogue, Partner Follow & Live Multi-User Sync
(function (global) {
  const { BLOCK_INFO } = global.VoxelTextures;
  const { PG17_LEVELS } = global;

  const SKIN_TONES = ['#f2c29b', '#e0a980', '#c68652', '#8d5524', '#f7d7bd', '#d49a6a'];
  const HAIR_COLORS = ['#2c1b10', '#4a2e1b', '#1b1b22', '#5c4b8a', '#3a2b22', '#b86b35'];
  const SHIRT_COLORS = ['#1d4ed8', '#eab308', '#16a34a', '#0284c7', '#dc2626', '#ea580c', '#6366f1'];
  const PANTS_COLORS = ['#1e293b', '#334155', '#3f3f46', '#1e3a5f', '#27272a'];

  const LEVEL_BADGE_COLORS = {
    1: '#cbd5e1',
    2: '#fde047',
    3: '#86efac',
    4: '#7dd3fc',
    5: '#fca5a5',
    6: '#fdba74',
  };

  const FLOOR_GREETINGS = {
    1: [
      'Welcome to Virtual Intel Campus Floor 1! Have you seen the Wooden Trojan Horse in the West Atrium?',
      'Check your Excel access level anytime with [U] — leveling up unlocks higher floors!',
    ],
    2: [
      'Floor 2 Sports Theme is buzzing! Try kicking the soccer ball on the green turf pitch!',
      'Our 3-lane running track and yellow espresso pantry are right over in L1.',
    ],
    3: [
      'Welcome to Floor 3 Forest Theme! Bear Bear loves waving and following visitors here.',
      'We have Yoga & Spin Studios over in the East Fitness wing!',
    ],
    4: [
      'Take a breather on Floor 4 Ocean Theme — watch the Sky Dolphin leap in its fountain!',
      'Head to the Relax Corner in L2 for Ping-Pong, Foosball, or a quick shower.',
    ],
    5: [
      'Floor 5 Industrial Loft features the Statue of Michelangelo and our iconic red booths!',
      'Need a workout? The Main Fitness Gym in East L2 has treadmills and squat racks.',
    ],
    6: [
      'You made it to Floor 6 Map Theme — our top executive sky lounge!',
      'Check out the spinning Holographic World Globe right under the VIP skylight.',
    ],
  };

  // Smooth Chibi-RPG Character Geometries (blended 3D voxel-world + cozy RPG style)
  const GEO_CHIBI_HEAD = new THREE.SphereGeometry(0.36, 24, 18);
  const GEO_CHIBI_HAIR = new THREE.SphereGeometry(0.38, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6);
  const GEO_CHIBI_TORSO = new THREE.CylinderGeometry(0.22, 0.27, 0.54, 18);
  const GEO_CHIBI_PACK = new THREE.BoxGeometry(0.32, 0.36, 0.14);
  const GEO_CHIBI_ARM = new THREE.CylinderGeometry(0.085, 0.075, 0.42, 12);
  GEO_CHIBI_ARM.translate(0, -0.21, 0);
  const GEO_CHIBI_HAND = new THREE.SphereGeometry(0.09, 12, 10);
  GEO_CHIBI_HAND.translate(0, -0.44, 0);
  const GEO_CHIBI_LEG = new THREE.CylinderGeometry(0.095, 0.085, 0.38, 12);
  GEO_CHIBI_LEG.translate(0, -0.19, 0);
  const GEO_CHIBI_SHOE = new THREE.SphereGeometry(0.115, 12, 10);
  GEO_CHIBI_SHOE.scale(1.0, 0.72, 1.35);
  GEO_CHIBI_SHOE.translate(0, -0.40, 0.03);
  const GEO_CAP_BRIM = new THREE.CylinderGeometry(0.39, 0.40, 0.06, 18, 1, false, -0.9, 1.8);

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function createChibiFaceTexture(skinColor, hairColor, eyeColor) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = skinColor;
    ctx.fillRect(0, 0, 256, 128);

    // Front face sits around u = 0.25 (x = 64) or u = 0.75 depending on SphereGeometry UV;
    // SphereGeometry starts phi=0 at -X, +Z is phi = Math.PI/2 -> u = 0.25, so center is x = 64?
    // Actually in Three.js SphereGeometry: x = -r*cos(phi)*sin(theta), z = r*sin(phi)*sin(theta).
    // At phi = 0.5*PI (u = 0.25): x=0, z=+r (FRONT!). Wait: let's draw cleanly at u = 0.25 (x = 64) AND rotate head Y by -Math.PI/2 or draw at x=128 with rotation.y = -Math.PI/2!
    // Even simpler: center face at x = 128 (u = 0.5, phi = PI) and rotate head mesh rotation.y = Math.PI/2! Wait: at phi = PI: x=+r, z=0. At phi = 1.5*PI: x=0, z=-r. At phi = 0.5*PI: x=0, z=+r!
    // Let's center the face at x = 64 (u = 0.25) AND verify: phi = 0.25 * 2PI = PI/2 -> x = -cos(PI/2)=0, z = +sin(PI/2)=+r (+Z FRONT!).
    // Wait: we can also just rotate head.rotation.y = Math.PI/2 if we draw at x = 128! Let's check: at u=0.5 (x=128), phi = PI -> local vector is (+r, 0, 0). Rotating mesh by -Math.PI/2 around Y maps (+1,0,0) -> (0,0,+1) (+Z FRONT!). That gives full horizontal margin around x=128!

    // Hair bangs across top
    ctx.fillStyle = hairColor;
    ctx.fillRect(0, 0, 256, 36);
    ctx.beginPath();
    ctx.moveTo(78, 36); ctx.lineTo(98, 52); ctx.lineTo(116, 36);
    ctx.lineTo(132, 54); ctx.lineTo(150, 36); ctx.lineTo(174, 50); ctx.lineTo(186, 36);
    ctx.fill();

    // Rosy chibi cheeks
    ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
    ctx.beginPath(); ctx.ellipse(98, 86, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(158, 86, 10, 6, 0, 0, Math.PI * 2); ctx.fill();

    // Expressive rounded chibi eyes
    [108, 148].forEach((ex) => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(ex, 72, 10, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = eyeColor;
      ctx.beginPath(); ctx.ellipse(ex, 73, 7.5, 9.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.ellipse(ex, 74, 4.5, 6, 0, 0, Math.PI * 2); ctx.fill();
      // Sparkle catchlights
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ex - 2.5, 69, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ex + 2.5, 77, 1.3, 0, Math.PI * 2); ctx.fill();
    });

    // Cute smile
    ctx.strokeStyle = '#6b3e2e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 90, 7, 0.2, Math.PI - 0.2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = 4;
    return tex;
  }

  function createNametagSprite(label, color = '#ffffff') {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.font = 'bold 42px "Segoe UI", system-ui, sans-serif';
    const w = Math.min(616, ctx.measureText(label).width + 48);
    const x = (640 - w) / 2;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.beginPath();
    ctx.roundRect(x, 12, w, 68, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 320, 47);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(2.05, 0.32, 1);
    sprite.position.set(0, 2.28, 0);
    return sprite;
  }

  function createSpeechMarkerSprite(text = '💬', bg = '#fef08a') {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 170;
    const ctx = c.getContext('2d');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(24, 14, 208, 118, 32);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 68px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 74);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.75, 0.5, 1);
    sprite.position.set(0, 2.75, 0);
    sprite.visible = false;
    return sprite;
  }

  function tagNpcGroup(group, npcName) {
    group.userData.npcName = npcName;
    group.traverse((ch) => {
      ch.userData.npcName = npcName;
    });
  }

  function createAvatarMesh(name, level, isLocal = false, customTag = null) {
    const seed = hashStr(name);
    const group = new THREE.Group();
    const bodyRig = new THREE.Group();
    group.add(bodyRig);

    const skin = SKIN_TONES[seed % SKIN_TONES.length];
    const hair = HAIR_COLORS[(seed * 3) % HAIR_COLORS.length];
    const shirt = isLocal ? '#0068B5' : SHIRT_COLORS[(level + seed) % SHIRT_COLORS.length];
    const pants = PANTS_COLORS[(seed * 7) % PANTS_COLORS.length];
    const eyes = ['#2b5fa8', '#347c44', '#4d3020', '#693ca8'][(seed * 11) % 4];
    const hasCap = isLocal || (seed % 2 === 0);
    const capColor = isLocal ? '#dc2626' : shirt;

    const skinMat = new THREE.MeshLambertMaterial({ color: skin });
    const hairMat = new THREE.MeshLambertMaterial({ color: hair });
    const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
    const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
    const shoeMat = new THREE.MeshLambertMaterial({ color: '#f8fafc' });
    const capMat = new THREE.MeshLambertMaterial({ color: capColor });
    const faceMat = new THREE.MeshLambertMaterial({ map: createChibiFaceTexture(skin, hair, eyes) });

    // Smooth Chibi Head (+Z front via -PI/2 rotation around Y)
    const head = new THREE.Mesh(GEO_CHIBI_HEAD, faceMat);
    head.scale.set(1.06, 0.96, 1.0);
    head.rotation.y = -Math.PI / 2;
    head.position.set(0, 1.38, 0);
    head.castShadow = true;
    bodyRig.add(head);

    // Hair / Cozy Cap Dome
    const capDome = new THREE.Mesh(GEO_CHIBI_HAIR, hasCap ? capMat : hairMat);
    capDome.scale.set(1.06, 0.96, 1.0);
    capDome.position.set(0, 1.41, 0);
    capDome.castShadow = true;
    bodyRig.add(capDome);

    if (hasCap) {
      const brim = new THREE.Mesh(GEO_CAP_BRIM, capMat);
      brim.position.set(0, 1.46, 0.08);
      brim.rotation.x = 0.14;
      bodyRig.add(brim);
    }

    // Rounded Chibi Jacket Torso + Backpack
    const torso = new THREE.Mesh(GEO_CHIBI_TORSO, shirtMat);
    torso.position.set(0, 0.78, 0);
    torso.castShadow = true;
    bodyRig.add(torso);

    const pack = new THREE.Mesh(GEO_CHIBI_PACK, new THREE.MeshLambertMaterial({ color: '#334155' }));
    pack.position.set(0, 0.78, -0.25);
    pack.castShadow = true;
    bodyRig.add(pack);

    // Rounded Arms + Hands
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.30, 0.98, 0);
    const lArmMesh = new THREE.Mesh(GEO_CHIBI_ARM, shirtMat);
    const lHandMesh = new THREE.Mesh(GEO_CHIBI_HAND, skinMat);
    lArmMesh.castShadow = true;
    leftArm.add(lArmMesh, lHandMesh);
    bodyRig.add(leftArm);

    const rightArm = new THREE.Group();
    rightArm.position.set(0.30, 0.98, 0);
    const rArmMesh = new THREE.Mesh(GEO_CHIBI_ARM, shirtMat);
    const rHandMesh = new THREE.Mesh(GEO_CHIBI_HAND, skinMat);
    rArmMesh.castShadow = true;
    rightArm.add(rArmMesh, rHandMesh);
    bodyRig.add(rightArm);

    // Stubby Chibi Legs + Sneakers
    const leftLeg = new THREE.Group();
    leftLeg.position.set(-0.12, 0.50, 0);
    const lLegMesh = new THREE.Mesh(GEO_CHIBI_LEG, pantsMat);
    const lShoeMesh = new THREE.Mesh(GEO_CHIBI_SHOE, shoeMat);
    lLegMesh.castShadow = true;
    leftLeg.add(lLegMesh, lShoeMesh);
    bodyRig.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(0.12, 0.50, 0);
    const rLegMesh = new THREE.Mesh(GEO_CHIBI_LEG, pantsMat);
    const rShoeMesh = new THREE.Mesh(GEO_CHIBI_SHOE, shoeMat);
    rLegMesh.castShadow = true;
    rightLeg.add(rLegMesh, rShoeMesh);
    bodyRig.add(rightLeg);

    let nametag = null;
    let promptSprite = null;
    if (!isLocal) {
      const badgeColor = LEVEL_BADGE_COLORS[level] || '#ffffff';
      const label = customTag || `${name} [F${level}]`;
      nametag = createNametagSprite(label, badgeColor);
      nametag.position.set(0, 2.08, 0);
      group.add(nametag);
      promptSprite = createSpeechMarkerSprite('💬', '#fef08a');
      promptSprite.position.set(0, 2.52, 0);
      group.add(promptSprite);
      tagNpcGroup(group, name);
    }

    return {
      group,
      bodyRig,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      nametag,
      promptSprite,
      walkPhase: (seed * 0.7) % (Math.PI * 2),
      cheerPhase: 0,
      animate(speed, dt, cheerTimer = 0) {
        if (cheerTimer > 0) {
          this.cheerPhase += dt * 11;
          this.leftArm.rotation.x = -2.45 + Math.sin(this.cheerPhase) * 0.35;
          this.rightArm.rotation.x = -2.45 - Math.sin(this.cheerPhase) * 0.35;
          this.leftLeg.rotation.x = Math.sin(this.cheerPhase) * 0.25;
          this.rightLeg.rotation.x = -Math.sin(this.cheerPhase) * 0.25;
          this.bodyRig.position.y = Math.abs(Math.sin(this.cheerPhase * 0.9)) * 0.28;
          return;
        }
        if (speed > 0.15) {
          this.walkPhase += dt * speed * 2.6;
          const swing = Math.sin(this.walkPhase) * 0.65;
          this.leftLeg.rotation.x = swing;
          this.rightLeg.rotation.x = -swing;
          this.leftArm.rotation.x = -swing * 0.75;
          this.rightArm.rotation.x = swing * 0.75;
          this.bodyRig.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.07;
        } else {
          this.leftLeg.rotation.x *= 0.8;
          this.rightLeg.rotation.x *= 0.8;
          this.leftArm.rotation.x *= 0.8;
          this.rightArm.rotation.x *= 0.8;
          this.bodyRig.position.y *= 0.8;
        }
      },
    };
  }

  function collidesAt(world, x, y, z, radius = 0.28, height = 1.72) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y + 0.02);
    const maxY = Math.floor(y + height);
    const minZ = Math.floor(z - radius);
    const maxZ = Math.floor(z + radius);

    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          if (world.isSolid(bx, by, bz)) return true;
        }
      }
    }
    return false;
  }

  function moveWithCollision(world, pos, vel, dt, radius = 0.28, height = 1.72) {
    const nx = pos.x + vel.x * dt;
    if (!collidesAt(world, nx, pos.y, pos.z, radius, height)) {
      pos.x = nx;
    } else if (!collidesAt(world, nx, pos.y + 1.05, pos.z, radius, height) && !collidesAt(world, pos.x, pos.y + 1.05, pos.z, radius, height)) {
      pos.x = nx;
      pos.y += 1.02;
    } else {
      vel.x = 0;
    }

    const nz = pos.z + vel.z * dt;
    if (!collidesAt(world, pos.x, pos.y, nz, radius, height)) {
      pos.z = nz;
    } else if (!collidesAt(world, pos.x, pos.y + 1.05, nz, radius, height) && !collidesAt(world, pos.x, pos.y + 1.05, pos.z, radius, height)) {
      pos.z = nz;
      pos.y += 1.02;
    } else {
      vel.z = 0;
    }

    const ny = pos.y + vel.y * dt;
    let onGround = false;
    if (!collidesAt(world, pos.x, ny, pos.z, radius, height)) {
      pos.y = ny;
    } else {
      if (vel.y < 0) {
        onGround = true;
        pos.y = Math.floor(pos.y + 0.02);
        while (collidesAt(world, pos.x, pos.y, pos.z, radius, height) && pos.y < world.h) {
          pos.y += 1;
        }
      }
      vel.y = 0;
    }

    pos.x = Math.max(1.5, Math.min(world.w - 1.5, pos.x));
    pos.z = Math.max(1.5, Math.min(world.d - 1.5, pos.z));
    if (pos.y < 1) { pos.y = 2; vel.y = 0; onGround = true; }

    return onGround;
  }

  class FloorNavGrid {
    constructor(world, floorObj) {
      this.world = world;
      this.floorObj = floorObj;
      this.w = world.w;
      this.d = world.d;
      this.walkable = new Uint8Array(this.w * this.d);
      this.cells = [];
      this.rebuild();
    }

    rebuild() {
      this.cells = [];
      const fy = this.floorObj.floorY;
      const sy = this.floorObj.standY;
      const isF1 = this.floorObj.level === 1;
      const minX = isF1 ? 2 : 5;
      const maxX = isF1 ? 65 : 62;
      const minZ = isF1 ? 2 : 7;
      const maxZ = isF1 ? 40 : 33;

      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const floorBlk = this.world.get(x, fy, z);
          const fInfo = BLOCK_INFO[floorBlk];
          const okFloor = fInfo && fInfo.solid;
          const okBody = !this.world.isSolid(x, sy, z) && !this.world.isSolid(x, sy + 1, z);
          const idx = z * this.w + x;
          if (okFloor && okBody) {
            this.walkable[idx] = 1;
            this.cells.push({ x: x + 0.5, z: z + 0.5 });
          } else {
            this.walkable[idx] = 0;
          }
        }
      }

      // Ensure unlocked stair entrances & down-stair landings are routable
      if (this.world.getStairZones) {
        for (const sz of this.world.getStairZones()) {
          if (sz.fromLevel !== this.floorObj.level) continue;
          const locked = sz.dir === 'up' && sz.toLevel > this.world.maxAllowedLevel;
          if (locked) continue;
          for (let z = Math.floor(sz.minZ); z <= Math.ceil(sz.maxZ); z++) {
            for (let x = Math.floor(sz.minX); x <= Math.ceil(sz.maxX); x++) {
              if (x >= 0 && x < this.w && z >= 0 && z < this.d) {
                this.walkable[z * this.w + x] = 1;
              }
            }
          }
        }
      }
    }

    isWalkable(x, z) {
      const ix = Math.floor(x);
      const iz = Math.floor(z);
      if (ix < 0 || ix >= this.w || iz < 0 || iz >= this.d) return false;
      return this.walkable[iz * this.w + ix] === 1;
    }

    findNearestWalkable(gx, gz, maxRadius = 7) {
      const x0 = Math.max(0, Math.min(this.w - 1, Math.floor(gx)));
      const z0 = Math.max(0, Math.min(this.d - 1, Math.floor(gz)));
      if (this.walkable[z0 * this.w + x0] === 1) return { x: x0, z: z0 };

      let best = null;
      let bestDistSq = Infinity;
      for (let r = 1; r <= maxRadius; r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = x0 + dx;
            const nz = z0 + dz;
            if (nx < 0 || nx >= this.w || nz < 0 || nz >= this.d) continue;
            if (this.walkable[nz * this.w + nx] !== 1) continue;
            const d2 = dx * dx + dz * dz;
            if (d2 < bestDistSq) {
              bestDistSq = d2;
              best = { x: nx, z: nz };
            }
          }
        }
        if (best) return best;
      }
      return null;
    }

    hasClearLine(x0, z0, x1, z1) {
      const dist = Math.hypot(x1 - x0, z1 - z0);
      const steps = Math.ceil(dist * 4);
      const pad = 0.26;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const px = x0 + (x1 - x0) * t;
        const pz = z0 + (z1 - z0) * t;
        if (
          !this.isWalkable(px - pad, pz - pad) ||
          !this.isWalkable(px + pad, pz - pad) ||
          !this.isWalkable(px - pad, pz + pad) ||
          !this.isWalkable(px + pad, pz + pad)
        ) {
          return false;
        }
      }
      return true;
    }

    findPlayerPath(sx, sz, gx, gz) {
      const start = this.findNearestWalkable(sx, sz, 4);
      const goal = this.findNearestWalkable(gx, gz, 8);
      if (!start || !goal) return [];
      if (start.x === goal.x && start.z === goal.z) {
        return [{ x: goal.x + 0.5, z: goal.z + 0.5 }];
      }

      const total = this.w * this.d;
      const parent = new Int32Array(total).fill(-1);
      const visited = new Uint8Array(total);
      const startIdx = start.z * this.w + start.x;
      const goalIdx = goal.z * this.w + goal.x;
      const queue = [startIdx];
      visited[startIdx] = 1;
      let found = false;
      const dirs8 = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1],
      ];
      let head = 0;

      while (head < queue.length) {
        const cur = queue[head++];
        if (cur === goalIdx) { found = true; break; }
        const cx = cur % this.w;
        const cz = (cur / this.w) | 0;
        for (let i = 0; i < 8; i++) {
          const [dx, dz] = dirs8[i];
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nx >= this.w || nz < 0 || nz >= this.d) continue;
          const nxt = nz * this.w + nx;
          if (visited[nxt] || !this.walkable[nxt]) continue;
          // Prevent corner cutting on diagonal moves
          if (dx !== 0 && dz !== 0) {
            if (!this.walkable[cz * this.w + nx] || !this.walkable[nz * this.w + cx]) continue;
          }
          visited[nxt] = 1;
          parent[nxt] = cur;
          queue.push(nxt);
        }
      }

      if (!found) return [];
      const raw = [];
      let cur = goalIdx;
      while (cur !== -1 && cur !== startIdx) {
        raw.push({ x: (cur % this.w) + 0.5, z: ((cur / this.w) | 0) + 0.5 });
        cur = parent[cur];
      }
      raw.reverse();
      if (raw.length <= 2) return raw;

      // Line-of-sight string-pulling smoothing for natural movement
      const smoothed = [];
      let anchorX = sx;
      let anchorZ = sz;
      let idx = 0;
      while (idx < raw.length) {
        let farthest = idx;
        for (let j = raw.length - 1; j > idx; j--) {
          if (this.hasClearLine(anchorX, anchorZ, raw[j].x, raw[j].z)) {
            farthest = j;
            break;
          }
        }
        smoothed.push(raw[farthest]);
        anchorX = raw[farthest].x;
        anchorZ = raw[farthest].z;
        idx = farthest + 1;
      }
      return smoothed;
    }

    findPath(sx, sz, gx, gz) {
      const x0 = Math.floor(sx), z0 = Math.floor(sz);
      let x1 = Math.floor(gx), z1 = Math.floor(gz);
      if (!this.isWalkable(x1, z1)) {
        const c = this.cells[Math.floor(Math.random() * this.cells.length)];
        if (!c) return [];
        x1 = Math.floor(c.x); z1 = Math.floor(c.z);
      }
      const total = this.w * this.d;
      const parent = new Int32Array(total).fill(-1);
      const visited = new Uint8Array(total);
      const startIdx = z0 * this.w + x0;
      const goalIdx = z1 * this.w + x1;
      const queue = [startIdx];
      visited[startIdx] = 1;
      let found = false;
      const dirs = [1, -1, this.w, -this.w];
      let head = 0;

      while (head < queue.length) {
        const cur = queue[head++];
        if (cur === goalIdx) { found = true; break; }
        const cx = cur % this.w;
        const cz = (cur / this.w) | 0;
        for (let i = 0; i < 4; i++) {
          const nxt = cur + dirs[i];
          if (nxt < 0 || nxt >= total || visited[nxt] || !this.walkable[nxt]) continue;
          const nx = nxt % this.w;
          const nz = (nxt / this.w) | 0;
          if (Math.abs(nx - cx) + Math.abs(nz - cz) !== 1) continue;
          visited[nxt] = 1;
          parent[nxt] = cur;
          queue.push(nxt);
        }
      }

      if (!found) return [];
      const path = [];
      let cur = goalIdx;
      while (cur !== -1 && cur !== startIdx) {
        path.push({
          x: (cur % this.w) + 0.5 + (Math.random() - 0.5) * 0.2,
          z: ((cur / this.w) | 0) + 0.5 + (Math.random() - 0.5) * 0.2,
        });
        cur = parent[cur];
      }
      path.reverse();
      return path;
    }
  }

  class RosterCrowdManager {
    constructor(scene, world, onChatMessage) {
      this.scene = scene;
      this.world = world;
      this.onChatMessage = onChatMessage;
      this.navByLevel = new Map();
      for (const lvl of PG17_LEVELS) {
        this.navByLevel.set(lvl.level, new FloorNavGrid(world, lvl));
      }
      this.npcs = [];
      this.remotePlayers = new Map(); // Live browser tabs via /api/sync
      this.talkingNpc = null;
      this.chatTimer = 6.0;
    }

    rebuildNav() {
      for (const nav of this.navByLevel.values()) nav.rebuild();
    }

    findPathForPlayer(floorLevel, sx, sz, gx, gz) {
      const nav = this.navByLevel.get(floorLevel);
      if (!nav) return [];
      return nav.findPlayerPath(sx, sz, gx, gz);
    }

    syncUsers(users, activeUserName) {
      for (const npc of this.npcs) {
        this.scene.remove(npc.avatar.group);
      }
      this.npcs = [];
      this.talkingNpc = null;

      const activeLower = String(activeUserName || '').toLowerCase();
      for (const u of users) {
        if (u.name.toLowerCase() === activeLower) continue;
        this.spawnUserAvatar(u);
      }
    }

    spawnUserAvatar(user) {
      const floorObj = this.world.getMaxAllowedFloorObj(user.level);
      const nav = this.navByLevel.get(floorObj.level);
      const cells = nav ? nav.cells : [];
      const spawn = cells.length > 0
        ? cells[Math.floor(Math.random() * cells.length)]
        : { x: 34.5, z: 12.5 };

      const avatar = createAvatarMesh(user.name, floorObj.level, false);
      avatar.group.position.set(spawn.x, floorObj.standY, spawn.z);
      this.scene.add(avatar.group);

      const npc = {
        name: user.name,
        level: floorObj.level,
        role: user.role || 'Member',
        isRemote: false,
        following: false,
        talkPauseTimer: 0,
        floorObj,
        nav,
        avatar,
        pos: new THREE.Vector3(spawn.x, floorObj.standY, spawn.z),
        vel: new THREE.Vector3(),
        yaw: Math.random() * Math.PI * 2,
        speed: 1.85 + Math.random() * 0.9,
        path: [],
        waitTimer: Math.random() * 1.5,
        stuckTimer: 0,
        lastX: spawn.x,
        lastZ: spawn.z,
      };
      this.pickNewDestination(npc);
      this.npcs.push(npc);
    }

    getNpcMeshes() {
      const liveNames = new Set();
      const list = [];
      for (const r of this.remotePlayers.values()) {
        liveNames.add(r.name.toLowerCase());
        list.push(r.avatar.group);
      }
      for (const n of this.npcs) {
        if (!liveNames.has(n.name.toLowerCase())) list.push(n.avatar.group);
      }
      return list;
    }

    findNpcByName(name) {
      const target = String(name || '').toLowerCase();
      for (const r of this.remotePlayers.values()) {
        if (r.name.toLowerCase() === target) return r;
      }
      const local = this.npcs.find((n) => n.name.toLowerCase() === target);
      return local || null;
    }

    getNearestTalkable(pos, maxDist = 3.2) {
      let best = null;
      let bestDist = maxDist;
      const liveNames = new Set();
      for (const r of this.remotePlayers.values()) {
        liveNames.add(r.name.toLowerCase());
        if (Math.abs(r.pos.y - pos.y) > 2.4) continue;
        const d = Math.hypot(r.pos.x - pos.x, r.pos.z - pos.z);
        if (d < bestDist) { bestDist = d; best = r; }
      }
      for (const npc of this.npcs) {
        if (liveNames.has(npc.name.toLowerCase())) continue;
        if (Math.abs(npc.pos.y - pos.y) > 2.4) continue;
        const d = Math.hypot(npc.pos.x - pos.x, npc.pos.z - pos.z);
        if (d < bestDist) { bestDist = d; best = npc; }
      }
      return best;
    }

    facePlayer(npc, playerPos) {
      if (!npc || !playerPos) return;
      const dx = playerPos.x - npc.pos.x;
      const dz = playerPos.z - npc.pos.z;
      npc.yaw = Math.atan2(dx, dz);
      npc.talkPauseTimer = 8.0;
    }

    buildGreeting(npc) {
      if (npc.isRemote) {
        return `Hey! I'm ${npc.name} (live player on Floor ${npc.level}). Want to chat?`;
      }
      const lines = FLOOR_GREETINGS[npc.floorObj.level] || FLOOR_GREETINGS[1];
      const line = lines[hashStr(npc.name) % lines.length];
      return `Hi! I'm ${npc.name} (${npc.role}, Floor ${npc.level}). ${line}`;
    }

    buildReply(npc, playerText, playerName) {
      if (npc.isRemote) {
        return `Sent to ${npc.name}: "${playerText}" (live chat broadcast!)`;
      }
      const lower = String(playerText || '').toLowerCase();
      if (lower.includes('follow')) {
        npc.following = !npc.following;
        return npc.following
          ? `Sure ${playerName}! Lead the way around Floor ${npc.floorObj.level} — I'll walk with you!`
          : `Okay ${playerName}, I'll stroll around Floor ${npc.floorObj.level} on my own now!`;
      }
      if (lower.includes('floor') || lower.includes('item') || lower.includes('where')) {
        return `On Floor ${npc.floorObj.level} (${npc.floorObj.shortName}), don't miss the ${npc.floorObj.uniqueItem}! Walk up and press [E] or click it!`;
      }
      if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
        return `Hey ${playerName}! Great to bump into you in ${npc.floorObj.shortName}!`;
      }
      return `Haha, good point ${playerName}! "${playerText}" — see you around ${npc.floorObj.shortName}!`;
    }

    syncRemotePlayers(playersList, myClientId) {
      const seen = new Set();
      for (const p of playersList) {
        if (!p.id || p.id === myClientId) continue;
        seen.add(p.id);
        let entry = this.remotePlayers.get(p.id);
        if (!entry || entry.name !== p.name || entry.level !== p.level) {
          if (entry) this.scene.remove(entry.avatar.group);
          const avatar = createAvatarMesh(p.name, p.level, false, `${p.name} [LIVE F${p.level}]`);
          this.scene.add(avatar.group);
          entry = {
            id: p.id,
            name: p.name,
            level: p.level,
            role: 'Live Player',
            isRemote: true,
            floorObj: this.world.getMaxAllowedFloorObj(p.level),
            avatar,
            pos: new THREE.Vector3(p.x, p.y, p.z),
            targetPos: new THREE.Vector3(p.x, p.y, p.z),
            yaw: p.yaw || 0,
          };
          this.remotePlayers.set(p.id, entry);
        } else {
          entry.targetPos.set(p.x, p.y, p.z);
          entry.yaw = p.yaw || 0;
        }
      }
      for (const [id, entry] of this.remotePlayers.entries()) {
        if (!seen.has(id)) {
          this.scene.remove(entry.avatar.group);
          this.remotePlayers.delete(id);
        }
      }
    }

    pickNewDestination(npc) {
      if (!npc.nav) return;
      const floorPois = this.world.pois.filter((p) => p.level === npc.floorObj.level);
      let goal;
      if (floorPois.length > 0 && Math.random() < 0.72) {
        const poi = floorPois[Math.floor(Math.random() * floorPois.length)];
        goal = { x: poi.x + (Math.random() - 0.5) * 4, z: poi.z + (Math.random() - 0.5) * 4 };
      } else {
        const cells = npc.nav.cells;
        goal = cells[Math.floor(Math.random() * cells.length)] || { x: 34.5, z: 12.5 };
      }
      npc.path = npc.nav.findPath(npc.pos.x, npc.pos.z, goal.x, goal.z);
      if (npc.path.length === 0) npc.waitTimer = 0.6;
    }

    cheerAllOnFloor(standY, duration = 3.8) {
      for (const npc of this.npcs) {
        if (Math.abs(npc.pos.y - standY) < 2.5) {
          npc.cheerTimer = duration;
        }
      }
      for (const r of this.remotePlayers.values()) {
        if (Math.abs(r.pos.y - standY) < 2.5) {
          r.cheerTimer = duration;
        }
      }
    }

    gatherForMeeting(centerPos, floorObj, durationSec = 25) {
      if (!floorObj) return 0;
      const targetNav = this.navByLevel.get(floorObj.level);
      if (!targetNav) return 0;
      let gathered = 0;
      const total = this.npcs.length || 1;
      const radius = 2.6;

      this.npcs.forEach((npc, idx) => {
        if (!npc.origFloorObj) npc.origFloorObj = npc.floorObj;
        const onOtherFloor = npc.floorObj.level !== floorObj.level;
        npc.floorObj = floorObj;
        npc.nav = targetNav;
        npc.meetingTimer = durationSec;
        npc.meetingHost = { x: centerPos.x, z: centerPos.z };

        const angle = (idx / total) * Math.PI * 2;
        const slotX = Math.max(6, Math.min(61, centerPos.x + Math.cos(angle) * radius));
        const slotZ = Math.max(9, Math.min(32, centerPos.z + Math.sin(angle) * radius));
        npc.meetingSlot = { x: slotX, z: slotZ };

        if (onOtherFloor) {
          // Off-floor colleagues arrive cleanly through this floor's Lift Lobby!
          const startX = 30.5 + (idx % 7) * 1.1;
          const startZ = 9.5 + (idx % 2) * 1.1;
          npc.pos.set(startX, floorObj.standY, startZ);
          npc.vel.set(0, 0, 0);
        }
        npc.path = targetNav.findPath(npc.pos.x, npc.pos.z, slotX, slotZ);
        npc.waitTimer = 0;
        gathered++;
      });
      return gathered;
    }

    endMeeting() {
      for (const npc of this.npcs) {
        npc.meetingTimer = 0;
        npc.meetingSlot = null;
        if (npc.origFloorObj && npc.origFloorObj.level !== npc.floorObj.level) {
          npc.floorObj = npc.origFloorObj;
          npc.nav = this.navByLevel.get(npc.floorObj.level);
          const cells = npc.nav ? npc.nav.cells : [];
          const spot = cells.length > 0 ? cells[Math.floor(Math.random() * cells.length)] : { x: 34.5, z: 12.5 };
          npc.pos.set(spot.x, npc.floorObj.standY, spot.z);
          npc.path = [];
        }
        npc.origFloorObj = null;
      }
    }

    update(dt, cameraPos, playerPos, sliceMaxY = null) {
      const liveNames = new Set();
      // Update live remote players smoothly
      for (const r of this.remotePlayers.values()) {
        liveNames.add(r.name.toLowerCase());
        if (r.cheerTimer > 0) r.cheerTimer -= dt;
        if (sliceMaxY !== null && r.pos.y > sliceMaxY) {
          r.avatar.group.visible = false;
          continue;
        }
        r.avatar.group.visible = true;
        const dist = r.pos.distanceTo(r.targetPos);
        r.pos.lerp(r.targetPos, Math.min(1, dt * 10));
        r.avatar.group.position.copy(r.pos);
        r.avatar.group.rotation.y = r.yaw;
        r.avatar.animate(dist > 0.05 ? 4.0 : 0, dt, r.cheerTimer || 0);
        if (r.avatar.promptSprite && playerPos) {
          const pd = Math.hypot(r.pos.x - playerPos.x, r.pos.z - playerPos.z);
          r.avatar.promptSprite.visible = pd < 3.2 && Math.abs(r.pos.y - playerPos.y) < 2.2;
        }
      }

      for (let i = 0; i < this.npcs.length; i++) {
        const npc = this.npcs[i];
        let moveSpeed = 0;
        if (npc.cheerTimer > 0) npc.cheerTimer -= dt;

        if (liveNames.has(npc.name.toLowerCase()) || (sliceMaxY !== null && npc.pos.y > sliceMaxY)) {
          npc.avatar.group.visible = false;
          continue;
        }
        npc.avatar.group.visible = true;

        const distToPlayer = playerPos && Math.abs(npc.pos.y - playerPos.y) < 2.2
          ? Math.hypot(npc.pos.x - playerPos.x, npc.pos.z - playerPos.z)
          : 999;

        if (npc.avatar.promptSprite) {
          npc.avatar.promptSprite.visible = distToPlayer < 3.2;
        }

        if (npc.meetingTimer > 0) {
          npc.meetingTimer -= dt;
          if (npc.meetingTimer <= 0) {
            if (npc.origFloorObj && npc.origFloorObj.level !== npc.floorObj.level) {
              npc.floorObj = npc.origFloorObj;
              npc.nav = this.navByLevel.get(npc.floorObj.level);
              const cells = npc.nav ? npc.nav.cells : [];
              const spot = cells.length > 0 ? cells[Math.floor(Math.random() * cells.length)] : { x: 34.5, z: 12.5 };
              npc.pos.set(spot.x, npc.floorObj.standY, spot.z);
              npc.path = [];
            }
            npc.origFloorObj = null;
            npc.meetingSlot = null;
          }
        }

        if (npc.talkPauseTimer > 0) {
          npc.talkPauseTimer -= dt;
          npc.vel.x = 0;
          npc.vel.z = 0;
        } else if (npc.meetingTimer > 0 && npc.meetingSlot) {
          if (npc.path.length > 0) {
            const wp = npc.path[0];
            const dx = wp.x - npc.pos.x;
            const dz = wp.z - npc.pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.4) {
              npc.path.shift();
            } else {
              const nx = dx / dist;
              const nz = dz / dist;
              npc.vel.x = nx * 4.5;
              npc.vel.z = nz * 4.5;
              moveSpeed = 4.5;
              npc.yaw = Math.atan2(nx, nz);
            }
          } else {
            const dx = npc.meetingSlot.x - npc.pos.x;
            const dz = npc.meetingSlot.z - npc.pos.z;
            const dist = Math.hypot(dx, dz);
            if (dist > 0.65) {
              const nx = dx / dist;
              const nz = dz / dist;
              npc.vel.x = nx * 3.8;
              npc.vel.z = nz * 3.8;
              moveSpeed = 3.8;
              npc.yaw = Math.atan2(nx, nz);
            } else {
              npc.vel.x = 0;
              npc.vel.z = 0;
              if (npc.meetingHost) {
                npc.yaw = Math.atan2(npc.meetingHost.x - npc.pos.x, npc.meetingHost.z - npc.pos.z);
              }
            }
          }
        } else if (npc.following && playerPos && Math.abs(playerPos.y - npc.floorObj.standY) < 2.0) {
          // Partner Follow behavior (Pokémon style!)
          const dx = playerPos.x - npc.pos.x;
          const dz = playerPos.z - npc.pos.z;
          const d = Math.hypot(dx, dz);
          if (d > 2.2) {
            const nx = dx / d;
            const nz = dz / d;
            npc.vel.x = nx * 4.2;
            npc.vel.z = nz * 4.2;
            moveSpeed = 4.2;
            npc.yaw = Math.atan2(nx, nz);
          } else {
            npc.vel.x = 0;
            npc.vel.z = 0;
          }
        } else if (npc.waitTimer > 0) {
          npc.waitTimer -= dt;
          npc.vel.x = 0;
          npc.vel.z = 0;
          if (npc.waitTimer <= 0) this.pickNewDestination(npc);
        } else if (npc.path.length > 0) {
          const wp = npc.path[0];
          const dx = wp.x - npc.pos.x;
          const dz = wp.z - npc.pos.z;
          const dist = Math.hypot(dx, dz);

          if (dist < 0.35) {
            npc.path.shift();
            if (npc.path.length === 0) npc.waitTimer = 1.4 + Math.random() * 2.8;
          } else {
            const nx = dx / dist;
            const nz = dz / dist;
            npc.vel.x = nx * npc.speed;
            npc.vel.z = nz * npc.speed;
            moveSpeed = npc.speed;

            const targetYaw = Math.atan2(nx, nz);
            let diff = targetYaw - npc.yaw;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            npc.yaw += diff * Math.min(1, dt * 10);
          }

          npc.stuckTimer += dt;
          if (npc.stuckTimer > 1.5) {
            const moved = Math.hypot(npc.pos.x - npc.lastX, npc.pos.z - npc.lastZ);
            npc.lastX = npc.pos.x;
            npc.lastZ = npc.pos.z;
            npc.stuckTimer = 0;
            if (moved < 0.3) {
              npc.path = [];
              npc.waitTimer = 0.25;
            }
          }
        } else {
          npc.waitTimer = 0.6;
        }

        npc.vel.y -= 18 * dt;
        moveWithCollision(this.world, npc.pos, npc.vel, dt, 0.24, 1.7);
        if (npc.pos.y < npc.floorObj.standY - 0.5) {
          npc.pos.y = npc.floorObj.standY;
          npc.vel.y = 0;
        }

        npc.avatar.group.position.copy(npc.pos);
        npc.avatar.group.rotation.y = npc.yaw;
        npc.avatar.animate(moveSpeed, dt, npc.cheerTimer || 0);

        if (npc.avatar.nametag && cameraPos) {
          const d = npc.pos.distanceToSquared(cameraPos);
          npc.avatar.nametag.visible = d < 28 * 28;
        }
      }
    }
  }

  global.VoxelPlayers = {
    createAvatarMesh,
    moveWithCollision,
    RosterCrowdManager,
  };
})(window);
