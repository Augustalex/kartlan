/**
 * KARTLAN 3D - Authoritative LAN Multiplayer Game Server
 * Features: Dynamic port auto-selection, WebSocket sync, UDP LAN auto-discovery,
 * room lobby management, authoritative checkpoint/ranking & item validation.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const dgram = require('dgram');
const { WebSocketServer, WebSocket } = require('ws');

let DEFAULT_PORT = parseInt(process.env.PORT || '3030', 10);
const UDP_BEACON_PORT = 41234;
const TICK_RATE = 60; // 60Hz server tick rate
const SNAPSHOT_INTERVAL_MS = 1000 / TICK_RATE;

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());

// Get LAN IPv4 addresses
function getLanIps() {
  const ips = [];
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push({ name, address: net.address });
      }
    }
  }
  return ips;
}

// Global Server State
const rooms = new Map(); // roomId -> Room
let nextRoomId = 1000;
let nextPlayerId = 1;
let currentServerPort = DEFAULT_PORT;

class Room {
  constructor(id, name, hostId, options = {}) {
    this.id = id;
    this.name = name || `Race #${id}`;
    this.hostId = hostId;
    this.trackId = options.trackId || 'circuit_neon';
    this.laps = Math.min(Math.max(parseInt(options.laps || 3, 10), 1), 7);
    this.maxPlayers = options.maxPlayers || 8;
    this.fillWithBots = options.fillWithBots !== undefined ? options.fillWithBots : true;
    this.state = 'lobby'; // 'lobby' | 'countdown' | 'racing' | 'finished'
    this.countdownTimer = 0;
    this.raceStartTime = 0;
    this.tick = 0;
    this.players = new Map(); // playerId -> Player
    this.projectiles = []; // active shells / hazards
    this.nextProjectileId = 1;
    this.itemBoxes = [];
    this.podium = []; // finished player rankings
    this.initItemBoxes();
  }

  initItemBoxes() {
    this.itemBoxes = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      this.itemBoxes.push({
        id: i,
        progress: (i / count),
        active: true,
        respawnTimer: 0
      });
    }
  }

  addPlayer(ws, name, color, character) {
    const playerId = `p_${nextPlayerId++}`;
    const isHost = this.players.size === 0;
    if (isHost) this.hostId = playerId;

    const player = {
      id: playerId,
      ws,
      name: name || `Racer ${this.players.size + 1}`,
      color: color || '#00f0ff',
      character: character || 'neon',
      isHost,
      isReady: isHost,
      isBot: false,
      position: { x: 0, y: 0.5, z: 0 },
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
      velocity: { x: 0, y: 0, z: 0 },
      steering: 0,
      driftState: 0,
      item: null,
      isInvincible: false,
      invincibleUntil: 0,
      isZapped: false,
      zappedUntil: 0,
      currentLap: 1,
      checkpointIndex: 0,
      lapProgress: 0,
      totalDistance: 0,
      raceRank: 1,
      finished: false,
      finishTime: 0,
      bestLapTime: 0,
      currentLapStartTime: 0,
      ping: 0,
      lastInputTick: 0
    };

    this.players.set(playerId, player);
    return player;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    if (this.hostId === playerId && this.players.size > 0) {
      const nextHost = this.players.values().next().value;
      this.hostId = nextHost.id;
      nextHost.isHost = true;
      nextHost.isReady = true;
    }
  }

  broadcast(message, excludePlayerId = null) {
    const payload = JSON.stringify(message);
    for (const player of this.players.values()) {
      if (player.id !== excludePlayerId && player.ws && player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(payload);
      }
    }
  }

  startCountdown() {
    if (this.state !== 'lobby') return;
    this.state = 'countdown';
    this.countdownTimer = 3.99;
    this.podium = [];

    // Set starting grid positions
    let gridSlot = 0;
    for (const player of this.players.values()) {
      const row = Math.floor(gridSlot / 2);
      const col = (gridSlot % 2) === 0 ? -3.5 : 3.5;
      player.position = { x: col, y: 0.5, z: -row * 9 };
      player.quaternion = { x: 0, y: 0, z: 0, w: 1 };
      player.velocity = { x: 0, y: 0, z: 0 };
      player.currentLap = 1;
      player.checkpointIndex = 0;
      player.lapProgress = 0;
      player.finished = false;
      player.finishTime = 0;
      player.item = null;
      gridSlot++;
    }

    this.broadcast({
      type: 'race_countdown_started',
      countdown: 3,
      trackId: this.trackId,
      laps: this.laps,
      players: this.getPublicPlayerList()
    });
  }

  update(deltaTime) {
    this.tick++;

    if (this.state === 'countdown') {
      const prevInt = Math.ceil(this.countdownTimer);
      this.countdownTimer -= deltaTime;
      const newInt = Math.ceil(this.countdownTimer);

      if (prevInt !== newInt && newInt > 0) {
        this.broadcast({ type: 'countdown_tick', count: newInt });
      }

      if (this.countdownTimer <= 0) {
        this.state = 'racing';
        this.raceStartTime = Date.now();
        for (const p of this.players.values()) {
          p.currentLapStartTime = this.raceStartTime;
        }
        this.broadcast({ type: 'race_started', startTime: this.raceStartTime });
      }
      return;
    }

    if (this.state !== 'racing') return;
    const now = Date.now();

    // Update item boxes
    for (const box of this.itemBoxes) {
      if (!box.active) {
        box.respawnTimer -= deltaTime;
        if (box.respawnTimer <= 0) {
          box.active = true;
          this.broadcast({ type: 'item_box_respawned', boxId: box.id });
        }
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.lifeTime -= deltaTime;

      if (proj.lifeTime <= 0) {
        this.projectiles.splice(i, 1);
        this.broadcast({ type: 'projectile_destroyed', id: proj.id });
        continue;
      }

      if (proj.type === 'GREEN_SHELL' || proj.type === 'RED_SHELL') {
        proj.position.x += proj.velocity.x * deltaTime;
        proj.position.z += proj.velocity.z * deltaTime;
      }

      for (const player of this.players.values()) {
        if (player.finished) continue;
        if (proj.ownerId === player.id && proj.maxLife - proj.lifeTime < 0.5) continue;

        const dx = player.position.x - proj.position.x;
        const dz = player.position.z - proj.position.z;
        if (Math.hypot(dx, dz) < 2.2) {
          if (player.isInvincible && now < player.invincibleUntil) {
            this.projectiles.splice(i, 1);
            this.broadcast({ type: 'projectile_destroyed', id: proj.id });
            break;
          }

          this.broadcast({
            type: 'player_hit',
            targetId: player.id,
            attackerId: proj.ownerId,
            itemType: proj.type,
            position: proj.position
          });

          this.projectiles.splice(i, 1);
          this.broadcast({ type: 'projectile_destroyed', id: proj.id });
          break;
        }
      }
    }

    this.calculateRanks();
    this.broadcastStateSnapshot();
  }

  calculateRanks() {
    const sorted = Array.from(this.players.values()).sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      if (a.currentLap !== b.currentLap) return b.currentLap - a.currentLap;
      return b.lapProgress - a.lapProgress;
    });

    sorted.forEach((player, idx) => {
      player.raceRank = idx + 1;
    });
  }

  broadcastStateSnapshot() {
    const playersData = [];
    for (const p of this.players.values()) {
      playersData.push({
        id: p.id,
        pos: [Math.round(p.position.x * 100) / 100, Math.round(p.position.y * 100) / 100, Math.round(p.position.z * 100) / 100],
        quat: [Math.round(p.quaternion.x * 1000) / 1000, Math.round(p.quaternion.y * 1000) / 1000, Math.round(p.quaternion.z * 1000) / 1000, Math.round(p.quaternion.w * 1000) / 1000],
        vel: [Math.round(p.velocity.x * 10) / 10, Math.round(p.velocity.y * 10) / 10, Math.round(p.velocity.z * 10) / 10],
        steer: Math.round(p.steering * 100) / 100,
        drift: p.driftState,
        item: p.item,
        inv: p.isInvincible,
        zap: p.isZapped,
        lap: p.currentLap,
        prog: Math.round(p.lapProgress * 1000) / 1000,
        rank: p.raceRank,
        fin: p.finished
      });
    }

    const projectilesData = this.projectiles.map(p => ({
      id: p.id,
      type: p.type,
      pos: [Math.round(p.position.x * 10) / 10, Math.round(p.position.y * 10) / 10, Math.round(p.position.z * 10) / 10]
    }));

    this.broadcast({
      type: 'state_snapshot',
      tick: this.tick,
      time: Date.now(),
      players: playersData,
      projectiles: projectilesData
    });
  }

  handlePlayerInput(playerId, data) {
    const player = this.players.get(playerId);
    if (!player || player.finished) return;

    if (data.pos) player.position = { x: data.pos[0], y: data.pos[1], z: data.pos[2] };
    if (data.quat) player.quaternion = { x: data.quat[0], y: data.quat[1], z: data.quat[2], w: data.quat[3] };
    if (data.vel) player.velocity = { x: data.vel[0], y: data.vel[1], z: data.vel[2] };
    if (data.drift !== undefined) player.driftState = data.drift;
    if (data.lapProgress !== undefined) player.lapProgress = data.lapProgress;
    if (data.checkpointIndex !== undefined) player.checkpointIndex = data.checkpointIndex;
  }

  handlePlayerLapCompleted(playerId, lapNumber, lapTime) {
    const player = this.players.get(playerId);
    if (!player || player.finished) return;

    player.currentLap = lapNumber;
    if (player.bestLapTime === 0 || lapTime < player.bestLapTime) {
      player.bestLapTime = lapTime;
    }

    if (lapNumber > this.laps) {
      player.finished = true;
      player.finishTime = Date.now() - this.raceStartTime;
      this.podium.push({
        id: player.id,
        name: player.name,
        color: player.color,
        finishTime: player.finishTime,
        bestLapTime: player.bestLapTime,
        rank: this.podium.length + 1
      });

      this.broadcast({
        type: 'player_finished',
        player: this.podium[this.podium.length - 1],
        podium: this.podium
      });

      const allFinished = Array.from(this.players.values()).every(p => p.finished);
      if (allFinished || this.podium.length >= this.players.size) {
        this.finishRace();
      }
    } else {
      this.broadcast({
        type: 'lap_completed',
        playerId: player.id,
        lap: lapNumber,
        lapTime
      });
    }
  }

  finishRace() {
    this.state = 'finished';
    this.broadcast({
      type: 'race_over',
      podium: this.podium,
      players: this.getPublicPlayerList()
    });
  }

  handleItemPickup(playerId, boxId) {
    const player = this.players.get(playerId);
    const box = this.itemBoxes.find(b => b.id === boxId);
    if (!player || !box || !box.active || player.item) return;

    box.active = false;
    box.respawnTimer = 4.5;

    const pool = ['BANANA', 'GREEN_SHELL', 'RED_SHELL', 'MUSHROOM', 'STAR', 'LIGHTNING'];
    const item = pool[Math.floor(Math.random() * pool.length)];
    player.item = item;

    this.broadcast({
      type: 'item_box_collected',
      boxId: box.id,
      playerId: player.id,
      item
    });
  }

  handleUseItem(playerId, itemData) {
    const player = this.players.get(playerId);
    if (!player || !player.item) return;

    const itemType = player.item;
    player.item = null;
    const now = Date.now();

    if (itemType === 'MUSHROOM') {
      this.broadcast({ type: 'item_used_boost', playerId: player.id });
    } else if (itemType === 'STAR') {
      player.isInvincible = true;
      player.invincibleUntil = now + 7500;
      this.broadcast({ type: 'item_used_star', playerId: player.id, duration: 7500 });
    } else if (itemType === 'LIGHTNING') {
      for (const opp of this.players.values()) {
        if (opp.id !== player.id && opp.raceRank < player.raceRank && !opp.isInvincible) {
          opp.isZapped = true;
          opp.zappedUntil = now + 5000;
          this.broadcast({ type: 'player_zapped', playerId: opp.id, duration: 5000 });
        }
      }
      this.broadcast({ type: 'item_used_lightning', userPlayerId: player.id });
    } else if (itemType === 'BANANA') {
      const forwardX = -Math.sin(itemData.heading || 0);
      const forwardZ = -Math.cos(itemData.heading || 0);
      const proj = {
        id: `proj_${this.nextProjectileId++}`,
        type: 'BANANA',
        ownerId: player.id,
        position: {
          x: player.position.x - forwardX * 2.5,
          y: player.position.y,
          z: player.position.z - forwardZ * 2.5
        },
        velocity: { x: 0, y: 0, z: 0 },
        lifeTime: 60,
        maxLife: 60
      };
      this.projectiles.push(proj);
      this.broadcast({ type: 'projectile_spawned', projectile: proj });
    } else if (itemType === 'GREEN_SHELL' || itemType === 'RED_SHELL') {
      const forwardX = -Math.sin(itemData.heading || 0);
      const forwardZ = -Math.cos(itemData.heading || 0);
      const speed = 40;
      const proj = {
        id: `proj_${this.nextProjectileId++}`,
        type: itemType,
        ownerId: player.id,
        position: {
          x: player.position.x + forwardX * 3.0,
          y: player.position.y + 0.3,
          z: player.position.z + forwardZ * 3.0
        },
        velocity: { x: forwardX * speed, y: 0, z: forwardZ * speed },
        lifeTime: 12,
        maxLife: 12
      };
      this.projectiles.push(proj);
      this.broadcast({ type: 'projectile_spawned', projectile: proj });
    }
  }

  getPublicPlayerList() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      character: p.character,
      isHost: p.isHost,
      isReady: p.isReady,
      isBot: p.isBot,
      raceRank: p.raceRank,
      finished: p.finished,
      finishTime: p.finishTime
    }));
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      trackId: this.trackId,
      laps: this.laps,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      state: this.state
    };
  }
}

// REST API endpoints
app.get('/api/info', (req, res) => {
  res.json({
    name: 'KARTLAN 3D Game Server',
    version: '1.0.0',
    lanIps: getLanIps(),
    port: currentServerPort,
    roomsCount: rooms.size
  });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(r => r.toJSON());
  res.json(roomList);
});

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// WebSocket message handler
wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentPlayer = null;

  ws.on('message', (messageRaw) => {
    let data;
    try {
      data = JSON.parse(messageRaw);
    } catch (err) {
      return;
    }

    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          clientTime: data.clientTime,
          serverTime: Date.now()
        }));
        break;

      case 'create_room': {
        const roomId = `${nextRoomId++}`;
        const room = new Room(roomId, data.name, null, {
          trackId: data.trackId,
          laps: data.laps,
          fillWithBots: data.fillWithBots
        });
        rooms.set(roomId, room);

        currentPlayer = room.addPlayer(ws, data.playerName, data.kartColor, data.character);
        currentRoom = room;

        ws.send(JSON.stringify({
          type: 'room_joined',
          room: room.toJSON(),
          playerId: currentPlayer.id,
          players: room.getPublicPlayerList()
        }));
        break;
      }

      case 'join_room': {
        const room = rooms.get(data.roomId);
        if (!room) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
          return;
        }
        if (room.state !== 'lobby') {
          ws.send(JSON.stringify({ type: 'error', message: 'Race already in progress' }));
          return;
        }

        currentPlayer = room.addPlayer(ws, data.playerName, data.kartColor, data.character);
        currentRoom = room;

        ws.send(JSON.stringify({
          type: 'room_joined',
          room: room.toJSON(),
          playerId: currentPlayer.id,
          players: room.getPublicPlayerList()
        }));

        room.broadcast({
          type: 'player_joined',
          player: {
            id: currentPlayer.id,
            name: currentPlayer.name,
            color: currentPlayer.color,
            character: currentPlayer.character,
            isHost: currentPlayer.isHost,
            isReady: currentPlayer.isReady
          },
          players: room.getPublicPlayerList()
        }, currentPlayer.id);
        break;
      }

      case 'update_settings': {
        if (!currentRoom || !currentPlayer || !currentPlayer.isHost) return;
        if (data.trackId) currentRoom.trackId = data.trackId;
        if (data.laps) currentRoom.laps = Math.min(Math.max(parseInt(data.laps, 10), 1), 7);

        currentRoom.broadcast({
          type: 'room_settings_updated',
          room: currentRoom.toJSON()
        });
        break;
      }

      case 'set_ready': {
        if (!currentRoom || !currentPlayer) return;
        currentPlayer.isReady = !!data.ready;
        currentRoom.broadcast({
          type: 'player_ready_changed',
          playerId: currentPlayer.id,
          isReady: currentPlayer.isReady,
          players: currentRoom.getPublicPlayerList()
        });
        break;
      }

      case 'start_race': {
        if (!currentRoom || !currentPlayer || !currentPlayer.isHost) return;
        currentRoom.startCountdown();
        break;
      }

      case 'player_input': {
        if (!currentRoom || !currentPlayer) return;
        currentRoom.handlePlayerInput(currentPlayer.id, data);
        break;
      }

      case 'pickup_item_box': {
        if (!currentRoom || !currentPlayer) return;
        currentRoom.handleItemPickup(currentPlayer.id, data.boxId);
        break;
      }

      case 'use_item': {
        if (!currentRoom || !currentPlayer) return;
        currentRoom.handleUseItem(currentPlayer.id, data);
        break;
      }

      case 'lap_completed': {
        if (!currentRoom || !currentPlayer) return;
        currentRoom.handlePlayerLapCompleted(currentPlayer.id, data.lap, data.lapTime);
        break;
      }

      case 'leave_room': {
        if (currentRoom && currentPlayer) {
          const r = currentRoom;
          r.removePlayer(currentPlayer.id);
          r.broadcast({
            type: 'player_left',
            playerId: currentPlayer.id,
            players: r.getPublicPlayerList(),
            newHostId: r.hostId
          });
          if (r.players.size === 0) {
            rooms.delete(r.id);
          }
          currentRoom = null;
          currentPlayer = null;
        }
        break;
      }
    }
  });

  ws.on('close', () => {
    if (currentRoom && currentPlayer) {
      const r = currentRoom;
      r.removePlayer(currentPlayer.id);
      r.broadcast({
        type: 'player_left',
        playerId: currentPlayer.id,
        players: r.getPublicPlayerList(),
        newHostId: r.hostId
      });
      if (r.players.size === 0) {
        rooms.delete(r.id);
      }
    }
  });
});

// Server Tick Loop (60Hz)
let lastTickTime = Date.now();
setInterval(() => {
  const now = Date.now();
  const deltaTime = (now - lastTickTime) / 1000;
  lastTickTime = now;

  for (const [roomId, room] of rooms.entries()) {
    room.update(deltaTime);
  }
}, SNAPSHOT_INTERVAL_MS);

// UDP LAN Discovery Beacon
const udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
udpSocket.on('error', () => {});
udpSocket.on('message', (msg, rinfo) => {
  if (msg.toString().includes('KARTLAN_DISCOVER')) {
    const lanIps = getLanIps();
    const response = JSON.stringify({
      type: 'KARTLAN_BEACON_RESPONSE',
      name: 'KARTLAN 3D Game Server',
      port: currentServerPort,
      lanIps: lanIps.map(i => i.address),
      roomsCount: rooms.size
    });
    udpSocket.send(response, rinfo.port, rinfo.address);
  }
});

udpSocket.bind(UDP_BEACON_PORT, () => {
  try {
    udpSocket.setBroadcast(true);
  } catch (e) {}

  setInterval(() => {
    try {
      const lanIps = getLanIps();
      const beaconMsg = JSON.stringify({
        type: 'KARTLAN_BEACON',
        serverName: 'KARTLAN 3D',
        port: currentServerPort,
        lanIps: lanIps.map(i => i.address),
        rooms: Array.from(rooms.values()).map(r => r.toJSON())
      });
      udpSocket.send(beaconMsg, UDP_BEACON_PORT, '255.255.255.255');
    } catch (err) {}
  }, 2500);
});

function startListening(port) {
  currentServerPort = port;
  server.listen(port, '0.0.0.0', () => {
    const lanIps = getLanIps();
    console.log('\n======================================================');
    console.log('   🏎️   KARTLAN 3D - WI-FI LAN MULTIPLAYER SERVER   🏎️');
    console.log('======================================================');
    console.log(` Local:   http://localhost:${port}`);
    if (lanIps.length > 0) {
      console.log(' LAN IPs for friends on same Wi-Fi:');
      for (const iface of lanIps) {
        console.log(`   👉 ${iface.name}: \x1b[36mhttp://${iface.address}:${port}\x1b[0m`);
      }
    } else {
      console.log(' No external Wi-Fi IP detected (Playing locally)');
    }
    console.log('======================================================\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is in use, trying port ${port + 1}...`);
      startListening(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

if (require.main === module) {
  startListening(DEFAULT_PORT);
}

module.exports = { server, app, rooms, Room };
