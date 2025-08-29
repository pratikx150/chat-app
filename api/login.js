const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Pool } = require('@neondatabase/serverless');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    const result = await client.query('SELECT password_hash FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username' });
    }

    const [salt, storedHash] = result.rows[0].password_hash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');

    if (hash !== storedHash) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({ token, username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
