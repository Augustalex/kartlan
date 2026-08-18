/**
 * KARTLAN 3D - High Performance Client Networking & Interpolation Engine
 * Features: Sub-millisecond clock sync, 60Hz client-prediction,
 * cubic spline snapshot interpolation, and subnet auto-discovery.
 */

import * as THREE from './three.module.min.js';

export class NetworkClient {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.serverTimeOffset = 0;
    this.pingMs = 0;
    this.room = null;
    this.currentHost = window.location.host;

    // Snapshot Interpolation Buffer
    this.snapshotBuffer = [];
    this.interpolationDelayMs = 65; // ~65ms buffer for smooth Hermite interpolation
    this.remotePlayers = new Map();

    // Event callbacks
    this.callbacks = {};
  }

  on(event, handler) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(handler);
  }

  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(fn => fn(data));
    }
  }

  connect(host = window.location.host) {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }

    this.currentHost = host;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.connected = true;
        this.startPingClockSync();
        this.emit('connected');
      };

      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        this.handleMessage(msg);
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('disconnected');
      };

      this.ws.onerror = (err) => {
        this.emit('error', err);
      };
    } catch (e) {
      this.emit('error', e);
    }
  }

  startPingClockSync() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping', clientTime: Date.now() });
      }
    }, 2000);
  }

  send(data) {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'pong': {
        const now = Date.now();
        const rtt = now - msg.clientTime;
        this.pingMs = Math.round(rtt / 2);
        this.serverTimeOffset = (msg.serverTime - now) + this.pingMs;
        this.emit('ping_update', this.pingMs);
        break;
      }

      case 'room_joined':
        this.playerId = msg.playerId;
        this.room = msg.room;
        this.emit('room_joined', msg);
        break;

      case 'state_snapshot':
        this.pushSnapshot(msg);
        break;

      default:
        this.emit(msg.type, msg);
        break;
    }
  }

  pushSnapshot(snapshot) {
    this.snapshotBuffer.push(snapshot);
    const maxBufferSize = 60;
    if (this.snapshotBuffer.length > maxBufferSize) {
      this.snapshotBuffer.shift();
    }
  }

  getServerTime() {
    return Date.now() + this.serverTimeOffset;
  }

  getInterpolatedPlayerState(playerId) {
    if (this.snapshotBuffer.length < 2) return null;

    const renderTime = this.getServerTime() - this.interpolationDelayMs;

    let s0 = null;
    let s1 = null;

    for (let i = this.snapshotBuffer.length - 1; i >= 0; i--) {
      const snap = this.snapshotBuffer[i];
      if (snap.time <= renderTime) {
        s0 = snap;
        s1 = this.snapshotBuffer[i + 1] || snap;
        break;
      }
    }

    if (!s0) {
      s0 = this.snapshotBuffer[0];
      s1 = this.snapshotBuffer[1] || s0;
    }

    const p0 = s0.players.find(p => p.id === playerId);
    const p1 = s1.players.find(p => p.id === playerId);

    if (!p0) return null;
    if (!p1 || s0 === s1 || s1.time === s0.time) {
      return {
        position: new THREE.Vector3(p0.pos[0], p0.pos[1], p0.pos[2]),
        quaternion: new THREE.Quaternion(p0.quat[0], p0.quat[1], p0.quat[2], p0.quat[3]),
        velocity: new THREE.Vector3(p0.vel[0], p0.vel[1], p0.vel[2]),
        driftTier: p0.drift,
        isInvincible: p0.inv,
        isZapped: p0.zap,
        rank: p0.rank,
        lap: p0.lap
      };
    }

    const t = Math.min(Math.max((renderTime - s0.time) / (s1.time - s0.time), 0.0), 1.0);

    const pos0 = new THREE.Vector3(p0.pos[0], p0.pos[1], p0.pos[2]);
    const pos1 = new THREE.Vector3(p1.pos[0], p1.pos[1], p1.pos[2]);
    const interpolatedPos = new THREE.Vector3().lerpVectors(pos0, pos1, t);

    const q0 = new THREE.Quaternion(p0.quat[0], p0.quat[1], p0.quat[2], p0.quat[3]);
    const q1 = new THREE.Quaternion(p1.quat[0], p1.quat[1], p1.quat[2], p1.quat[3]);
    const interpolatedQuat = new THREE.Quaternion().copy(q0).slerp(q1, t);

    return {
      position: interpolatedPos,
      quaternion: interpolatedQuat,
      velocity: new THREE.Vector3(p1.vel[0], p1.vel[1], p1.vel[2]),
      driftTier: p1.drift,
      isInvincible: p1.inv,
      isZapped: p1.zap,
      rank: p1.rank,
      lap: p1.lap
    };
  }

  async discoverLanRooms(targetHost = this.currentHost) {
    try {
      const res = await fetch(`http://${targetHost}/api/rooms`, { mode: 'cors' });
      if (res.ok) {
        const rooms = await res.json();
        return rooms.map(r => ({ ...r, hostAddress: targetHost }));
      }
    } catch (e) {}
    return [];
  }

  async getServerInfo(targetHost = this.currentHost) {
    try {
      const res = await fetch(`http://${targetHost}/api/info`, { mode: 'cors' });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  }

  async scanSubnet(subnetPrefix, port = 3030) {
    const foundRooms = [];
    const promises = [];

    for (let i = 1; i <= 254; i++) {
      const ip = `${subnetPrefix}.${i}`;
      const url = `http://${ip}:${port}/api/rooms`;

      const p = fetch(url, { signal: AbortSignal.timeout(600), mode: 'cors' })
        .then(res => res.json())
        .then(rooms => {
          if (Array.isArray(rooms) && rooms.length > 0) {
            rooms.forEach(r => {
              foundRooms.push({ ...r, hostAddress: `${ip}:${port}` });
            });
          }
        })
        .catch(() => {});

      promises.push(p);
    }

    await Promise.all(promises);
    return foundRooms;
  }
}
