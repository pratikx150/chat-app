const jwt = require('jsonwebtoken');
const { Pool } = require('@neondatabase/serverless');

export default async function handler(req, res) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const client = await pool.connect();

    if (req.method === 'GET') {
      const result = await client.query('SELECT * FROM messages ORDER BY timestamp ASC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.split(' ')[1];
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Missing text' });
      }

      await client.query('INSERT INTO messages (username, text) VALUES ($1, $2)', [decoded.username, text]);
      res.status(200).json({ message: 'Sent' });
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
