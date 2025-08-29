const { query } = require('./db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const messages = await query('SELECT * FROM messages ORDER BY created_at ASC');
    res.json(messages.rows);
  } else if (req.method === 'POST') {
    const { content, type, username, mediaId, gifUrl, stickerUrl, replyTo, link } = req.body;
    await query('INSERT INTO messages (content, type, username, media_id, gif_url, sticker_url, reply_to, link) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [content, type, username, mediaId, gifUrl, stickerUrl, replyTo, link]);
    res.json({ status: 'success' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
