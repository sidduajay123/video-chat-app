// webrtc.js — WebRTC peer connection management

const WebRTCService = (() => {
  const STUN_SERVERS = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  let peerConnection = null;
  let localStream = null;
  let onTrackCallback = null;
  let onIceCandidateCallback = null;
  let onConnectionStateCallback = null;

  /**
   * Request camera + microphone access
   * @returns {Promise<MediaStream>}
   * @throws {Error} if permission denied
   */
  async function requestMediaPermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 }
      });
      localStream = stream;
      return stream;
    } catch (err) {
      localStream = null;
      throw err;
    }
  }

  /**
   * Initialize peer connection with event handlers
   */
  function createPeerConnection() {
    if (peerConnection) {
      closePeerConnection();
    }

    peerConnection = new RTCPeerConnection(STUN_SERVERS);

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Handle remote tracks
    peerConnection.ontrack = (event) => {
      if (onTrackCallback && event.streams[0]) {
        onTrackCallback(event.streams[0]);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && onIceCandidateCallback) {
        onIceCandidateCallback(event.candidate);
      }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      if (onConnectionStateCallback) {
        onConnectionStateCallback(peerConnection.connectionState);
      }
    };

    return peerConnection;
  }

  /**
   * Create SDP offer (caller side)
   */
  async function createOffer() {
    if (!peerConnection) createPeerConnection();
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await peerConnection.setLocalDescription(offer);
    return offer;
  }

  /**
   * Handle incoming offer, create answer (callee side)
   */
  async function handleOffer(sdp) {
    if (!peerConnection) createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    return answer;
  }

  /**
   * Handle incoming answer (caller side)
   */
  async function handleAnswer(sdp) {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
  }

  /**
   * Add ICE candidate from peer
   */
  async function addIceCandidate(candidate) {
    if (!peerConnection) return;
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.warn('ICE candidate error:', e);
    }
  }

  /**
   * Toggle microphone mute
   */
  function toggleMic() {
    if (!localStream) return false;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle camera on/off
   */
  function toggleCamera() {
    if (!localStream) return false;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Close and clean up peer connection
   */
  function closePeerConnection() {
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  }

  /**
   * Stop all local media tracks
   */
  function stopLocalStream() {
    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
  }

  /**
   * Full cleanup
   */
  function cleanup() {
    closePeerConnection();
    stopLocalStream();
  }

  function setOnTrack(cb) { onTrackCallback = cb; }
  function setOnIceCandidate(cb) { onIceCandidateCallback = cb; }
  function setOnConnectionState(cb) { onConnectionStateCallback = cb; }
  function getLocalStream() { return localStream; }
  function getPeerConnection() { return peerConnection; }

  return {
    requestMediaPermissions,
    createPeerConnection,
    createOffer,
    handleOffer,
    handleAnswer,
    addIceCandidate,
    toggleMic,
    toggleCamera,
    closePeerConnection,
    stopLocalStream,
    cleanup,
    setOnTrack,
    setOnIceCandidate,
    setOnConnectionState,
    getLocalStream,
    getPeerConnection
  };
})();
