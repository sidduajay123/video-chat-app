// tests/server.test.js — Integration tests for Express + Socket.IO server

const request = require('supertest');
const { app, server, io, matchmaker } = require('../server');
const { io: Client } = require('socket.io-client');

const PORT = 3001;
let httpServer;
let clientUrl;

beforeAll((done) => {
  httpServer = server.listen(PORT, () => {
    clientUrl = `http://localhost:${PORT}`;
    done();
  });
});

afterAll((done) => {
  io.close();
  httpServer.close(done);
});

// ── HTTP Endpoints ─────────────────────────────────────────────────────────
describe('HTTP Endpoints', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  test('GET /api/stats returns queue stats', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('activeRooms');
    expect(res.body).toHaveProperty('queues');
  });

  test('GET / serves index.html', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});

// ── Socket.IO: Connection ──────────────────────────────────────────────────
describe('Socket.IO Connection', () => {
  test('client can connect successfully', (done) => {
    const client = Client(clientUrl, { transports: ['websocket'] });
    client.on('connect', () => {
      expect(client.connected).toBe(true);
      client.disconnect();
      done();
    });
  });
});

// ── Socket.IO: Queue & Matching ────────────────────────────────────────────
describe('Socket.IO: Queue & Matching', () => {
  test('joining queue with invalid gender emits error', (done) => {
    const client = Client(clientUrl, { transports: ['websocket'] });
    client.on('connect', () => {
      client.emit('join-queue', { gender: 'alien', mode: 'video', location: {} });
    });
    client.on('error', (err) => {
      expect(err.message).toBeDefined();
      client.disconnect();
      done();
    });
  });

  test('joining queue with invalid mode emits error', (done) => {
    const client = Client(clientUrl, { transports: ['websocket'] });
    client.on('connect', () => {
      client.emit('join-queue', { gender: 'male', mode: 'audio', location: {} });
    });
    client.on('error', (err) => {
      expect(err.message).toBeDefined();
      client.disconnect();
      done();
    });
  });

  test('single user gets queued event', (done) => {
    const client = Client(clientUrl, { transports: ['websocket'] });
    client.on('connect', () => {
      client.emit('join-queue', { gender: 'male', mode: 'video', location: { city: 'Delhi' } });
    });
    client.on('queued', (data) => {
      expect(data.message).toBeDefined();
      client.disconnect();
      done();
    });
  });

  test('opposite gender users in same mode get matched', (done) => {
    const male = Client(clientUrl, { transports: ['websocket'] });
    const female = Client(clientUrl, { transports: ['websocket'] });
    let matchCount = 0;

    const onMatch = () => {
      matchCount++;
      if (matchCount === 2) {
        male.disconnect();
        female.disconnect();
        done();
      }
    };

    male.on('connect', () => {
      male.emit('join-queue', { gender: 'male', mode: 'video', location: { city: 'Mumbai' } });
    });
    female.on('connect', () => {
      female.emit('join-queue', { gender: 'female', mode: 'video', location: { city: 'London' } });
    });

    male.on('matched', (data) => {
      expect(data.roomId).toBeDefined();
      expect(data.peerLocation.city).toBe('London');
      onMatch();
    });
    female.on('matched', (data) => {
      expect(data.roomId).toBeDefined();
      expect(data.peerLocation.city).toBe('Mumbai');
      onMatch();
    });
  }, 10000);

  test('same gender users do NOT get matched', (done) => {
    const male1 = Client(clientUrl, { transports: ['websocket'] });
    const male2 = Client(clientUrl, { transports: ['websocket'] });
    let queuedCount = 0;
    let matchedCount = 0;

    const onQueued = () => {
      queuedCount++;
      if (queuedCount === 2) {
        // Give time to check no match
        setTimeout(() => {
          expect(matchedCount).toBe(0);
          male1.disconnect();
          male2.disconnect();
          done();
        }, 500);
      }
    };

    male1.on('connect', () => {
      male1.emit('join-queue', { gender: 'male', mode: 'video', location: {} });
    });
    male2.on('connect', () => {
      male2.emit('join-queue', { gender: 'male', mode: 'video', location: {} });
    });

    male1.on('queued', onQueued);
    male2.on('queued', onQueued);
    male1.on('matched', () => matchedCount++);
    male2.on('matched', () => matchedCount++);
  }, 10000);

  test('peer-left emitted when a user disconnects from a room', (done) => {
    const male = Client(clientUrl, { transports: ['websocket'] });
    const female = Client(clientUrl, { transports: ['websocket'] });
    let matched = 0;

    male.on('connect', () => {
      male.emit('join-queue', { gender: 'male', mode: 'text', location: {} });
    });
    female.on('connect', () => {
      female.emit('join-queue', { gender: 'female', mode: 'text', location: {} });
    });

    male.on('matched', () => { matched++; if (matched === 2) male.disconnect(); });
    female.on('matched', () => { matched++; if (matched === 2) male.disconnect(); });

    female.on('peer-left', (data) => {
      expect(['disconnected', 'skipped']).toContain(data.reason);
      female.disconnect();
      done();
    });
  }, 10000);
});

// ── Socket.IO: Messaging ───────────────────────────────────────────────────
describe('Socket.IO: Messaging', () => {
  test('message is relayed to peer', (done) => {
    const male = Client(clientUrl, { transports: ['websocket'] });
    const female = Client(clientUrl, { transports: ['websocket'] });
    let matchCount = 0;
    let roomId = null;

    male.on('connect', () => {
      male.emit('join-queue', { gender: 'male', mode: 'text', location: {} });
    });
    female.on('connect', () => {
      female.emit('join-queue', { gender: 'female', mode: 'text', location: {} });
    });

    male.on('matched', (data) => {
      roomId = data.roomId;
      matchCount++;
      if (matchCount === 2) {
        male.emit('send-message', { roomId, text: 'Hello!', timestamp: Date.now() });
      }
    });
    female.on('matched', () => { matchCount++; });

    female.on('receive-message', (msg) => {
      expect(msg.text).toBe('Hello!');
      expect(msg.fromPeer).toBe(true);
      male.disconnect();
      female.disconnect();
      done();
    });
  }, 10000);
});
