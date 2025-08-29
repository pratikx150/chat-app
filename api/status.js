const { query } = require('./db');

module.exports = async (req, res) => {
  try {
    // Test DB connection
    await query('SELECT NOW()');
    res.status(200).json({ status: 'ok', message: 'Server and database are running' });
  } catch (error) {
    console.error('Status check failed:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
};
