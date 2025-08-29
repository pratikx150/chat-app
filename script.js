const DEFAULT_FAVICON = "/vite.svg";
const UNREAD_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='8' fill='%23ff0000'/%3E%3Ctext x='8' y='12' text-anchor='middle' fill='white' font-size='10' font-weight='bold'%3E!%3C/text%3E%3C/svg%3E";
const DEFAULT_TITLE = "Nest";
const UNREAD_TITLE = "🔴 New Messages";

const themes = [
  { name: "Default Dark", id: "theme-default" },
  { name: "Dark Black", id: "theme-light" },
  { name: "Forest Whisper", id: "theme-forest" },
  { name: "Pink Dream", id: "theme-sunset" },
];

const stickerCategories = [
  { id: 'GIFs', name: 'GIFs', icon: 'GIF' },
  { id: 'PICs', name: 'PICs', icon: 'PIC' },
  { id: 'NIL', name: 'NIL', icon: 'NIL' },
];

const stickers = [
  { id: 'happy', name: 'Happy Dog', url: 'https://media1.tenor.com/m/zxOs4Unxm_8AAAAC/dog-meme.gif', category: 'PICs' },
];

let username = localStorage.getItem('username');
let currentTheme = localStorage.getItem('chatTheme') || 'theme-default';
let messages = [];
let onlineUsers = [];
let activeTimer = null;
let globalNotifications = [];
let newMessageText = '';
let replyingTo = null;
let isRecording = false;
let previewMedia = null;
let showUnreadInTitle = false;
let unreadCount = 0;
let userHasScrolledUp = false;
let showScrollToBottom = false;
let showTimerModal = false;
let showTimerExpiredModal = false;
let expiredTimerName = '';
let timerName = '';
let timerMinutes = 5;
let timerSeconds = 0;
let activeEmojiShower = null;
let currentTime = Date.now();
let showStickerPicker = false;
let activeStickerCategory = 'GIFs';
let showMediaMenu = false;
let showCamera = false;
let facingMode = 'environment';
let cameraStream = null;
let showUserDropdown = false;
let isMuted = false;

const app = document.getElementById('app');
const favicon = document.getElementById('favicon');
const chatContainer = { current: null };
const fileInput = { current: null };
const videoRef = { current: null };
const canvasRef = { current: null };
let lastMessageCount = 0;
let lastReadMessageId = null;
let lastScrollTop = 0;
let isAutoScrolling = false;

const API_BASE = '/api';

