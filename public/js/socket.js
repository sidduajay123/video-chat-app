// socket.js — Socket.IO client and all event handlers

const SocketService = (() => {
  let socket = null;
  let currentRoomId = null;
  let handlers = {};

  function connect() {
    socket = io({
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    // Handle BFCache (Back-Forward cache) page restoration
    window.addEventListener('pageshow', (event) => {
      if (event.persisted && socket) {
        console.log('[Socket] Page restored from BFCache, reconnecting...');
        socket.connect();
      }
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      if (handlers.onConnect) handlers.onConnect(socket.id);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
      if (handlers.onDisconnect) handlers.onDisconnect();
    });

    socket.on('queued', (data) => {
      console.log('[Socket] Queued:', data.message);
    });

    socket.on('matched', async (data) => {
      console.log('[Socket] Matched:', data);
      currentRoomId = data.roomId;
      if (handlers.onMatched) handlers.onMatched(data);
    });

    socket.on('offer', async ({ sdp }) => {
      if (!handlers.onOffer) return;
      handlers.onOffer(sdp);
    });

    socket.on('answer', async ({ sdp }) => {
      if (!handlers.onAnswer) return;
      handlers.onAnswer(sdp);
    });

    socket.on('ice-candidate', ({ candidate }) => {
      if (handlers.onIceCandidate) handlers.onIceCandidate(candidate);
    });

    socket.on('receive-message', (msg) => {
      if (handlers.onMessage) handlers.onMessage(msg);
    });

    socket.on('peer-left', (data) => {
      console.log('[Socket] Peer left:', data.reason);
      currentRoomId = null;
      if (handlers.onPeerLeft) handlers.onPeerLeft(data);
    });

    socket.on('user-count', (data) => {
      console.log('[Socket] User count:', data.count);
      if (handlers.onUserCount) handlers.onUserCount(data);
    });

    socket.on('error', (err) => {
      console.error('[Socket] Error:', err.message);
      if (handlers.onError) handlers.onError(err);
    });

    return socket;
  }

  function joinQueue({ gender, mode, location, avatar }) {
    if (!socket) return;
    socket.emit('join-queue', { gender, mode, location, avatar });
  }

  function sendOffer(sdp) {
    if (!socket || !currentRoomId) return;
    socket.emit('offer', { roomId: currentRoomId, sdp });
  }

  function sendAnswer(sdp) {
    if (!socket || !currentRoomId) return;
    socket.emit('answer', { roomId: currentRoomId, sdp });
  }

  function sendIceCandidate(candidate) {
    if (!socket || !currentRoomId) return;
    socket.emit('ice-candidate', { roomId: currentRoomId, candidate });
  }

  function sendMessage(text) {
    if (!socket || !currentRoomId || !text.trim()) return;
    socket.emit('send-message', {
      roomId: currentRoomId,
      text: text.trim(),
      timestamp: Date.now()
    });
  }

  function next() {
    if (!socket) return;
    socket.emit('next', { roomId: currentRoomId });
    currentRoomId = null;
  }

  function on(event, cb) {
    handlers[event] = cb;
  }

  function getRoomId() { return currentRoomId; }
  function setRoomId(id) { currentRoomId = id; }
  function getSocket() { return socket; }

  return {
    connect, joinQueue,
    sendOffer, sendAnswer, sendIceCandidate,
    sendMessage, next,
    on, getRoomId, setRoomId, getSocket
  };
})();
