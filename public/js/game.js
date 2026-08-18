/**
 * KARTLAN 3D - Main Game Client Coordinator
 * Orchestrates 3D rendering, arcade drift physics, camera juice,
 * dynamic HUD minimap, audio synchronization, and LAN multiplayer.
 */

import * as THREE from './three.module.min.js';
import { sound } from './audio.js';
import { Track } from './tracks.js';
import { KartPhysics } from './physics.js';
import { KartVisual } from './kart-models.js';
import { ItemManager } from './items.js';
import { InputController } from './input.js';
import { NetworkClient } from './network.js';
import { BotController } from './ai.js';

class Game {
  constructor() {
    this.container = document.getElementById('game-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.track = null;
    this.localPhysics = null;
    this.localVisual = null;
    this.itemManager = null;
    this.input = new InputController();
    this.net = new NetworkClient();

    // Multi-kart entities
    this.remoteKarts = new Map(); // id -> { visual, physics, botController }
    this.localPlayerId = 'p_local';
    this.localName = 'TurboAce';
    this.localColor = '#00f0ff';

    // Game state
    this.gameState = 'menu'; // 'menu' | 'lobby' | 'countdown' | 'racing' | 'podium'
    this.currentTrackId = 'circuit_neon';
    this.totalLaps = 3;
    this.currentLap = 1;
    this.raceStartTime = 0;
    this.lapStartTime = 0;
    this.currentItem = null;
    this.isSinglePlayer = false;

    // Minimap canvas
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // Clock
    this.clock = new THREE.Clock();
    this.lastSendTickTime = 0;

    this.initRenderer();
    this.loadTrack(this.currentTrackId);
    this.initNetwork();
    this.initUI();
    this.animate();
  }

  initRenderer() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070b19);
    this.scene.fog = new THREE.FogExp2(0x070b19, 0.0035);

