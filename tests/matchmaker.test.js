// tests/matchmaker.test.js — Unit tests for Matchmaker logic

const Matchmaker = require('../matchmaker');

describe('Matchmaker', () => {
  let mm;

  beforeEach(() => {
    mm = new Matchmaker();
  });

  // ── Enqueue ────────────────────────────────────────────────────────────────
  describe('enqueue()', () => {
    test('should return queued=true when no opposite gender available', () => {
      const result = mm.enqueue('socket-1', 'male', 'video', { city: 'Mumbai', flag: '🇮🇳' });
      expect(result).toMatchObject({ matched: false, queued: true });
    });

    test('should match male and female in same mode', () => {
      mm.enqueue('socket-1', 'male', 'video', { city: 'Mumbai' });
      const result = mm.enqueue('socket-2', 'female', 'video', { city: 'London' });
      expect(result.matched).toBe(true);
      expect(result.roomId).toBeDefined();
      expect([result.caller, result.callee]).toContain('socket-1');
      expect([result.caller, result.callee]).toContain('socket-2');
    });

    test('should NOT match same gender', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      const result = mm.enqueue('socket-2', 'male', 'video', {});
      expect(result.matched).toBe(false);
    });

    test('should NOT match different modes', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      const result = mm.enqueue('socket-2', 'female', 'text', {});
      expect(result.matched).toBe(false);
    });

    test('should match in text mode separately', () => {
      mm.enqueue('socket-1', 'male', 'text', {});
      const result = mm.enqueue('socket-2', 'female', 'text', {});
      expect(result.matched).toBe(true);
    });

    test('should return null for invalid gender', () => {
      const result = mm.enqueue('socket-1', 'unknown', 'video', {});
      expect(result).toBeNull();
    });

    test('should return null for invalid mode', () => {
      const result = mm.enqueue('socket-1', 'male', 'audio', {});
      expect(result).toBeNull();
    });

    test('should remove stale entry before re-queuing', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.enqueue('socket-1', 'male', 'video', {}); // re-queue same socket
      expect(mm.queues.video.male.length).toBe(1);
    });

    test('should assign caller and callee correctly', () => {
      mm.enqueue('socket-A', 'male', 'video', {});
      const result = mm.enqueue('socket-B', 'female', 'video', {});
      expect(result.caller).toBe('socket-B'); // second joiner becomes caller
      expect(result.callee).toBe('socket-A');
    });

    test('should pass location to both peers in match result', () => {
      const locA = { city: 'Delhi', flag: '🇮🇳' };
      const locB = { city: 'Paris', flag: '🇫🇷' };
      mm.enqueue('socket-A', 'male', 'video', locA);
      const result = mm.enqueue('socket-B', 'female', 'video', locB);
      expect(result.callerLocation).toEqual(locB);
      expect(result.calleeLocation).toEqual(locA);
    });
  });

  // ── getPeer ────────────────────────────────────────────────────────────────
  describe('getPeer()', () => {
    test('should return the peer of a matched socket', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.enqueue('socket-2', 'female', 'video', {});
      const peer = mm.getPeer('socket-1');
      expect(peer).not.toBeNull();
      expect(peer.socketId).toBe('socket-2');
    });

    test('should return null for unmatched socket', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      const peer = mm.getPeer('socket-1');
      expect(peer).toBeNull();
    });

    test('should return peer from both sides', () => {
      mm.enqueue('socket-A', 'male', 'video', {});
      mm.enqueue('socket-B', 'female', 'video', {});
      const peerOfA = mm.getPeer('socket-A');
      const peerOfB = mm.getPeer('socket-B');
      expect(peerOfA.socketId).toBe('socket-B');
      expect(peerOfB.socketId).toBe('socket-A');
    });

    test('should return same roomId for both peers', () => {
      mm.enqueue('socket-A', 'male', 'video', {});
      mm.enqueue('socket-B', 'female', 'video', {});
      const peerOfA = mm.getPeer('socket-A');
      const peerOfB = mm.getPeer('socket-B');
      expect(peerOfA.roomId).toBe(peerOfB.roomId);
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────────
  describe('disconnect()', () => {
    test('should return peer socketId on disconnect', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.enqueue('socket-2', 'female', 'video', {});
      const peer = mm.disconnect('socket-1');
      expect(peer).toBe('socket-2');
    });

    test('should return null for unmatched socket', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      const peer = mm.disconnect('socket-1');
      expect(peer).toBeNull();
    });

    test('should clean up room after disconnect', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.enqueue('socket-2', 'female', 'video', {});
      mm.disconnect('socket-1');
      expect(mm.rooms.size).toBe(0);
    });

    test('should remove both peers from socketToRoom map after disconnect', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.enqueue('socket-2', 'female', 'video', {});
      mm.disconnect('socket-1');
      expect(mm.socketToRoom.has('socket-1')).toBe(false);
      expect(mm.socketToRoom.has('socket-2')).toBe(false);
    });

    test('should remove from queue on disconnect', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.disconnect('socket-1');
      expect(mm.queues.video.male.length).toBe(0);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────────
  describe('getStats()', () => {
    test('should return zero stats initially', () => {
      const stats = mm.getStats();
      expect(stats.activeRooms).toBe(0);
      expect(stats.queues.video.male).toBe(0);
    });

    test('should count queued users', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.enqueue('socket-2', 'male', 'text', {});
      const stats = mm.getStats();
      expect(stats.queues.video.male).toBe(1);
      expect(stats.queues.text.male).toBe(1);
    });

    test('should count active rooms', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.enqueue('socket-2', 'female', 'video', {});
      const stats = mm.getStats();
      expect(stats.activeRooms).toBe(1);
    });
  });

  // ── getRoom ────────────────────────────────────────────────────────────────
  describe('getRoom()', () => {
    test('should return room by ID', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      const result = mm.enqueue('socket-2', 'female', 'video', {});
      const room = mm.getRoom(result.roomId);
      expect(room).not.toBeNull();
      expect(room.mode).toBe('video');
    });

    test('should return null for non-existent room', () => {
      expect(mm.getRoom('fake-room-id')).toBeNull();
    });
  });

  // ── removeFromQueues ───────────────────────────────────────────────────────
  describe('removeFromQueues()', () => {
    test('should remove socket from all queues', () => {
      mm.enqueue('socket-1', 'male', 'video', {});
      mm.removeFromQueues('socket-1');
      expect(mm.queues.video.male.length).toBe(0);
    });
  });

  // ── Multiple concurrent matches ────────────────────────────────────────────
  describe('multiple concurrent sessions', () => {
    test('should handle multiple concurrent matches independently', () => {
      mm.enqueue('M1', 'male', 'video', {});
      mm.enqueue('M2', 'male', 'video', {});
      const r1 = mm.enqueue('F1', 'female', 'video', {});
      const r2 = mm.enqueue('F2', 'female', 'video', {});
      expect(r1.matched).toBe(true);
      expect(r2.matched).toBe(true);
      expect(r1.roomId).not.toBe(r2.roomId);
      expect(mm.rooms.size).toBe(2);
    });
  });
});
