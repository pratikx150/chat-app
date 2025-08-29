CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  is_online BOOLEAN DEFAULT false,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_muted BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  theme VARCHAR(50) DEFAULT 'theme-default',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  content TEXT,
  type VARCHAR(50) NOT NULL,
  username VARCHAR(255) NOT NULL,
  media_id VARCHAR(255),
  gif_url TEXT,
  sticker_url TEXT,
  reply_to INTEGER,
  link TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_by TEXT[] DEFAULT ARRAY[]::TEXT[],
  FOREIGN KEY (username) REFERENCES users(username),
  FOREIGN KEY (reply_to) REFERENCES messages(id)
);

CREATE TABLE timers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  duration INTEGER NOT NULL,
  start_time TIMESTAMP,
  paused_at TIMESTAMP,
  is_paused BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT false,
  username VARCHAR(255) NOT NULL,
  FOREIGN KEY (username) REFERENCES users(username)
);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  data JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
