const { query } = require('./db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { action, username } = req.query;
    if (action === 'online') {
      const users = await query('SELECT username FROM users WHERE is_online = true');
      res.json(users.rows);
    } else if (action === 'self') {
      const user = await query('SELECT * FROM users WHERE username = $1', [username]);
      res.json(user.rows[0]);
    }
  } else if (req.method === 'POST') {
    const { action, username, theme } = req.body;
    if (action === 'updateTheme') {
      await query('UPDATE users SET theme = $1 WHERE username = $2', [theme, username]);
      res.json({ status: 'success' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
