document.addEventListener('DOMContentLoaded', () => {
  const loginDiv = document.getElementById('login');
  const registerDiv = document.getElementById('register');
  const chatDiv = document.getElementById('chat');
  const messagesDiv = document.getElementById('messages');
  const typingIndicator = document.getElementById('typing-indicator');
  const onlineUsers = document.getElementById('online-users');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const messageForm = document.getElementById('message-form');

  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');
  const logoutBtn = document.getElementById('logout');

  const attachBtn = document.getElementById('attach-btn');
  const recordBtn = document.getElementById('record-btn');
  const fileInput = document.getElementById('file-input');
  const emojiBtn = document.getElementById('emoji-btn'); // Placeholder

  let pollInterval, statusInterval;
  let currentUser;
  let isTyping = false;
  let typingTimeout;
  let recorder, stream;

  // Show login by default
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
      alert('Registered! Now login.');
      switchToLogin.click();
    } else {
      alert('Error: ' + (await res.json()).error);
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
      const { token, username: user } = await res.json();
      localStorage.setItem('token', token);
      localStorage.setItem('username', user);
      showChat();
    } else {
      alert('Error: ' + (await res.json()).error);
    }
  });

  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('message-input').value.trim();
    if (!text) return;
    const token = localStorage.getItem('token');

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      document.getElementById('message-input').value = '';
      fetchMessages();
      sendStatus('update_active');
      if (isTyping) {
        clearTimeout(typingTimeout);
        sendStatus('stop_typing');
        isTyping = false;
      }
    } else {
      alert('Error sending message');
    }
  });

  document.getElementById('message-input').addEventListener('input', () => {
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

  attachBtn.addEventListener('click', () => {
    fileInput.click();
  });

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
        let chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          sendFile(blob, 'voice.webm');
          chunks = [];
          recorder = null;
          stream.getTracks().forEach((track) => track.stop());
          recordBtn.textContent = '🎤';
        };
        recorder.start();
        recordBtn.textContent = '⏹';
      } catch (err) {
        alert('Error accessing microphone');
      }
    } else {
      recorder.stop();
    }
  });

  async function sendFile(file, filename = file.name) {
    const token = localStorage.getItem('token');
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
      alert('Error sending file');
    }
  }

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    clearInterval(pollInterval);
    clearInterval(statusInterval);
    chatDiv.style.display = 'none';
    loginDiv.style.display = 'block';
    setTimeout(() => loginDiv.classList.add('active'), 10);
  });

  async function fetchMessages() {
    const res = await fetch('/api/messages');
    if (res.ok) {
      const messages = await res.json();
      messagesDiv.innerHTML = '';
      messages.forEach(msg => {
        const isSelf = msg.username === currentUser;
        const div = document.createElement('div');
        div.classList.add('message', isSelf ? 'right' : 'left');
        let contentHtml = '';
        if (msg.type === 'text') {
          contentHtml = `<span>${msg.content}</span>`;
        } else if (msg.type === 'image') {
          contentHtml = `<img src="${msg.content}" alt="image" style="max-width:100%; border-radius:8px;">`;
        } else if (msg.type === 'audio') {
          contentHtml = `<audio src="${msg.content}" controls></audio>`;
        } else {
          contentHtml = `<a href="${msg.content}" download>Download file</a>`;
        }
        if (!isSelf) {
          contentHtml = `<img class="avatar" src="https://ui-avatars.com/api/?name=${msg.username}&background=333&color=fff">
            <div class="content">${contentHtml}</div>`;
        } else {
          contentHtml = `<div class="content">${contentHtml}</div>`;
        }
        div.innerHTML = contentHtml + `<div class="timestamp">${new Date(msg.timestamp).toLocaleTimeString()}</div>`;
        messagesDiv.appendChild(div);
      });
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  async function fetchStatus() {
    const res = await fetch('/api/status');
    if (res.ok) {
      const { online, typing } = await res.json();
      onlineUsers.textContent = `Online: ${online.join(', ') || 'None'}`;
      typingIndicator.textContent = typing.length > 0 ? `${typing.join(', ')} is typing...` : '';
    }
  }

  async function sendStatus(action) {
    const token = localStorage.getItem('token');
    await fetch('/api/status', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action })
    });
  }

  function showChat() {
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

  // Check if already logged in
  if (localStorage.getItem('token')) {
    showChat();
  }
});
