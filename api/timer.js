const { query } = require('./db');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { action, name, duration, username } = req.body;
    if (action === 'create') {
      await query('INSERT INTO timers (name, duration, start_time, is_active, username) VALUES ($1, $2, CURRENT_TIMESTAMP, true, $3)', [name, duration, username]);
    } else if (action === 'stop') {
      await query('UPDATE timers SET is_active = false WHERE username = $1', [username]);
    } // Add pause/resume similarly
    res.json({ status: 'success' });
  } else if (req.method === 'GET') {
    const timer = await query('SELECT * FROM timers WHERE is_active = true LIMIT 1');
    res.json(timer.rows[0] || null);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
