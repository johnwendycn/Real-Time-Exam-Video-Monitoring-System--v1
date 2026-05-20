// ==========================================================================
// VANGUARD - CLIENT ORCHESTRATOR & SIGNALING ENGINE (ROOM EDITION)
// ==========================================================================

// Global State
let socket = null;
let currentUser = null;
let token = null;
let currentRoomId = null;

// Mediasoup Client State
let device = null;
let sendTransport = null;
let recvTransport = null;
let videoProducer = null;
let audioProducer = null;

// Admin-specific mappings
const activeConsumers = new Map(); // targetUserId -> { videoConsumer, audioConsumer, videoElement }
const activeUserCards = new Map();  // targetUserId -> Card DOM Element
let adminChattingWithUserId = null;  // currently open direct line chat user
let adminChattingWithUsername = '';

// Chat State
let activeCandidateChatTab = 'public'; // 'public' or 'private'
let activeAdminChatTab = 'private';    // 'private' or 'public'

// ==========================================================================
// INTERACTIVE SYNTHESIS AUDIO ENGINE (WEB AUDIO API)
// ==========================================================================
const SoundEngine = {
  ctx: null,
  
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported in this browser.");
    }
  },

  play(type) {
    this.init();
    if (!this.ctx) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    switch (type) {
      case 'click': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1000, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
        break;
      }
      case 'success': {
        // Ascending chime
        const playTone = (freq, start, dur) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, start);
          gain.gain.setValueAtTime(0.1, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(start);
          osc.stop(start + dur);
        };
        playTone(523.25, now, 0.15);     // C5
        playTone(659.25, now + 0.08, 0.2); // E5
        playTone(783.99, now + 0.16, 0.25); // G5
        break;
      }
      case 'error': {
        // Low raspy buzzer
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(100, now);
        osc2.frequency.setValueAtTime(103, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.35);
        osc2.stop(now + 0.35);
        break;
      }
      case 'message': {
        // Cute bubble pop
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.exponentialRampToValueAtTime(850, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'join': {
        // Ascending major arpeggio
        const freqs = [261.63, 329.63, 392.00, 523.25];
        freqs.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.08, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.18);
        });
        break;
      }
      case 'leave': {
        // Descending major arpeggio
        const freqs = [523.25, 392.00, 329.63, 261.63];
        freqs.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.08, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.18);
        });
        break;
      }
      case 'kick': {
        // Siren warning tone
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.linearRampToValueAtTime(250, now + 0.2);
        osc.frequency.linearRampToValueAtTime(500, now + 0.4);
        osc.frequency.linearRampToValueAtTime(250, now + 0.6);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
        break;
      }
      case 'toggle': {
        // High to low double blip
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(750, now);
        osc.frequency.setValueAtTime(350, now + 0.04);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
        break;
      }
    }
  }
};

// ==========================================================================
// INITIALIZATION & DOM SELECTION
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Setup audio context unlock on first user click
  document.addEventListener('click', () => SoundEngine.init(), { once: true });
  initApp();
});

function initApp() {
  setupAuthTabs();
  setupFormHandlers();
  
  // Check persistent login state
  token = localStorage.getItem('vanguard_token');
  if (token) {
    validateTokenAndLogin();
  }
}

// Toast Notification Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconClass = 'fa-circle-info';
  if (type === 'success') {
    iconClass = 'fa-circle-check';
    SoundEngine.play('success');
  } else if (type === 'danger') {
    iconClass = 'fa-circle-exclamation';
    SoundEngine.play('error');
  } else if (type === 'warning') {
    iconClass = 'fa-triangle-exclamation';
    SoundEngine.play('kick');
  } else if (type === 'chat') {
    iconClass = 'fa-comment-dots';
    SoundEngine.play('message');
  } else {
    SoundEngine.play('click');
  }

  toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ==========================================================================
// AUTHENTICATION AND ROUTING UI FLOW
// ==========================================================================

function setupAuthTabs() {
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
  });
}

function setupFormHandlers() {
  // Login Form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameOrEmail = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      localStorage.setItem('vanguard_token', data.token);
      token = data.token;
      currentUser = data.user;
      
      showToast(`Welcome back, ${currentUser.username}!`, 'success');
      enterDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Register Form
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const role = document.getElementById('register-role').value;

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, role })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      localStorage.setItem('vanguard_token', data.token);
      token = data.token;
      currentUser = data.user;
      
      showToast('Registration successful!', 'success');
      enterDashboard();
    } catch (err) {
      showToast(err.message, 'danger');
    }
  });

  // Global Logout triggers will be mapped individually per lobby
}

async function validateTokenAndLogin() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (!res.ok) {
      localStorage.removeItem('vanguard_token');
      return;
    }
    currentUser = data;
    enterDashboard();
  } catch (err) {
    console.error('Session restore failed:', err.message);
  }
}

function logout() {
  // Clear local tracks if candidate
  if (videoProducer) videoProducer.close();
  if (audioProducer) audioProducer.close();

  const localVid = document.getElementById('local-video');
  if (localVid && localVid.srcObject) {
    localVid.srcObject.getTracks().forEach(track => track.stop());
  }

  // Close WebRTC transports before disconnecting so server frees mediasoup state
  if (recvTransport) {
    recvTransport.close();
    recvTransport = null;
  }
  if (sendTransport) {
    sendTransport.close();
    sendTransport = null;
  }
  device = null;

  function doDisconnect() {
    if (socket) socket.disconnect();
    socket = null;
    currentUser = null;
    token = null;
    activeConsumers.clear();
    activeUserCards.clear();

    localStorage.removeItem('vanguard_token');

    // Switch UI views
    document.getElementById('admin-view').classList.add('hidden');
    document.getElementById('user-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');

    showToast('Logged out securely.', 'info');
  }

  // If admin is actively monitoring a room, tell server to leave first
  // so it can free mediasoup resources and clear currentRoomId in DB
  if (socket && currentRoomId) {
    socket.emit('room:leave', {}, () => {
      currentRoomId = null;
      doDisconnect();
    });
    // Safety fallback: if the server doesn't respond within 1s, proceed anyway
    setTimeout(() => {
      if (socket) doDisconnect();
    }, 1000);
  } else {
    currentRoomId = null;
    doDisconnect();
  }
}

// View router
function enterDashboard() {
  document.getElementById('auth-view').classList.add('hidden');

  if (currentUser.role === 'admin') {
    document.getElementById('admin-view').classList.remove('hidden');
    document.getElementById('admin-lobby-state').classList.remove('hidden');
    document.getElementById('admin-monitor-state').classList.add('hidden');
    document.getElementById('admin-lobby-name').innerText = currentUser.username;
    initAdminLobby();
  } else {
    document.getElementById('user-view').classList.remove('hidden');
    document.getElementById('user-lobby-state').classList.remove('hidden');
    document.getElementById('user-monitor-state').classList.add('hidden');
    document.getElementById('user-lobby-profile-name').innerText = currentUser.username;
    initUserLobby();
  }
}

