// app.js — Application state machine and event wiring

const App = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  const state = {
    mode: null,        // 'video' | 'text'
    gender: null,      // 'male' | 'female'
    location: null,    // { city, country, flag }
    avatar: '🐱',      // Selected avatar (default)
    localStream: null,
    isMicOn: true,
    isCamOn: true,
    sidebarOpen: true,
    currentRoomId: null,
    isSearching: false,
    isCancelled: false
  };

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    UI.init();
    SocketService.connect();
    bindEvents();
    wireSocketHandlers();
    restoreGender();
    UI.showScreen('screen-home');
  }

  // ① Restore saved gender/avatar from localStorage
  function restoreGender() {
    const saved = localStorage.getItem('user-gender');
    if (saved === 'male' || saved === 'female') {
      state.gender = saved;
      const btn = document.getElementById(saved === 'male' ? 'btn-male' : 'btn-female');
      if (btn) btn.classList.add('selected');
    }
    const savedAvatar = localStorage.getItem('user-avatar');
    if (savedAvatar) {
      state.avatar = savedAvatar;
      document.querySelectorAll('.avatar-option').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-avatar') === savedAvatar);
      });
    }
  }

  // ── Button Event Bindings ──────────────────────────────────────────────────
  function bindEvents() {
    document.getElementById('btn-video-mode').addEventListener('click', () => {
      state.mode = 'video';
      UI.showScreen('screen-gender');
    });
    document.getElementById('btn-text-mode').addEventListener('click', () => {
      state.mode = 'text';
      UI.showScreen('screen-gender');
    });

    document.getElementById('btn-gender-back').addEventListener('click', () => {
      UI.showScreen('screen-home');
    });

    document.getElementById('btn-male').addEventListener('click', () => handleGenderSelect('male'));
    document.getElementById('btn-female').addEventListener('click', () => handleGenderSelect('female'));

    document.querySelectorAll('.avatar-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.avatar = e.target.getAttribute('data-avatar');
        localStorage.setItem('user-avatar', state.avatar);
      });
    });

    document.getElementById('btn-denied-home').addEventListener('click', goHome);

    // ④ Cancel — stay on screen, show Start Chat
    document.getElementById('btn-cancel-search').addEventListener('click', () => {
      state.isSearching = false;
      state.isCancelled = true;
      SocketService.next();
      const pulse = document.getElementById('search-pulse');
      if (pulse) pulse.style.animationPlayState = 'paused';
      const title = document.getElementById('searching-title');
      if (title) title.textContent = 'Search cancelled';
      const info = document.getElementById('searching-info');
      if (info) info.textContent = 'Click Start Chat to find a new match.';
      document.getElementById('btn-cancel-search').style.display = 'none';
      document.getElementById('btn-start-chat').style.display = 'inline-flex';
    });

    // ④ Start Chat button
    document.getElementById('btn-start-chat').addEventListener('click', () => {
      state.isCancelled = false;
      resetSearchUI();
      UI.setSearchingInfo(state.gender, state.mode, state.location);
      joinQueue();
    });

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
    document.getElementById('btn-video-send').addEventListener('click', () => sendMessage('video'));
    document.getElementById('video-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage('video');
    });
    document.getElementById('btn-text-next').addEventListener('click', handleNext);
    document.getElementById('btn-text-end').addEventListener('click', goHome);
    document.getElementById('btn-text-send').addEventListener('click', () => sendMessage('text'));
    document.getElementById('text-chat-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage('text');
    });
  }

  // ── Gender Selected ────────────────────────────────────────────────────────
  async function handleGenderSelect(gender) {
    state.gender = gender;
    localStorage.setItem('user-gender', gender);
    document.getElementById('btn-male').classList.toggle('selected', gender === 'male');
    document.getElementById('btn-female').classList.toggle('selected', gender === 'female');

    if (state.mode === 'video') {
      await handleVideoPermissions();
    } else {
      UI.showScreen('screen-searching');
      resetSearchUI();
      state.location = await LocationService.resolve();
      UI.setSearchingInfo(state.gender, state.mode, state.location);
      joinQueue();
    }
  }

  // ── Video Permission Gate ──────────────────────────────────────────────────
  async function handleVideoPermissions() {
    UI.showScreen('screen-permission');

    UI.setPermStatus('location', 'pending');
    state.location = await LocationService.resolve();
    UI.setPermStatus('location', 'success');

    UI.setPermStatus('camera', 'pending');
    try {
      const stream = await WebRTCService.requestMediaPermissions();
      state.localStream = stream;
      UI.setPermStatus('camera', 'success');
      UI.setLocalVideo(stream);

      // ② Mirror to search screen self-preview
      const searchSelf = document.getElementById('search-self-video');
      if (searchSelf) searchSelf.srcObject = stream;

      setTimeout(() => {
        UI.showScreen('screen-searching');
        resetSearchUI();
        UI.setSearchingInfo(state.gender, state.mode, state.location);
        joinQueue();
      }, 600);

    } catch (err) {
      UI.setPermStatus('camera', 'error');
      setTimeout(() => {
        UI.showScreen('screen-denied');
        UI.startCountdown(3, goHome);
      }, 500);
    }
  }

  // ── Reset search screen to searching state ────────────────────────────────
  function resetSearchUI() {
    state.isCancelled = false;
    const pulse = document.getElementById('search-pulse');
    if (pulse) pulse.style.animationPlayState = 'running';
    const title = document.getElementById('searching-title');
    if (title) title.textContent = 'Finding your match...';
    document.getElementById('btn-cancel-search').style.display = 'inline-flex';
    document.getElementById('btn-start-chat').style.display = 'none';

    // ② Show self-preview only in video mode
    const previewWrap = document.getElementById('self-preview-wrap');
    if (previewWrap) previewWrap.style.display = state.mode === 'video' ? 'block' : 'none';
  }

  // ── Join Matchmaking Queue ─────────────────────────────────────────────────
  function joinQueue() {
    state.isSearching = true;
    SocketService.joinQueue({
      gender: state.gender,
      mode: state.mode,
      location: state.location,
      avatar: state.avatar
    });
  }

  // ── Socket Event Handlers ──────────────────────────────────────────────────
  function wireSocketHandlers() {

    // ⑤ Active user count
    SocketService.on('onUserCount', (data) => {
      const el = document.getElementById('active-users-count');
      if (el) el.textContent = data.count;
    });

    // Matched with a peer
    SocketService.on('onMatched', async (data) => {
      state.currentRoomId = data.roomId;
      state.isSearching = false;
      const peerLocation = data.peerLocation || { city: 'Unknown', flag: '🌍' };
      const peerAvatar = data.peerAvatar || '👤';

      UI.setAvatars(state.avatar, peerAvatar);

      if (data.mode === 'video') {
        UI.setConnecting(true);
        if (state.localStream) UI.setLocalVideo(state.localStream);
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

        WebRTCService.setOnConnectionState((connState) => {
          if (connState === 'failed' || connState === 'disconnected') {
            UI.showToast('⚠️ Connection unstable...');
          }
        });

        WebRTCService.createPeerConnection();

        if (data.isCaller) {
          const offer = await WebRTCService.createOffer();
          SocketService.sendOffer(offer);
        }
      } else {
        UI.setTextLocation('peer', peerLocation);
        UI.setTextLocation('self', state.location);
        UI.clearMessages('text-chat-messages');
        UI.showScreen('screen-text');
      }
    });

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

    SocketService.on('onMessage', (msg) => {
      const containerId = state.mode === 'video' ? 'video-chat-messages' : 'text-chat-messages';
      UI.appendMessage(containerId, {
        text: msg.text,
        fromMe: false,
        timestamp: msg.timestamp
      });
    });

    // ③ Peer left — instant re-search
    SocketService.on('onPeerLeft', (data) => {
      const isSkipped = data.reason === 'skipped';
      UI.showToast(isSkipped ? 'Stranger skipped 👋' : 'Stranger disconnected 👋');
      WebRTCService.closePeerConnection();
      UI.clearVideos();

      UI.showScreen('screen-searching');
      resetSearchUI();
      UI.setSearchingInfo(state.gender, state.mode, state.location);

      // Restore self-preview stream
      if (state.mode === 'video' && state.localStream) {
        const searchSelf = document.getElementById('search-self-video');
        if (searchSelf) searchSelf.srcObject = state.localStream;
      }

      // Join queue immediately (0ms delay) for instant pairing
      joinQueue();
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
    UI.clearMessages('video-chat-messages');
    UI.clearMessages('text-chat-messages');

    UI.showScreen('screen-searching');
    resetSearchUI();
    UI.setSearchingInfo(state.gender, state.mode, state.location);

    if (state.mode === 'video' && state.localStream) {
      const searchSelf = document.getElementById('search-self-video');
      if (searchSelf) searchSelf.srcObject = state.localStream;
    }

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

    state.mode = null;
    state.isSearching = false;
    state.isCancelled = false;
    state.currentRoomId = null;
    state.isMicOn = true;
    state.isCamOn = true;

    UI.showScreen('screen-home');
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
