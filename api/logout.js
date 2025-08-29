const { query } = require('./db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { username } = req.body;
  await query('UPDATE users SET is_online = false WHERE username = $1', [username]);
  res.json({ status: 'success' });
};
