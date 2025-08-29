const { query } = require('./db');

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const messages = await query('SELECT * FROM messages ORDER BY created_at ASC');
      return res.status(200).json(messages.rows);
    } else if (req.method === 'POST') {
      const { content, type, username, mediaId, gifUrl, stickerUrl, replyTo, link } = req.body;
      if (!type || !username) {
        return res.status(400).json({ error: 'Missing required fields: type and username' });
      }
      await query(
        'INSERT INTO messages (content, type, username, media_id, gif_url, sticker_url, reply_to, link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [content || '', type, username, mediaId, gifUrl, stickerUrl, replyTo, link]
      );
      return res.status(201).json({ status: 'success' });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Messages error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
