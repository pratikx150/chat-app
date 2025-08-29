const WebSocket = require('ws');
const { Pool } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const wss = new WebSocket.Server({ noServer: true });
const clients = new Map();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  let username;

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      username = decoded.username;
    } catch (err) {
      ws.close(1008, 'Invalid token');
      return;
    }
  } else {
    ws.close(1008, 'No token provided');
    return;
  }

  clients.set(ws, username);
  broadcast({ type: 'online', users: Array.from(clients.values()) });

  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    if (data.type === 'join') {
      clients.set(ws, data.username);
      broadcast({ type: 'online', users: Array.from(clients.values()) });
    } else if (data.type === 'message') {
      let client;
      try {
        client = await pool.connect();
        await client.query(
          'INSERT INTO messages (username, type, content, timestamp) VALUES ($1, $2, $3, $4)',
          [data.username, data.type || 'text', data.content, data.timestamp || new Date().toISOString()]
        );
        const result = await client.query(
          'SELECT * FROM messages WHERE id = currval(\'messages_id_seq\')'
        );
        broadcast({ ...result.rows[0], type: 'message' });
      } catch (err) {
        console.error('Message save error:', err);
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      } finally {
        if (client) client.release();
      }
    } else if (data.type === 'typing') {
      broadcast({ type: 'typing', username: data.username });
    } else if (data.type === 'logout') {
      clients.delete(ws);
      broadcast({ type: 'online', users: Array.from(clients.values()) });
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    broadcast({ type: 'online', users: Array.from(clients.values()) });
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });
});

function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

module.exports = (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.writeHead(405).end('Method not allowed');
    return;
  }

  if (!res.socket.server.wss) {
    res.socket.server.wss = wss;
  }

  res.socket.server.wss.handleUpgrade(req, req.socket, Buffer.alloc(0), (ws) => {
    wss.emit('connection', ws, req);
  });

  res.writeHead(200).end();
};
