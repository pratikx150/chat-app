document.addEventListener('DOMContentLoaded', () => {
  const loginDiv = document.getElementById('login');
  const registerDiv = document.getElementById('register');
  const chatDiv = document.getElementById('chat');
  const messagesDiv = document.getElementById('messages');
  const onlineUsers = document.getElementById('online-users');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const messageInput = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');

  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');
  const logoutBtn = document.getElementById('logout');

  const attachBtn = document.getElementById('attach-btn');
  const recordBtn = document.getElementById('record-btn');
  const fileInput = document.getElementById('file-input');
  const emojiBtn = document.getElementById('emoji-btn');

  let pollInterval, statusInterval;
  let currentUser;
  let isTyping = false;
  let typingTimeout;
  let recorder, stream;

  loginDiv.classList.add('active');

  switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginDiv.style.display = 'none';
    registerDiv.style.display = 'block';
    setTimeout(() => registerDiv.classList.add('active'), 10);
  });

  switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerDiv.style.display = 'none';
    loginDiv.style.display = 'block';
    setTimeout(() => loginDiv.classList.add('active'), 10);
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      alert('Registered! Please login.');
      switchToLogin.click();
    } else {
      const error = await res.json();
      alert(`Registration failed: ${error.error || 'Unknown error'}`);
      console.error('Registration error:', error);
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      currentUser = data.username;
      showChat();
    } else {
      const error = await res.json();
      alert(`Login failed: ${error.error || 'Unknown error'}`);
      console.error('Login error:', error);
    }
  });

  sendBtn.addEventListener('click', async () => {
    const text = messageInput.value.trim();
    if (!text) return;
    await sendMessage(text);
    messageInput.value = '';
  });

  messageInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = messageInput.value.trim();
      if (text) await sendMessage(text);
      messageInput.value = '';
    }
  });

  messageInput.addEventListener('input', () => {
    if (!isTyping) {
      isTyping = true;
      sendStatus('start_typing');
    }
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      sendStatus('stop_typing');
    }, 5000);
  });

  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) {
      sendFile(file);
      fileInput.value = '';
    }
  });

  recordBtn.addEventListener('click', async () => {
    if (!recorder) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          sendFile(blob, 'voice.webm');
          chunks.length = 0;
          recorder = null;
          stream.getTracks().forEach(track => track.stop());
          recordBtn.textContent = '🎤';
        };
        recorder.start();
        recordBtn.textContent = '⏹';
      } catch (err) {
        alert('Microphone access denied');
        console.error('Recording error:', err);
      }
    } else {
      recorder.stop();
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    clearInterval(pollInterval);
    clearInterval(statusInterval);
    chatDiv.style.display = 'none';
    loginDiv.style.display = 'block';
    setTimeout(() => loginDiv.classList.add('active'), 10);
  });

  async function sendMessage(text) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login again');

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      fetchMessages();
      sendStatus('update_active');
      if (isTyping) {
        clearTimeout(typingTimeout);
        sendStatus('stop_typing');
        isTyping = false;
      }
    } else {
      const error = await res.json();
      alert(`Message failed: ${error.error || 'Unknown error'}`);
      console.error('Message error:', error);
    }
  }

  async function sendFile(file, filename = file.name) {
    const token = localStorage.getItem('token');
    if (!token) return alert('Please login again');

    const formData = new FormData();
    formData.append('file', file, filename);

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    if (res.ok) {
      fetchMessages();
      sendStatus('update_active');
    } else {
      const error = await res.json();
      alert(`File upload failed: ${error.error || 'Unknown error'}`);
      console.error('File upload error:', error);
    }
  }

  async function fetchMessages() {
    const res = await fetch('/api/messages');
    if (res.ok) {
      const messages = await res.json();
      messagesDiv.innerHTML = '';
      messages.forEach(msg => {
        const isSelf = msg.username === currentUser;
        const div = document.createElement('div');
        div.classList.add('message', isSelf ? 'self' : '');
        let contentHtml = '';
        if (msg.type === 'text') {
          contentHtml = msg.content;
        } else if (msg.type === 'image') {
          contentHtml = `<img src="${msg.content}" alt="image" style="max-width:100%;border-radius:8px;">`;
        } else if (msg.type === 'audio') {
          contentHtml = `<audio src="${msg.content}" controls></audio>`;
        } else {
          contentHtml = `<a href="${msg.content}" download>Download</a>`;
        }
        div.innerHTML = contentHtml + `<div class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>`;
        messagesDiv.appendChild(div);
      });
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    } else {
      console.error('Fetch messages error:', await res.json());
    }
  }

  async function fetchStatus() {
    const res = await fetch('/api/status');
    if (res.ok) {
      const { online, typing } = await res.json();
      onlineUsers.textContent = `Online: ${online.join(', ') || 'None'}`;
      // Add typing indicator if desired
    }
  }

  async function sendStatus(action) {
    const token = localStorage.getItem('token');
    if (!token) return;
    const res = await fetch('/api/status', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action })
    });
    if (!res.ok) console.error('Status update error:', await res.json());
  }

  function showChat() {
    if (!localStorage.getItem('username')) {
      alert('Session expired. Please login again.');
      localStorage.removeItem('token');
      loginDiv.style.display = 'block';
      setTimeout(() => loginDiv.classList.add('active'), 10);
      return;
    }
    currentUser = localStorage.getItem('username');
    loginDiv.style.display = 'none';
    registerDiv.style.display = 'none';
    chatDiv.style.display = 'flex';
    fetchMessages();
    fetchStatus();
    sendStatus('update_active');
    pollInterval = setInterval(fetchMessages, 5000);
    statusInterval = setInterval(() => {
      fetchStatus();
      sendStatus('update_active');
    }, 10000);
  }

  if (localStorage.getItem('token')) {
    showChat();
  }
});
