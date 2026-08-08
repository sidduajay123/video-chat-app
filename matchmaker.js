// matchmaker.js — Gender-based queue and room matching logic

const { v4: uuidv4 } = require('uuid');

class Matchmaker {
  constructor() {
    // Separate queues per mode per gender
    this.queues = {
      video: { male: [], female: [] },
      text:  { male: [], female: [] }
    };
    this.rooms = new Map(); // roomId -> { peerA, peerB, mode }
    this.socketToRoom = new Map(); // socketId -> roomId
  }

  /**
   * Add a user to the appropriate queue and attempt matching
   * @param {string} socketId
   * @param {string} gender - 'male' | 'female'
   * @param {string} mode   - 'video' | 'text'
   * @param {object} location - { city, country, flag }
   * @returns {object|null} match result or null if queued
   */
  enqueue(socketId, gender, mode, location) {
    if (!['male', 'female'].includes(gender)) return null;
    if (!['video', 'text'].includes(mode)) return null;

    const oppositeGender = gender === 'male' ? 'female' : 'male';
    const oppositeQueue = this.queues[mode][oppositeGender];
    const sameQueue = this.queues[mode][gender];

    // Remove any stale entry for this socket first
    this.removeFromQueues(socketId);

    // 1. Try to match with opposite gender first
    if (oppositeQueue.length > 0) {
      const peer = oppositeQueue.shift();
      return this.createMatchedRoom(socketId, gender, location, peer.socketId, peer.gender, peer.location, mode);
    }

    // 2. Fall back to matching with same gender
    if (sameQueue.length > 0) {
      const peer = sameQueue.shift();
      return this.createMatchedRoom(socketId, gender, location, peer.socketId, peer.gender, peer.location, mode);
    }

    // No match yet — add to queue
    this.queues[mode][gender].push({ socketId, gender, location, joinedAt: Date.now() });
    return { matched: false, queued: true };
  }

  /**
   * Helper to instantiate a matched room pair
   */
  createMatchedRoom(socketIdA, genderA, locationA, socketIdB, genderB, locationB, mode) {
    const roomId = uuidv4();
    const room = {
      roomId,
      peerA: { socketId: socketIdA, gender: genderA, location: locationA },
      peerB: { socketId: socketIdB, gender: genderB, location: locationB },
      mode,
      createdAt: Date.now()
    };

    this.rooms.set(roomId, room);
    this.socketToRoom.set(socketIdA, roomId);
    this.socketToRoom.set(socketIdB, roomId);

    return {
      matched: true,
      roomId,
      caller: socketIdA,       // A initiates WebRTC offer
      callee: socketIdB,
      callerLocation: locationA,
      calleeLocation: locationB,
      mode
    };
  }

  /**
   * Get the peer's socket ID for a given socket in a room
   */
  getPeer(socketId) {
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;
    if (room.peerA.socketId === socketId) return { socketId: room.peerB.socketId, roomId };
    if (room.peerB.socketId === socketId) return { socketId: room.peerA.socketId, roomId };
    return null;
  }

  /**
   * Remove a socket from all queues
   */
  removeFromQueues(socketId) {
    for (const mode of ['video', 'text']) {
      for (const gender of ['male', 'female']) {
        this.queues[mode][gender] = this.queues[mode][gender].filter(
          u => u.socketId !== socketId
        );
      }
    }
  }

  /**
   * Disconnect a socket from its room, return peer socketId
   */
  disconnect(socketId) {
    this.removeFromQueues(socketId);
    const roomId = this.socketToRoom.get(socketId);
    if (!roomId) return null;

    const room = this.rooms.get(roomId);
    this.rooms.delete(roomId);
    this.socketToRoom.delete(socketId);

    if (!room) return null;

    let peerSocketId = null;
    if (room.peerA.socketId === socketId) {
      peerSocketId = room.peerB.socketId;
    } else if (room.peerB.socketId === socketId) {
      peerSocketId = room.peerA.socketId;
    }

    if (peerSocketId) {
      this.socketToRoom.delete(peerSocketId);
    }

    return peerSocketId;
  }

  /**
   * Get queue stats (for monitoring/health checks)
   */
  getStats() {
    return {
      queues: {
        video: {
          male: this.queues.video.male.length,
          female: this.queues.video.female.length
        },
        text: {
          male: this.queues.text.male.length,
          female: this.queues.text.female.length
        }
      },
      activeRooms: this.rooms.size,
      connectedPairs: this.rooms.size
    };
  }

  /**
   * Get room by ID
   */
  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  /**
   * Get all active room IDs
   */
  getRoomIds() {
    return Array.from(this.rooms.keys());
  }
}

module.exports = Matchmaker;
