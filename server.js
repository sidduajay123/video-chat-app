// server.js — Express + Socket.IO entrypoint

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const Matchmaker = require('./matchmaker');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'", "http:", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "cdn.socket.io"],
      connectSrc: ["'self'", "wss:", "ws:", "https://nominatim.openstreetmap.org", "http:", "https:"],
      mediaSrc: ["'self'", "blob:", "http:", "https:"],
      imgSrc: ["'self'", "data:", "blob:", "http:", "https:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      upgradeInsecureRequests: null // Disable forcing HTTPS upgrades
    }
  }
}));
app.use(cors());
app.use(express.json());

// Rate limiter on API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', apiLimiter);

// ─── Static Files ─────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Health & Stats Endpoints ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/stats', (req, res) => {
  res.json(matchmaker.getStats());
});

// ─── Matchmaker ───────────────────────────────────────────────────────────────
const matchmaker = new Matchmaker();

// ─── Socket.IO Events ─────────────────────────────────────────────────────────
const joinRateLimitMap = new Map(); // socketId -> last join timestamp

// Broadcast active user count
function broadcastUserCount() {
  const count = io.sockets.sockets.size;
  io.emit('user-count', { count });
}

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);
  broadcastUserCount();

  // ── Join Queue ──────────────────────────────────────────────────────────────
  socket.on('join-queue', ({ gender, mode, location, avatar }) => {
    // Rate limit: max 1 join per 100ms
    const lastJoin = joinRateLimitMap.get(socket.id) || 0;
    const now = Date.now();
    if (now - lastJoin < 100) {
      socket.emit('error', { message: 'Too many requests. Please wait.' });
      return;
    }
    joinRateLimitMap.set(socket.id, now);

    const userAvatar = avatar || '👤';
    const result = matchmaker.enqueue(socket.id, gender, mode, { ...location, avatar: userAvatar });
    if (!result) {
      socket.emit('error', { message: 'Invalid gender or mode.' });
      return;
    }

    if (result.matched) {
      const { roomId, caller, callee, callerLocation, calleeLocation, mode: matchMode } = result;

      // Notify caller (initiates WebRTC offer)
      io.to(caller).emit('matched', {
        roomId,
        peerLocation: calleeLocation,
        peerAvatar: calleeLocation.avatar || '👤',
        isCaller: true,
        mode: matchMode
      });

      // Notify callee
      io.to(callee).emit('matched', {
        roomId,
        peerLocation: callerLocation,
        peerAvatar: callerLocation.avatar || '👤',
        isCaller: false,
        mode: matchMode
      });

      console.log(`[MATCH] Room ${roomId} — ${caller} ↔ ${callee} (${matchMode})`);
    } else {
      socket.emit('queued', { message: 'Searching for a match...' });
    }
  });

  // ── WebRTC Signaling ────────────────────────────────────────────────────────
  socket.on('offer', ({ roomId, sdp }) => {
    const peer = matchmaker.getPeer(socket.id);
    if (peer && peer.roomId === roomId) {
      io.to(peer.socketId).emit('offer', { sdp });
    }
  });

  socket.on('answer', ({ roomId, sdp }) => {
    const peer = matchmaker.getPeer(socket.id);
    if (peer && peer.roomId === roomId) {
      io.to(peer.socketId).emit('answer', { sdp });
    }
  });

  socket.on('ice-candidate', ({ roomId, candidate }) => {
    const peer = matchmaker.getPeer(socket.id);
    if (peer && peer.roomId === roomId) {
      io.to(peer.socketId).emit('ice-candidate', { candidate });
    }
  });

  // ── Text Message Relay ──────────────────────────────────────────────────────
  socket.on('send-message', ({ roomId, text, timestamp }) => {
    if (!text || typeof text !== 'string' || text.length > 500) return;
    const peer = matchmaker.getPeer(socket.id);
    if (peer && peer.roomId === roomId) {
      io.to(peer.socketId).emit('receive-message', {
        text: text.trim(),
        timestamp: timestamp || Date.now(),
        fromPeer: true
      });
    }
  });

  // ── Next / Skip ─────────────────────────────────────────────────────────────
  socket.on('next', ({ roomId }) => {
    const peerSocketId = matchmaker.disconnect(socket.id);
    if (peerSocketId) {
      io.to(peerSocketId).emit('peer-left', { reason: 'skipped' });
    }
    console.log(`[NEXT] ${socket.id} skipped in room ${roomId}`);
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    joinRateLimitMap.delete(socket.id);
    const peerSocketId = matchmaker.disconnect(socket.id);
    if (peerSocketId) {
      io.to(peerSocketId).emit('peer-left', { reason: 'disconnected' });
    }
    console.log(`[-] Disconnected: ${socket.id}`);
    broadcastUserCount();
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Video Chat Server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server, io, matchmaker };
