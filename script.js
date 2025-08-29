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

  let ws, currentUser, pollInterval;

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
    if (text) await sendMessage(text);
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
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing', username: currentUser }));
    }
  });

  attachBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (file) {
      await sendFile(file);
      fileInput.value = '';
    }
  });

  recordBtn.addEventListener('click', async () => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      alert('WebSocket not connected. Using fallback.');
      const file = await recordAudio();
      if (file) await sendFile(file, 'voice.webm');
      return;
    }

    if (!recorder) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = async () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          await sendFile(blob, 'voice.webm');
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
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'logout', username: currentUser }));
      ws.close();
    }
    clearInterval(pollInterval);
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    chatDiv.style.display = 'none';
    loginDiv.style.display = 'block';
    setTimeout(() => loginDiv.classList.add('active'), 10);
  });

  async function sendMessage(text) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'message', username: currentUser, content: text, timestamp: new Date().toISOString() }));
    } else {
      await fallbackSendMessage(text);
    }
  }

  async function sendFile(file, filename = file.name) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const formData = new FormData();
      formData.append('file', file, filename);

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        ws.send(JSON.stringify({ type: 'message', ...data.message, username: currentUser }));
      } else {
        const error = await res.json();
        alert(`File upload failed: ${error.error || 'Unknown error'}`);
        console.error('File upload error:', error);
      }
    } else {
      await fallbackSendFile(file, filename);
    }
  }

  async function recordAudio() {
    return new Promise((resolve) => {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          const recorder = new MediaRecorder(stream);
          const chunks = [];
          recorder.ondataavailable = (e) => chunks.push(e.data);
          recorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
            resolve(new Blob(chunks, { type: 'audio/webm' }));
          };
          recorder.start();
          setTimeout(() => recorder.stop(), 5000); // 5-second recording
        })
        .catch(err => {
          console.error('Recording error:', err);
          resolve(null);
        });
    });
  }

  async function fallbackSendMessage(text) {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ text })
    });

    if (res.ok) {
      const data = await res.json();
      displayMessage(data.message);
    } else {
      const error = await res.json();
      alert(`Message failed: ${error.error || 'Unknown error'}`);
      console.error('Message error:', error);
    }
  }

  async function fallbackSendFile(file, filename) {
    const formData = new FormData();
    formData.append('file', file, filename);

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      displayMessage(data.message);
    } else {
      const error = await res.json();
      alert(`File upload failed: ${error.error || 'Unknown error'}`);
      console.error('File upload error:', error);
    }
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

    const token = localStorage.getItem('token');
    ws = new WebSocket(`wss://your-vercel-url/api/ws?token=${encodeURIComponent(token)}`);
    ws.onopen = () => {
      console.log('WebSocket connected');
      ws.send(JSON.stringify({ type: 'join', username: currentUser }));
      fetchInitialMessages();
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'message') {
        displayMessage(data);
      } else if (data.type === 'online') {
        onlineUsers.textContent = `Online: ${data.users.join(', ') || 'None'}`;
      } else if (data.type === 'typing') {
        // Add typing indicator if desired
      }
    };
    ws.onclose = () => {
      console.log('WebSocket disconnected. Switching to polling.');
      startPolling();
    };
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      alert('WebSocket failed. Using polling as fallback.');
      startPolling();
    };
  }

  function fetchInitialMessages() {
    fetch('/api/messages')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(messages => messages.forEach(displayMessage))
      .catch(err => console.error('Initial messages fetch error:', err));
  }

  function displayMessage(msg) {
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
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  function startPolling() {
    clearInterval(pollInterval);
    pollInterval = setInterval(() => {
      fetch('/api/messages')
        .then(res => res.ok ? res.json() : Promise.reject(res))
        .then(messages => {
          const lastMessageId = messages[messages.length - 1]?.id || 0;
          messages.forEach(msg => {
            if (!messagesDiv.querySelector(`[data-id="${msg.id}"]`)) {
              displayMessage(msg);
            }
          });
        })
        .catch(err => console.error('Polling error:', err));
    }, 5000);
  }

  if (localStorage.getItem('token')) {
    showChat();
  }
});