// ==========================================================================
// ADMIN LOBBY & ROOM MANAGEMENT
// ==========================================================================

async function initAdminLobby() {
  // Bind create room modal triggers
  document.getElementById('create-room-btn').onclick = () => {
    document.getElementById('create-room-modal').classList.remove('hidden');
  };
  document.getElementById('close-create-room-btn').onclick = () => {
    document.getElementById('create-room-modal').classList.add('hidden');
  };
  
  document.getElementById('create-room-form').onsubmit = handleCreateRoomSubmit;
  document.getElementById('admin-lobby-logout-btn').onclick = logout;
  document.getElementById('admin-back-lobby-btn').onclick = leaveMonitoredRoom;
  document.getElementById('admin-logout-btn').onclick = logout;
  
  // Connect socket if not connected
  initLobbySocket();

  await fetchActiveRooms();
}

function initLobbySocket() {
  if (socket) return;

  socket = io({
    auth: { token }
  });

  socket.on('connect', () => {
    console.log('[Socket] Admin connected to signaling lobby.');
  });
}

async function fetchActiveRooms() {
  try {
    const res = await fetch('/api/rooms', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const rooms = await res.json();
    if (!res.ok) throw new Error(rooms.error || 'Failed to fetch rooms');

    const grid = document.getElementById('rooms-grid');
    grid.innerHTML = '';

    if (rooms.length === 0) {
      grid.innerHTML = `
        <div class="empty-state glass-panel" style="grid-column: 1 / -1; min-height: 200px; padding: 40px 20px;">
          <i class="fa-solid fa-folder-open empty-icon" style="font-size: 2.2rem; margin-bottom: 12px;"></i>
          <h4>No proctoring rooms created yet</h4>
          <p>Click "Create Exam Room" in the top right to start a secure proctoring session.</p>
        </div>
      `;
      return;
    }

    rooms.forEach(room => {
      const card = document.createElement('div');
      card.className = 'room-card border-glow fade-in';
      card.id = `room-card-${room.id}`;
      
      const badgeClass = room.hasPasscode ? 'badge-private' : 'badge-public';
      const badgeText = room.hasPasscode ? '<i class="fa-solid fa-lock"></i> Private' : '<i class="fa-solid fa-lock-open"></i> Public';
      
      card.innerHTML = `
        <div class="room-card-header">
          <h4>${room.name}</h4>
          <span class="room-card-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="room-card-body">
          <p style="margin-bottom: 4px;">Created on ${new Date(room.createdAt).toLocaleDateString()}</p>
          <p style="margin-bottom: 4px;">Occupancy: <strong style="color: var(--accent-primary);">${room.participantCount} / ${room.maxParticipants}</strong> candidates</p>
          <p>Status: <span style="color: var(--accent-success); font-weight:700;">Active</span></p>
        </div>
        <div class="room-card-actions">
          <button class="room-card-btn btn-monitor" onclick="monitorRoom('${room.id}', '${room.name}')"><i class="fa-solid fa-desktop"></i> Monitor Session</button>
          <button class="room-card-btn btn-delete" title="Delete Room" onclick="deleteRoom('${room.id}')"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      `;
      grid.appendChild(card);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function handleCreateRoomSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('room-name-input').value.trim();
  const passcode = document.getElementById('room-passcode-input').value.trim();
  const maxParticipants = document.getElementById('room-max-participants-input').value;
  
  try {
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, passcode, maxParticipants })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create room');
    
    showToast('Room created successfully.', 'success');
    document.getElementById('create-room-modal').classList.add('hidden');
    document.getElementById('create-room-form').reset();
    
    fetchActiveRooms();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteRoom(roomId) {
  if (!confirm('Are you sure you want to delete/close this proctor room? Candidates inside this room will be disconnected.')) return;
  
  try {
    const res = await fetch(`/api/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete room');
    
    showToast('Room successfully closed/deleted.', 'success');
    fetchActiveRooms();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ==========================================================================
// ADMIN WEBRTC MONITORING SESSION
// ==========================================================================

// Pre-initialize Mediasoup Device and Receive Transport for the active admin monitoring session.
// Always creates a FRESH device + transport per monitoring session so re-logins start clean.
async function setupAdminWebRtc() {
  try {
    // Close and reset any leftover transport from a previous (or same) session
    if (recvTransport) {
      recvTransport.close();
      recvTransport = null;
    }
    device = null;

    console.log('[SFU Admin] Initializing Mediasoup Device...');
    const routerRtpCapabilities = await new Promise((resolve, reject) => {
      socket.emit('getRouterRtpCapabilities', {}, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res.rtpCapabilities);
      });
    });

    device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities });
    console.log('[SFU Admin] Mediasoup Device loaded.');

    console.log('[SFU Admin] Creating WebRTC Recv Transport...');
    const transportParams = await new Promise((resolve, reject) => {
      socket.emit('createWebRtcTransport', {}, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });

    recvTransport = device.createRecvTransport(transportParams);

    recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connectWebRtcTransport', { transportId: recvTransport.id, dtlsParameters }, (res) => {
        if (res.error) errback(res.error);
        else callback();
      });
    });
    console.log('[SFU Admin] WebRTC Recv Transport created.');
  } catch (err) {
    console.error('[SFU Admin] WebRTC Ingestion initialization failed:', err);
    throw err;
  }
}

async function monitorRoom(roomId, roomName) {
  try {
    showToast(`Joining room: ${roomName}...`, 'info');
    
    // Ensure socket is initialized
    if (!socket) {
      socket = io({
        auth: { token }
      });
    }

    // Reset grid state NOW — before any socket events can arrive and populate it.
    // If we cleared the grid inside initAdminMonitorSession() (which runs in the
    // room:join ack callback), it would wipe out cards added by room:init-state
    // which arrives and is processed BEFORE the ack callback fires.
    document.getElementById('streams-grid').innerHTML = '';
    document.getElementById('streams-grid').classList.add('hidden');
    document.getElementById('streams-empty-state').classList.remove('hidden');
    activeUserCards.clear();
    activeConsumers.clear();

    // Pre-initialize Admin WebRTC Device and Transports BEFORE joining the room
    await setupAdminWebRtc();

    // Register room socket listeners before joining to prevent race condition.
    // room:init-state will arrive and be processed before the room:join ack callback,
    // so listeners MUST be registered before emitting room:join.
    setupAdminSocketListeners();

    socket.emit('room:join', { roomId }, (res) => {
      if (res.error) {
        showToast(res.error, 'danger');
      } else {
        currentRoomId = roomId;
        // Toggle view states
        document.getElementById('admin-lobby-state').classList.add('hidden');
        document.getElementById('admin-monitor-state').classList.remove('hidden');
        document.getElementById('current-monitored-room-name').innerText = roomName;
        document.getElementById('admin-profile-name').innerText = currentUser.username;

        // Bind DOM events and load initial metrics/logs.
        // NOTE: do NOT clear the grid here — room:init-state already populated it.
        initAdminMonitorSession();
      }
    });
  } catch (err) {
    showToast(`Failed to initialize WebRTC receiver: ${err.message}`, 'danger');
  }
}

function initAdminMonitorSession() {
  // Bind log triggers
  document.getElementById('refresh-logs-btn').onclick = fetchProctorLogs;
  document.getElementById('close-chat-modal').onclick = () => {
    document.getElementById('admin-chat-modal').classList.add('hidden');
    adminChattingWithUserId = null;
  };
  document.getElementById('modal-chat-form').onsubmit = handleAdminModalChatSubmit;

  // Grid was already reset in monitorRoom() before room:join was emitted,
  // and room:init-state has already populated it by the time this callback fires.
  // Do NOT clear it here.

  // Load database logs & metrics initially
  fetchMetrics();
  fetchProctorLogs();
}

function setupAdminSocketListeners() {
  if (!socket) return;

  socket.off('room:init-state');
  socket.on('room:init-state', ({ users }) => {
    console.log('[Socket Room] Monitored room init-state loaded. Total users:', users.length);
    const grid = document.getElementById('streams-grid');
    const emptyState = document.getElementById('streams-empty-state');
    
    grid.innerHTML = '';
    activeUserCards.clear();
    
    const candidates = users.filter(u => u.status !== 'offline');
    
    if (candidates.length > 0) {
      grid.classList.remove('hidden');
      emptyState.classList.add('hidden');
    } else {
      grid.classList.add('hidden');
      emptyState.classList.remove('hidden');
    }

    candidates.forEach(user => {
      addUserCard(user);
      if (user.status === 'streaming' && user.producerIds && user.producerIds.length > 0) {
        user.producerIds.forEach(prodId => {
          consumeStream(user.id, prodId);
        });
      }
    });
    
    updateActiveStreamsCounter();
  });

  socket.off('user:status-changed');
  socket.on('user:status-changed', async ({ userId, username, status, producerId }) => {
    console.log(`[Socket Room] User status changed in room: ${username} -> ${status}`);
    
    let card = activeUserCards.get(userId);
    
    if (status === 'offline') {
      if (card) {
        card.style.animation = 'slideOut 0.3s forwards';
        setTimeout(() => {
          card.remove();
          activeUserCards.delete(userId);
          activeConsumers.delete(userId);
          
          const grid = document.getElementById('streams-grid');
          if (activeUserCards.size === 0) {
            grid.classList.add('hidden');
            document.getElementById('streams-empty-state').classList.remove('hidden');
          }
          updateActiveStreamsCounter();
        }, 300);
      }
      showToast(`Candidate ${username} went offline.`, 'warning');
      fetchMetrics();
      return;
    }

    if (!card) {
      document.getElementById('streams-empty-state').classList.add('hidden');
      document.getElementById('streams-grid').classList.remove('hidden');
      card = addUserCard({ id: userId, username, status });
    }

    const statusDot = card.querySelector('.glowing-dot');
    const footerStatus = card.querySelector('.stream-meta-status');
    
    if (status === 'streaming') {
      statusDot.className = 'glowing-dot';
      footerStatus.className = 'stream-meta-status live';
      footerStatus.innerHTML = `<i class="fa-solid fa-signal"></i> Streaming Live`;
      
      showToast(`Candidate ${username} started broadcasting!`, 'success');
      
      if (producerId) {
        consumeStream(userId, producerId);
      }
    } else if (status === 'online') {
      statusDot.className = 'glowing-dot paused';
      footerStatus.className = 'stream-meta-status paused';
      footerStatus.innerHTML = `<i class="fa-solid fa-clock"></i> Standby`;
    }

    fetchMetrics();
    updateActiveStreamsCounter();
  });

  socket.off('proctor:log-added');
  socket.on('proctor:log-added', (log) => {
    appendAuditLogEntry(log);
    fetchMetrics();
  });

  socket.off('chat:receive-message');
  socket.on('chat:receive-message', ({ senderId, senderUsername, messageText, timestamp, type, receiverId }) => {
    if (senderId === currentUser.id) return;
    const isModalOpen = !document.getElementById('admin-chat-modal').classList.contains('hidden');
    if (type === 'public') {
      if (isModalOpen && activeAdminChatTab === 'public') {
        appendModalChatMessage(senderId === currentUser.id ? 'outgoing' : 'incoming', senderUsername, messageText, timestamp);
      } else {
        showToast(`[Public] ${senderUsername}: "${messageText.substring(0, 20)}..."`, 'chat');
      }
    } else if (type === 'private') {
      const activeDMUser = adminChattingWithUserId;
      if (isModalOpen && activeAdminChatTab === 'private' && (senderId === activeDMUser || (senderId === currentUser.id && receiverId === activeDMUser))) {
        appendModalChatMessage(senderId === currentUser.id ? 'outgoing' : 'incoming', senderUsername, messageText, timestamp);
      } else if (senderId !== currentUser.id) {
        showToast(`New DM from ${senderUsername}: "${messageText.substring(0, 20)}..."`, 'chat');
        const card = activeUserCards.get(senderId);
        if (card) {
          const chatBtn = card.querySelector('.btn-ctrl-blue');
          if (chatBtn) {
            chatBtn.style.animation = 'pulseGreen 1s infinite alternate';
          }
        }
      }
    }
  });

  // Dynamic candidate lobby events inside our monitored room
  socket.off('room:user-joined');
  socket.on('room:user-joined', ({ userId, username, status }) => {
    showToast(`Candidate ${username} entered the proctored exam room.`, 'success');
    
    let card = activeUserCards.get(userId);
    if (!card) {
      document.getElementById('streams-empty-state').classList.add('hidden');
      document.getElementById('streams-grid').classList.remove('hidden');
      card = addUserCard({ id: userId, username, status });
    }
    fetchMetrics();
  });

  socket.off('room:user-left');
  socket.on('room:user-left', ({ userId, username }) => {
    showToast(`Candidate ${username} exited the proctored exam room.`, 'warning');
    let card = activeUserCards.get(userId);
    if (card) {
      card.remove();
      activeUserCards.delete(userId);
      activeConsumers.delete(userId);
      
      const grid = document.getElementById('streams-grid');
      if (activeUserCards.size === 0) {
        grid.classList.add('hidden');
        document.getElementById('streams-empty-state').classList.remove('hidden');
      }
    }
    fetchMetrics();
    updateActiveStreamsCounter();
  });
}


async function leaveMonitoredRoom() {
  if (!confirm('Are you sure you want to stop proctoring this room and return to the lobby?')) return;
  
  if (socket) {
    socket.emit('room:leave', {}, (res) => {
      currentRoomId = null;
      // Clear WebRTC Recv transport
      if (recvTransport) {
        recvTransport.close();
        recvTransport = null;
      }
      device = null;
      activeConsumers.clear();
      activeUserCards.clear();
      
      // Go back to lobby
      document.getElementById('admin-monitor-state').classList.add('hidden');
      document.getElementById('admin-lobby-state').classList.remove('hidden');
      initAdminLobby();
    });
  }
}

// ==========================================================================
// CANDIDATE LOBBY & BROADCAST
// ==========================================================================

async function initUserLobby() {
  document.getElementById('user-lobby-logout-btn').onclick = logout;
  document.getElementById('join-room-form').onsubmit = handleUserJoinRoomSubmit;
  document.getElementById('user-exit-room-btn').onclick = leaveUserRoom;
  document.getElementById('user-logout-btn').onclick = logout;

  // Track room select to toggle passcode box
  const roomSelect = document.getElementById('join-room-select');
  roomSelect.onchange = () => {
    const selectedOption = roomSelect.options[roomSelect.selectedIndex];
    const hasPasscode = selectedOption.getAttribute('data-has-passcode') === 'true';
    const passcodeGroup = document.getElementById('passcode-input-group');
    
    if (hasPasscode) {
      passcodeGroup.classList.remove('hidden');
      document.getElementById('join-room-passcode').required = true;
    } else {
      passcodeGroup.classList.add('hidden');
      document.getElementById('join-room-passcode').required = false;
    }
  };

  await fetchUserLobbyRooms();
}

async function fetchUserLobbyRooms() {
  try {
    const res = await fetch('/api/rooms', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const rooms = await res.json();
    if (!res.ok) throw new Error(rooms.error || 'Failed to fetch rooms');

    const select = document.getElementById('join-room-select');
    select.innerHTML = '<option value="" disabled selected>Select an exam room...</option>';

    rooms.forEach(room => {
      const option = document.createElement('option');
      option.value = room.id;
      option.innerText = `${room.name} ${room.hasPasscode ? '(Locked 🔒)' : '(Public 🔓)'} [${room.participantCount} / ${room.maxParticipants}]`;
      option.setAttribute('data-has-passcode', room.hasPasscode);
      select.appendChild(option);
    });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function handleUserJoinRoomSubmit(e) {
  e.preventDefault();
  const roomId = document.getElementById('join-room-select').value;
  const passcode = document.getElementById('join-room-passcode').value;

  showToast('Connecting to proctoring node...', 'info');

  if (!socket) {
    socket = io({
      auth: { token }
    });
  }

  socket.emit('room:join', { roomId, passcode }, (res) => {
    if (res.error) {
      showToast(res.error, 'danger');
    } else {
      currentRoomId = roomId;
      // Transition views
      document.getElementById('user-lobby-state').classList.add('hidden');
      document.getElementById('user-monitor-state').classList.remove('hidden');
      
      document.getElementById('current-user-room-name').innerText = res.room.name;
      document.getElementById('user-profile-name').innerText = currentUser.username;

      // Start standard streaming/chat setup
      initUserStreamingSession();
    }
  });
}

function initUserStreamingSession() {
  // Reset buttons
  document.getElementById('start-broadcast-btn').onclick = startBroadcasting;
  document.getElementById('start-broadcast-btn').classList.remove('hidden');
  document.getElementById('start-broadcast-btn').disabled = false;
  document.getElementById('start-broadcast-btn').innerHTML = `<i class="fa-solid fa-circle-play"></i> Initiate Broadcast`;
  
  document.getElementById('toggle-video-btn').onclick = toggleLocalVideo;
  document.getElementById('toggle-video-btn').classList.add('hidden');
  document.getElementById('toggle-audio-btn').onclick = toggleLocalAudio;
  document.getElementById('toggle-audio-btn').classList.add('hidden');
  
  document.getElementById('chat-input-form').onsubmit = handleUserChatSubmit;

  // Set default chat tab
  activeCandidateChatTab = 'public';
  document.getElementById('candidate-tab-public').className = 'chat-tab-btn active';
  document.getElementById('candidate-tab-private').className = 'chat-tab-btn';
  document.getElementById('candidate-tab-public').style.borderBottom = '2px solid var(--accent-primary)';
  document.getElementById('candidate-tab-private').style.borderBottom = '2px solid transparent';
  document.getElementById('candidate-tab-public').style.color = '#a5b4fc';
  document.getElementById('candidate-tab-private').style.color = '#94a3b8';
  document.getElementById('chat-channel-title').innerHTML = `<i class="fa-solid fa-comments"></i> Public Room Discussion`;
  document.getElementById('chat-message-input').placeholder = 'Type a public message...';

  // Bind tab click events
  document.getElementById('candidate-tab-public').onclick = () => {
    SoundEngine.play('click');
    activeCandidateChatTab = 'public';
    document.getElementById('candidate-tab-public').className = 'chat-tab-btn active';
    document.getElementById('candidate-tab-private').className = 'chat-tab-btn';
    document.getElementById('candidate-tab-public').style.borderBottom = '2px solid var(--accent-primary)';
    document.getElementById('candidate-tab-private').style.borderBottom = '2px solid transparent';
    document.getElementById('candidate-tab-public').style.color = '#a5b4fc';
    document.getElementById('candidate-tab-private').style.color = '#94a3b8';
    document.getElementById('chat-channel-title').innerHTML = `<i class="fa-solid fa-comments"></i> Public Room Discussion`;
    document.getElementById('chat-message-input').placeholder = 'Type a public message...';
    loadCandidateChatHistory();
  };

  document.getElementById('candidate-tab-private').onclick = () => {
    SoundEngine.play('click');
    activeCandidateChatTab = 'private';
    document.getElementById('candidate-tab-private').className = 'chat-tab-btn active';
    document.getElementById('candidate-tab-public').className = 'chat-tab-btn';
    document.getElementById('candidate-tab-private').style.borderBottom = '2px solid var(--accent-primary)';
    document.getElementById('candidate-tab-public').style.borderBottom = '2px solid transparent';
    document.getElementById('candidate-tab-private').style.color = '#a5b4fc';
    document.getElementById('candidate-tab-public').style.color = '#94a3b8';
    document.getElementById('chat-channel-title').innerHTML = `<i class="fa-solid fa-user-shield"></i> Proctor DM`;
    document.getElementById('chat-message-input').placeholder = 'Type a message to the proctor...';
    loadCandidateChatHistory();
  };

  // Clear local video preview elements
  const localVideo = document.getElementById('local-video');
  localVideo.srcObject = null;
  localVideo.classList.add('hidden');
  document.getElementById('local-video-placeholder').classList.remove('hidden');
  document.getElementById('user-blocked-overlay').classList.add('hidden');

  // Load initial chat history (Public)
  loadCandidateChatHistory();

  // Play room enter arpeggio sound!
  SoundEngine.play('join');

  // Bind candidate socket listeners
  socket.off('connect');
  socket.on('connect', () => {
    document.getElementById('user-status-light').className = 'status-indicator online pulsing';
    document.getElementById('spec-transport').innerText = 'Socket.io Core';
  });

  socket.off('disconnect');
  socket.on('disconnect', () => {
    document.getElementById('user-status-light').className = 'status-indicator offline';
    document.getElementById('spec-transport').innerText = 'Offline';
  });

  socket.off('stream:toggled');
  socket.on('stream:toggled', ({ producerId, paused, actionType }) => {
    showToast(`Proctor remotely ${paused ? 'PAUSED' : 'RESUMED'} your ${actionType} channel.`, paused ? 'warning' : 'success');
    SoundEngine.play('toggle');
    
    if (actionType === 'video') {
      const overlay = document.getElementById('user-blocked-overlay');
      if (paused) {
        overlay.classList.remove('hidden');
        document.getElementById('toggle-video-btn').innerHTML = `<i class="fa-solid fa-video-slash"></i> Resumed by Admin`;
        document.getElementById('toggle-video-btn').disabled = true;
      } else {
        overlay.classList.add('hidden');
        document.getElementById('toggle-video-btn').innerHTML = `<i class="fa-solid fa-video"></i> Stop Camera`;
        document.getElementById('toggle-video-btn').disabled = false;
      }
    } else if (actionType === 'audio') {
      const btn = document.getElementById('toggle-audio-btn');
      if (paused) {
        btn.innerHTML = `<i class="fa-solid fa-microphone-slash"></i> Muted by Admin`;
        btn.disabled = true;
      } else {
        btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Mute Mic`;
        btn.disabled = false;
      }
    }
  });

  socket.off('proctor:kicked');
  socket.on('proctor:kicked', ({ reason }) => {
    SoundEngine.play('kick');
    alert(`CRITICAL ALERT: You have been kicked by the Proctor!\nReason: ${reason || 'Violation of exam policy'}`);
    logout();
  });

  socket.off('chat:receive-message');
  socket.on('chat:receive-message', ({ senderId, senderUsername, messageText, timestamp, type }) => {
    if (senderId === currentUser.id) return;
    // If the received message matches our currently active tab, append it
    if (type === activeCandidateChatTab) {
      appendChatMessage(senderId === currentUser.id ? 'outgoing' : 'incoming', senderUsername, messageText, timestamp);
    } else {
      // Direct message notification / bubble pop
      SoundEngine.play('message');
      showToast(`New ${type} message from ${senderUsername}: "${messageText.substring(0, 20)}..."`, 'chat');
    }
  });
}

async function leaveUserRoom() {
  if (!confirm('Are you sure you want to exit the proctored exam room? This will stop your camera and microphone streams.')) return;

  // Clear local tracks
  if (videoProducer) {
    videoProducer.close();
    videoProducer = null;
  }
  if (audioProducer) {
    audioProducer.close();
    audioProducer = null;
  }
  
  const localVid = document.getElementById('local-video');
  if (localVid && localVid.srcObject) {
    localVid.srcObject.getTracks().forEach(track => track.stop());
    localVid.srcObject = null;
  }

  if (sendTransport) {
    sendTransport.close();
    sendTransport = null;
  }
  device = null;

  document.getElementById('stream-status-pill').className = 'status-pill status-pill-red';
  document.getElementById('stream-status-pill').innerText = 'Stream Offline';
  document.getElementById('spec-transport').innerText = 'Lobby Standby';

  if (socket) {
    socket.emit('room:leave', {}, (res) => {
      currentRoomId = null;
      // Return back to lobby
      document.getElementById('user-monitor-state').classList.add('hidden');
      document.getElementById('user-lobby-state').classList.remove('hidden');
      initUserLobby();
    });
  }
}

// ==========================================================================
// CANDIDATE WEBRTC STREAMING ACTIONS
// ==========================================================================

async function startBroadcasting() {
  const startBtn = document.getElementById('start-broadcast-btn');
  startBtn.disabled = true;
  startBtn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Initializing SFU...`;

  try {
    // 1. Fetch user stream
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { max: 24 } },
      audio: true
    });

    const localVideo = document.getElementById('local-video');
    localVideo.srcObject = localStream;
    localVideo.classList.remove('hidden');
    document.getElementById('local-video-placeholder').classList.add('hidden');

    const videoTrack = localStream.getVideoTracks()[0];
    const audioTrack = localStream.getAudioTracks()[0];

    // 2. Fetch SFU Capabilities & Create Mediasoup Device
    const routerRtpCapabilities = await new Promise((resolve, reject) => {
      socket.emit('getRouterRtpCapabilities', {}, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res.rtpCapabilities);
      });
    });

    device = new mediasoupClient.Device();
    await device.load({ routerRtpCapabilities });
    console.log('[Mediasoup Client] Router capabilities loaded into dynamic device.');

    // 3. Create Server Send Transport
    const transportParams = await new Promise((resolve, reject) => {
      socket.emit('createWebRtcTransport', {}, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });

    // 4. Instantiate client-side Send Transport
    sendTransport = device.createSendTransport(transportParams);

    sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
      socket.emit('connectWebRtcTransport', { transportId: sendTransport.id, dtlsParameters }, (res) => {
        if (res.error) errback(res.error);
        else callback();
      });
    });

    sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
      socket.emit('produce', { transportId: sendTransport.id, kind, rtpParameters }, (res) => {
        if (res.error) errback(res.error);
        else callback({ id: res.id });
      });
    });

    // 5. Produce video & audio
    videoProducer = await sendTransport.produce({ track: videoTrack });
    audioProducer = await sendTransport.produce({ track: audioTrack });

    console.log('[Mediasoup Client] Successfully producing video and audio tracks!');

    // UI Updates
    document.getElementById('stream-status-pill').className = 'status-pill status-pill-green';
    document.getElementById('stream-status-pill').innerText = 'Live Streaming';
    document.getElementById('spec-transport').innerText = 'WebRTC SFU Active';
    
    // Enable Toggle controls
    document.getElementById('toggle-video-btn').classList.remove('hidden');
    document.getElementById('toggle-video-btn').disabled = false;
    document.getElementById('toggle-audio-btn').classList.remove('hidden');
    document.getElementById('toggle-audio-btn').disabled = false;
    
    startBtn.classList.add('hidden');
    showToast('Secure broadcast active. The proctors are now monitoring.', 'success');

  } catch (err) {
    console.error('Broadcasting failed:', err);
    showToast(`Streaming initialization failed: ${err.message}`, 'danger');
    startBtn.disabled = false;
    startBtn.innerHTML = `<i class="fa-solid fa-circle-play"></i> Retry Broadcast`;
  }
}

function toggleLocalVideo() {
  const btn = document.getElementById('toggle-video-btn');
  if (videoProducer.paused) {
    videoProducer.resume();
    btn.innerHTML = `<i class="fa-solid fa-video"></i> Stop Camera`;
    btn.className = 'control-btn btn-grey';
  } else {
    videoProducer.pause();
    btn.innerHTML = `<i class="fa-solid fa-video-slash"></i> Start Camera`;
    btn.className = 'control-btn btn-danger';
  }
}

function toggleLocalAudio() {
  const btn = document.getElementById('toggle-audio-btn');
  if (audioProducer.paused) {
    audioProducer.resume();
    btn.innerHTML = `<i class="fa-solid fa-microphone"></i> Mute Mic`;
    btn.className = 'control-btn btn-grey';
  } else {
    audioProducer.pause();
    btn.innerHTML = `<i class="fa-solid fa-microphone-slash"></i> Unmute Mic`;
    btn.className = 'control-btn btn-danger';
  }
}

function handleUserChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-message-input');
  const messageText = input.value.trim();
  if (!messageText) return;

  const receiverId = activeCandidateChatTab === 'public' ? 'public' : 'admin';

  socket.emit('chat:send-message', { receiverId, messageText }, (res) => {
    if (res.error) {
      showToast(res.error, 'danger');
    } else {
      appendChatMessage('outgoing', currentUser.username, messageText, res.timestamp);
      input.value = '';
    }
  });
}

function appendChatMessage(direction, sender, text, timestamp) {
  const container = document.getElementById('chat-messages-container');
  const bubble = document.createElement('div');
  bubble.className = `msg-bubble ${direction}`;
  
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  bubble.innerHTML = `
    <span class="sender-label">${sender}</span>
    <p>${text}</p>
    <span class="time-label">${time}</span>
  `;
  
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
}

// ==========================================================================
// ADMIN CARD & WEBRTC INGESTION
// ==========================================================================

function addUserCard(user) {
  const grid = document.getElementById('streams-grid');
  
  const card = document.createElement('div');
  card.className = 'stream-card glass-panel border-glow fade-in';
  card.id = `user-card-${user.id}`;
  
  // Footer status indicator text
  let statusClass = 'stopped';
  let statusText = `<i class="fa-solid fa-video-slash"></i> Offline`;
  let dotClass = 'offline';

  if (user.status === 'online') {
    statusClass = 'paused';
    statusText = `<i class="fa-solid fa-clock"></i> Standby`;
    dotClass = 'paused';
  } else if (user.status === 'streaming') {
    statusClass = 'live';
    statusText = `<i class="fa-solid fa-signal"></i> Streaming Live`;
    dotClass = '';
  }

  card.innerHTML = `
    <div class="stream-video-container">
      <div class="no-video-overlay" id="no-video-${user.id}">
        <i class="fa-solid fa-video-slash"></i>
        <span>No media stream published</span>
      </div>
      <video id="video-${user.id}" autoplay playsinline></video>
      <div class="user-identity-card">
        <span class="glowing-dot ${dotClass}"></span>
        <span>${user.username}</span>
      </div>
      <!-- Hover administrative buttons -->
      <div class="stream-card-controls">
        <button class="action-circle-btn btn-ctrl-blue" title="Open chat" onclick="openAdminChatModal('${user.id}', '${user.username}')">
          <i class="fa-solid fa-comments"></i>
        </button>
        <button class="action-circle-btn btn-ctrl-orange" id="mute-btn-${user.id}" title="Toggle mic mute">
          <i class="fa-solid fa-microphone"></i>
        </button>
        <button class="action-circle-btn btn-ctrl-orange" id="pause-btn-${user.id}" title="Toggle video stop">
          <i class="fa-solid fa-video"></i>
        </button>
        <button class="action-circle-btn btn-ctrl-red" title="Kick candidate" onclick="kickCandidatePrompt('${user.id}', '${user.username}')">
          <i class="fa-solid fa-user-xmark"></i>
        </button>
        <button class="action-circle-btn btn-ctrl-red" title="Block account" onclick="blockCandidatePrompt('${user.id}', '${user.username}')">
          <i class="fa-solid fa-ban"></i>
        </button>
      </div>
    </div>
    <div class="stream-card-footer">
      <span class="stream-meta-status ${statusClass}">${statusText}</span>
      <span class="ping-badge">WebRTC</span>
    </div>
  `;

  // Bind custom events inside stream overlay
  card.querySelector(`#mute-btn-${user.id}`).onclick = () => toggleUserMic(user.id);
  card.querySelector(`#pause-btn-${user.id}`).onclick = () => toggleUserCam(user.id);

  grid.appendChild(card);
  activeUserCards.set(user.id, card);
  return card;
}

function updateActiveStreamsCounter() {
  let count = 0;
  activeUserCards.forEach((card) => {
    if (card.querySelector('.stream-meta-status').classList.contains('live')) count++;
  });
  document.getElementById('stream-count-badge').innerText = `${count} Live`;
}

async function consumeStream(targetUserId, producerId) {
  try {
    console.log(`[SFU Admin] Commencing consumer initialization for user ${targetUserId} - Producer: ${producerId}`);

    // Ensure receiver transport is pre-configured
    if (!device || !recvTransport) {
      throw new Error('WebRTC Ingestion pipeline is not pre-configured.');
    }

    // 3. Emit consume event to receive WebRTC stream params
    const consumerParams = await new Promise((resolve, reject) => {
      socket.emit('consume', {
        consumerTransportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
        targetUserId
      }, (res) => {
        if (res.error) reject(new Error(res.error));
        else resolve(res);
      });
    });

    // 4. Create local client Consumer
    const consumer = await recvTransport.consume(consumerParams);

    // 5. Resume packet stream on server and client
    await new Promise((resolve, reject) => {
      socket.emit('resumeConsumer', { consumerId: consumer.id }, (res) => {
        if (res.error) reject(new Error(res.error));
        else {
          consumer.resume(); // Local client consumer must be explicitly resumed
          resolve();
        }
      });
    });

    console.log(`[SFU Admin] Successfully consuming track type: ${consumer.kind} - ID: ${consumer.id}`);

    // 6. Map elements
    if (!activeConsumers.has(targetUserId)) {
      activeConsumers.set(targetUserId, { videoConsumer: null, audioConsumer: null });
    }

    const mapping = activeConsumers.get(targetUserId);

    if (consumer.kind === 'video') {
      mapping.videoConsumer = consumer;
      
      const videoEl = document.getElementById(`video-${targetUserId}`);
      const overlay = document.getElementById(`no-video-${targetUserId}`);
      
      if (videoEl) {
        const stream = new MediaStream([consumer.track]);
        videoEl.srcObject = stream;
        videoEl.play().catch(e => console.warn('Autoplay block on grid video:', e));
        
        if (overlay) overlay.classList.add('hidden');
      }
    } else if (consumer.kind === 'audio') {
      mapping.audioConsumer = consumer;
      
      // Play audio invisibly
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.srcObject = new MediaStream([consumer.track]);
      document.body.appendChild(audioEl);
    }

  } catch (err) {
    console.error('Failed to consume user WebRTC feed:', err);
    showToast(`Could not mount video feed: ${err.message}`, 'warning');
  }
}

// Remote pause/play camera
function toggleUserCam(userId) {
  const mapping = activeConsumers.get(userId);
  const card = activeUserCards.get(userId);
  if (!mapping || !mapping.videoConsumer) {
    showToast('User has not started video stream.', 'warning');
    return;
  }

  const isPaused = mapping.videoConsumer.paused;
  const btn = card.querySelector(`#pause-btn-${userId}`);

  socket.emit('admin:toggle-producer', {
    targetUserId: userId,
    producerId: mapping.videoConsumer.producerId,
    pause: !isPaused,
    actionType: 'video'
  }, (res) => {
    if (res.error) {
      showToast(res.error, 'danger');
    } else {
      if (!isPaused) {
        mapping.videoConsumer.pause();
        btn.innerHTML = `<i class="fa-solid fa-video-slash"></i>`;
        btn.className = 'action-circle-btn btn-ctrl-red';
        showToast('Video feed paused successfully.', 'info');
      } else {
        mapping.videoConsumer.resume();
        btn.innerHTML = `<i class="fa-solid fa-video"></i>`;
        btn.className = 'action-circle-btn btn-ctrl-orange';
        showToast('Video feed resumed successfully.', 'success');
      }
    }
  });
}

// Remote mute/unmute mic
function toggleUserMic(userId) {
  const mapping = activeConsumers.get(userId);
  const card = activeUserCards.get(userId);
  if (!mapping || !mapping.audioConsumer) {
    showToast('User has not shared audio stream.', 'warning');
    return;
  }

  const isPaused = mapping.audioConsumer.paused;
  const btn = card.querySelector(`#mute-btn-${userId}`);

  socket.emit('admin:toggle-producer', {
    targetUserId: userId,
    producerId: mapping.audioConsumer.producerId,
    pause: !isPaused,
    actionType: 'audio'
  }, (res) => {
    if (res.error) {
      showToast(res.error, 'danger');
    } else {
      if (!isPaused) {
        mapping.audioConsumer.pause();
        btn.innerHTML = `<i class="fa-solid fa-microphone-slash"></i>`;
        btn.className = 'action-circle-btn btn-ctrl-red';
        showToast('Candidate microphone muted.', 'info');
      } else {
        mapping.audioConsumer.resume();
        btn.innerHTML = `<i class="fa-solid fa-microphone"></i>`;
        btn.className = 'action-circle-btn btn-ctrl-orange';
        showToast('Candidate microphone unmuted.', 'success');
      }
    }
  });
}

// Force Logout Kick candidate
function kickCandidatePrompt(userId, username) {
  const reason = prompt(`Enter reason to disconnect ${username}:`, 'Unauthorized browser actions detected');
  if (reason === null) return;

  socket.emit('admin:kick-user', { targetUserId: userId, reason }, (res) => {
    if (res.error) showToast(res.error, 'danger');
    else showToast(`Evicted ${username} from platform.`, 'success');
  });
}

// SQL Block database record
async function blockCandidatePrompt(userId, username) {
  if (!confirm(`Are you sure you want to block candidate ${username}? This will write a block record to SQL database and invalidate their account.`)) return;

  try {
    const res = await fetch(`/api/admin/block/${userId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (!res.ok) throw new Error(data.error || 'Block request failed');
    
    showToast(`Successfully blocked user ${username} from the Sequelize DB.`, 'success');
    
    // Kick them instantly via socket
    socket.emit('admin:kick-user', { targetUserId: userId, reason: 'Account has been blocked by Administrator.' });
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// ==========================================================================
// ADMIN LOGS & METRICS API CALLS
// ==========================================================================

async function fetchMetrics() {
  try {
    const res = await fetch('/api/admin/metrics', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (!res.ok) return;

    document.getElementById('stat-active-streams').innerText = data.streamingUsers;
    document.getElementById('stat-online-users').innerText = data.onlineUsers;
    document.getElementById('stat-audit-actions').innerText = data.totalLogs;
  } catch (err) {
    console.error('Failed to update metrics:', err);
  }
}

async function fetchProctorLogs() {
  try {
    const res = await fetch('/api/admin/logs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const logs = await res.json();
    
    if (!res.ok) return;

    const list = document.getElementById('audit-log-list');
    list.innerHTML = '';

    logs.forEach(log => {
      appendAuditLogEntry(log, false); // batch append
    });
  } catch (err) {
    console.error('Failed to load logs:', err);
  }
}

function appendAuditLogEntry(log, prepend = true) {
  const list = document.getElementById('audit-log-list');
  const div = document.createElement('div');
  div.className = 'log-item fade-in';
  
  let actionColorClass = 'text-color-join';
  if (log.action === 'USER_KICKED') actionColorClass = 'text-color-kick';
  if (log.action === 'USER_BLOCKED') actionColorClass = 'text-color-block';
  if (log.action === 'MEDIA_PAUSED') actionColorClass = 'text-color-media';
  
  const time = new Date(log.createdAt || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Extracted details
  let detailsText = '';
  try {
    const parsed = JSON.parse(log.details);
    detailsText = parsed.text || parsed.reason || log.details;
  } catch (e) {
    detailsText = log.details || '';
  }

  div.innerHTML = `
    <div class="log-header-strip">
      <span class="action-type ${actionColorClass}">${log.action.replace('_', ' ')}</span>
      <span class="time">${time}</span>
    </div>
    <p>${detailsText}</p>
    <div class="meta-row">Target: <strong>${log.targetUsername || 'System'}</strong> | Proctor: <strong>${log.adminUsername || 'System'}</strong></div>
  `;

  if (prepend) {
    list.insertBefore(div, list.firstChild);
  } else {
    list.appendChild(div);
  }
}

// ==========================================================================
// ADMIN CHAT MODAL & HISTORY MANAGEMENT
// ==========================================================================

function openAdminChatModal(userId, username) {
  adminChattingWithUserId = userId;
  adminChattingWithUsername = username;
  document.getElementById('admin-chat-modal').classList.remove('hidden');

  // De-escalate blinking chat button
  const card = activeUserCards.get(userId);
  if (card) {
    const chatBtn = card.querySelector('.btn-ctrl-blue');
    if (chatBtn) {
      chatBtn.style.animation = 'none';
    }
  }

  // Setup tab click handlers dynamically
  const tabPrivate = document.getElementById('admin-tab-private');
  const tabPublic = document.getElementById('admin-tab-public');

  tabPrivate.onclick = () => {
    SoundEngine.play('click');
    activeAdminChatTab = 'private';
    tabPrivate.className = 'chat-tab-btn active';
    tabPublic.className = 'chat-tab-btn';
    tabPrivate.style.borderBottom = '2px solid var(--accent-primary)';
    tabPublic.style.borderBottom = '2px solid transparent';
    tabPrivate.style.color = '#a5b4fc';
    tabPublic.style.color = '#94a3b8';
    document.getElementById('admin-chat-channel-title').innerText = `Direct DM with ${username}`;
    document.getElementById('modal-chat-input').placeholder = `Type direct reply to ${username}...`;
    loadAdminChatHistory();
  };

  tabPublic.onclick = () => {
    SoundEngine.play('click');
    activeAdminChatTab = 'public';
    tabPublic.className = 'chat-tab-btn active';
    tabPrivate.className = 'chat-tab-btn';
    tabPublic.style.borderBottom = '2px solid var(--accent-primary)';
    tabPrivate.style.borderBottom = '2px solid transparent';
    tabPublic.style.color = '#a5b4fc';
    tabPrivate.style.color = '#94a3b8';
    document.getElementById('admin-chat-channel-title').innerText = `Public Room Chat`;
    document.getElementById('modal-chat-input').placeholder = `Type a public broadcast message...`;
    loadAdminChatHistory();
  };

  // Initially activate the private DM tab
  tabPrivate.click();
}

async function loadAdminChatHistory() {
  if (!currentRoomId) return;
  const box = document.getElementById('modal-chat-messages');
  box.innerHTML = `<div class="system-message"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading history...</p></div>`;

  try {
    let url = '';
    if (activeAdminChatTab === 'public') {
      url = `/api/chat/room/${currentRoomId}/public`;
    } else {
      url = `/api/chat/private/${currentRoomId}/${adminChattingWithUserId}`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const messages = await res.json();
    if (!res.ok) throw new Error(messages.error || 'Failed to fetch history');

    box.innerHTML = '';
    if (messages.length === 0) {
      if (activeAdminChatTab === 'public') {
        box.innerHTML = `
          <div class="system-message">
            <i class="fa-solid fa-users"></i>
            <p>Welcome to the Public Room Chat. All candidates and proctors can see messages sent here.</p>
          </div>
        `;
      } else {
        box.innerHTML = `
          <div class="system-message">
            <i class="fa-solid fa-lock"></i>
            <p>Direct communication channel with candidate <strong>${adminChattingWithUsername}</strong>. All messages are encrypted & audited.</p>
          </div>
        `;
      }
      return;
    }

    messages.forEach(msg => {
      const direction = msg.senderId === currentUser.id ? 'outgoing' : 'incoming';
      appendModalChatMessage(direction, msg.Sender?.username || 'Unknown', msg.messageText, msg.createdAt);
    });
  } catch (err) {
    console.error('Failed to load admin chat history:', err);
    box.innerHTML = `<div class="system-message"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load chat history.</p></div>`;
  }
}

function handleAdminModalChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('modal-chat-input');
  const messageText = input.value.trim();
  if (!messageText) return;

  const receiverId = activeAdminChatTab === 'public' ? 'public' : adminChattingWithUserId;

  socket.emit('chat:send-message', { receiverId, messageText }, (res) => {
    if (res.error) {
      showToast(res.error, 'danger');
    } else {
      appendModalChatMessage('outgoing', currentUser.username, messageText, res.timestamp);
      input.value = '';
    }
  });
}

function appendModalChatMessage(direction, sender, text, timestamp) {
  const box = document.getElementById('modal-chat-messages');
  const div = document.createElement('div');
  div.className = `msg-bubble ${direction}`;
  
  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  div.innerHTML = `
    <span class="sender-label">${sender}</span>
    <p>${text}</p>
    <span class="time-label">${time}</span>
  `;
  
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function loadCandidateChatHistory() {
  if (!currentRoomId) return;
  const container = document.getElementById('chat-messages-container');
  container.innerHTML = `<div class="system-message"><i class="fa-solid fa-spinner fa-spin"></i><p>Loading history...</p></div>`;

  try {
    let url = '';
    if (activeCandidateChatTab === 'public') {
      url = `/api/chat/room/${currentRoomId}/public`;
    } else {
      url = `/api/chat/private/${currentRoomId}/${currentUser.id}`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const messages = await res.json();
    if (!res.ok) throw new Error(messages.error || 'Failed to fetch history');

    container.innerHTML = '';
    if (messages.length === 0) {
      if (activeCandidateChatTab === 'public') {
        container.innerHTML = `
          <div class="system-message">
            <i class="fa-solid fa-shield-halved"></i>
            <p>Welcome to the Public Exam Room Chat. All candidates and proctors can see messages sent here.</p>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="system-message">
            <i class="fa-solid fa-user-shield"></i>
            <p>Welcome to your Proctor DM. This is a private channel between you and the Proctor.</p>
          </div>
        `;
      }
      return;
    }

    messages.forEach(msg => {
      const direction = msg.senderId === currentUser.id ? 'outgoing' : 'incoming';
      appendChatMessage(direction, msg.Sender?.username || 'Unknown', msg.messageText, msg.createdAt);
    });
  } catch (err) {
    console.error('Failed to load chat history:', err);
    container.innerHTML = `<div class="system-message"><i class="fa-solid fa-triangle-exclamation"></i><p>Failed to load chat history.</p></div>`;
  }
}
