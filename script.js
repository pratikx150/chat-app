console.log('script.js loaded successfully'); // Debug log to confirm file loading

const DEFAULT_FAVICON = "/public/favicon.svg";
const API_BASE = '/api';

let username = localStorage.getItem('username');
let messages = [];
let newMessageText = '';
let currentTime = Date.now();

const app = document.getElementById('app');
const loginContainer = document.getElementById('login-container');
const chatApp = document.getElementById('chat-app');
const chatContainer = document.getElementById('chatContainer');
const debugDiv = document.getElementById('debug');

// API Calls
async function login(usernameInput, password) {
  try {
    console.log('Attempting login for:', usernameInput); // Debug log
    const correctPassword = new Date().getHours().toString().padStart(2, '0') + new Date().getMinutes().toString().padStart(2, '0');
    if (password !== correctPassword) throw new Error('Incorrect password');
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameInput, password })
    });
    const result = await response.json();
    if (result.status === 'success') {
      username = result.username;
      localStorage.setItem('username', username);
      renderApp();
      fetchData();
      setInterval(fetchData, 1000);
    } else {
      throw new Error(result.error || 'Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Login failed: ' + error.message);
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

async function sendMessage(content) {
  try {
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, type: 'text', username })
    });
    if (!response.ok) throw new Error('Failed to send message');
    fetchMessages();
  } catch (error) {
    console.error('Send message error:', error);
    alert('Failed to send message: ' + error.message);
  }
}

async function fetchData() {
  try {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) throw new Error('Server status check failed');
    await fetchMessages();
  } catch (error) {
    console.error('Fetch data error:', error);
  }
}

// Render Functions
function renderApp() {
  try {
    console.log('Rendering app, username:', username); // Debug log
    if (!username) {
      loginContainer.classList.remove('hidden');
      chatApp.classList.add('hidden');
    } else {
      loginContainer.classList.add('hidden');
      chatApp.classList.remove('hidden');
      renderInput();
      renderChat();
    }
    debugDiv.classList.add('hidden');
  } catch (error) {
    console.error('Render app error:', error);
    debugDiv.classList.remove('hidden');
    debugDiv.textContent = 'Error rendering app: ' + error.message;
  }
}

function renderChat() {
  try {
    if (!chatContainer) return;
    chatContainer.innerHTML = messages.map(message => `
      <div class="message-item-wrapper flex ${message.username === username ? 'flex-row-reverse' : 'flex-row'} mb-2">
        <div class="message-container ${message.username === username ? 'bg-[var(--accent-primary)] text-[var(--text-on-accent)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'} p-3 rounded-lg">
          <div class="text-sm">${message.content}</div>
          <div class="text-xs text-[var(--text-secondary)]">${new Date(message.created_at).toLocaleTimeString()}</div>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Render chat error:', error);
  }
}

function renderInput() {
  try {
    const inputContainer = document.getElementById('inputContainer');
    if (!inputContainer) return;
    inputContainer.innerHTML = `
      <form id="messageForm" class="flex items-center gap-2">
        <input type="text" id="messageInput" placeholder="Type a message" class="input-styled flex-1" value="${newMessageText}">
        <button type="submit" class="button-primary">Send</button>
      </form>
    `;
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
      messageInput.addEventListener('input', (e) => newMessageText = e.target.value);
    }
    const messageForm = document.getElementById('messageForm');
    if (messageForm) {
      messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!newMessageText.trim()) return;
        await sendMessage(newMessageText);
        newMessageText = '';
        renderInput();
      });
    }
  } catch (error) {
    console.error('Render input error:', error);
  }
}

// Initial Render
try {
  console.log('Starting initial render'); // Debug log
  debugDiv.classList.add('hidden');
  renderApp();
  if (username) {
    fetchData();
    setInterval(fetchData, 1000);
  }
  setInterval(() => currentTime = Date.now(), 1000);
} catch (error) {
  console.error('Initial render error:', error);
  debugDiv.classList.remove('hidden');
  debugDiv.textContent = 'Error initializing app: ' + error.message;
}
