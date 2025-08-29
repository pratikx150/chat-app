document.addEventListener('DOMContentLoaded', () => {
  const loginDiv = document.getElementById('login');
  const registerDiv = document.getElementById('register');
  const chatDiv = document.getElementById('chat');
  const messagesDiv = document.getElementById('messages');

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const messageForm = document.getElementById('message-form');

  const switchToRegister = document.getElementById('switch-to-register');
  const switchToLogin = document.getElementById('switch-to-login');
  const logoutBtn = document.getElementById('logout');

  let pollInterval;

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
      const { token } = await res.json();
      localStorage.setItem('token', token);
      showChat();
    } else {
      alert('Error: ' + (await res.json()).error);
    }
  });

  messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = document.getElementById('message-input').value;
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
      fetchMessages(); // Refresh immediately
    } else {
      alert('Error sending message');
    }
  });

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token');
    clearInterval(pollInterval);
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
        const div = document.createElement('div');
        div.classList.add('message');
        div.innerHTML = `<strong>${msg.username}:</strong> ${msg.text} <small>(${new Date(msg.timestamp).toLocaleString()})</small>`;
        messagesDiv.appendChild(div);
      });
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  }

  function showChat() {
    loginDiv.style.display = 'none';
    registerDiv.style.display = 'none';
    chatDiv.style.display = 'block';
    fetchMessages();
    pollInterval = setInterval(fetchMessages, 5000);
  }

  // Check if already logged in
  if (localStorage.getItem('token')) {
    showChat();
  }
});
