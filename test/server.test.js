/**
 * Automated Test Suite for KARTLAN 3D
 */

const http = require('http');
const { WebSocket } = require('ws');
const { server } = require('../server.js');

const PORT = 3099;
process.env.PORT = PORT.toString();

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  }
}

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`--- RUNNING KARTLAN TEST SUITE (Port ${PORT}) ---`);

  // Test 1: HTTP API /api/info
  await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}/api/info`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        assert(json.name.includes('KARTLAN 3D'), 'API /api/info returns correct server name');
        assert(Array.isArray(json.lanIps), 'API /api/info returns LAN IP addresses array');
        resolve();
      });
    });
  });

  // Test 2: HTTP API /api/rooms
  await new Promise((resolve) => {
    http.get(`http://127.0.0.1:${PORT}/api/rooms`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const json = JSON.parse(data);
        assert(Array.isArray(json), 'API /api/rooms returns array of active rooms');
        resolve();
      });
    });
  });

  // Test 3: WebSocket Ping / Pong Clock Sync
  await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'ping', clientTime: Date.now() }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'pong') {
        assert(typeof msg.serverTime === 'number', 'WebSocket pong responds with serverTime for NTP clock sync');
        ws.close();
        resolve();
      }
    });
  });

  // Test 4: WebSocket Room Creation & Multiplayer Sync
  await new Promise((resolve) => {
    const ws1 = new WebSocket(`ws://127.0.0.1:${PORT}`);
    let roomId = null;

    ws1.on('open', () => {
      ws1.send(JSON.stringify({
        type: 'create_room',
        name: 'Test Grand Prix',
        playerName: 'HostPlayer',
        kartColor: '#00f0ff',
        trackId: 'circuit_neon',
        laps: 3
      }));
    });

    ws1.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.type === 'room_joined') {
        assert(msg.room.name === 'Test Grand Prix', 'Room created and joined successfully');
        assert(msg.players.length === 1, 'Host registered in players list');
        roomId = msg.room.id;

        // Connect second player to the room
        const ws2 = new WebSocket(`ws://127.0.0.1:${PORT}`);
        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'join_room',
            roomId: roomId,
            playerName: 'FriendRacer',
            kartColor: '#ff0055'
          }));
        });

        ws2.on('message', (raw2) => {
          const msg2 = JSON.parse(raw2);
          if (msg2.type === 'room_joined') {
            assert(msg2.players.length === 2, 'Second player joined LAN room and player list synchronized');
            ws1.close();
            ws2.close();
            resolve();
          }
        });
      }
    });
  });

  console.log(`\n🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  server.close(() => {
    process.exit(0);
  });
});
