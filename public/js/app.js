// app.js — Application state machine and event wiring

const App = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    mode: null,        // 'video' | 'text'
    gender: null,      // 'male' | 'female'
    location: null,    // { city, country, flag }
    localStream: null,
    isMicOn: true,
    isCamOn: true,
    sidebarOpen: true,
    currentRoomId: null,
    isSearching: false
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    UI.init();
    SocketService.connect();
    bindEvents();
    wireSocketHandlers();
    UI.showScreen('screen-home');
  }

  // ── Button Event Bindings ──────────────────────────────────────────────────
  function bindEvents() {
    // Home → Mode
    document.getElementById('btn-video-mode').addEventListener('click', () => {
      state.mode = 'video';
      UI.showScreen('screen-gender');
    });
    document.getElementById('btn-text-mode').addEventListener('click', () => {
      state.mode = 'text';
      UI.showScreen('screen-gender');
    });

    // Gender back
    document.getElementById('btn-gender-back').addEventListener('click', () => {
      UI.showScreen('screen-home');
    });

    // Gender selection
    document.getElementById('btn-male').addEventListener('click', () => handleGenderSelect('male'));
    document.getElementById('btn-female').addEventListener('click', () => handleGenderSelect('female'));

    // Permission denied → home
    document.getElementById('btn-denied-home').addEventListener('click', goHome);

    // Cancel search
    document.getElementById('btn-cancel-search').addEventListener('click', () => {
      state.isSearching = false;
      goHome();
    });

    // Video controls
    document.getElementById('btn-toggle-mic').addEventListener('click', toggleMic);
    document.getElementById('btn-toggle-cam').addEventListener('click', toggleCam);
    document.getElementById('btn-show-chat').addEventListener('click', () => {
      state.sidebarOpen = true;
      UI.toggleSidebar(true);
    });
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
      state.sidebarOpen = false;
      UI.toggleSidebar(false);
    });
    document.getElementById('btn-video-next').addEventListener('click', handleNext);
    document.getElementById('btn-video-end').addEventListener('click', goHome);

    // Video chat input
    document.getElementById('btn-video-send').addEventListener('click', () => sendMessage('video'));
    document.getElementById('video-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage('video');
    });

    // Text controls
    document.getElementById('btn-text-next').addEventListener('click', handleNext);
    document.getElementById('btn-text-end').addEventListener('click', goHome);

    // Text chat input
    document.getElementById('btn-text-send').addEventListener('click', () => sendMessage('text'));
    document.getElementById('text-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage('text');
    });
  }

  // ── Gender Selected ────────────────────────────────────────────────────────
  async function handleGenderSelect(gender) {
    state.gender = gender;

    if (state.mode === 'video') {
      await handleVideoPermissions();
    } else {
      // Text mode — just resolve location and queue
      UI.showScreen('screen-searching');
      state.location = await LocationService.resolve();
      UI.setSearchingInfo(state.gender, state.mode, state.location);
      joinQueue();
    }
  }

  // ── Video Permission Gate ──────────────────────────────────────────────────
  async function handleVideoPermissions() {
    UI.showScreen('screen-permission');

    // Step 1: Location (non-blocking)
    UI.setPermStatus('location', 'pending');
    state.location = await LocationService.resolve();
    UI.setPermStatus('location', 'success');

    // Step 2: Camera + Mic (BLOCKING GATE)
    UI.setPermStatus('camera', 'pending');
    try {
      const stream = await WebRTCService.requestMediaPermissions();
      state.localStream = stream;
      UI.setPermStatus('camera', 'success');
      UI.setLocalVideo(stream);

      // Success → go to search
      setTimeout(() => {
        UI.showScreen('screen-searching');
        UI.setSearchingInfo(state.gender, state.mode, state.location);
        joinQueue();
      }, 600);

    } catch (err) {
      // Permission denied — HARD GATE
      UI.setPermStatus('camera', 'error');
      setTimeout(() => {
        UI.showScreen('screen-denied');
        UI.startCountdown(3, goHome);
      }, 500);
    }
  }

  // ── Join Matchmaking Queue ─────────────────────────────────────────────────
  function joinQueue() {
    state.isSearching = true;
    SocketService.joinQueue({
      gender: state.gender,
      mode: state.mode,
      location: state.location
    });
  }

  // ── Socket Event Handlers ──────────────────────────────────────────────────
  function wireSocketHandlers() {
    // Matched with a peer
    SocketService.on('onMatched', async (data) => {
      state.currentRoomId = data.roomId;
      state.isSearching = false;
      const peerLocation = data.peerLocation || { city: 'Unknown', flag: '🌍' };

      if (data.mode === 'video') {
        UI.setConnecting(true);
        UI.setLocationBadge('peer', peerLocation);
        UI.setLocationBadge('self', state.location);
        UI.showScreen('screen-video');
        UI.toggleSidebar(true);
        UI.clearMessages('video-chat-messages');

        WebRTCService.setOnTrack((remoteStream) => {
          UI.setRemoteVideo(remoteStream);
          UI.setConnecting(false);
        });

        WebRTCService.setOnIceCandidate((candidate) => {
          SocketService.sendIceCandidate(candidate);
        });

        WebRTCService.setOnConnectionState((state) => {
          if (state === 'failed' || state === 'disconnected') {
            UI.showToast('⚠️ Connection unstable...');
          }
        });

        WebRTCService.createPeerConnection();

        if (data.isCaller) {
          const offer = await WebRTCService.createOffer();
          SocketService.sendOffer(offer);
        }
      } else {
        // Text mode
        UI.setTextLocation('peer', peerLocation);
        UI.setTextLocation('self', state.location);
        UI.clearMessages('text-chat-messages');
        UI.showScreen('screen-text');
      }
    });

    // WebRTC signaling
    SocketService.on('onOffer', async (sdp) => {
      const answer = await WebRTCService.handleOffer(sdp);
      SocketService.sendAnswer(answer);
    });

    SocketService.on('onAnswer', async (sdp) => {
      await WebRTCService.handleAnswer(sdp);
    });

    SocketService.on('onIceCandidate', async (candidate) => {
      await WebRTCService.addIceCandidate(candidate);
    });

    // Incoming message
    SocketService.on('onMessage', (msg) => {
      const containerId = state.mode === 'video' ? 'video-chat-messages' : 'text-chat-messages';
      UI.appendMessage(containerId, {
        text: msg.text,
        fromMe: false,
        timestamp: msg.timestamp
      });
    });

    // Peer left / skipped
    SocketService.on('onPeerLeft', (data) => {
      const reason = data.reason === 'skipped' ? 'Stranger moved on 👋' : 'Stranger disconnected 👋';
      UI.showToast(reason);
      WebRTCService.closePeerConnection();
      UI.clearVideos();

      setTimeout(() => {
        // Auto re-queue
        if (state.mode === 'video') {
          UI.showScreen('screen-searching');
          UI.setSearchingInfo(state.gender, state.mode, state.location);
        } else {
          UI.showScreen('screen-searching');
          UI.setSearchingInfo(state.gender, state.mode, state.location);
        }
        joinQueue();
      }, 2000);
    });

    SocketService.on('onError', (err) => {
      UI.showToast(`Error: ${err.message}`);
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function handleNext() {
    SocketService.next();
    WebRTCService.closePeerConnection();
    UI.clearVideos();
    UI.setConnecting(true);
    UI.clearMessages('video-chat-messages');
    UI.clearMessages('text-chat-messages');

    UI.showScreen('screen-searching');
    UI.setSearchingInfo(state.gender, state.mode, state.location);
    joinQueue();
  }

  function toggleMic() {
    const isOn = WebRTCService.toggleMic();
    state.isMicOn = isOn;
    const btn = document.getElementById('btn-toggle-mic');
    btn.textContent = isOn ? '🎤' : '🔇';
    btn.classList.toggle('active', !isOn);
  }

  function toggleCam() {
    const isOn = WebRTCService.toggleCamera();
    state.isCamOn = isOn;
    const btn = document.getElementById('btn-toggle-cam');
    btn.textContent = isOn ? '📷' : '📷';
    btn.classList.toggle('active', !isOn);
    btn.style.opacity = isOn ? '1' : '0.5';
  }

  function sendMessage(chatMode) {
    const inputId = chatMode === 'video' ? 'video-chat-input' : 'text-chat-input';
    const containerId = chatMode === 'video' ? 'video-chat-messages' : 'text-chat-messages';
    const input = document.getElementById(inputId);
    if (!input || !input.value.trim()) return;

    const text = input.value.trim();
    SocketService.sendMessage(text);
    UI.appendMessage(containerId, { text, fromMe: true, timestamp: Date.now() });
    UI.clearInput(inputId);
  }

  function goHome() {
    SocketService.next();
    WebRTCService.cleanup();
    UI.clearVideos();
    UI.clearMessages('video-chat-messages');
    UI.clearMessages('text-chat-messages');

    // Reset state
    state.mode = null;
    state.gender = null;
    state.isSearching = false;
    state.currentRoomId = null;
    state.isMicOn = true;
    state.isCamOn = true;

    UI.showScreen('screen-home');
  }

  return { init };
})();

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());
