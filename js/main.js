// PG17 Voxel Tower Engine: Pokemon-Style 3/4 Navigation, NPC/User Dialogue Box,
// Unique Interactive Items, Floor-Access Gating (Floors 1-6) & Live Multi-User Sync
(function (global) {
  const { BLOCKS, createAtlas } = global.VoxelTextures;
  const { PG17_LEVELS, VoxelWorld } = global;
  const { buildWorldMeshes } = global.VoxelMesher;
  const { createAvatarMesh, moveWithCollision, RosterCrowdManager } = global.VoxelPlayers;
  const { UniqueItemManager } = global.PG17Items;
  const { RosterManager, nextUpgradeLevel } = global.PG17Roster;

  const CAMERA_MODES = ['Campus 3/4', 'Top-Down Map', '1st Person Surround'];

  class SoundFX {
    constructor() { this.ctx = null; this.stepTimer = 0; }
    ensure() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    }
    playTone(freq, dur, vol = 0.08, type = 'triangle') {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.65), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    }
    step() { this.playTone(150 + Math.random() * 35, 0.05, 0.03, 'sine'); }
    blip() { this.playTone(680, 0.04, 0.04, 'square'); }
    denied() {
      this.ensure();
      this.playTone(130, 0.14, 0.11, 'sawtooth');
      setTimeout(() => this.playTone(105, 0.18, 0.11, 'sawtooth'), 110);
    }
    levelUp() {
      this.ensure();
      [440, 554.37, 659.25, 880].forEach((f, i) => {
        setTimeout(() => this.playTone(f, 0.22, 0.09, 'triangle'), i * 85);
      });
    }
    elevator() {
      this.ensure();
      this.playTone(523.25, 0.18, 0.07, 'sine');
      setTimeout(() => this.playTone(659.25, 0.25, 0.07, 'sine'), 140);
    }
    cheer() {
      this.ensure();
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, idx) => {
        setTimeout(() => this.playTone(f, 0.2, 0.085, 'triangle'), idx * 80);
      });
    }
  }

  function detectZone(world, x, y, z) {
    if (x < 4 || x > 63 || z < 6 || z > 34) return 'Virtual Intel Campus Arrival Plaza (Floor 1)';
    const lvl = world.getFloorAtY(y);
    const wing = x <= 25 ? 'L1' : (x >= 42 ? 'L2' : 'LL');

    if (lvl.level === 1) {
      if (wing === 'L1') return 'Floor 1 • Trojan Horse Atrium (L1)';
      if (wing === 'L2') return 'Floor 1 • Main Reception (ML)';
      return 'Floor 1 • Main Lift Lobby (LL)';
    }
    if (lvl.level === 2) {
      if (wing === 'L1') return x >= 18 ? 'Floor 2 • Sports Running Track (L1)' : 'Floor 2 • Blue Court & Yellow Pantry (L1)';
      if (wing === 'L2') return 'Floor 2 • Indoor Turf Pitch & Ball (L2)';
      return 'Floor 2 • Sports Lift Lobby (LL)';
    }
    if (lvl.level === 3) {
      if (wing === 'L1') return 'Floor 3 • Forest Lounge & Bear Bear (L1)';
      if (wing === 'L2') return z <= 20 ? 'Floor 3 • Fitness Yoga Studio (L2)' : 'Floor 3 • Spin & Turf Studio (L2)';
      return 'Floor 3 • Forest Lift Lobby (LL)';
    }
    if (lvl.level === 4) {
      if (wing === 'L1') return z <= 20 ? 'Floor 4 • Ocean Dolphin Lounge (L1)' : 'Floor 4 • Kelp Wave Bar (L1)';
      if (wing === 'L2') return z <= 15 ? 'Floor 4 • Locker & Shower Wing (L2)' : 'Floor 4 • Ping-Pong Relax Corner (L2)';
      return 'Floor 4 • Ocean Lift Lobby (LL)';
    }
    if (lvl.level === 5) {
      if (wing === 'L1') return 'Floor 5 • Michelangelo Gallery & Red Booths (L1)';
      if (wing === 'L2') return 'Floor 5 • Main Fitness Gym (L2)';
      return 'Floor 5 • Industrial Lift Lobby (LL)';
    }
    if (lvl.level === 6) {
      if (wing === 'L1') return 'Floor 6 • City Map Sky Lounge (L1)';
      if (wing === 'L2') return 'Floor 6 • Terrain Map Executive Lounge (L2)';
      return 'Floor 6 • VIP Sky Atrium & World Globe (LL)';
    }
    return `Floor ${lvl.level} • ${lvl.shortName}`;
  }

  function initGame() {
    if (typeof THREE === 'undefined') {
      document.getElementById('loading-overlay').innerHTML =
        '<div style="color:#ff8080;text-align:center;padding:24px;"><h2>Three.js failed to load</h2><p>Please check your internet connection and refresh.</p></div>';
      return;
    }

    const container = document.getElementById('game-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x93c5fd);
    scene.fog = new THREE.Fog(0x93c5fd, 75, 175);

    const camera = new THREE.PerspectiveCamera(56, window.innerWidth / window.innerHeight, 0.1, 260);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight(0xfffbeb, 0x475569, 0.94);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff7ed, 0.85);
    sunLight.position.set(60, 82, 56);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 190;
    sunLight.shadow.camera.left = -52;
    sunLight.shadow.camera.right = 52;
    sunLight.shadow.camera.top = 52;
    sunLight.shadow.camera.bottom = -52;
    sunLight.shadow.bias = -0.0005;
    sunLight.target.position.set(34, 14, 20);
    scene.add(sunLight);
    scene.add(sunLight.target);

    const pointLights = [];
    PG17_LEVELS.forEach((lvl) => {
      [15, 34, 52].forEach((lx) => {
        const pl = new THREE.PointLight(0xfff1d6, 0.38, 28, 1.3);
        pl.position.set(lx, lvl.standY + 3.6, 20);
        scene.add(pl);
        pointLights.push(pl);
      });
    });

    // World & Meshes
    const atlasTex = createAtlas();
    atlasTex.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    const world = new VoxelWorld();
    let cameraMode = 0; // 0: Pokemon 3/4 (default), 1: Top-Down Map, 2: 1st Person Surround
    let sliceFloors = true;
    let viewedFloorObj = PG17_LEVELS[0];
    let worldMeshGroup = null;

    function getActiveSliceMaxY() {
      if (cameraMode !== 2 && sliceFloors) {
        return viewedFloorObj.floorY + 4;
      }
      return null;
    }

    function rebuildWorldMesh() {
      if (worldMeshGroup) {
        scene.remove(worldMeshGroup);
        worldMeshGroup.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
      }
      worldMeshGroup = buildWorldMeshes(world, atlasTex, getActiveSliceMaxY());
      scene.add(worldMeshGroup);
    }

    // Cursor & Walk-Target Rings
    const cursorRingGeo = new THREE.RingGeometry(0.30, 0.46, 24);
    cursorRingGeo.rotateX(-Math.PI / 2);
    const cursorRingMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
    const cursorRing = new THREE.Mesh(cursorRingGeo, cursorRingMat);
    cursorRing.visible = false;
    scene.add(cursorRing);

    const targetRingGeo = new THREE.RingGeometry(0.24, 0.44, 24);
    targetRingGeo.rotateX(-Math.PI / 2);
    const targetRingMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
    const walkTargetRing = new THREE.Mesh(targetRingGeo, targetRingMat);
    walkTargetRing.visible = false;
    scene.add(walkTargetRing);

    const walkPathMat = new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.75 });
    const walkPathLine = new THREE.Line(new THREE.BufferGeometry(), walkPathMat);
    walkPathLine.visible = false;
    scene.add(walkPathLine);

    // Particles
    const particles = [];
    const partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    function spawnParticles(x, y, z, colorHex, count = 12) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex || '#fde047' });
      for (let i = 0; i < count; i++) {
        const m = new THREE.Mesh(partGeo, mat);
        m.position.set(x, y + 0.6, z);
        scene.add(m);
        particles.push({
          mesh: m,
          vel: new THREE.Vector3((Math.random() - 0.5) * 5, 2.5 + Math.random() * 3.5, (Math.random() - 0.5) * 5),
          life: 0.65,
        });
      }
    }

    // User Post Board & Toast Helpers
    const POSTS_STORAGE_KEY = 'pg17_wall_posts_v1';
    const chatMessagesEl = document.getElementById('chat-messages');
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function savePost(sender, text, isSystem) {
      if (isSystem) return;
      try {
        const list = JSON.parse(localStorage.getItem(POSTS_STORAGE_KEY) || '[]');
        list.push({ sender, text });
        if (list.length > 40) list.splice(0, list.length - 40);
        localStorage.setItem(POSTS_STORAGE_KEY, JSON.stringify(list));
      } catch (e) { /* ignore */ }
    }
    function pushChat(sender, text, isSystem = false, skipSave = false) {
      const row = document.createElement('div');
      row.className = 'chat-row' + (isSystem ? ' chat-system' : '');
      row.innerHTML = isSystem
        ? `<span>${escapeHtml(text)}</span>`
        : `<span class="chat-name">&lt;${escapeHtml(sender)}&gt;</span> <span>${escapeHtml(text)}</span>`;
      chatMessagesEl.appendChild(row);
      while (chatMessagesEl.children.length > 40) chatMessagesEl.removeChild(chatMessagesEl.firstChild);
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      if (!skipSave) savePost(sender, text, isSystem);
    }
    try {
      const savedPosts = JSON.parse(localStorage.getItem(POSTS_STORAGE_KEY) || '[]');
      savedPosts.forEach((p) => pushChat(p.sender, p.text, false, true));
    } catch (e) { /* ignore */ }

    const toastEl = document.getElementById('access-toast');
    let toastTimeout = null;
    function showToast(msg, isError = true) {
      toastEl.textContent = msg;
      toastEl.className = isError ? 'toast error show' : 'toast success show';
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => { toastEl.classList.remove('show'); }, 2900);
    }

    // Unique Items + Intel Floor Logos + Crowd + Roster
    const itemManager = new UniqueItemManager(scene, PG17_LEVELS);
    const crowd = new RosterCrowdManager(scene, world, (sender, text) => pushChat(sender, text));
    const sfx = new SoundFX();

    // Local Player State
    const playerPos = new THREE.Vector3(28.0, 2.0, 26.0);
    const playerVel = new THREE.Vector3(0, 0, 0);
    let yaw = 0;       // Facing direction (0 = North -Z)
    let camYaw = 0;    // Gentle camera orbit (0 = North -Z)
    let onGround = true;
    let isNight = false;
    let drawerOpen = false;
    let localCheerTimer = 0;
    let lastDeniedAt = 0;
    let walkTarget = null;
    let walkPath = [];
    let walkStuckTimer = 0;
    let walkLastX = 28.0;
    let walkLastZ = 26.0;
    let hoveredItem = null;
    let hoveredNpc = null;

    function clearWalkPath() {
      walkTarget = null;
      walkPath = [];
      walkStuckTimer = 0;
      walkPathLine.visible = false;
    }

    function setSmartWalkTarget(tx, tz) {
      const floorNow = world.getFloorAtY(playerPos.y);
      const path = crowd.findPathForPlayer(floorNow.level, playerPos.x, playerPos.z, tx, tz);
      if (path.length === 0) {
        clearWalkPath();
        showToast('🚫 Path blocked — try clicking inside an open room or doorway.', true);
        return false;
      }
      walkPath = path;
      walkTarget = path[path.length - 1];
      walkStuckTimer = 0;
      walkLastX = playerPos.x;
      walkLastZ = playerPos.z;
      return true;
    }

    const smoothCamPos = new THREE.Vector3(28.0, 12.5, 39.5);
    const smoothLookAt = new THREE.Vector3(28.0, 2.8, 26.0);

    let localAvatar = createAvatarMesh('Guest', 1, true);
    localAvatar.group.visible = true;
    scene.add(localAvatar.group);

    function rebuildLocalAvatar(user) {
      const wasVisible = localAvatar.group.visible;
      scene.remove(localAvatar.group);
      localAvatar = createAvatarMesh(user.name, user.level, true);
      localAvatar.group.visible = wasVisible;
      scene.add(localAvatar.group);
    }

    const roster = new RosterManager(() => {
      applyActiveUserState(false);
    });

    // Floating 3D Stair Indicators (▲ UP / ▼ DOWN / 🔒 LOCKED)
    const stairZones = world.getStairZones();
    const stairMarkersGroup = new THREE.Group();
    scene.add(stairMarkersGroup);

    function createStairSignSprite(text, bgColor, borderColor) {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 112;
      const ctx = c.getContext('2d');
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.roundRect(16, 12, 480, 88, 24);
      ctx.fill();
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 48px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 256, 58);

      const tex = new THREE.CanvasTexture(c);
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(2.3, 0.5, 1);
      return sp;
    }

    function rebuildStairMarkers(activeLevel, maxAllowedLevel) {
      while (stairMarkersGroup.children.length > 0) {
        const ch = stairMarkersGroup.children[0];
        stairMarkersGroup.remove(ch);
        if (ch.material && ch.material.map) ch.material.map.dispose();
        if (ch.material) ch.material.dispose();
      }
      for (const sz of stairZones) {
        if (sz.fromLevel !== activeLevel) continue;
        const isLocked = sz.dir === 'up' && sz.toLevel > maxAllowedLevel;
        const label = isLocked
          ? `🔒 F${sz.toLevel} Locked`
          : (sz.dir === 'up' ? `▲ UP to F${sz.toLevel}` : `▼ DOWN to F${sz.toLevel}`);
        const bg = isLocked ? '#fca5a5' : (sz.dir === 'up' ? '#fde047' : '#7dd3fc');
        const bd = isLocked ? '#991b1b' : '#0f172a';
        const sp = createStairSignSprite(label, bg, bd);
        sp.position.set(sz.markerX, sz.standY + 2.35, sz.markerZ);
        stairMarkersGroup.add(sp);
      }
    }

    // =========================================================================
    // Classic Pokemon-Style Dialogue & Talk System
    // =========================================================================
    const pkmnDialogEl = document.getElementById('pkmn-dialog');
    const pkmnSpeakerEl = document.getElementById('pkmn-speaker');
    const pkmnTextEl = document.getElementById('pkmn-text');
    const pkmnChoicesEl = document.getElementById('pkmn-choices');
    const pkmnOptFollowBtn = document.getElementById('pkmn-opt-follow');
    const pkmnReplyInput = document.getElementById('pkmn-reply-input');

    let activeDialogNpc = null;
    let typewriterTimer = null;

    function isDialogOpen() {
      return pkmnDialogEl.classList.contains('open');
    }

    function setDialogText(fullText) {
      if (typewriterTimer) clearInterval(typewriterTimer);
      pkmnTextEl.textContent = '';
      let idx = 0;
      typewriterTimer = setInterval(() => {
        idx += 2;
        pkmnTextEl.textContent = fullText.slice(0, idx);
        if (idx >= fullText.length) {
          clearInterval(typewriterTimer);
          typewriterTimer = null;
        }
      }, 16);
    }

    function openNpcDialog(npc) {
      sfx.ensure();
      sfx.blip();
      activeDialogNpc = npc;
      clearWalkPath();
      crowd.facePlayer(npc, playerPos);
      pkmnSpeakerEl.textContent = `${npc.name} • Floor ${npc.level} (${npc.role})`;
      pkmnChoicesEl.style.display = 'flex';
      pkmnOptFollowBtn.style.display = npc.isRemote ? 'none' : 'inline-block';
      pkmnOptFollowBtn.textContent = npc.following ? 'Stop Following' : 'Follow Me!';
      pkmnReplyInput.placeholder = `Talk to ${npc.name}...`;
      pkmnDialogEl.classList.add('open');
      setDialogText(crowd.buildGreeting(npc));
    }

    function openPropDialog(title, text) {
      sfx.ensure();
      sfx.blip();
      activeDialogNpc = null;
      clearWalkPath();
      pkmnSpeakerEl.textContent = title;
      pkmnChoicesEl.style.display = 'none';
      pkmnDialogEl.classList.add('open');
      setDialogText(text);
    }

    function closeDialog() {
      if (typewriterTimer) { clearInterval(typewriterTimer); typewriterTimer = null; }
      pkmnDialogEl.classList.remove('open');
      activeDialogNpc = null;
    }

    document.getElementById('pkmn-close').addEventListener('click', closeDialog);

    document.getElementById('pkmn-opt-hi').addEventListener('click', () => {
      if (!activeDialogNpc) return;
      sfx.blip();
      const me = roster.getActiveUser();
      const reply = crowd.buildReply(activeDialogNpc, 'Hi!', me.name);
      setDialogText(reply);
      pushChat(`${me.name} → ${activeDialogNpc.name}`, 'Hi!');
    });

    document.getElementById('pkmn-opt-floor').addEventListener('click', () => {
      if (!activeDialogNpc) return;
      sfx.blip();
      const me = roster.getActiveUser();
      const reply = crowd.buildReply(activeDialogNpc, 'Tell me about this floor & item!', me.name);
      setDialogText(reply);
    });

    document.getElementById('pkmn-opt-follow').addEventListener('click', () => {
      if (!activeDialogNpc) return;
      sfx.blip();
      const me = roster.getActiveUser();
      const reply = crowd.buildReply(activeDialogNpc, 'Follow me', me.name);
      pkmnOptFollowBtn.textContent = activeDialogNpc.following ? 'Stop Following' : 'Follow Me!';
      setDialogText(reply);
    });

    document.getElementById('pkmn-reply-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeDialogNpc) return;
      const txt = pkmnReplyInput.value.trim();
      if (!txt) return;
      pkmnReplyInput.value = '';
      sfx.blip();
      const me = roster.getActiveUser();
      pushChat(`${me.name} → ${activeDialogNpc.name}`, txt);
      sendLiveChat(`${me.name} [F${me.level}]`, txt, activeDialogNpc.name);
      const reply = crowd.buildReply(activeDialogNpc, txt, me.name);
      setDialogText(reply);
    });

    // Check interactive furniture/prop right in front of the player (Pokemon facing check!)
    function checkFacingProp() {
      const fx = Math.floor(playerPos.x - Math.sin(yaw) * 1.15);
      const fz = Math.floor(playerPos.z - Math.cos(yaw) * 1.15);
      const fy = Math.floor(playerPos.y);
      const probes = [
        [fx, fy, fz],
        [fx, fy + 1, fz],
        [Math.floor(playerPos.x), fy, Math.floor(playerPos.z)],
      ];
      for (const [bx, by, bz] of probes) {
        const blk = world.get(bx, by, bz);
        if (blk === BLOCKS.COFFEE_BAR) {
          return { title: '☕ Virtual Intel Campus Espresso Bar', msg: '▶ You brewed a fresh double-shot latte! Energy restored!' };
        }
        if (blk === BLOCKS.PINGPONG) {
          return { title: '🏓 Ping-Pong Table', msg: '▶ Rally time! Smashed a cross-court spin shot in the Relax Corner!' };
        }
        if (blk === BLOCKS.GYM_MACHINE) {
          return { title: '🏋️ Virtual Intel Campus Fitness Station', msg: '▶ Completed a quick workout set! Feeling stronger for the next floor!' };
        }
        if (blk === BLOCKS.YOGA_MAT) {
          return { title: '🧘 Forest Yoga Studio', msg: '▶ Deep breath on the yoga mat... +10 Calmness!' };
        }
        if (blk === BLOCKS.ELEVATOR) {
          return { title: '🛗 Virtual Intel Campus Lift Bank', msg: '▶ Tip: Use the Elevator Panel on the top-right to jump to any unlocked Floor (F1–F6)!' };
        }
        if (blk === BLOCKS.LOCKER) {
          return { title: '🔐 Fitness Locker Cubbies', msg: '▶ Stored gym bag safely in the Virtual Intel Campus Fitness Lockers.' };
        }
      }
      return null;
    }

    function triggerItem(item) {
      if (!item) return;
      sfx.ensure();
      if (item.toolAction === 'open_circuit') {
        item.trigger(sfx, playerPos);
        spawnParticles(item.group.position.x, item.group.position.y + 0.8, item.group.position.z, '#38bdf8', 14);
        openCircuitReader();
        return;
      }
      if (item.toolAction === 'start_meeting') {
        item.trigger(sfx, playerPos);
        spawnParticles(item.group.position.x, item.group.position.y + 0.8, item.group.position.z, '#4ade80', 16);
        startTeamMeeting({ x: item.group.position.x, y: item.group.position.y, z: item.group.position.z });
        return;
      }
      if (item.toolAction === 'trigger_cheers') {
        item.trigger(sfx, playerPos);
        triggerCheers();
        return;
      }
      const msg = item.trigger(sfx, playerPos);
      spawnParticles(item.group.position.x, item.group.position.y + 0.5, item.group.position.z, '#fde047', 14);
      openPropDialog(`✨ ${item.name}`, msg);
      pushChat('', msg, true);
    }

    function performPrimaryAction() {
      if (isDialogOpen()) {
        closeDialog();
        return;
      }
      if (hoveredNpc) {
        openNpcDialog(hoveredNpc);
        return;
      }
      if (hoveredItem) {
        triggerItem(hoveredItem);
        return;
      }
      const nearNpc = crowd.getNearestTalkable(playerPos, 3.2);
      const nearItem = itemManager.getNearestItem(playerPos, 3.8);
      if (nearNpc && (!nearItem || nearNpc.pos.distanceTo(playerPos) <= nearItem.group.position.distanceTo(playerPos))) {
        openNpcDialog(nearNpc);
        return;
      }
      if (nearItem) {
        triggerItem(nearItem);
        return;
      }
      const prop = checkFacingProp();
      if (prop) {
        openPropDialog(prop.title, prop.msg);
        return;
      }
      const curFl = world.getFloorAtY(playerPos.y);
      showToast(`Walk up to any person, ${curFl.uniqueItem}, coffee bar, or gym station and press [E]!`, true);
    }

    function teleportToFloor(floorObj, announce = true) {
      const user = roster.getActiveUser();
      const maxAllowed = world.getMaxAllowedFloorObj(user.level);
      if (floorObj.level > maxAllowed.level) {
        sfx.denied();
        showToast(`🔒 Access Denied: Floor ${floorObj.level} (${floorObj.shortName}) requires Floor ${floorObj.level}+. Your access: Floor ${user.level}.`, true);
        return false;
      }
      closeDialog();
      viewedFloorObj = floorObj;
      clearWalkPath();
      playerPos.set(34.0, floorObj.standY, 13.0);
      playerVel.set(0, 0, 0);
      yaw = Math.PI;
      if (cameraMode !== 2 && sliceFloors) rebuildWorldMesh();
      if (announce) {
        sfx.elevator();
        pushChat('', `🛗 Floor ${floorObj.level} — ${floorObj.shortName} | Unique Item: ${floorObj.uniqueItem}`, true);
      }
      rebuildStairMarkers(viewedFloorObj.level, maxAllowed.level);
      renderFloorButtons();
      return true;
    }

    function applyActiveUserState(teleportToAssigned = false) {
      const user = roster.getActiveUser();
      const maxFloor = world.getMaxAllowedFloorObj(user.level);
      world.applyAccessLevel(maxFloor.level);
      crowd.rebuildNav();
      rebuildLocalAvatar(user);
      crowd.syncUsers(roster.users, user.name);

      if (teleportToAssigned || playerPos.y > maxFloor.standY + 2) {
        viewedFloorObj = maxFloor;
        clearWalkPath();
        playerPos.set(34.0, maxFloor.standY, 13.0);
        playerVel.set(0, 0, 0);
        yaw = Math.PI;
      }

      rebuildWorldMesh();
      rebuildStairMarkers(viewedFloorObj.level, maxFloor.level);
      renderUserHud();
      renderFloorButtons();
      renderRosterList();
    }

    // =========================================================================
    // Live Multi-User Sync:
    //   1) Firebase Realtime DB (if URL set)
    //   2) Local server.py (/api/sync, when running locally)
    //   3) Zero-Account Public WSS Live Room (MQTT over WebSocket — works on github.io!)
    // =========================================================================
    const DEFAULT_FIREBASE_URL = '';
    const FB_STORAGE_KEY = 'pg17_firebase_url_v1';
    const ROOM_STORAGE_KEY = 'pg17_live_room_v1';
    const DEFAULT_ROOM_ID = 'intel-campus-live';
    const MQTT_BROKERS = [
      'wss://broker.emqx.io:8084/mqtt',
      'wss://broker.hivemq.com:8884/mqtt',
    ];

    function normalizeFirebaseUrl(raw) {
      const s = String(raw || '').trim().replace(/\/+$/, '');
      if (!s) return '';
      if (!/^https:\/\/[a-z0-9.-]+$/i.test(s)) return '';
      return s;
    }

    function normalizeRoomId(raw) {
      const clean = String(raw || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 32);
      return clean || DEFAULT_ROOM_ID;
    }

    const searchParams = new URLSearchParams(location.search);
    const urlParamFb = searchParams.get('fb');
    const urlParamRoom = searchParams.get('room');
    let firebaseUrl = normalizeFirebaseUrl(urlParamFb || localStorage.getItem(FB_STORAGE_KEY) || DEFAULT_FIREBASE_URL);
    let roomId = normalizeRoomId(urlParamRoom || localStorage.getItem(ROOM_STORAGE_KEY) || DEFAULT_ROOM_ID);
    if (urlParamFb && firebaseUrl) {
      try { localStorage.setItem(FB_STORAGE_KEY, firebaseUrl); } catch (e) { /* ignore */ }
    }
    if (urlParamRoom) {
      try { localStorage.setItem(ROOM_STORAGE_KEY, roomId); } catch (e) { /* ignore */ }
    }

    const myClientId = 'p_' + Math.random().toString(36).slice(2, 10);
    let lastChatId = 0;
    const seenFirebaseChats = new Set();
    let lastRosterSyncTs = 0;
    let isApplyingRemoteRoster = false;
    const isLocalPythonHost = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') && !/\.aspx$/i.test(location.pathname);
    let syncEnabled = !firebaseUrl && isLocalPythonHost;

    const fbInputEl = document.getElementById('firebase-url-input');
    const fbStatusEl = document.getElementById('firebase-status');
    const roomInputEl = document.getElementById('room-id-input');
    const liveRoomBadgeEl = document.getElementById('live-room-badge');
    if (fbInputEl) fbInputEl.value = firebaseUrl;
    if (roomInputEl) roomInputEl.value = roomId;

    function updateSyncStatus(text, ok = false) {
      if (fbStatusEl) {
        fbStatusEl.textContent = text;
        fbStatusEl.style.color = ok ? '#4ade80' : '#94a3b8';
      }
      if (liveRoomBadgeEl) {
        liveRoomBadgeEl.textContent = text;
        liveRoomBadgeEl.style.color = ok ? '#4ade80' : '#94a3b8';
      }
    }

    // Zero-Account MQTT-over-WSS Live Room Manager
    let mqttClient = null;
    let mqttBrokerIdx = 0;
    let mqttConnected = false;
    let mqttFallbackTimer = null;
    const mqttPeers = new Map(); // id -> { id, name, level, x, y, z, yaw, ts }

    function topicPrefix() {
      return `vcampus_intel/${roomId}`;
    }

    function disconnectMqtt() {
      if (mqttFallbackTimer) { clearTimeout(mqttFallbackTimer); mqttFallbackTimer = null; }
      if (mqttClient) {
        try {
          if (mqttConnected) {
            mqttClient.publish(`${topicPrefix()}/pos`, JSON.stringify({ id: myClientId, bye: true }));
          }
          mqttClient.end(true);
        } catch (e) { /* ignore */ }
        mqttClient = null;
      }
      mqttConnected = false;
      mqttPeers.clear();
    }

    function connectMqttRoom() {
      disconnectMqtt();
      if (firebaseUrl || syncEnabled) return;
      if (typeof global.mqtt === 'undefined') {
        updateSyncStatus('Live Room unavailable offline', false);
        return;
      }
      const brokerUrl = MQTT_BROKERS[mqttBrokerIdx % MQTT_BROKERS.length];
      updateSyncStatus(`Connecting Room "${roomId}"...`, false);

      try {
        const client = global.mqtt.connect(brokerUrl, {
          clientId: `vc_${myClientId}_${Math.floor(Math.random() * 999)}`,
          clean: true,
          connectTimeout: 6000,
          reconnectPeriod: 4000,
        });
        mqttClient = client;

        mqttFallbackTimer = setTimeout(() => {
          if (!mqttConnected && mqttClient === client) {
            mqttBrokerIdx = (mqttBrokerIdx + 1) % MQTT_BROKERS.length;
            connectMqttRoom();
          }
        }, 6500);

        client.on('connect', () => {
          if (mqttClient !== client) return;
          mqttConnected = true;
          if (mqttFallbackTimer) { clearTimeout(mqttFallbackTimer); mqttFallbackTimer = null; }
          const pfx = topicPrefix();
          client.subscribe([`${pfx}/pos`, `${pfx}/chat`, `${pfx}/roster`, `${pfx}/event`]);
          updateSyncStatus(`🟢 Live Room: ${roomId}`, true);
          publishMqttPos();
        });

        client.on('message', (topic, payloadBuf) => {
          try {
            const msg = JSON.parse(payloadBuf.toString());
            const pfx = topicPrefix();
            if (topic === `${pfx}/pos`) {
              if (!msg || !msg.id || msg.id === myClientId) return;
              if (msg.bye) {
                mqttPeers.delete(msg.id);
              } else {
                mqttPeers.set(msg.id, { ...msg, ts: Date.now() });
              }
            } else if (topic === `${pfx}/chat`) {
              if (!msg || msg.id === myClientId || !msg.text) return;
              const me = roster.getActiveUser();
              pushChat(msg.sender, msg.text, false, true);
              if (msg.target && msg.target.toLowerCase() === me.name.toLowerCase()) {
                openPropDialog(`💬 Message from ${msg.sender}`, msg.text);
              }
            } else if (topic === `${pfx}/roster`) {
              if (msg && Array.isArray(msg.users) && msg.users.length > 0 && (msg.updatedAt || 0) > lastRosterSyncTs) {
                lastRosterSyncTs = msg.updatedAt;
                isApplyingRemoteRoster = true;
                roster.users = msg.users;
                if (msg.pinHash) roster.applyRemotePinHash(msg.pinHash);
                origRosterSave(false);
                isApplyingRemoteRoster = false;
              }
            } else if (topic === `${pfx}/event`) {
              if (!msg || msg.id === myClientId) return;
              handleRemoteCampusEvent(msg);
            }
          } catch (e) { /* ignore malformed packet */ }
        });

        client.on('error', () => {
          if (mqttClient === client && !mqttConnected) {
            updateSyncStatus(`Retrying Room "${roomId}"...`, false);
          }
        });
      } catch (e) {
        updateSyncStatus('Live Room error', false);
      }
    }

    function publishMqttPos() {
      if (!mqttClient || !mqttConnected) return;
      const me = roster.getActiveUser();
      mqttClient.publish(`${topicPrefix()}/pos`, JSON.stringify({
        id: myClientId,
        name: me.name,
        level: me.level,
        x: Number(playerPos.x.toFixed(2)),
        y: Number(playerPos.y.toFixed(2)),
        z: Number(playerPos.z.toFixed(2)),
        yaw: Number((yaw + Math.PI).toFixed(2)),
      }));
    }

    window.addEventListener('beforeunload', () => {
      if (mqttClient && mqttConnected) {
        try {
          mqttClient.publish(`${topicPrefix()}/pos`, JSON.stringify({ id: myClientId, bye: true }));
        } catch (e) { /* ignore */ }
      }
    });

    async function pushRosterShared() {
      if (isApplyingRemoteRoster || !roster.isSuperUser) return;
      const ts = Date.now();
      lastRosterSyncTs = ts;
      const payload = { updatedAt: ts, users: roster.users, pinHash: roster.pinHash };
      if (mqttClient && mqttConnected) {
        try {
          mqttClient.publish(
            `${topicPrefix()}/roster`,
            JSON.stringify(payload),
            { retain: true }
          );
        } catch (e) { /* ignore */ }
        return;
      }
      if (!firebaseUrl) return;
      try {
        await fetch(`${firebaseUrl}/roster.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) { /* ignore */ }
    }

    async function sendLiveChat(sender, text, target = '') {
      if (mqttClient && mqttConnected) {
        try {
          mqttClient.publish(`${topicPrefix()}/chat`, JSON.stringify({
            id: myClientId,
            sender,
            text,
            target,
            ts: Date.now(),
          }));
        } catch (e) { /* ignore */ }
        return;
      }
      if (firebaseUrl) {
        try {
          await fetch(`${firebaseUrl}/chats.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sender, text, target, ts: Date.now() }),
          });
        } catch (e) { /* ignore */ }
        return;
      }
      if (!syncEnabled) return;
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender, text, target }),
        });
        if (!r.ok) syncEnabled = false;
      } catch (e) { syncEnabled = false; }
    }

    // Hook roster changes to sync shared Excel list (Super User authoritative edits only!)
    const origRosterSave = roster.save.bind(roster);
    roster.save = function (broadcast = false) {
      origRosterSave(broadcast);
      if (broadcast && roster.isSuperUser) {
        pushRosterShared();
      }
    };

    // Start Zero-Account MQTT Live Room automatically on static hosts (github.io, sharepoint, etc.)
    if (!firebaseUrl && !syncEnabled) {
      connectMqttRoom();
    } else if (firebaseUrl) {
      updateSyncStatus('Connecting to Firebase...', true);
    }

    // MQTT Broadcast & Stale-Peer Pruning Loop (280ms)
    setInterval(() => {
      if (!mqttClient || !mqttConnected) return;
      publishMqttPos();
      const nowTs = Date.now();
      const active = [];
      for (const [id, p] of mqttPeers.entries()) {
        if (nowTs - (p.ts || 0) > 8500) {
          mqttPeers.delete(id);
        } else {
          active.push(p);
        }
      }
      crowd.syncRemotePlayers(active, myClientId);
      updateSyncStatus(`🟢 Live Room: ${roomId} (${active.length + 1} online)`, true);
    }, 280);

    // Firebase Realtime Sync Loop (380ms, only when Firebase URL configured)
    setInterval(async () => {
      if (!firebaseUrl) return;
      try {
        const me = roster.getActiveUser();
        const nowTs = Date.now();
        await fetch(`${firebaseUrl}/players/${myClientId}.json`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: myClientId,
            name: me.name,
            level: me.level,
            x: playerPos.x,
            y: playerPos.y,
            z: playerPos.z,
            yaw: yaw + Math.PI,
            ts: nowTs,
          }),
        });

        const [pRes, cRes, rRes] = await Promise.all([
          fetch(`${firebaseUrl}/players.json`),
          fetch(`${firebaseUrl}/chats.json`),
          fetch(`${firebaseUrl}/roster.json`),
        ]);
        if (!pRes.ok) {
          updateSyncStatus(`Firebase error (${pRes.status}) — check Rules`, false);
          return;
        }
        const pData = (await pRes.json()) || {};
        const active = Object.values(pData).filter((p) => p && nowTs - (p.ts || 0) < 9000);
        crowd.syncRemotePlayers(active, myClientId);
        updateSyncStatus(`🟢 Firebase Live (${active.length} online)`, true);

        const cData = cRes.ok ? ((await cRes.json()) || {}) : {};
        const myTag = `${me.name} @F${world.getFloorAtY(playerPos.y).level}`;
        const entries = Object.entries(cData).sort((a, b) => (a[1]?.ts || 0) - (b[1]?.ts || 0)).slice(-30);
        for (const [key, c] of entries) {
          if (!c || seenFirebaseChats.has(key)) continue;
          seenFirebaseChats.add(key);
          if (nowTs - (c.ts || 0) < 600000 && c.sender !== myTag && c.sender !== `${me.name} [F${me.level}]`) {
            pushChat(c.sender, c.text, false, true);
            if (c.target && c.target.toLowerCase() === me.name.toLowerCase()) {
              openPropDialog(`💬 Message from ${c.sender}`, c.text);
            }
          }
        }

        if (rRes.ok) {
          const rData = await rRes.json();
          if (rData && Array.isArray(rData.users) && rData.users.length > 0 && (rData.updatedAt || 0) > lastRosterSyncTs) {
            lastRosterSyncTs = rData.updatedAt;
            isApplyingRemoteRoster = true;
            roster.users = rData.users;
            if (rData.pinHash) roster.applyRemotePinHash(rData.pinHash);
            origRosterSave(false);
            isApplyingRemoteRoster = false;
          }
        }
      } catch (e) {
        updateSyncStatus('Firebase unreachable', false);
      }
    }, 380);

    // Local Python server.py Sync Loop (only when running on localhost/127.0.0.1 server.py)
    const syncTimer = setInterval(async () => {
      if (firebaseUrl || !syncEnabled) {
        if (!syncEnabled) clearInterval(syncTimer);
        return;
      }
      try {
        const me = roster.getActiveUser();
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: myClientId,
            name: me.name,
            level: me.level,
            x: playerPos.x,
            y: playerPos.y,
            z: playerPos.z,
            yaw: yaw + Math.PI,
            sinceChatId: lastChatId,
          }),
        });
        if (!res.ok) {
          syncEnabled = false;
          clearInterval(syncTimer);
          connectMqttRoom();
          return;
        }
        const data = await res.json();
        if (Array.isArray(data.players)) {
          crowd.syncRemotePlayers(data.players, myClientId);
          updateSyncStatus(`🟢 Local Server (${data.players.length} online)`, true);
        }
        if (Array.isArray(data.chats)) {
          for (const c of data.chats) {
            lastChatId = Math.max(lastChatId, c.id);
            const myTag = `${me.name} [F${me.level}]`;
            if (c.sender !== myTag) {
              pushChat(c.sender, c.text);
              if (c.target && c.target.toLowerCase() === me.name.toLowerCase()) {
                openPropDialog(`💬 Message from ${c.sender}`, c.text);
              }
            }
          }
        }
      } catch (e) {
        syncEnabled = false;
        clearInterval(syncTimer);
        connectMqttRoom();
      }
    }, 300);

    // UI Elements
    const hudUserEl = document.getElementById('hud-user-badge');
    const hudUpgradeEl = document.getElementById('hud-upgrade-note');
    const floorLandmarkEl = document.getElementById('floor-landmark-badge');
    const floorBtnsEl = document.getElementById('floor-buttons');
    const rosterListEl = document.getElementById('roster-list');
    const rosterSummaryEl = document.getElementById('roster-summary');
    const itemPromptEl = document.getElementById('item-prompt');
    const comfortTipEl = document.getElementById('comfort-tip');
    const crosshairEl = document.getElementById('crosshair');

    function renderUserHud() {
      const user = roster.getActiveUser();
      const maxFloor = world.getMaxAllowedFloorObj(user.level);
      const nextLvl = nextUpgradeLevel(user.level);
      const crown = roster.isSuperUser ? '👑 ' : '';
      hudUserEl.innerHTML = `<strong>${crown}${escapeHtml(user.name)}</strong> • Access Floor ${user.level} <span class="badge-pill" style="background:${maxFloor.accent};color:#0f172a">F1 → F${maxFloor.level}</span>`;
      if (roster.isSuperUser) {
        hudUpgradeEl.textContent = '👑 Super User Mode: Full F1–F6 access & floor control unlocked.';
      } else if (maxFloor.level >= 6) {
        hudUpgradeEl.textContent = `✨ Top Floor Unlocked! Full access to Floors 1 → 6.`;
      } else {
        const nextObj = PG17_LEVELS.find((l) => l.level === nextLvl);
        hudUpgradeEl.textContent = `⬆️ Floor ${nextLvl} (${nextObj ? nextObj.shortName : ''}) requires Super User grant.`;
      }

      const btnDrawer = document.getElementById('btn-toggle-drawer');
      const btnUp = document.getElementById('btn-level-up-me');
      btnUp.style.display = roster.isSuperUser ? 'block' : 'none';
      btnDrawer.classList.toggle('wide', !roster.isSuperUser);
      btnDrawer.textContent = roster.isSuperUser ? 'Admin / Users [U]' : 'Login / Live Room [U]';
      btnUp.disabled = maxFloor.level >= 6;
      btnUp.textContent = maxFloor.level >= 6 ? 'Max Floor (F6)' : `Level Up Me → F${nextLvl}`;

      // Toggle Super User controls in drawer
      const unlockForm = document.getElementById('super-unlock-form');
      const superActiveBox = document.getElementById('super-active-controls');
      const superTitle = document.getElementById('super-user-title');
      if (unlockForm && superActiveBox && superTitle) {
        unlockForm.style.display = roster.isSuperUser ? 'none' : 'flex';
        superActiveBox.style.display = roster.isSuperUser ? 'flex' : 'none';
        superTitle.textContent = roster.isSuperUser ? '👑 Super User Control (Unlocked)' : '👑 Super User Control (Locked)';
      }
      document.querySelectorAll('.admin-only').forEach((el) => {
        el.style.display = roster.isSuperUser ? '' : 'none';
      });
    }

    function renderFloorButtons() {
      const user = roster.getActiveUser();
      const maxFloor = world.getMaxAllowedFloorObj(user.level);
      const currentStanding = world.getFloorAtY(playerPos.y);
      const activeView = cameraMode !== 2 ? viewedFloorObj : currentStanding;

      const floorItems = itemManager.getByLevel(activeView.level);
      floorLandmarkEl.innerHTML = '';
      const hdr = document.createElement('span');
      hdr.textContent = `F${activeView.level} Items (${floorItems.length}):`;
      floorLandmarkEl.appendChild(hdr);
      floorItems.forEach((it) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'floor-item-chip';
        chip.textContent = `✨ ${it.name}`;
        chip.title = `Go to / interact with ${it.name} (${it.actionLabel})`;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          if (Math.abs(it.group.position.y - playerPos.y) > 2.5) {
            if (!teleportToFloor(activeView, false)) return;
          }
          const d = Math.hypot(it.group.position.x - playerPos.x, it.group.position.z - playerPos.z);
          if (d < 3.6) {
            triggerItem(it);
          } else {
            const ok = setSmartWalkTarget(it.group.position.x, it.group.position.z);
            if (ok) showToast(`🧭 Walking to ${it.name} — click or press [E] to ${it.actionLabel}!`, false);
            else triggerItem(it);
          }
        });
        floorLandmarkEl.appendChild(chip);
      });

      floorBtnsEl.innerHTML = '';
      [...PG17_LEVELS].reverse().forEach((lvl) => {
        const unlocked = lvl.level <= maxFloor.level;
        const isCurrent = activeView.level === lvl.level;
        const btn = document.createElement('button');
        btn.className = `floor-btn ${unlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''}`;
        btn.innerHTML = `<span class="fl-code">${lvl.code}</span><span class="fl-name">${lvl.shortName}</span><span class="fl-icon">${unlocked ? (isCurrent ? '●' : '✓') : '🔒'}</span>`;
        btn.title = unlocked ? `${lvl.shortName} • ${lvl.uniqueItem}` : `Locked: Requires Floor ${lvl.level}+`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          teleportToFloor(lvl, true);
        });
        floorBtnsEl.appendChild(btn);
      });
    }

    function renderRosterList() {
      const active = roster.getActiveUser();
      rosterSummaryEl.textContent = roster.isSuperUser
        ? `${roster.users.length} Users (Super User Can Change Floors)`
        : `${roster.users.length} Users (Floor Access Managed by Super User)`;
      rosterListEl.innerHTML = '';

      // Show live online guests not yet in roster so Super User can grant them floor access immediately
      if (roster.isSuperUser) {
        const seenGuests = new Set();
        for (const r of crowd.remotePlayers.values()) {
          const rKey = r.name.toLowerCase();
          if (roster.findUser(r.name) || seenGuests.has(rKey)) continue;
          seenGuests.add(rKey);
          const gRow = document.createElement('div');
          gRow.className = 'roster-row';
          gRow.style.borderColor = 'rgba(56, 189, 248, 0.55)';
          gRow.innerHTML = `
            <div class="roster-info">
              <span class="roster-name">🟢 ${escapeHtml(r.name)} (Online Guest)</span>
              <span class="roster-meta">Currently Floor ${r.level} — Select floor to grant access</span>
            </div>
            <div class="roster-actions">
              <select class="lvl-select" title="Grant ${escapeHtml(r.name)} floor access">
                ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${r.level === n ? 'selected' : ''}>F${n}</option>`).join('')}
              </select>
            </div>
          `;
          gRow.querySelector('.lvl-select').addEventListener('change', (e) => {
            const newLvl = parseInt(e.target.value, 10);
            const updated = roster.addOrUpdateUser(r.name, newLvl, 'Live Member');
            if (updated) {
              sfx.levelUp();
              showToast(`👑 Granted ${updated.name} access to Floor ${updated.level} — synced live!`, false);
            }
          });
          rosterListEl.appendChild(gRow);
        }
      }

      const sorted = [...roster.users].sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
      sorted.forEach((u) => {
        const isMe = u.name.toLowerCase() === active.name.toLowerCase();
        const maxFl = world.getMaxAllowedFloorObj(u.level);
        const row = document.createElement('div');
        row.className = 'roster-row' + (isMe ? ' active-me' : '');
        const adminControls = roster.isSuperUser
          ? `<select class="lvl-select" title="Change ${escapeHtml(u.name)} floor access">
              ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${u.level === n ? 'selected' : ''}>F${n}</option>`).join('')}
            </select>
            <button class="mini-btn del-btn" title="Remove">✕</button>`
          : '';
        row.innerHTML = `
          <div class="roster-info">
            <span class="roster-name">${escapeHtml(u.name)}${isMe ? ' (You)' : ''}</span>
            <span class="roster-meta">Floor ${u.level} (Walk F1–F${maxFl.level}) • ${escapeHtml(u.role || 'Member')}</span>
          </div>
          <div class="roster-actions">
            <button class="mini-btn login-btn">${isMe ? 'Active' : 'Login'}</button>
            ${adminControls}
          </div>
        `;
        row.querySelector('.login-btn').addEventListener('click', () => {
          roster.login(u.name);
          applyActiveUserState(true);
          pushChat('', `🔑 Logged in as ${u.name} (Floor ${u.level} — walks F1..F${maxFl.level})`, true);
        });
        if (roster.isSuperUser) {
          row.querySelector('.lvl-select').addEventListener('change', (e) => {
            const newLvl = parseInt(e.target.value, 10);
            const updated = roster.setUserLevel(u.name, newLvl);
            if (updated) {
              sfx.levelUp();
              const newFl = world.getMaxAllowedFloorObj(updated.level);
              showToast(`👑 Set ${updated.name} access to Floor ${updated.level} (${newFl.shortName}) — synced live!`, false);
              pushChat('', `👑 Super User set ${updated.name} floor access to Floor ${updated.level} (${newFl.shortName}).`, true);
            }
          });
          row.querySelector('.del-btn').addEventListener('click', () => {
            roster.removeUser(u.name);
          });
        }
        rosterListEl.appendChild(row);
      });
    }

    document.getElementById('btn-interact').addEventListener('click', (e) => {
      e.stopPropagation();
      performPrimaryAction();
    });
    itemPromptEl.addEventListener('click', (e) => {
      e.stopPropagation();
      performPrimaryAction();
    });

    // D-Pad Controls (Pokemon style!)
    const dpadState = { up: false, down: false, left: false, right: false };
    document.querySelectorAll('#pkmn-dpad .dpad-btn').forEach((btn) => {
      const dir = btn.dataset.dir;
      if (dir === 'act') {
        btn.addEventListener('click', (e) => { e.stopPropagation(); performPrimaryAction(); });
        return;
      }
      const down = (e) => { e.stopPropagation(); dpadState[dir] = true; clearWalkPath(); };
      const up = () => { dpadState[dir] = false; };
      btn.addEventListener('mousedown', down);
      btn.addEventListener('touchstart', down, { passive: true });
      window.addEventListener('mouseup', up);
      window.addEventListener('touchend', up);
    });

    // Drawer Controls
    const rosterDrawer = document.getElementById('roster-drawer');
    function setDrawerOpen(open) {
      drawerOpen = open;
      rosterDrawer.classList.toggle('open', drawerOpen);
      if (drawerOpen) renderRosterList();
    }
    document.getElementById('btn-toggle-drawer').addEventListener('click', (e) => {
      e.stopPropagation();
      setDrawerOpen(!drawerOpen);
    });
    document.getElementById('btn-close-drawer').addEventListener('click', () => setDrawerOpen(false));

    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const val = document.getElementById('login-name-input').value.trim();
      if (!val) return;
      const u = roster.login(val);
      document.getElementById('login-name-input').value = '';
      applyActiveUserState(true);
      const maxFl = world.getMaxAllowedFloorObj(u.level);
      showToast(`🔑 Logged in as ${u.name} (Floor ${u.level} — ${maxFl.shortName})`, false);
    });

    document.getElementById('add-user-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!roster.isSuperUser) {
        showToast('🔒 Only Super User can add or change floor access!', true);
        return;
      }
      const name = document.getElementById('add-name').value.trim();
      const level = document.getElementById('add-level').value;
      const role = document.getElementById('add-role').value.trim() || 'Member';
      if (!name) return;
      const u = roster.addOrUpdateUser(name, level, role);
      document.getElementById('add-name').value = '';
      document.getElementById('add-role').value = '';
      showToast(`👑 Saved ${u.name} on Floor ${u.level} (synced live)`, false);
    });

    document.getElementById('super-unlock-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const pinEl = document.getElementById('super-pin-input');
      const ok = roster.verifyAndUnlockSuperUser(pinEl.value);
      pinEl.value = '';
      if (ok) {
        sfx.levelUp();
        showToast('👑 Super User unlocked! You can now change everyone\'s floor access live.', false);
      } else {
        sfx.denied();
        showToast('🔒 Incorrect Super User PIN.', true);
      }
    });

    document.getElementById('btn-lock-super').addEventListener('click', () => {
      roster.lockSuperUser();
      showToast('🔒 Super User mode locked.', false);
    });

    document.getElementById('change-pin-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const npEl = document.getElementById('new-pin-input');
      if (roster.changeAdminPin(npEl.value)) {
        npEl.value = '';
        showToast('🔑 Super User PIN updated & synced!', false);
      } else {
        showToast('⚠️ PIN must be at least 4 characters.', true);
      }
    });

    document.getElementById('btn-level-up-me').addEventListener('click', (e) => {
      e.stopPropagation();
      const me = roster.getActiveUser();
      const updated = roster.levelUpUser(me.name);
      if (updated) {
        sfx.levelUp();
        const newFl = world.getMaxAllowedFloorObj(updated.level);
        showToast(`⬆️ Level Up! ${updated.name} reached Floor ${updated.level} (${newFl.shortName})!`, false);
        pushChat('', `✨ LEVEL UP! ${updated.name} unlocked Floor ${updated.level}: ${newFl.upgradeNote}`, true);
      }
    });

    const excelInput = document.getElementById('excel-file-input');
    document.getElementById('btn-upload-excel').addEventListener('click', () => excelInput.click());
    excelInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const count = await roster.importFile(file);
        applyActiveUserState(true);
        showToast(`📊 Imported ${count} users from ${file.name}!`, false);
      } catch (err) {
        showToast(`⚠️ Import error: ${err.message}`, true);
      }
      excelInput.value = '';
    });

    document.getElementById('btn-download-excel').addEventListener('click', () => {
      const fname = roster.exportExcelOrCsv();
      showToast(`💾 Downloaded ${fname}`, false);
    });
    document.getElementById('btn-reset-roster').addEventListener('click', () => {
      roster.resetDefaults();
      applyActiveUserState(true);
      showToast('🔄 Reset to default Floors 1–6 roster', false);
    });

    const roomForm = document.getElementById('room-form');
    if (roomForm) {
      roomForm.addEventListener('submit', (e) => {
        e.preventDefault();
        roomId = normalizeRoomId(roomInputEl.value);
        roomInputEl.value = roomId;
        try { localStorage.setItem(ROOM_STORAGE_KEY, roomId); } catch (err) { /* ignore */ }
        firebaseUrl = '';
        syncEnabled = false;
        connectMqttRoom();
        showToast(`🔗 Joined Live Room "${roomId}"!`, false);
      });
    }

    const fbForm = document.getElementById('firebase-form');
    if (fbForm) {
      fbForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const clean = normalizeFirebaseUrl(fbInputEl.value);
        if (!clean) {
          firebaseUrl = '';
          try { localStorage.removeItem(FB_STORAGE_KEY); } catch (err) { /* ignore */ }
          connectMqttRoom();
          showToast('Switched back to Zero-Account Live Room.', false);
          return;
        }
        disconnectMqtt();
        firebaseUrl = clean;
        fbInputEl.value = clean;
        try { localStorage.setItem(FB_STORAGE_KEY, clean); } catch (err) { /* ignore */ }
        updateSyncStatus('Connecting to Firebase...', true);
        showToast('🔗 Connected Firebase URL! Live multi-user sync active.', false);
      });
    }
    const copyLinkBtn = document.getElementById('btn-copy-share-link');
    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', async () => {
        const base = location.origin + location.pathname;
        const shareUrl = firebaseUrl
          ? `${base}?fb=${encodeURIComponent(firebaseUrl)}`
          : `${base}?room=${encodeURIComponent(roomId)}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast('📋 Copied live invite link!', false);
        } catch (err) {
          prompt('Copy this invite link:', shareUrl);
        }
      });
    }

    // Camera Mode, Zoom & Universal Floor Tools (Circuit Reader, Team Meeting, Cheers)
    const btnCamera = document.getElementById('btn-camera');
    const btnTime = document.getElementById('btn-time');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnCircuit = document.getElementById('btn-circuit');
    const btnMeeting = document.getElementById('btn-meeting');
    const btnCheers = document.getElementById('btn-cheers');

    let targetZoom = 1.0;
    let smoothZoom = 1.0;
    const MIN_ZOOM = 0.4;
    const MAX_ZOOM = 2.5;

    function setZoom(next) {
      targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
      if (btnZoomReset) {
        btnZoomReset.textContent = `${Math.round(100 / targetZoom)}%`;
      }
    }

    function updateButtons() {
      btnCamera.textContent = `View: ${CAMERA_MODES[cameraMode]} [C]`;
      btnTime.textContent = `${isNight ? 'Night' : 'Day'} [T]`;
      if (btnZoomReset) {
        btnZoomReset.textContent = `${Math.round(100 / targetZoom)}%`;
      }

      if (cameraMode === 0) {
        comfortTipEl.innerHTML = '<strong>Campus 3/4:</strong> Scroll/+/- zoom. Click floor to walk, [M] Meet, [H] Cheers, [E] Interact!';
        crosshairEl.style.display = 'none';
      } else if (cameraMode === 1) {
        comfortTipEl.innerHTML = '<strong>Top-Down Map:</strong> Scroll/+/- zoom out/in. Click floor to walk, [M] Meet, [H] Cheers!';
        crosshairEl.style.display = 'none';
      } else {
        comfortTipEl.innerHTML = '<strong>1st Person:</strong> Drag or A/D to look 360°, Scroll/+/- to zoom. [C] to walk again.';
        crosshairEl.style.display = 'block';
      }
    }

    function cycleCameraMode() {
      cameraMode = (cameraMode + 1) % 3;
      if (cameraMode === 2) {
        clearWalkPath();
        localAvatar.group.visible = false;
        sliceFloors = false;
      } else {
        localAvatar.group.visible = true;
        sliceFloors = true;
      }
      viewedFloorObj = world.getFloorAtY(playerPos.y);
      rebuildWorldMesh();
      updateButtons();
      renderFloorButtons();
    }

    function toggleTimeOfDay() {
      isNight = !isNight;
      if (isNight) {
        scene.background.setHex(0x0f172a);
        scene.fog.color.setHex(0x0f172a);
        hemiLight.intensity = 0.42;
        sunLight.intensity = 0.30;
        pointLights.forEach((l) => (l.intensity = 0.72));
      } else {
        scene.background.setHex(0x93c5fd);
        scene.fog.color.setHex(0x93c5fd);
        hemiLight.intensity = 0.94;
        sunLight.intensity = 0.85;
        pointLights.forEach((l) => (l.intensity = 0.38));
      }
      updateButtons();
    }

    // --- Universal Tools (All Floors F1-F6): circuit.intel.com Reader, Team Meeting & Cheers ---
    function publishCampusEvent(evt) {
      if (!mqttClient || !mqttConnected) return;
      try {
        mqttClient.publish(`${topicPrefix()}/event`, JSON.stringify({
          ...evt,
          id: myClientId,
          ts: Date.now(),
        }));
      } catch (e) { /* ignore */ }
    }

    const CONFETTI_COLORS = ['#fde047', '#38bdf8', '#4ade80', '#f472b6', '#fb923c', '#a855f7'];
    function spawnConfettiBurst(cx, cy, cz) {
      CONFETTI_COLORS.forEach((c) => spawnParticles(cx, cy + 0.6, cz, c, 8));
    }

    function triggerCheers(fromRemote = null) {
      sfx.cheer();
      if (fromRemote) {
        spawnConfettiBurst(fromRemote.x || playerPos.x, fromRemote.y || playerPos.y, fromRemote.z || playerPos.z);
        crowd.cheerAllOnFloor(fromRemote.y || playerPos.y, 3.8);
        const msg = `🥂 ${fromRemote.name} cheers from Floor ${fromRemote.level}: Let's celebrate! 🎉`;
        showToast(msg, false);
        pushChat('', msg, true);
        return;
      }
      const me = roster.getActiveUser();
      const fl = world.getFloorAtY(playerPos.y);
      localCheerTimer = 3.8;
      crowd.cheerAllOnFloor(fl.standY, 3.8);
      spawnConfettiBurst(playerPos.x, playerPos.y, playerPos.z);
      for (const npc of crowd.npcs) {
        if (Math.abs(npc.pos.y - fl.standY) < 2.5) {
          spawnParticles(npc.pos.x, npc.pos.y + 0.6, npc.pos.z, CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)], 6);
        }
      }
      const msg = `🥂 ${me.name} raised a glass on Floor ${fl.level} (${fl.shortName}): CHEERS! 🎉`;
      showToast(msg, false);
      pushChat('', msg, true);
      publishCampusEvent({
        type: 'cheers',
        name: me.name,
        level: fl.level,
        x: Number(playerPos.x.toFixed(2)),
        y: Number(playerPos.y.toFixed(2)),
        z: Number(playerPos.z.toFixed(2)),
      });
    }

    const meetingBanner = document.getElementById('meeting-banner');
    const meetingStatusText = document.getElementById('meeting-status-text');
    const btnMeetingNote = document.getElementById('btn-meeting-note');
    const btnMeetingCheers = document.getElementById('btn-meeting-cheers');
    const btnMeetingEnd = document.getElementById('btn-meeting-end');
    let meetingTimeout = null;

    // Team Meeting stays strictly inside the local 3D map (gathers virtual map avatars only, never calls real users)
    function startTeamMeeting(customCenter = null) {
      const center = customCenter || { x: playerPos.x, y: playerPos.y, z: playerPos.z };
      const fl = world.getFloorAtY(center.y);
      const count = crowd.gatherForMeeting(center, fl, 30);
      if (meetingStatusText) {
        meetingStatusText.textContent = `👥 Map Huddle on Floor ${fl.level} (${count} map bots gathered)`;
      }
      if (meetingBanner) meetingBanner.classList.add('open');
      if (meetingTimeout) clearTimeout(meetingTimeout);
      meetingTimeout = setTimeout(() => {
        if (meetingBanner) meetingBanner.classList.remove('open');
      }, 30000);

      sfx.elevator();
      spawnParticles(center.x, center.y + 0.5, center.z, '#4ade80', 18);
      const msg = `👥 Map Team Huddle on Floor ${fl.level} (${fl.shortName}) — gathered ${count} map characters inside the campus!`;
      showToast(msg, false);
      pushChat('', msg, true);
    }

    function endTeamMeeting() {
      crowd.endMeeting();
      if (meetingTimeout) { clearTimeout(meetingTimeout); meetingTimeout = null; }
      if (meetingBanner) meetingBanner.classList.remove('open');
      showToast('👥 Map Huddle ended — characters returned to patrolling.', false);
    }

    function handleRemoteCampusEvent(evt) {
      if (evt.type === 'cheers') {
        triggerCheers(evt);
      }
    }

    if (btnMeetingNote) {
      btnMeetingNote.addEventListener('click', () => {
        const note = prompt('Add local Map Huddle note to Campus Wall:');
        if (note && note.trim()) {
          const me = roster.getActiveUser();
          const fl = world.getFloorAtY(playerPos.y).level;
          const full = `📋 [Map Huddle Note] ${note.trim()}`;
          pushChat(`${me.name} @F${fl}`, full);
          showToast('📋 Note posted locally on your Campus Wall!', false);
        }
      });
    }
    if (btnMeetingCheers) btnMeetingCheers.addEventListener('click', () => triggerCheers());
    if (btnMeetingEnd) btnMeetingEnd.addEventListener('click', () => endTeamMeeting());

    // circuit.intel.com Reader Modal
    const CIRCUIT_ARTICLES = [
      {
        title: 'Intel Foundry & Next-Gen Silicon Milestones on Circuit',
        tag: 'Engineering • circuit.intel.com',
        date: 'Latest Digest',
        summary: 'Teams across Malaysia, Hillsboro, and Israel celebrate RibbonFET & PowerVia ramp milestones with automated packaging breakthroughs.',
      },
      {
        title: 'Virtual Intel Campus (F1–F6): Interactive Collaboration Spaces',
        tag: 'Penang PG17 • Campus Life',
        date: 'Featured',
        summary: 'Explore Floors 1–6 including Sports Track & Pitch, Forest Yoga Studio, Ocean Lounge, Industrial Main Gym, and Floor 6 VIP Map Sky Lounge.',
      },
      {
        title: 'Core Ultra AI PC & Edge Developer Hackathon Highlights',
        tag: 'AI & Software • Innovation',
        date: 'This Week',
        summary: 'See how engineers build ultra-responsive local AI assistants and real-time 3D interactive tools running seamlessly at the edge.',
      },
      {
        title: 'Wellness, Fitness & Sustainability Across Campus',
        tag: 'People & Planet • Circuit',
        date: 'Community',
        summary: 'Join Floor 2 Sprint Track, Floor 3 Yoga & Spin Studios, Floor 4 Ping-Pong Relax Corner, and Floor 5 Gym challenges with your team!',
      },
    ];

    const circuitModal = document.getElementById('circuit-modal');
    const circuitDigestBody = document.getElementById('circuit-digest-body');
    const circuitIframeWrap = document.getElementById('circuit-iframe-wrap');
    const circuitIframe = document.getElementById('circuit-iframe');
    const tabDigest = document.getElementById('tab-circuit-digest');
    const tabLive = document.getElementById('tab-circuit-live');

    function renderCircuitDigest() {
      if (!circuitDigestBody) return;
      circuitDigestBody.innerHTML = '';
      CIRCUIT_ARTICLES.forEach((art) => {
        const card = document.createElement('div');
        card.className = 'circuit-article';
        card.innerHTML = `
          <div class="circuit-meta"><span>${art.tag}</span><span>${art.date}</span></div>
          <h4>${art.title}</h4>
          <p>${art.summary}</p>
          <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;">
            <a href="https://circuit.intel.com/" target="_blank" rel="noopener noreferrer" class="mini-btn" style="background:#0068b5;color:#fff;text-decoration:none;">Read on circuit.intel.com ↗</a>
            <button type="button" class="mini-btn share-circuit-btn">📢 Share to Campus Wall</button>
          </div>
        `;
        card.querySelector('.share-circuit-btn').addEventListener('click', () => {
          const me = roster.getActiveUser();
          const fl = world.getFloorAtY(playerPos.y).level;
          const text = `📰 Reading on circuit.intel.com: "${art.title}"`;
          pushChat(`${me.name} @F${fl}`, text);
          sendLiveChat(`${me.name} @F${fl}`, text);
          showToast('📢 Shared Circuit headline to Campus Wall!', false);
        });
        circuitDigestBody.appendChild(card);
      });
    }

    function openCircuitReader() {
      renderCircuitDigest();
      if (circuitModal) circuitModal.classList.add('open');
      sfx.blip();
    }
    function closeCircuitReader() {
      if (circuitModal) circuitModal.classList.remove('open');
    }

    if (tabDigest && tabLive && circuitDigestBody && circuitIframeWrap) {
      tabDigest.addEventListener('click', () => {
        circuitDigestBody.style.display = 'flex';
        circuitIframeWrap.classList.remove('active');
        tabDigest.style.background = '#0284c7'; tabDigest.style.color = '#fff';
        tabLive.style.background = ''; tabLive.style.color = '';
      });
      tabLive.addEventListener('click', () => {
        circuitDigestBody.style.display = 'none';
        circuitIframeWrap.classList.add('active');
        if (circuitIframe && !circuitIframe.src) {
          circuitIframe.src = 'https://circuit.intel.com/';
        }
        tabLive.style.background = '#0284c7'; tabLive.style.color = '#fff';
        tabDigest.style.background = ''; tabDigest.style.color = '';
      });
    }
    const btnCloseCircuit = document.getElementById('btn-close-circuit');
    if (btnCloseCircuit) btnCloseCircuit.addEventListener('click', closeCircuitReader);
    if (circuitModal) {
      circuitModal.addEventListener('click', (e) => {
        if (e.target === circuitModal) closeCircuitReader();
      });
    }

    btnCamera.addEventListener('click', (e) => { e.stopPropagation(); cycleCameraMode(); });
    btnTime.addEventListener('click', (e) => { e.stopPropagation(); toggleTimeOfDay(); });
    if (btnCircuit) btnCircuit.addEventListener('click', (e) => { e.stopPropagation(); openCircuitReader(); });
    if (btnMeeting) btnMeeting.addEventListener('click', (e) => { e.stopPropagation(); startTeamMeeting(); });
    if (btnCheers) btnCheers.addEventListener('click', (e) => { e.stopPropagation(); triggerCheers(); });
    if (btnZoomIn) btnZoomIn.addEventListener('click', (e) => { e.stopPropagation(); setZoom(targetZoom / 1.18); });
    if (btnZoomOut) btnZoomOut.addEventListener('click', (e) => { e.stopPropagation(); setZoom(targetZoom * 1.18); });
    if (btnZoomReset) btnZoomReset.addEventListener('click', (e) => { e.stopPropagation(); setZoom(1.0); });

    renderer.domElement.addEventListener('wheel', (e) => {
      if (drawerOpen || (circuitModal && circuitModal.classList.contains('open'))) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      setZoom(targetZoom * factor);
    }, { passive: false });

    // Cursor Raycasting & Drag Look
    const raycaster = new THREE.Raycaster();
    const mouseNdc = new THREE.Vector2(0, 0);
    let isDraggingLook = false;
    let dragStartX = 0;
    let dragMoved = false;

    function updateCursorRay(clientX, clientY) {
      mouseNdc.x = (clientX / window.innerWidth) * 2 - 1;
      mouseNdc.y = -(clientY / window.innerHeight) * 2 + 1;
    }

    renderer.domElement.addEventListener('mousemove', (e) => {
      updateCursorRay(e.clientX, e.clientY);
      if (isDraggingLook) {
        if (Math.abs(e.clientX - dragStartX) > 4) dragMoved = true;
        if (cameraMode === 2) {
          yaw -= (e.movementX || 0) * 0.0045;
        } else {
          camYaw -= (e.movementX || 0) * 0.004;
        }
      }
    });

    renderer.domElement.addEventListener('mousedown', (e) => {
      sfx.ensure();
      if (drawerOpen) return;
      updateCursorRay(e.clientX, e.clientY);
      dragStartX = e.clientX;
      dragMoved = false;
      if (e.button === 2 || (e.button === 0 && cameraMode === 2)) {
        isDraggingLook = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      const wasDrag = dragMoved;
      isDraggingLook = false;
      if (drawerOpen) return;
      if (e.target !== renderer.domElement) return;
      if (wasDrag) return;

      if (e.button === 0) {
        raycaster.setFromCamera(mouseNdc, camera);

        // 1. Clicked on an NPC or Live User? Talk to them!
        const npcHits = raycaster.intersectObjects(crowd.getNpcMeshes(), true);
        if (npcHits.length > 0 && npcHits[0].object.visible) {
          const npcName = npcHits[0].object.userData.npcName;
          const npc = crowd.findNpcByName(npcName);
          if (npc) {
            openNpcDialog(npc);
            return;
          }
        }

        // 2. Clicked on a floor's Unique Interactive Item? Trigger it!
        const itemHits = raycaster.intersectObjects(itemManager.getMeshes(), true);
        if (itemHits.length > 0 && itemHits[0].object.visible) {
          const item = itemManager.findById(itemHits[0].object.userData.itemId);
          if (item) {
            triggerItem(item);
            return;
          }
        }

        // 3. Clicked on floor in Campus 3/4 / Top-Down view? Route intelligently around walls & furniture!
        if (cameraMode !== 2) {
          if (isDialogOpen()) closeDialog();
          const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -viewedFloorObj.standY);
          const hitPt = new THREE.Vector3();
          if (raycaster.ray.intersectPlane(floorPlane, hitPt)) {
            const tx = Math.max(2.2, Math.min(world.w - 2.2, hitPt.x));
            const tz = Math.max(2.2, Math.min(world.d - 2.2, hitPt.z));
            setSmartWalkTarget(tx, tz);
          }
        }
      }
    });
    renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard Input
    const keys = {};
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const typingInInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT');
      if (e.code === 'Escape' && typingInInput) {
        activeEl.blur();
        return;
      }
      if (e.code === 'Escape' && circuitModal && circuitModal.classList.contains('open')) {
        closeCircuitReader();
        return;
      }
      if (e.code === 'Escape' && isDialogOpen()) {
        closeDialog();
        return;
      }
      if (typingInInput) return;

      keys[e.code] = true;
      if (e.code === 'KeyC') {
        cycleCameraMode();
      } else if (e.code === 'KeyT') {
        toggleTimeOfDay();
      } else if (e.code === 'KeyM') {
        startTeamMeeting();
      } else if (e.code === 'KeyH') {
        triggerCheers();
      } else if (e.code === 'KeyU') {
        setDrawerOpen(!drawerOpen);
      } else if (e.code === 'KeyE') {
        performPrimaryAction();
      } else if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        setZoom(targetZoom / 1.18);
      } else if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        setZoom(targetZoom * 1.18);
      } else if (e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        setZoom(1.0);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        chatInput.focus();
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    // User Community Wall / Post Form
    const postForm = document.getElementById('post-form');
    const chatInput = document.getElementById('chat-input');
    postForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const txt = chatInput.value.trim();
      if (!txt) return;
      const me = roster.getActiveUser();
      const floorNow = world.getFloorAtY(playerPos.y).level;
      const label = `${me.name} @F${floorNow}`;
      pushChat(label, txt);
      sendLiveChat(label, txt);
      chatInput.value = '';
      chatInput.blur();
      sfx.blip();
    });
    document.getElementById('btn-clear-posts').addEventListener('click', () => {
      chatMessagesEl.innerHTML = '';
      try { localStorage.removeItem(POSTS_STORAGE_KEY); } catch (e) { /* ignore */ }
    });
    const chatBoxEl = document.getElementById('chat-box');
    const btnToggleChat = document.getElementById('btn-toggle-chat');
    if (btnToggleChat && chatBoxEl) {
      btnToggleChat.addEventListener('click', () => {
        const collapsed = chatBoxEl.classList.toggle('collapsed');
        btnToggleChat.textContent = collapsed ? '+' : '−';
      });
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Initialize
    applyActiveUserState(false);
    updateButtons();

    const loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) loadingEl.style.display = 'none';

    pushChat('', 'Welcome to Virtual Intel Campus (Floors 1–6)! Walk with WASD, Arrows, or Click-to-Move.', true);
    pushChat('', 'Click any person or press [E] near someone to talk! Click unique items on each floor to interact!', true);

    const roomNameEl = document.getElementById('room-name');
    const totalBadgeEl = document.getElementById('total-players-badge');
    let lastStandingLevel = world.getFloorAtY(playerPos.y).level;
    let stairCooldown = 0;
    let lastTime = performance.now();

    function animate(now) {
      requestAnimationFrame(animate);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (stairCooldown > 0) stairCooldown -= dt;

      const activeUser = roster.getActiveUser();
      const maxAllowedFloor = world.getMaxAllowedFloorObj(activeUser.level);
      const typingInInput = document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');

      if (!drawerOpen && !typingInInput) {
        if (keys['KeyQ']) camYaw += 1.8 * dt;
        if (keys['KeyZ']) camYaw -= 1.8 * dt;
      }

      let mx = 0, mz = 0;
      if (cameraMode === 2) {
        // 1st Person Surround: look 360° horizontally ONLY (cannot walk or tilt up/down!)
        if (!drawerOpen && !typingInInput) {
          if (keys['KeyA'] || keys['ArrowLeft'] || dpadState.left) yaw += 2.1 * dt;
          if (keys['KeyD'] || keys['ArrowRight'] || dpadState.right) yaw -= 2.1 * dt;
        }
        playerVel.set(0, 0, 0);
      } else {
        const forwardX = -Math.sin(camYaw);
        const forwardZ = -Math.cos(camYaw);
        const rightX = Math.cos(camYaw);
        const rightZ = -Math.sin(camYaw);

        let keyInput = false;
        if (!drawerOpen && !typingInInput) {
          if (keys['KeyW'] || keys['ArrowUp'] || dpadState.up)       { mx += forwardX; mz += forwardZ; keyInput = true; }
          if (keys['KeyS'] || keys['ArrowDown'] || dpadState.down)   { mx -= forwardX; mz -= forwardZ; keyInput = true; }
          if (keys['KeyA'] || keys['ArrowLeft'] || dpadState.left)   { mx -= rightX;   mz -= rightZ;   keyInput = true; }
          if (keys['KeyD'] || keys['ArrowRight'] || dpadState.right) { mx += rightX;   mz += rightZ;   keyInput = true; }
        }
        if (keyInput) {
          clearWalkPath();
          if (isDialogOpen()) closeDialog();
        }

        if (walkPath.length > 0) {
          const wp = walkPath[0];
          const dx = wp.x - playerPos.x;
          const dz = wp.z - playerPos.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 0.42) {
            walkPath.shift();
            if (walkPath.length === 0) {
              clearWalkPath();
            } else {
              const nxt = walkPath[0];
              const nd = Math.hypot(nxt.x - playerPos.x, nxt.z - playerPos.z) || 1;
              mx = (nxt.x - playerPos.x) / nd;
              mz = (nxt.z - playerPos.z) / nd;
            }
          } else {
            mx = dx / dist;
            mz = dz / dist;
          }

          // Re-route cleanly if bumped against an edge
          walkStuckTimer += dt;
          if (walkStuckTimer > 0.6) {
            const moved = Math.hypot(playerPos.x - walkLastX, playerPos.z - walkLastZ);
            walkLastX = playerPos.x;
            walkLastZ = playerPos.z;
            walkStuckTimer = 0;
            if (moved < 0.12 && walkTarget) {
              const floorNow = world.getFloorAtY(playerPos.y);
              const reroute = crowd.findPathForPlayer(floorNow.level, playerPos.x, playerPos.z, walkTarget.x, walkTarget.z);
              if (reroute.length > 0) walkPath = reroute;
              else clearWalkPath();
            }
          }
        }

        const mLen = Math.hypot(mx, mz);
        if (mLen > 0) {
          mx /= mLen; mz /= mLen;
          const targetYaw = Math.atan2(-mx, -mz);
          let diff = targetYaw - yaw;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          yaw += diff * Math.min(1, dt * 13);
        }

        const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? 8.8 : 5.6;
        playerVel.x = mx * speed;
        playerVel.z = mz * speed;

        const prevX = playerPos.x;
        const prevY = playerPos.y;
        const prevZ = playerPos.z;

        playerVel.y -= 20 * dt;
        onGround = moveWithCollision(world, playerPos, playerVel, dt);

        // STAIRWELL UP & DOWN TRANSITION (Pokemon-style smooth floor change if access allows!)
        if (stairCooldown <= 0) {
          for (const sz of stairZones) {
            if (Math.abs(playerPos.y - sz.standY) > 1.35) continue;
            const locked = sz.dir === 'up' && sz.toLevel > maxAllowedFloor.level;
            const padZ = locked ? 1.35 : 0.0;
            const inX = playerPos.x >= sz.minX && playerPos.x <= sz.maxX;
            const inZ = playerPos.z >= (sz.minZ - padZ) && playerPos.z <= (sz.maxZ + padZ);
            if (!inX || !inZ) continue;

            if (locked) {
              clearWalkPath();
              if (now - lastDeniedAt > 1400) {
                lastDeniedAt = now;
                sfx.denied();
                const targetFl = PG17_LEVELS.find((l) => l.level === sz.toLevel);
                showToast(`🔒 Stairs Locked: Floor ${sz.toLevel} (${targetFl ? targetFl.shortName : ''}) requires Floor ${sz.toLevel}+. Your Access: Floor ${activeUser.level}`, true);
              }
            } else {
              playerPos.set(sz.spawnX, sz.spawnY, sz.spawnZ);
              playerVel.set(0, 0, 0);
              yaw = sz.spawnYaw;
              clearWalkPath();
              stairCooldown = 0.85;
              const destFl = world.getFloorAtY(playerPos.y);
              viewedFloorObj = destFl;
              lastStandingLevel = destFl.level;
              rebuildWorldMesh();
              rebuildStairMarkers(destFl.level, maxAllowedFloor.level);
              renderFloorButtons();
              sfx.elevator();
              const arrow = sz.dir === 'up' ? '▲ Walked up stairs to' : '▼ Walked down stairs to';
              showToast(`${arrow} Floor ${destFl.level} — ${destFl.shortName}`, false);
              pushChat('', `🪜 ${arrow} Floor ${destFl.level} (${destFl.shortName})`, true);
            }
            break;
          }
        }

        // STRICT FLOOR-LEVEL GATING
        const maxPermitStandY = maxAllowedFloor.standY + 1.25;
        if (playerPos.y > maxPermitStandY) {
          playerPos.x = prevX;
          playerPos.y = Math.min(prevY, maxAllowedFloor.standY);
          playerPos.z = prevZ;
          playerVel.y = 0;
          clearWalkPath();
          if (now - lastDeniedAt > 1400) {
            lastDeniedAt = now;
            sfx.denied();
            const nextLvl = nextUpgradeLevel(activeUser.level);
            const nextObj = PG17_LEVELS.find((l) => l.level === nextLvl);
            showToast(`🔒 Access Denied: Floor ${nextLvl} (${nextObj ? nextObj.shortName : ''}) requires Floor ${nextLvl}+. Your Access: Floor ${activeUser.level}`, true);
          }
        }
      }

      const standingFloor = world.getFloorAtY(playerPos.y);
      if (standingFloor.level !== lastStandingLevel) {
        lastStandingLevel = standingFloor.level;
        viewedFloorObj = standingFloor;
        rebuildStairMarkers(standingFloor.level, maxAllowedFloor.level);
        renderFloorButtons();
        if (cameraMode !== 2 && sliceFloors) rebuildWorldMesh();
      }

      const horizSpeed = Math.hypot(playerVel.x, playerVel.z);
      if (onGround && horizSpeed > 1.0 && cameraMode !== 2) {
        sfx.stepTimer -= dt;
        if (sfx.stepTimer <= 0) {
          sfx.step();
          sfx.stepTimer = (keys['ShiftLeft'] || keys['ShiftRight']) ? 0.26 : 0.36;
        }
      }

      if (localCheerTimer > 0) localCheerTimer -= dt;
      localAvatar.group.position.copy(playerPos);
      localAvatar.group.rotation.y = yaw + Math.PI;
      localAvatar.animate(horizSpeed, dt, localCheerTimer);

      // Camera Positioning + Smooth Zoom
      smoothZoom += (targetZoom - smoothZoom) * Math.min(1, dt * 10);
      if (cameraMode === 0) {
        // Cozy Pokemon 3/4 Follow Camera with adjustable zoom
        if (Math.abs(camera.fov - 55) > 0.1) { camera.fov = 55; camera.updateProjectionMatrix(); }
        const dist = 13.5 * smoothZoom;
        const height = 10.5 * smoothZoom;
        const desiredPos = new THREE.Vector3(
          playerPos.x + Math.sin(camYaw) * dist,
          playerPos.y + height,
          playerPos.z + Math.cos(camYaw) * dist
        );
        smoothCamPos.lerp(desiredPos, Math.min(1, dt * 8));
        smoothLookAt.lerp(new THREE.Vector3(playerPos.x, playerPos.y + 1.0, playerPos.z), Math.min(1, dt * 10));
        camera.position.copy(smoothCamPos);
        camera.lookAt(smoothLookAt);
      } else if (cameraMode === 1) {
        // Top-Down Map Walk with adjustable zoom
        if (Math.abs(camera.fov - 55) > 0.1) { camera.fov = 55; camera.updateProjectionMatrix(); }
        const dist = 17.5 * smoothZoom;
        const height = 24.5 * smoothZoom;
        const desiredPos = new THREE.Vector3(
          playerPos.x + Math.sin(camYaw) * dist,
          playerPos.y + height,
          playerPos.z + Math.cos(camYaw) * dist
        );
        smoothCamPos.lerp(desiredPos, Math.min(1, dt * 8));
        smoothLookAt.lerp(new THREE.Vector3(playerPos.x, playerPos.y + 0.8, playerPos.z), Math.min(1, dt * 10));
        camera.position.copy(smoothCamPos);
        camera.lookAt(smoothLookAt);
      } else {
        // 1st Person Surround: strictly horizontal (pitch = 0, NO up/down tilt!) + FOV zoom
        const targetFov = Math.max(28, Math.min(80, 55 * smoothZoom));
        if (Math.abs(camera.fov - targetFov) > 0.08) {
          camera.fov = targetFov;
          camera.updateProjectionMatrix();
        }
        camera.position.set(playerPos.x, playerPos.y + 1.58, playerPos.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = yaw;
        camera.rotation.x = 0;
        camera.rotation.z = 0;
      }

      // Cursor Raycast for Floor Ring, NPC Hover & Item Hover
      raycaster.setFromCamera(mouseNdc, camera);
      hoveredNpc = null;
      hoveredItem = null;

      const npcHits = raycaster.intersectObjects(crowd.getNpcMeshes(), true);
      if (npcHits.length > 0 && npcHits[0].object.visible) {
        hoveredNpc = crowd.findNpcByName(npcHits[0].object.userData.npcName);
      }
      if (!hoveredNpc) {
        const itemHits = raycaster.intersectObjects(itemManager.getMeshes(), true);
        if (itemHits.length > 0 && itemHits[0].object.visible) {
          hoveredItem = itemManager.findById(itemHits[0].object.userData.itemId);
        }
      }

      if (cameraMode !== 2 && !drawerOpen) {
        const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -viewedFloorObj.standY);
        const hitPt = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(floorPlane, hitPt) && hitPt.x >= 2 && hitPt.x <= world.w - 2 && hitPt.z >= 2 && hitPt.z <= world.d - 2) {
          cursorRing.visible = true;
          cursorRing.position.set(hitPt.x, viewedFloorObj.standY + 0.04, hitPt.z);
          cursorRingMat.color.setHex((hoveredNpc || hoveredItem) ? 0xfde047 : 0x38bdf8);
        } else {
          cursorRing.visible = false;
        }
      } else {
        cursorRing.visible = false;
      }

      if (walkTarget && walkPath.length > 0) {
        walkTargetRing.visible = true;
        walkTargetRing.position.set(walkTarget.x, playerPos.y + 0.05, walkTarget.z);
        const s = 0.85 + Math.sin(now * 0.008) * 0.2;
        walkTargetRing.scale.set(s, s, 1);

        const pts = [new THREE.Vector3(playerPos.x, playerPos.y + 0.08, playerPos.z)];
        for (const wp of walkPath) {
          pts.push(new THREE.Vector3(wp.x, playerPos.y + 0.08, wp.z));
        }
        walkPathLine.geometry.dispose();
        walkPathLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
        walkPathLine.visible = true;
      } else {
        walkTargetRing.visible = false;
        walkPathLine.visible = false;
      }

      // Prompt pill for hovered or nearby NPC / Unique Item
      const nearNpc = hoveredNpc || crowd.getNearestTalkable(playerPos, 3.2);
      const nearItem = hoveredItem || itemManager.getNearestItem(playerPos, 3.8);
      if (!isDialogOpen() && nearNpc) {
        itemPromptEl.style.display = 'block';
        itemPromptEl.textContent = `💬 Talk to ${nearNpc.name} [Click / E]`;
      } else if (!isDialogOpen() && nearItem) {
        itemPromptEl.style.display = 'block';
        itemPromptEl.textContent = `✨ ${nearItem.name} — Click or press [E]: ${nearItem.actionLabel}`;
      } else {
        itemPromptEl.style.display = 'none';
      }

      itemManager.update(dt, playerPos, sfx, getActiveSliceMaxY(), (msg) => {
        showToast(msg, false);
        pushChat('', msg, true);
      });

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.vel.y -= 12 * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.scale.setScalar(Math.max(0.01, p.life * 2));
        if (p.life <= 0) {
          scene.remove(p.mesh);
          particles.splice(i, 1);
        }
      }

      crowd.update(dt, camera.position, playerPos, getActiveSliceMaxY());

      roomNameEl.textContent = detectZone(world, playerPos.x, playerPos.y, playerPos.z);
      totalBadgeEl.textContent = `${crowd.npcs.length + crowd.remotePlayers.size + 1} Active in Virtual Intel Campus (${roster.users.length} Roster)`;

      renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);
  }

  window.addEventListener('DOMContentLoaded', initGame);
})(window);
