// ui.js — DOM manipulation, transitions, badge rendering

const UI = (() => {
  const screens = {};

  function init() {
    document.querySelectorAll('.screen').forEach(el => {
      screens[el.id] = el;
    });
  }

  /**
   * Switch to a screen with smooth transition
   */
  function showScreen(id) {
    const next = screens[id];
    if (!next) return;

    const current = document.querySelector('.screen.active');
    if (current && current !== next) {
      current.classList.add('exit');
      setTimeout(() => current.classList.remove('active', 'exit'), 350);
    }

    next.classList.add('active');
    next.classList.remove('exit');
  }

  /**
   * Render a chat message bubble
   */
  function appendMessage(containerId, { text, fromMe, timestamp }) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const time = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const div = document.createElement('div');
    div.className = `message ${fromMe ? 'from-me' : 'from-peer'}`;
    div.innerHTML = `
      <div class="bubble">${escapeHtml(text)}</div>
      ${time ? `<div class="msg-time">${time}</div>` : ''}
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  /**
   * Update location badge in video screen
   */
  function setLocationBadge(who, location) {
    const flag = document.getElementById(`${who}-flag`);
    const city = document.getElementById(`${who}-city`);
    if (flag) flag.textContent = location.flag || '🌍';
    if (city) city.textContent = location.city || 'Unknown';
  }

  /**
   * Update text chat header location
   */
  function setTextLocation(who, location) {
    const el = document.getElementById(`text-${who}-location`);
    if (!el) return;
    const label = who === 'peer' ? "Stranger's location" : 'Your location';
    el.textContent = `📍 ${location.city || 'Unknown'}${location.country ? ', ' + location.country : ''}`;
  }

  /**
   * Set user selected avatars in the badges / headings
   */
  function setAvatars(selfAvatar, peerAvatar) {
    const selfVidBadge = document.getElementById('self-avatar-badge');
    const peerVidBadge = document.getElementById('peer-avatar-badge');
    const peerTextAvatar = document.getElementById('text-peer-avatar');

    if (selfVidBadge) selfVidBadge.textContent = selfAvatar || '👤';
    if (peerVidBadge) peerVidBadge.textContent = peerAvatar || '👤';
    if (peerTextAvatar) peerTextAvatar.textContent = peerAvatar || '👤';
  }

  /**
   * Show/hide connecting overlay
   */
  function setConnecting(visible) {
    const el = document.getElementById('connecting-overlay');
    if (!el) return;
    el.classList.toggle('hidden', !visible);
  }

  /**
   * Show toast notification
   */
  function showToast(msg, duration = 3000) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  }

  /**
   * Update permission step status icons
   */
  function setPermStatus(step, status) {
    const el = document.getElementById(`status-${step}`);
    if (!el) return;
    const icons = { pending: '⏳', success: '✅', error: '❌' };
    el.textContent = icons[status] || '⏳';
  }

  /**
   * Start and show the redirect countdown (permission denied screen)
   */
  function startCountdown(seconds, onDone) {
    const el = document.getElementById('redirect-countdown');
    let remaining = seconds;
    if (el) el.textContent = remaining;

    const interval = setInterval(() => {
      remaining--;
      if (el) el.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        onDone();
      }
    }, 1000);

    return interval;
  }

  /**
   * Set searching screen info tags
   */
  function setSearchingInfo(gender, mode, location) {
    const info = document.getElementById('searching-info');
    const tags = document.getElementById('searching-tags');
    if (info) info.textContent = 'Looking for your match...';
    if (tags) {
      tags.innerHTML = [
        `<span class="tag">📹 ${mode === 'video' ? 'Video' : 'Text'} Chat</span>`,
        `<span class="tag">🧑 ${gender === 'male' ? 'Male' : 'Female'}</span>`,
        `<span class="tag">${location.flag} ${location.city || 'Unknown'}</span>`
      ].join('');
    }
  }

  /**
   * Toggle chat sidebar in video mode
   */
  function toggleSidebar(open) {
    const sidebar = document.getElementById('chat-sidebar');
    const controls = document.querySelector('.video-controls');
    if (sidebar) sidebar.classList.toggle('collapsed', !open);
    if (controls) controls.classList.toggle('sidebar-closed', !open);
  }

  /**
   * Clear chat messages container
   */
  function clearMessages(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
  }

  /**
   * Clear text input
   */
  function clearInput(id) {
    const el = document.getElementById(id);
    if (el) el.value = '';
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Set local video stream
   */
  function setLocalVideo(stream) {
    const el = document.getElementById('local-video');
    if (el) el.srcObject = stream;
  }

  /**
   * Set remote video stream
   */
  function setRemoteVideo(stream) {
    const el = document.getElementById('remote-video');
    if (el) el.srcObject = stream;
  }

  /**
   * Clear video elements
   */
  function clearVideos() {
    const local = document.getElementById('local-video');
    const remote = document.getElementById('remote-video');
    if (local) local.srcObject = null;
    if (remote) remote.srcObject = null;
  }

  return {
    init, showScreen,
    appendMessage, setLocationBadge, setTextLocation, setAvatars,
    setConnecting, showToast, setPermStatus,
    startCountdown, setSearchingInfo, toggleSidebar,
    clearMessages, clearInput,
    setLocalVideo, setRemoteVideo, clearVideos
  };
})();
