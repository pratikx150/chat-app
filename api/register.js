const crypto = require('crypto');
const { Pool } = require('@neondatabase/serverless');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  const password_hash = `${salt}:${hash}`;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    client = await pool.connect();
    await client.query('INSERT INTO users (username, password_hash) VALUES ($1, $2)', [username, password_hash]);
    res.status(200).json({ message: 'Registered successfully' });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Username already taken' });
    } else {
      res.status(500).json({ error: err.message });
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
