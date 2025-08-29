const jwt = require('jsonwebtoken');
const { Pool } = require('@neondatabase/serverless');

export default async function handler(req, res) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const client = await pool.connect();

    if (req.method === 'GET') {
      const onlineResult = await client.query("SELECT username FROM users WHERE last_active > NOW() - INTERVAL '5 minutes'");
      const typingResult = await client.query('SELECT username FROM typing_users');
      res.status(200).json({
        online: onlineResult.rows.map(r => r.username),
        typing: typingResult.rows.map(r => r.username)
      });
    } else if (req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { action } = req.body;
      const username = decoded.username;

      if (action === 'update_active') {
        await client.query('UPDATE users SET last_active = NOW() WHERE username = $1', [username]);
      } else if (action === 'start_typing') {
        await client.query('INSERT INTO typing_users (username) VALUES ($1) ON CONFLICT (username) DO UPDATE SET timestamp = NOW()', [username]);
      } else if (action === 'stop_typing') {
        await client.query('DELETE FROM typing_users WHERE username = $1', [username]);
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }
      res.status(200).json({ ok: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

    client.release();
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    await pool.end();
  }
}
