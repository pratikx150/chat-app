const { put } = require('@vercel/blob');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Assume multipart form with 'file'
  const { filename, contentType, buffer } = req.body; // Use multer or similar for real file handling
  const blob = await put(filename, buffer, { access: 'public', contentType });
  res.json({ url: blob.url, storageId: blob.pathname });
};