    this.camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.5, 1200);
    this.camera.position.set(0, 10, -20);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(100, 150, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    const d = 120;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    if (!this.camera || !this.renderer) return;
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  loadTrack(trackId) {
    // Clear old elements
    if (this.track) {
      while (this.scene.children.length > 0) {
        this.scene.remove(this.scene.children[0]);
      }
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
      this.scene.add(ambientLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
      dirLight.position.set(100, 150, 80);
      dirLight.castShadow = true;
      this.scene.add(dirLight);
    }

    this.currentTrackId = trackId;
    this.track = new Track(this.scene, trackId);
    this.scene.background = new THREE.Color(this.track.config.skyColor);
    this.scene.fog.color = new THREE.Color(this.track.config.fogColor);

    // Item manager
    this.itemManager = new ItemManager(this.scene, this.track);

    // Local Kart
    this.localPhysics = new KartPhysics(this.track, true);
    this.localVisual = new KartVisual(this.scene, this.localColor, true);

    const startWp = this.track.waypoints[0];
    this.localPhysics.setPosition(
      startWp.point.x - 3.5,
      startWp.point.y + 0.5,
      startWp.point.z,
      Math.atan2(-startWp.tangent.x, -startWp.tangent.z)
    );
  }

  initNetwork() {
    this.net.on('connected', () => {
      const statusEl = document.getElementById('server-status');
      if (statusEl) {
        statusEl.innerText = 'Connected';
        statusEl.className = 'badge badge-green';
      }
    });

    this.net.on('disconnected', () => {
      const statusEl = document.getElementById('server-status');
      if (statusEl) {
        statusEl.innerText = 'Disconnected';
        statusEl.className = 'badge badge-red';
      }
    });

    this.net.on('ping_update', (ping) => {
      const el = document.getElementById('hud-ping');
      if (el) el.innerText = `${ping}ms`;
    });

    this.net.on('room_joined', (data) => {
      this.localPlayerId = data.playerId;
      this.showLobbyScreen(data.room, data.players);
    });

    this.net.on('player_joined', (data) => {
      this.updateLobbyPlayers(data.players);
    });

    this.net.on('player_left', (data) => {
      this.updateLobbyPlayers(data.players);
      this.removeRemoteKart(data.playerId);
    });

    this.net.on('player_ready_changed', (data) => {
      this.updateLobbyPlayers(data.players);
    });

    this.net.on('room_settings_updated', (data) => {
      this.updateLobbySettings(data.room);
    });

    this.net.on('race_countdown_started', (data) => {
      this.startRaceCountdown(data);
    });

    this.net.on('countdown_tick', (data) => {
      this.showCountdown(data.count);
      sound.playCountdownBeep(false);
    });

    this.net.on('race_started', (data) => {
      this.gameState = 'racing';
      this.raceStartTime = data.startTime;
      this.lapStartTime = data.startTime;
      this.showCountdown('GO!');
      sound.playCountdownBeep(true);
      sound.startMusic(false);
      setTimeout(() => this.hideCountdown(), 1200);
    });

    this.net.on('item_box_collected', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.setItem(data.item);
      }
    });

    this.net.on('item_box_respawned', (data) => {
      const box = this.itemManager.itemBoxes.find(b => b.id === data.boxId);
      if (box) box.active = true;
    });

    this.net.on('projectile_spawned', (data) => {
      this.itemManager.spawnProjectileVisual(data.projectile);
      sound.playShellFire();
    });

    this.net.on('projectile_destroyed', (data) => {
      this.itemManager.destroyProjectileVisual(data.id);
    });

    this.net.on('player_hit', (data) => {
      if (data.targetId === this.localPlayerId) {
        this.localPhysics.spinOut();
        this.input.vibrate(0.8, 400);
      }
      sound.playExplosion();
    });

    this.net.on('player_zapped', (data) => {
      if (data.playerId === this.localPlayerId) {
        this.localPhysics.isZapped = true;
        this.localPhysics.zappedTimer = data.duration / 1000;
        sound.playZap();
      }
    });

    this.net.on('race_over', (data) => {
      this.showPodium(data.podium);
      sound.playVictoryFanfare();
    });
  }

  initUI() {
    // Menu Buttons
    const btnSingle = document.getElementById('btn-singleplayer');
    if (btnSingle) {
      btnSingle.onclick = (e) => {
        e.preventDefault();
        sound.resume();
        this.startSinglePlayerGame();
      };
    }

    const btnHost = document.getElementById('btn-host-lan');
    if (btnHost) {
      btnHost.onclick = (e) => {
        e.preventDefault();
        sound.resume();
        this.createLanRoom();
      };
    }

    const btnRefresh = document.getElementById('btn-refresh-rooms');
    if (btnRefresh) {
      btnRefresh.onclick = (e) => {
        e.preventDefault();
        this.refreshLanRooms();
      };
    }

    const btnReady = document.getElementById('btn-toggle-ready');
    if (btnReady) {
      btnReady.onclick = (e) => {
        e.preventDefault();
        const isReady = btnReady.classList.toggle('ready');
        btnReady.innerText = isReady ? 'READY!' : 'SET READY';
        this.net.send({ type: 'set_ready', ready: isReady });
      };
    }

    const btnStart = document.getElementById('btn-start-race');
    if (btnStart) {
      btnStart.onclick = (e) => {
        e.preventDefault();
        this.net.send({ type: 'start_race' });
      };
    }

    const btnLeave = document.getElementById('btn-leave-lobby');
    if (btnLeave) {
      btnLeave.onclick = (e) => {
        e.preventDefault();
        this.net.send({ type: 'leave_room' });
        this.showMenuScreen();
      };
    }

    const btnPodium = document.getElementById('btn-podium-menu');
    if (btnPodium) {
      btnPodium.onclick = (e) => {
        e.preventDefault();
        this.showMenuScreen();
      };
    }

    // Track selector change
    const trackSelect = document.getElementById('lobby-track-select');
    if (trackSelect) {
      trackSelect.onchange = (e) => {
        this.net.send({ type: 'update_settings', trackId: e.target.value });
      };
    }

    // Kart Color picker
    const colorButtons = document.querySelectorAll('.color-swatch');
    colorButtons.forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        colorButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.localColor = btn.dataset.color;
        if (this.localVisual) {
          this.localVisual.colorHex = this.localColor;
          this.localVisual.bodyMesh.material.color.set(this.localColor);
        }
      };
    });

    // Auto connect to host WebSocket
    this.net.connect();
    this.refreshLanRooms();
  }

  showMenuScreen() {
    this.gameState = 'menu';
    sound.stopMusic();
    document.getElementById('screen-menu').classList.remove('hidden');
    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-hud').classList.add('hidden');
    document.getElementById('screen-podium').classList.add('hidden');
    this.refreshLanRooms();
  }

  async refreshLanRooms() {
    const roomsList = document.getElementById('lan-rooms-list');
    if (!roomsList) return;
    roomsList.innerHTML = '<div class="loading-text">Scanning LAN for games...</div>';

    const info = await this.net.getServerInfo();
    if (info && info.lanIps) {
      const ipList = document.getElementById('lan-ip-display');
      if (ipList) {
        ipList.innerHTML = info.lanIps.map(ip => `<span class="lan-ip-badge">http://${ip.address}:${info.port}</span>`).join(' ');
      }
    }

    const rooms = await this.net.discoverLanRooms();
    if (!rooms || rooms.length === 0) {
      roomsList.innerHTML = '<div class="empty-rooms">No open LAN races found. Host one below!</div>';
      return;
    }

    roomsList.innerHTML = '';
    rooms.forEach(room => {
      const item = document.createElement('div');
      item.className = 'room-card';
      item.innerHTML = `
        <div class="room-info">
          <div class="room-title">${room.name}</div>
          <div class="room-details">${room.trackId.toUpperCase()} • ${room.playerCount}/${room.maxPlayers} Players • ${room.laps} Laps</div>
        </div>
        <button class="btn btn-primary btn-join" data-id="${room.id}">JOIN RACE</button>
      `;
      item.querySelector('.btn-join').onclick = (e) => {
        e.preventDefault();
        sound.resume();
        this.joinLanRoom(room.id);
      };
      roomsList.appendChild(item);
    });
  }

  createLanRoom() {
    const nameInput = document.getElementById('input-player-name');
    this.localName = (nameInput && nameInput.value) ? nameInput.value : 'TurboAce';
    this.isSinglePlayer = false;

    this.net.send({
      type: 'create_room',
      name: `${this.localName}'s Grand Prix`,
      playerName: this.localName,
      kartColor: this.localColor,
      trackId: 'circuit_neon',
      laps: 3,
      fillWithBots: true
    });
  }

  joinLanRoom(roomId) {
    const nameInput = document.getElementById('input-player-name');
    this.localName = (nameInput && nameInput.value) ? nameInput.value : 'TurboAce';
    this.isSinglePlayer = false;

    this.net.send({
      type: 'join_room',
      roomId,
      playerName: this.localName,
      kartColor: this.localColor
    });
  }

  showLobbyScreen(room, players) {
    this.gameState = 'lobby';
    document.getElementById('screen-menu').classList.add('hidden');
    document.getElementById('screen-lobby').classList.remove('hidden');
    document.getElementById('screen-hud').classList.add('hidden');
    document.getElementById('screen-podium').classList.add('hidden');

    const nameEl = document.getElementById('lobby-room-name');
    if (nameEl) nameEl.innerText = room.name;

    const isHost = room.hostId === this.localPlayerId;
    const startBtn = document.getElementById('btn-start-race');
    if (startBtn) startBtn.style.display = isHost ? 'block' : 'none';

    const trackSelect = document.getElementById('lobby-track-select');
    if (trackSelect) trackSelect.disabled = !isHost;

    this.updateLobbyPlayers(players);
  }

  updateLobbyPlayers(players) {
    const grid = document.getElementById('lobby-players-grid');
    if (!grid) return;
    grid.innerHTML = '';
    players.forEach(p => {
      const card = document.createElement('div');
      card.className = 'lobby-player-card';
      card.innerHTML = `
        <div class="player-color-dot" style="background-color: ${p.color}"></div>
        <div class="player-name">${p.name} ${p.isHost ? '👑' : ''}</div>
        <div class="player-status ${p.isReady ? 'status-ready' : 'status-waiting'}">${p.isReady ? 'READY' : 'WAITING'}</div>
      `;
      grid.appendChild(card);
    });
  }

  updateLobbySettings(room) {
    const sel = document.getElementById('lobby-track-select');
    if (sel) sel.value = room.trackId;
  }

  startSinglePlayerGame() {
    this.isSinglePlayer = true;
    this.localPlayerId = 'p_solo';
    this.currentTrackId = 'circuit_neon';
    this.totalLaps = 3;

    // Load track if needed
    if (!this.track || this.currentTrackId !== 'circuit_neon') {
      this.loadTrack('circuit_neon');
    }

    // Reset local kart
    const startWp = this.track.waypoints[0];
    const startAngle = Math.atan2(-startWp.tangent.x, -startWp.tangent.z);
    this.localPhysics.setPosition(startWp.point.x - 3.5, startWp.point.y + 0.5, startWp.point.z, startAngle);
    this.localPhysics.currentLap = 1;
    this.localPhysics.lapProgress = 0;
    this.localPhysics.speed = 0;

    // Clean up old remote karts
    for (const r of this.remoteKarts.values()) {
      if (r.visual) r.visual.destroy();
    }
    this.remoteKarts.clear();

    // Spawn 5 AI bots
    const botColors = ['#ff0055', '#00ff66', '#ffaa00', '#aa00ff', '#ffffff'];
    for (let i = 0; i < 5; i++) {
      const botId = `bot_${i + 1}`;
      const phys = new KartPhysics(this.track, false);
      const vis = new KartVisual(this.scene, botColors[i], false);
      const botCtrl = new BotController(botId, this.track, phys);

      const row = Math.floor((i + 1) / 2);
      const col = ((i + 1) % 2) === 0 ? -3.5 : 3.5;
      phys.setPosition(startWp.point.x + col, startWp.point.y + 0.5, startWp.point.z - row * 9, startAngle);

      this.remoteKarts.set(botId, {
        id: botId,
        name: `[AI] Bot ${i + 1}`,
        physics: phys,
        visual: vis,
        botController: botCtrl,
        lap: 1,
        finished: false
      });
    }

    // Switch screen to HUD
    this.gameState = 'countdown';
    this.currentLap = 1;
    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-menu').classList.add('hidden');
    document.getElementById('screen-hud').classList.remove('hidden');

    this.showCountdown(3);
    sound.playCountdownBeep(false);

    let count = 3;
    const timer = setInterval(() => {
      count--;
      if (count > 0) {
        this.showCountdown(count);
        sound.playCountdownBeep(false);
      } else {
        clearInterval(timer);
        this.gameState = 'racing';
        this.raceStartTime = Date.now();
        this.lapStartTime = Date.now();
        this.showCountdown('GO!');
        sound.playCountdownBeep(true);
        sound.startMusic(false);
        setTimeout(() => this.hideCountdown(), 1200);
      }
    }, 1000);
  }

  startRaceCountdown(data) {
    this.gameState = 'countdown';
    const targetTrackId = data.trackId || this.currentTrackId;
    this.totalLaps = data.laps || 3;
    this.currentLap = 1;

    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-menu').classList.add('hidden');
    document.getElementById('screen-hud').classList.remove('hidden');

    if (!this.track || this.currentTrackId !== targetTrackId) {
      this.loadTrack(targetTrackId);
    }

    const startWp = this.track.waypoints[0];
    const startAngle = Math.atan2(-startWp.tangent.x, -startWp.tangent.z);
    this.localPhysics.setPosition(startWp.point.x - 3.5, startWp.point.y + 0.5, startWp.point.z, startAngle);

    // Initialize remote players from lobby
    if (data.players) {
      // Clear old remote karts
      for (const r of this.remoteKarts.values()) {
        if (r.visual) r.visual.destroy();
      }
      this.remoteKarts.clear();

      data.players.forEach((p, idx) => {
        if (p.id !== this.localPlayerId) {
          const vis = new KartVisual(this.scene, p.color, false);
          this.remoteKarts.set(p.id, {
            id: p.id,
            name: p.name,
            visual: vis,
            physics: null,
            lap: 1,
            finished: false
          });
        }
      });
    }

    this.showCountdown(3);
    sound.playCountdownBeep(false);
  }

  showCountdown(text) {
    const el = document.getElementById('hud-countdown');
    if (!el) return;
    el.innerText = text;
    el.classList.remove('hidden');
    el.classList.add('pulse-anim');
  }

  hideCountdown() {
    const el = document.getElementById('hud-countdown');
    if (el) el.classList.add('hidden');
  }

  setItem(itemType) {
    this.currentItem = itemType;
    const itemBoxEl = document.getElementById('hud-item-icon');
    if (!itemBoxEl) return;
    const itemNames = {
      'GREEN_SHELL': '🟢 GREEN SHELL',
      'RED_SHELL': '🔴 RED SHELL',
      'BANANA': '🍌 BANANA',
      'MUSHROOM': '🍄 MUSHROOM',
      'STAR': '⭐ STARMAN',
      'LIGHTNING': '⚡ LIGHTNING'
    };
    itemBoxEl.innerText = itemNames[itemType] || itemType;
    itemBoxEl.classList.add('item-pop-anim');
    sound.playItemGet();
  }

  useItem() {
    if (!this.currentItem) return;
    const item = this.currentItem;
    this.currentItem = null;
    const iconEl = document.getElementById('hud-item-icon');
    if (iconEl) iconEl.innerText = '';

    if (this.isSinglePlayer) {
      if (item === 'MUSHROOM') {
        this.localPhysics.applyBoost(3.0, 1.45);
      } else if (item === 'STAR') {
        this.localPhysics.isInvincible = true;
        this.localPhysics.invincibleTimer = 7.5;
        this.localPhysics.applyBoost(7.5, 1.35);
      } else if (item === 'LIGHTNING') {
        for (const r of this.remoteKarts.values()) {
          if (r.physics) {
            r.physics.isZapped = true;
            r.physics.zappedTimer = 5.0;
          }
        }
        sound.playZap();
      } else {
        const forwardX = -Math.sin(this.localPhysics.heading);
        const forwardZ = -Math.cos(this.localPhysics.heading);
        const spawnPos = {
          x: this.localPhysics.position.x + (item === 'BANANA' ? -forwardX * 2.5 : forwardX * 3.0),
          y: this.localPhysics.position.y + 0.4,
          z: this.localPhysics.position.z + (item === 'BANANA' ? -forwardZ * 2.5 : forwardZ * 3.0)
        };
        const proj = {
          id: `sp_proj_${Date.now()}`,
          type: item,
          position: spawnPos
        };
        this.itemManager.spawnProjectileVisual(proj);
        sound.playShellFire();
      }
    } else {
      this.net.send({
        type: 'use_item',
        heading: this.localPhysics.heading
      });
    }
  }

  removeRemoteKart(playerId) {
    const r = this.remoteKarts.get(playerId);
    if (r) {
      if (r.visual) r.visual.destroy();
      this.remoteKarts.delete(playerId);
    }
  }

  update(dt) {
    if (!this.track || !this.localPhysics) return;

    const inputState = this.input.getState();

    // 1. Update Local Kart Physics & Animation
    if (this.gameState === 'racing' || this.gameState === 'countdown') {
      const activeInput = this.gameState === 'racing' ? inputState : { accelerate: false, brake: false, steerLeft: false, steerRight: false, drift: false, useItem: false };

      const otherPhys = [];
      for (const r of this.remoteKarts.values()) {
        if (r.physics) otherPhys.push(r.physics);
      }

      this.localPhysics.update(dt, activeInput, otherPhys);
      this.localVisual.group.position.copy(this.localPhysics.position);
      this.localVisual.group.quaternion.copy(this.localPhysics.quaternion);

      this.localVisual.update(
        dt,
        this.localPhysics.speed,
        activeInput.steerLeft ? 1 : (activeInput.steerRight ? -1 : 0),
        this.localPhysics.driftTier,
        this.localPhysics.boostTimer > 0,
        this.localPhysics.isInvincible,
        this.localPhysics.isZapped
      );

      // Check item box pickups
      const pickedBoxId = this.itemManager.checkItemBoxCollisions(this.localPhysics.position);
      if (pickedBoxId !== null) {
        sound.playItemBoxRoll();
        if (this.isSinglePlayer) {
          const pool = ['MUSHROOM', 'RED_SHELL', 'GREEN_SHELL', 'BANANA', 'STAR', 'LIGHTNING'];
          this.setItem(pool[Math.floor(Math.random() * pool.length)]);
        } else {
          this.net.send({ type: 'pickup_item_box', boxId: pickedBoxId });
        }
      }

      // Check item usage
      if (activeInput.useItem && this.currentItem) {
        this.useItem();
      }

      // Check lap completion
      if (this.localPhysics.currentLap !== this.currentLap) {
        const lapTime = (Date.now() - this.lapStartTime) / 1000;
        this.currentLap = this.localPhysics.currentLap;
        this.lapStartTime = Date.now();

        if (this.currentLap === this.totalLaps) {
          sound.startMusic(true);
        }

        if (this.isSinglePlayer) {
          if (this.currentLap > this.totalLaps) {
            this.showPodium([
              { rank: 1, name: this.localName, finishTime: Date.now() - this.raceStartTime },
              { rank: 2, name: '[AI] Bot 1', finishTime: (Date.now() - this.raceStartTime) + 2400 },
              { rank: 3, name: '[AI] Bot 2', finishTime: (Date.now() - this.raceStartTime) + 4800 }
            ]);
            sound.playVictoryFanfare();
          }
        } else {
          this.net.send({
            type: 'lap_completed',
            lap: this.currentLap,
            lapTime
          });
        }
      }
    }

    // 2. Update Remote Players / AI Bots
    if (this.isSinglePlayer) {
      for (const bot of this.remoteKarts.values()) {
        if (bot.botController && bot.physics) {
          const botInput = bot.botController.update(dt);
          bot.physics.update(dt, botInput, [this.localPhysics]);
          bot.visual.group.position.copy(bot.physics.position);
          bot.visual.group.quaternion.copy(bot.physics.quaternion);
          bot.visual.update(
            dt,
            bot.physics.speed,
            botInput.steerLeft ? 1 : (botInput.steerRight ? -1 : 0),
            bot.physics.driftTier,
            bot.physics.boostTimer > 0,
            bot.physics.isInvincible,
            bot.physics.isZapped
          );
        }
      }
    } else {
      for (const [id, r] of this.remoteKarts.entries()) {
        const state = this.net.getInterpolatedPlayerState(id);
        if (state && r.visual) {
          r.visual.group.position.copy(state.position);
          r.visual.group.quaternion.copy(state.quaternion);
          r.visual.update(
            dt,
            state.velocity.length(),
            0,
            state.driftTier,
            false,
            state.isInvincible,
            state.isZapped
          );
        }
      }
    }

    // 3. Update 3D Items & Projectiles
    this.itemManager.update(dt);

    // 4. Update Dynamic Camera
    this.updateCamera(dt, inputState.lookBack);

    // 5. Send Network Input State (60Hz)
    const now = Date.now();
    if (!this.isSinglePlayer && this.net.connected && now - this.lastSendTickTime >= 16) {
      this.lastSendTickTime = now;
      this.net.send({
        type: 'player_input',
        pos: [this.localPhysics.position.x, this.localPhysics.position.y, this.localPhysics.position.z],
        quat: [this.localPhysics.quaternion.x, this.localPhysics.quaternion.y, this.localPhysics.quaternion.z, this.localPhysics.quaternion.w],
        vel: [this.localPhysics.velocity.x, this.localPhysics.velocity.y, this.localPhysics.velocity.z],
        drift: this.localPhysics.driftTier,
        lapProgress: this.localPhysics.lapProgress,
        checkpointIndex: this.localPhysics.lastClosestWpIndex
      });
    }

    // 6. Update HUD & Minimap
    this.updateHUD();
    this.renderMinimap();
  }

  updateCamera(dt, lookBack) {
    const kartPos = this.localPhysics.position;
    const heading = this.localPhysics.heading + (lookBack ? Math.PI : 0);

    const camDistance = 8.5;
    const camHeight = 3.6;

    const targetCamX = kartPos.x + Math.sin(heading) * camDistance;
    const targetCamZ = kartPos.z + Math.cos(heading) * camDistance;
    const targetCamY = kartPos.y + camHeight;

    this.camera.position.x = THREE.MathUtils.lerp(this.camera.position.x, targetCamX, dt * 12);
    this.camera.position.z = THREE.MathUtils.lerp(this.camera.position.z, targetCamZ, dt * 12);
    this.camera.position.y = THREE.MathUtils.lerp(this.camera.position.y, targetCamY, dt * 12);

    if (this.localPhysics.cameraShake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.localPhysics.cameraShake;
      this.camera.position.y += (Math.random() - 0.5) * this.localPhysics.cameraShake;
    }

    const lookTarget = kartPos.clone().add(new THREE.Vector3(0, 1.4, 0));
    this.camera.lookAt(lookTarget);

    this.camera.fov = 68 + this.localPhysics.fovKick;
    this.camera.updateProjectionMatrix();
  }

  updateHUD() {
    if (this.gameState !== 'racing' && this.gameState !== 'countdown') return;

    const speedKmh = Math.round(Math.abs(this.localPhysics.speed) * 3.6);
    const speedEl = document.getElementById('hud-speed-num');
    if (speedEl) speedEl.innerText = speedKmh;

    const lapEl = document.getElementById('hud-lap-text');
    if (lapEl) lapEl.innerText = `LAP ${Math.min(this.currentLap, this.totalLaps)} / ${this.totalLaps}`;

    let rank = 1;
    for (const r of this.remoteKarts.values()) {
      if (r.physics) {
        if (r.physics.currentLap > this.localPhysics.currentLap) rank++;
        else if (r.physics.currentLap === this.localPhysics.currentLap && r.physics.lapProgress > this.localPhysics.lapProgress) rank++;
      }
    }
    const suffix = ['TH', 'ST', 'ND', 'RD', 'TH', 'TH', 'TH', 'TH'][rank] || 'TH';
    const rankEl = document.getElementById('hud-rank-num');
    if (rankEl) rankEl.innerText = `${rank}${suffix}`;
  }

  renderMinimap() {
    if (!this.minimapCtx || !this.track) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const bounds = { minX: -150, maxX: 350, minZ: -300, maxZ: 250 };
    const toCanvasX = (x) => ((x - bounds.minX) / (bounds.maxX - bounds.minX)) * (w - 30) + 15;
    const toCanvasY = (z) => ((z - bounds.minZ) / (bounds.maxZ - bounds.minZ)) * (h - 30) + 15;

    ctx.beginPath();
    ctx.strokeStyle = '#223355';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    this.track.waypoints.forEach((wp, idx) => {
      const cx = toCanvasX(wp.point.x);
      const cy = toCanvasY(wp.point.z);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    this.track.waypoints.forEach((wp, idx) => {
      const cx = toCanvasX(wp.point.x);
      const cy = toCanvasY(wp.point.z);
      if (idx === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.closePath();
    ctx.stroke();

    for (const r of this.remoteKarts.values()) {
      const pos = r.physics ? r.physics.position : (r.visual ? r.visual.group.position : null);
      if (pos) {
        ctx.beginPath();
        ctx.arc(toCanvasX(pos.x), toCanvasY(pos.z), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0055';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.arc(toCanvasX(this.localPhysics.position.x), toCanvasY(this.localPhysics.position.z), 6, 0, Math.PI * 2);
    ctx.fillStyle = '#00ffea';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  showPodium(podium) {
    this.gameState = 'podium';
    document.getElementById('screen-hud').classList.add('hidden');
    document.getElementById('screen-podium').classList.remove('hidden');

    const list = document.getElementById('podium-results-list');
    if (!list) return;
    list.innerHTML = '';
    podium.forEach((entry, idx) => {
      const row = document.createElement('div');
      row.className = 'podium-row';
      const timeStr = entry.finishTime ? `${(entry.finishTime / 1000).toFixed(2)}s` : 'DNF';
      row.innerHTML = `
        <div class="podium-rank">#${idx + 1}</div>
        <div class="podium-name">${entry.name || 'Racer'}</div>
        <div class="podium-time">${timeStr}</div>
      `;
      list.appendChild(row);
    });
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.update(dt);
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}

// Boot game on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new Game();
});
