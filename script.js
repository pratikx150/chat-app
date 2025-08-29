document.addEventListener('DOMContentLoaded', () => {
  const loginDiv = document.getElementById('login');
  const registerDiv = document.getElementById('register');
  const chatDiv = document.getElementById('chat');
  const messagesDiv = document.getElementById('messages');
  const onlineUsers = document.getElementById('online-users');
  const heartShower = document.getElementById('heart-shower');

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

  loginDiv.classList.add('active', 'opacity-100');

  switchToRegister.addEventListener('click', (e) => {
    e.preventDefault();
    loginDiv.classList.remove('opacity-100');
    setTimeout(() => {
      loginDiv.style.display = 'none';
      registerDiv.style.display = 'block';
      registerDiv.classList.add('opacity-100');
    }, 500);
  });

  switchToLogin.addEventListener('click', (e) => {
    e.preventDefault();
    registerDiv.classList.remove('opacity-100');
    setTimeout(() => {
      registerDiv.style.display = 'none';
      loginDiv.style.display = 'block';
      loginDiv.classList.add('opacity-100');
    }, 500);
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
      const data = await res.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);
      showChat();
    } else {
      const errorData = await res.json();
      alert(`Login failed: ${errorData.error || 'Unknown error'}`);
      console.error('Login error:', errorData);
    }
  });

  sendBtn.addEventListener('click', async () => {
    const text = messageInput.value.trim();
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
      messageInput.value = '';
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
          recordBtn.classList.remove('recording-button');
        };
        recorder.start();
        recordBtn.classList.add('recording-button');
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
    chatDiv.classList.add('hidden');
    loginDiv.classList.remove('hidden');
    setTimeout(() => loginDiv.classList.add('opacity-100'), 10);
  });

  async function fetchMessages() {
    const res = await fetch('/api/messages');
    if (res.ok) {
      const messages = await res.json();
      messagesDiv.innerHTML = '';
      messages.forEach(msg => {
        const isSelf = msg.username === currentUser;
        const div = document.createElement('div');
        div.classList.add('message-container', 'message-animate-in');
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', isSelf ? 'message-sent' : 'message-received', 'p-3', 'rounded-xl', 'max-w-[60%]');
        let contentHtml = '';
        if (msg.type === 'text') {
          contentHtml = msg.content;
        } else if (msg.type === 'image') {
          contentHtml = `<img src="${msg.content}" alt="image" class="rounded-lg max-w-full">`;
        } else if (msg.type === 'audio') {
          contentHtml = `<audio src="${msg.content}" controls class="w-full"></audio>`;
        } else {
          contentHtml = `<a href="${msg.content}" download class="link-text hover:link-hover-text">Download file</a>`;
        }
        messageDiv.innerHTML = contentHtml + `<div class="text-xs text-muted mt-1">${new Date(msg.timestamp).toLocaleTimeString()}</div>`;
        div.appendChild(messageDiv);
        messagesDiv.appendChild(div);
      });
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      showHeart();
    }
  }

  async function fetchStatus() {
    const res = await fetch('/api/status');
    if (res.ok) {
      const { online, typing } = await res.json();
      onlineUsers.textContent = `Online: ${online.join(', ') || 'None'}`;
      // Add typing indicator if needed
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
    if (!currentUser) {
      alert('User not found. Please login again.');
      return;
    }
    loginDiv.classList.remove('opacity-100');
    registerDiv.classList.remove('opacity-100');
    setTimeout(() => {
      loginDiv.classList.add('hidden');
      registerDiv.classList.add('hidden');
      chatDiv.classList.remove('hidden');
    }, 500);
    fetchMessages();
    fetchStatus();
    sendStatus('update_active');
    pollInterval = setInterval(fetchMessages, 5000);
    statusInterval = setInterval(() => {
      fetchStatus();
      sendStatus('update_active');
    }, 10000);
  }

  function showHeart() {
    const heart = document.createElement('div');
    heart.classList.add('heart-particle');
    heart.innerHTML = '❤️';
    heart.style.setProperty('--tx', `${Math.random() * 100 - 50}vw`);
    heart.style.setProperty('--rot', `${Math.random() * 360}deg`);
    heartShower.appendChild(heart);
    setTimeout(() => heart.remove(), 2000);
  }

  if (localStorage.getItem('token')) {
    showChat();
  }
});
