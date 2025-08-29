const jwt = require('jsonwebtoken');
const { Pool } = require('@neondatabase/serverless');
const formidable = require('formidable');
const fs = require('fs/promises');

export default async function handler(req, res) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    const client = await pool.connect();

    if (req.method === 'GET') {
      const result = await client.query('SELECT * FROM messages ORDER BY timestamp ASC');
      res.status(200).json(result.rows);
    } else if (req.method === 'POST') {
      const form = formidable({});
      form.parse(req, async (err, fields, files) => {
        if (err) {
          return res.status(500).json({ error: 'Error parsing form' });
        }

        let type = 'text';
        let content;

        if (fields.text) {
          content = fields.text[0];
        } else if (files.file) {
          const file = files.file[0];
          const mimetype = file.mimetype;
          const base64 = (await fs.readFile(file.filepath)).toString('base64');
          content = `data:${mimetype};base64,${base64}`;
          if (mimetype.startsWith('image/')) {
            type = 'image';
          } else if (mimetype.startsWith('audio/')) {
            type = 'audio';
          } else {
            type = 'file';
          }
          await fs.unlink(file.filepath); // Clean up temp file
        } else {
          return res.status(400).json({ error: 'Missing text or file' });
        }

        await client.query('INSERT INTO messages (username, type, content) VALUES ($1, $2, $3)', [decoded.username, type, content]);
        res.status(200).json({ message: 'Sent' });
      });
      return; // Parse is async, so return here
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
