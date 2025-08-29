const { query } = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username, password } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });

  // Dummy password check (replace with proper auth)
  const correctPassword = new Date().getHours().toString().padStart(2, '0') + new Date().getMinutes().toString().padStart(2, '0');
  if (password !== correctPassword) return res.status(401).json({ error: 'Incorrect password' });

  // Check if user exists, create if not
  let user = await query('SELECT * FROM users WHERE username = $1', [username]);
  if (user.rows.length === 0) {
    user = await query('INSERT INTO users (username, is_online) VALUES ($1, true) RETURNING *', [username]);
  } else {
    await query('UPDATE users SET is_online = true WHERE username = $1', [username]);
  }
  res.json({ status: 'success', username: user.rows[0].username, isMuted: user.rows[0].is_muted });
};
