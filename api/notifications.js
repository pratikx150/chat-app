const { query } = require('./db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const notifications = await query('SELECT * FROM notifications WHERE is_active = true');
    res.json(notifications.rows);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
