const jwt = require('jsonwebtoken');
const { Pool } = require('@neondatabase/serverless');
const formidable = require('formidable');
const fs = require('fs/promises');

export default async function handler(req, res) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let client;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader && req.method !== 'GET') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let decoded;
    if (req.method !== 'GET') {
      const token = authHeader.split(' ')[1];
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    client = await pool.connect();

    if (req.method === 'GET') {
      const result = await client.query('SELECT * FROM messages ORDER BY timestamp ASC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const form = new formidable.IncomingForm();
      const [fields, files] = await form.parse(req);
      let type = 'text';
      let content;

      if (fields.text) {
        content = fields.text[0];
        type = 'text';
      } else if (files.file) {
        const file = files.file[0];
        const mimetype = file.mimetype || 'application/octet-stream';
        const buffer = await fs.readFile(file.filepath);
        content = `data:${mimetype};base64,${buffer.toString('base64')}`;
        if (mimetype.startsWith('image/')) type = 'image';
        else if (mimetype.startsWith('audio/')) type = 'audio';
        else type = 'file';
        await fs.unlink(file.filepath);
      } else {
        return res.status(400).json({ error: 'Missing text or file' });
      }

      await client.query(
        'INSERT INTO messages (username, type, content, timestamp) VALUES ($1, $2, $3, $4)',
        [decoded.username, type, content, new Date().toISOString()]
      );
      const result = await client.query(
        'SELECT * FROM messages WHERE id = currval(\'messages_id_seq\')'
      );
      res.status(200).json({ message: result.rows[0] });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('Messages error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (client) client.release();
    await pool.end();
  }
}