// Helper Functions
function changeFavicon(href) {
  favicon.href = href;
  document.title = showUnreadInTitle ? UNREAD_TITLE : DEFAULT_TITLE;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function getRealtimeRemaining(timer) {
  if (!timer || !timer.is_active) return 0;
  const now = Date.now();
  let elapsed = Math.floor((now - new Date(timer.start_time)) / 1000);
  if (timer.is_paused && timer.paused_at) {
    elapsed = Math.floor((new Date(timer.paused_at) - new Date(timer.start_time)) / 1000);
  }
  return Math.max(0, timer.duration - elapsed);
}

function getDisplayUsername(user) {
  return user.replace(/\+/g, "");
}

function scrollToMessage(messageId) {
  const element = document.querySelector(`[data-message-id="${messageId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    element.classList.add('animate-highlight');
    setTimeout(() => element.classList.remove('animate-highlight'), 3000);
  }
}

function isNearBottom() {
  if (!chatContainer.current) return true;
  const threshold = window.innerWidth <= 640 ? 400 : 300;
  const scrollBottom = chatContainer.current.scrollHeight - chatContainer.current.scrollTop - chatContainer.current.clientHeight;
  return scrollBottom <= threshold;
}

function updateScrollState() {
  if (!chatContainer.current || isAutoScrolling) return;
  const scrollTop = chatContainer.current.scrollTop;
  const scrollHeight = chatContainer.current.scrollHeight;
  const clientHeight = chatContainer.current.clientHeight;
  const scrollBottom = scrollHeight - scrollTop - clientHeight;
  const threshold = window.innerWidth <= 640 ? 300 : 200;
  userHasScrolledUp = scrollBottom > threshold;
  showScrollToBottom = userHasScrolledUp;
  if (!userHasScrolledUp) {
    unreadCount = 0;
    if (messages.length > 0) lastReadMessageId = messages[messages.length - 1].id;
  }
  lastScrollTop = scrollTop;
  renderChat();
}

function scrollToBottom() {
  if (!chatContainer.current) return;
  isAutoScrolling = true;
  unreadCount = 0;
  userHasScrolledUp = false;
  showScrollToBottom = false;
  if (messages.length > 0) lastReadMessageId = messages[messages.length - 1].id;
  chatContainer.current.scrollTop = chatContainer.current.scrollHeight;
  setTimeout(() => isAutoScrolling = false, 800);
}

function formatMessageTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function changeTheme(themeId) {
  document.body.className = themeId;
  localStorage.setItem('chatTheme', themeId);
  currentTheme = themeId;
  if (username) {
    fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateTheme', username, theme: themeId }),
    }).catch(error => console.error('Theme update failed:', error));
  }
  renderHeader();
}

function detectURL(text) {
  return text.match(/(https?:\/\/[^\s]+)/g);
}

// API Calls
async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/status`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Server status check failed');
    return data;
  } catch (error) {
    console.error('Status check error:', error);
    return { status: 'error', message: error.message };
  }
}

async function login(usernameInput, password) {
  try {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password }),
    });
    const result = await response.json();
    if (result.status === 'success') {
      username = result.username;
      localStorage.setItem('username', username);
      isMuted = result.isMuted || false;
      currentTheme = result.theme || 'theme-default';
      changeTheme(currentTheme);
      fetchData();
      renderApp();
    } else {
      alert(result.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Failed to connect to server. Please try again.');
  }
}

async function logout() {
  try {
    await fetch(`${API_BASE}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    username = null;
    localStorage.removeItem('username');
    document.title = DEFAULT_TITLE;
    showUnreadInTitle = false;
    changeFavicon(DEFAULT_FAVICON);
    renderApp();
  } catch (error) {
    console.error('Logout error:', error);
    alert('Logout failed. Please try again.');
  }
}

async function sendMessage(content, type, mediaId = null, gifUrl = null, stickerUrl = null, replyTo = null, link = null) {
  try {
    await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type, username, mediaId, gifUrl, stickerUrl, replyTo, link }),
    });
    fetchMessages();
  } catch (error) {
    console.error('Send message error:', error);
    alert('Failed to send message. Please try again.');
  }
}

async function fetchMessages() {
  try {
    const response = await fetch(`${API_BASE}/messages`);
    if (!response.ok) throw new Error('Failed to fetch messages');
    messages = await response.json();
    renderChat();
  } catch (error) {
    console.error('Fetch messages error:', error);
  }
}

async function fetchOnlineUsers() {
  try {
    const response = await fetch(`${API_BASE}/users?action=online`);
    if (!response.ok) throw new Error('Failed to fetch online users');
    onlineUsers = await response.json();
    renderHeader();
  } catch (error) {
    console.error('Fetch online users error:', error);
  }
}

async function fetchActiveTimer() {
  try {
    const response = await fetch(`${API_BASE}/timer`);
    if (!response.ok) throw new Error('Failed to fetch timer');
    activeTimer = await response.json();
    renderHeader();
  } catch (error) {
    console.error('Fetch timer error:', error);
  }
}

async function fetchNotifications() {
  try {
    const response = await fetch(`${API_BASE}/notifications`);
    if (!response.ok) throw new Error('Failed to fetch notifications');
    globalNotifications = await response.json();
    const timerExpired = globalNotifications.find(n => n.type === "timer_expired" && n.is_active);
    if (timerExpired) {
      expiredTimerName = timerExpired.data?.timerName || 'Timer';
      showTimerExpiredModal = true;
      renderModals();
    }
  } catch (error) {
    console.error('Fetch notifications error:', error);
  }
}

async function fetchData() {
  const status = await checkServerStatus();
  if (status.status === 'error') {
    console.error('Server offline:', status.message);
    return;
  }
  fetchMessages();
  fetchOnlineUsers();
  fetchActiveTimer();
  fetchNotifications();
}

// Recording Functions
let mediaRecorder;
function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    isRecording = true;
    renderInput();
  }).catch(error => {
    console.error('Recording error:', error);
    alert('Recording error: ' + error.message);
  });
}

function stopRecording() {
  mediaRecorder.stop();
  mediaRecorder.ondataavailable = async (e) => {
    const blob = e.data;
    const formData = new FormData();
    formData.append('file', blob, 'recording.wav');
    try {
      const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const { storageId } = await response.json();
      sendMessage('', 'audio', storageId);
    } catch (error) {
      console.error('Upload audio error:', error);
      alert('Failed to upload audio.');
    }
  };
  isRecording = false;
  renderInput();
}

// Camera Functions
async function startCamera() {
  try {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode } });
    videoRef.current.srcObject = cameraStream;
    showCamera = true;
    renderModals();
  } catch (error) {
    console.error('Camera error:', error);
    alert('Camera error: ' + error.message);
  }
}

function stopCamera() {
  if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
  cameraStream = null;
  showCamera = false;
  renderModals();
}

async function switchCamera() {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  stopCamera();
  startCamera();
}

async function capturePhoto() {
  const video = videoRef.current;
  const canvas = canvasRef.current;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  canvas.toBlob(async (blob) => {
    const formData = new FormData();
    formData.append('file', blob, 'photo.jpg');
    try {
      const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      const { storageId } = await response.json();
      sendMessage('', 'image', storageId);
      stopCamera();
    } catch (error) {
      console.error('Upload photo error:', error);
      alert('Failed to upload photo.');
    }
  }, 'image/jpeg', 0.8);
}

// Render Functions
function renderApp() {
  document.body.className = currentTheme;
  app.innerHTML = '';
  if (!username) {
    renderLogin();
  } else {
    renderChatApp();
  }
}

function renderLogin() {
  const container = document.createElement('div');
  container.className = 'login-container';
  container.innerHTML = `
    <form class="login-form" id="loginForm">
      <h1 class="login-title">Welcome to Nest</h1>
      <input type="text" id="usernameInput" placeholder="Enter your username" class="input-styled">
      <input type="password" id="passwordInput" placeholder="Enter password" class="input-styled">
      <button type="submit" class="button-primary w-full" id="loginButton">Join Nest</button>
    </form>
  `;
  app.appendChild(container);

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    if (password === "2025") {
      renderErrorPage();
      return;
    }
    const correctPassword = new Date().getHours().toString().padStart(2, '0') + new Date().getMinutes().toString().padStart(2, '0');
    if (password !== correctPassword) {
      alert("Incorrect password.");
      return;
    }
    await login(usernameInput, password);
  });
}

function renderErrorPage() {
  app.innerHTML = `
    <div class="error-container">
      <h1 class="error-title">Server ERROR</h1>
      <pre class="error-pre">
        Error 404: SERVER IS CRASHED PLEASE CHECK YOUR INTERNET
        // Simulated error stack
      </pre>
      <div class="animate-pulse text-[var(--success-text)]">
        Site will be solved under 5-10 minutes please wait
      </div>
    </div>
  `;
}

function renderChatApp() {
  app.innerHTML = `
    <div class="header" id="header"></div>
    <div class="chat-container" id="chatContainer"></div>
    <div class="input-container" id="inputContainer"></div>
    <div id="modals"></div>
  `;
  chatContainer.current = document.getElementById('chatContainer');
  fileInput.current = document.createElement('input');
  fileInput.current.type = 'file';
  fileInput.current.accept = 'image/*,video/*';
  fileInput.current.style.display = 'none';
  fileInput.current.addEventListener('change', handleFileUpload);
  document.body.appendChild(fileInput.current);

  videoRef.current = document.createElement('video');
  canvasRef.current = document.createElement('canvas');

  chatContainer.current.addEventListener('scroll', updateScrollState, { passive: true });
  renderHeader();
  renderChat();
  renderInput();
  renderModals();
}

function renderHeader() {
  const header = document.getElementById('header');
  header.innerHTML = `
    <div class="flex flex-col gap-2 max-w-6xl mx-auto">
      <div class="flex items-center justify-between">
        <h1 class="title">Nest</h1>
        <div class="flex items-center gap-2 relative">
          ${renderTimer()}
          <button id="userDropdownButton" class="bg-[var(--bg-tertiary)] hover:bg-[var(--bg-quaternary)] px-3 py-1.5 rounded-lg text-[var(--text-secondary)] text-xs flex items-center gap-2">
            <div class="profile-picture">${getDisplayUsername(username)[0].toUpperCase()}</div>
            <span>${getDisplayUsername(username)} ${isMuted ? '<span class="text-[var(--error-text)]">(Muted)</span>' : ''}</span>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="online-users" id="onlineUsers"></div>
      ${showUserDropdown ? renderUserDropdown() : ''}
    </div>
  `;
  const onlineUsersDiv = document.getElementById('onlineUsers');
  onlineUsersDiv.innerHTML = onlineUsers.map(user => `
    <div class="online-user ${getDisplayUsername(user.username) === getDisplayUsername(username) ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]' : ''}">
      <span class="online-dot-pulse"></span>
      <span>${getDisplayUsername(user.username)}</span>
    </div>
  `).join('');

  document.getElementById('userDropdownButton').addEventListener('click', () => {
    showUserDropdown = !showUserDropdown;
    renderHeader();
  });
}

function renderTimer() {
  if (!activeTimer) {
    return `<button id="startTimerButton" class="timer-container flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)]" title="Start Timer">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M8.5 5.5a.5.5 0 0 0-1 0v3.362l-1.429 2.38a.5.5 0 0 0 .858.515l1.5-2.5A.5.5 0 0 0 8.5 9V5.5z"/>
        <path d="M6.5 0a.5.5 0 0 0 0 1H7v1.07A7.001 7.001 0 0 0 8 16a7 7 0 0 0 5.29-11.584.531.531 0 0 0-.013-.016.5.5 0 0 0-.707.707l.003.004A6 6 0 1 1 7.5 3.07V2h.5a.5.5 0 0 0 0-1h-2z"/>
      </svg>
      Timer
    </button>`;
  }
  const timerClass = activeTimer.is_paused ? 'timer-paused' : 'timer-running';
  return `<div class="timer-container ${timerClass} flex items-center gap-1 px-2 py-1 rounded-lg">
    <div class="timer-name text-xs truncate max-w-16">${activeTimer.name}</div>
    <div class="timer-display text-sm">${formatTime(getRealtimeRemaining(activeTimer))}</div>
    ${activeTimer.is_paused ? '<button id="resumeTimer" class="timer-button" title="Resume"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></button>' : '<button id="pauseTimer" class="timer-button" title="Pause"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg></button>'}
    <button id="stopTimer" class="timer-button" title="Stop"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg></button>
  </div>`;
}

function renderUserDropdown() {
  return `<div class="absolute top-16 right-2 w-44 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl z-30 py-2">
    <button id="settingsButton" class="w-full px-3 py-2 text-left hover:bg-[var(--bg-tertiary)] text-sm">Settings</button>
    <select id="themeSelect" class="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] text-[var(--text-primary)] border-none">
      ${themes.map(theme => `<option value="${theme.id}" ${theme.id === currentTheme ? 'selected' : ''}>${theme.name}</option>`).join('')}
    </select>
    <button id="logoutButton" class="w-full px-3 py-2 text-left text-[var(--error-text)] hover:bg-[var(--bg-tertiary)] text-sm">Logout</button>
  </div>`;
}

function renderChat() {
  const chatDiv = document.getElementById('chatContainer');
  chatDiv.innerHTML = messages.map((message, index) => {
    const isOwnMessage = getDisplayUsername(message.username) === getDisplayUsername(username);
    return `
      <div data-message-id="${message.id}" class="message-item-wrapper ${isOwnMessage ? 'flex-row-reverse ml-2' : 'flex-row'}">
        <div class="profile-picture">${getDisplayUsername(message.username)[0].toUpperCase()}</div>
        <div class="message-container ${isOwnMessage ? '' : 'received'}">
          ${message.reply_to ? `<div class="reply-container"><span class="text-[var(--message-reply-user-text)]">${getDisplayUsername(messages.find(m => m.id === message.reply_to)?.username || '')}</span></div>` : ''}
          <div class="text-sm">${message.content || (message.sticker_url ? `<img src="${message.sticker_url}" class="w-16 h-16 object-cover" />` : '')}</div>
          <div class="text-xs text-[var(--text-muted)]">${formatMessageTime(message.created_at)}</div>
        </div>
      </div>
    `;
  }).join('');
  if (showScrollToBottom) {
    const button = document.createElement('button');
    button.className = 'scroll-to-bottom';
    button.innerHTML = '<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>';
    if (unreadCount > 0) button.innerHTML += `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>`;
    button.addEventListener('click', scrollToBottom);
    app.appendChild(button);
  }
  if (messages.length > lastMessageCount) {
    const newMessages = messages.slice(lastMessageCount);
    const otherMessages = newMessages.filter(m => m.username !== username);
    if (otherMessages.length > 0 && userHasScrolledUp) unreadCount += otherMessages.length;
    if (document.hidden) showUnreadInTitle = true;
    changeFavicon(showUnreadInTitle ? UNREAD_FAVICON : DEFAULT_FAVICON);
  }
  lastMessageCount = messages.length;
  if (!userHasScrolledUp) scrollToBottom();
}

function renderInput() {
  const inputDiv = document.getElementById('inputContainer');
  inputDiv.innerHTML = `
    <div class="px-2 h-6 pt-1" id="typingIndicators"></div>
    ${replyingTo ? `<div class="px-2 pt-1 pb-1">
      <div class="p-2 bg-[var(--message-reply-bg)] rounded-lg flex justify-between items-center shadow">
        <div class="text-xs">
          <span class="text-[var(--text-muted)]">Replying to </span>
          <span class="text-[var(--message-reply-user-text)] font-medium">${getDisplayUsername(replyingTo.username)}</span>
        </div>
        <button id="cancelReply" class="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1.5 rounded-full hover:bg-[var(--bg-quaternary)]">
          <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
      </div>
    </div>` : ''}
    <form id="messageForm" class="input-form">
      <div class="relative media-menu-container">
        <button type="button" id="mediaButton" class="p-2.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] button-interactive" title="Media">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        ${showMediaMenu ? `
          <div class="absolute bottom-full left-0 mb-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg shadow-xl py-2 min-w-[120px]">
            <button id="galleryButton" class="w-full px-4 py-2 text-left hover:bg-[var(--bg-tertiary)] text-sm flex items-center gap-2">
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"></path><path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"></path></svg>
              Gallery
            </button>
            <button id="cameraButton" class="w-full px-4 py-2 text-left hover:bg-[var(--bg-tertiary)] text-sm flex items-center gap-2">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              Camera
            </button>
          </div>
        ` : ''}
      </div>
      <button type="button" id="recordButton" class="p-2.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] button-interactive ${isRecording ? 'recording-button' : ''}" title="${isRecording ? 'Stop Recording' : 'Record Audio'}">
        ${isRecording ? '<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/></svg>' : '<svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z"/><path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/></svg>'}
      </button>
      <input type="text" id="messageInput" placeholder="${isMuted ? 'You are muted' : 'Type a message'}" class="input-field ${isMuted ? 'muted-input' : ''}" value="${newMessageText}">
      <button type="button" id="stickerButton" class="p-2.5 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] button-interactive" title="Stickers">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 6.627 5.373 12 12 12s12-5.373 12-12C24 5.373 18.627 0 12 0zm0 22c-5.523 0-10-4.477-10-10S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm5-6h-2.586l2.293-2.293a1 1 0 0 0-1.414-1.414L13 14.586l-2.293-2.293a1 1 0 0 0-1.414 1.414L11.586 16H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2z"/></svg>
      </button>
      <button type="submit" id="sendButton" class="send-button" title="Send Message">
        <svg width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576 6.636 10.07Zm6.787-8.201L1.591 6.602l4.339 2.76 7.494-7.493Z"/></svg>
      </button>
    </form>
    ${showStickerPicker ? renderStickerPicker() : ''}
  `;
  const typingDiv = document.getElementById('typingIndicators');
  typingDiv.innerHTML = onlineUsers.filter(u => u.username !== username && u.isTyping).map(u => `
    <div class="typing-indicator">
      ${getDisplayUsername(u.username)} is typing<span class="dot-one">.</span><span class="dot-two">.</span><span class="dot-three">.</span>
    </div>
  `).join('');

  document.getElementById('mediaButton').addEventListener('click', () => {
    showMediaMenu = !showMediaMenu;
    renderInput();
  });

  document.getElementById('recordButton').addEventListener('click', () => {
    if (isRecording) stopRecording();
    else startRecording();
  });

  const messageInput = document.getElementById('messageInput');
  messageInput.addEventListener('input', (e) => newMessageText = e.target.value);
  messageInput.addEventListener('paste', handlePaste);

  document.getElementById('stickerButton').addEventListener('click', () => {
    showStickerPicker = !showStickerPicker;
    renderInput();
  });

  const form = document.getElementById('messageForm');
  form.addEventListener('submit', handleSendMessage);

  document.getElementById('cancelReply')?.addEventListener('click', () => {
    replyingTo = null;
    renderInput();
  });

  document.getElementById('galleryButton')?.addEventListener('click', () => fileInput.current.click());
  document.getElementById('cameraButton')?.addEventListener('click', startCamera);
}

function renderStickerPicker() {
  return `
    <div class="sticker-picker">
      <div class="sticker-header">
        <span class="text-sm font-medium">Stickers</span>
        <button id="closeSticker" class="text-lg hover:opacity-70">✕</button>
      </div>
      <div class="sticker-categories flex gap-1 mb-3 overflow-x-auto">
        ${stickerCategories.map(cat => `
          <button class="sticker-category ${activeStickerCategory === cat.id ? 'active' : ''}" data-id="${cat.id}">${cat.icon}</button>
        `).join('')}
      </div>
      <div class="sticker-grid">
        ${getStickersByCategory(activeStickerCategory).map(sticker => `
          <button class="sticker-item" data-url="${sticker.url}">
            <img src="${sticker.url}" alt="${sticker.name}" class="w-8 h-8 object-cover">
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

function getStickersByCategory(category) {
  return stickers.filter(s => s.category === category);
}

async function handleStickerSelect(url) {
  try {
    await sendMessage('', 'sticker', null, null, url, replyingTo?.id);
    replyingTo = null;
    showStickerPicker = false;
    renderInput();
  } catch (error) {
    console.error('Sticker send error:', error);
    alert('Failed to send sticker.');
  }
}

function renderModals() {
  const modals = document.getElementById('modals');
  modals.innerHTML = '';
  if (previewMedia) {
    const div = document.createElement('div');
    div.className = 'media-preview';
    div.innerHTML = `
      <div class="relative max-w-4xl w-full">
        <button id="closePreview" class="close-button">
          <svg width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
        </button>
        ${previewMedia.type === 'video' ? `<video controls autoPlay class="media-content"><source src="${previewMedia.url}" type="video/mp4"></video>` : `<img src="${previewMedia.url}" alt="Preview" class="media-content">`}
      </div>
    `;
    modals.appendChild(div);
    document.getElementById('closePreview').addEventListener('click', () => {
      previewMedia = null;
      renderModals();
    });
  }
  if (showCamera) {
    const div = document.createElement('div');
    div.className = 'fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4';
    div.innerHTML = `
      <div class="bg-[var(--bg-secondary)] rounded-xl w-full max-w-md p-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-medium">Camera</h3>
          <button id="closeCamera" class="text-2xl">✕</button>
        </div>
        <video id="cameraVideo" autoPlay playsInline muted class="w-full h-64 bg-black rounded-lg mb-4"></video>
        <canvas id="cameraCanvas" class="hidden"></canvas>
        <div class="flex justify-center gap-4">
          <button id="switchCamera" class="p-3 bg-[var(--bg-tertiary)] rounded-full button-interactive" title="Switch Camera"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24"><path d="M17 2l4 4-4 4M21 6H8a4 4 0 0 0-4 4v3M7 22l-4-4 4-4M3 18h13a4 4 0 0 0 4-4v-3"/></svg></button>
          <button id="capturePhoto" class="p-4 bg-[var(--accent-primary)] rounded-full button-interactive" title="Take Photo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="24" height="24"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></button>
        </div>
      </div>
    `;
    modals.appendChild(div);
    videoRef.current = document.getElementById('cameraVideo');
    canvasRef.current = document.getElementById('cameraCanvas');
    startCamera();
    document.getElementById('closeCamera').addEventListener('click', stopCamera);
    document.getElementById('switchCamera').addEventListener('click', switchCamera);
    document.getElementById('capturePhoto').addEventListener('click', capturePhoto);
  }
  if (showTimerExpiredModal) {
    const div = document.createElement('div');
    div.className = 'fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-50 p-4 timer-expired-modal';
    div.innerHTML = `
      <div class="bg-[var(--bg-secondary)] rounded-xl w-full max-w-md p-6">
        <h3 class="timer-expired-title text-xl font-bold mb-4">Timer Expired: ${expiredTimerName}</h3>
        <p class="text-[var(--text-secondary)] mb-6">Your timer has finished!</p>
        <button id="closeTimerExpired" class="button-primary w-full">Close</button>
      </div>
    `;
    modals.appendChild(div);
    document.getElementById('closeTimerExpired').addEventListener('click', () => {
      showTimerExpiredModal = false;
      renderModals();
    });
  }
}

async function handlePaste(e) {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (!file || !username) return;
      const formData = new FormData();
      formData.append('file', file, 'pasted-image.jpg');
      try {
        const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
        const { storageId } = await response.json();
        sendMessage('', 'image', storageId);
      } catch (error) {
        console.error('Paste image error:', error);
        alert('Failed to upload pasted image.');
      }
    }
  }
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file || !username) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const response = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    const { storageId } = await response.json();
    sendMessage('', file.type.startsWith('image/') ? 'image' : 'video', storageId);
  } catch (error) {
    console.error('File upload error:', error);
    alert('Failed to upload file.');
  }
}

async function handleSendMessage(e) {
  e.preventDefault();
  if (!newMessageText.trim() && !replyingTo) return;
  if (isMuted && !newMessageText.startsWith("/")) {
    alert('You are muted and cannot send messages.');
    return;
  }
  try {
    const link = detectURL(newMessageText) ? newMessageText.match(/(https?:\/\/[^\s]+)/g)[0] : null;
    await sendMessage(newMessageText, 'text', null, null, null, replyingTo?.id, link);
    newMessageText = '';
    replyingTo = null;
    renderInput();
  } catch (error) {
    console.error('Send message error:', error);
    alert('Failed to send message.');
  }
}

// Event Listeners for Dynamic Elements
document.addEventListener('click', (e) => {
  if (e.target.closest('.sticker-item')) {
    const url = e.target.closest('.sticker-item').dataset.url;
    handleStickerSelect(url);
  }
  if (e.target.closest('#closeSticker')) {
    showStickerPicker = false;
    renderInput();
  }
  if (e.target.closest('#startTimerButton')) {
    // Implement timer start logic
    fetch(`${API_BASE}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Default Timer', duration: 300, username }),
    }).then(() => fetchActiveTimer());
  }
  if (e.target.closest('#pauseTimer')) {
    fetch(`${API_BASE}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause', username }),
    }).then(() => fetchActiveTimer());
  }
  if (e.target.closest('#resumeTimer')) {
    fetch(`${API_BASE}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume', username }),
    }).then(() => fetchActiveTimer());
  }
  if (e.target.closest('#stopTimer')) {
    fetch(`${API_BASE}/timer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', username }),
    }).then(() => fetchActiveTimer());
  }
  if (e.target.closest('#themeSelect')) {
    changeTheme(e.target.value);
  }
  if (e.target.closest('#logoutButton')) {
    logout();
  }
});

// Initial Render
renderApp();
if (username) {
  fetchData();
  setInterval(fetchData, 1000);
}
setInterval(() => currentTime = Date.now(), 1000);
