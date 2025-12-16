const { Pool } = require('pg');
require('dotenv').config();

// Support both individual DB params and DATABASE_URL (for Railway)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false
        }
      }
    : {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
      }
);

const initDB = async () => {
  const client = await pool.connect();
  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add role column if it doesn't exist (for existing databases)
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user'
    `);

    // Add cursor_color column for collaborative editing
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS cursor_color VARCHAR(7)
    `);

    // Create pages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        parent_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
        display_order INTEGER DEFAULT 0,
        is_expanded BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);

    // Add deleted_at column if it doesn't exist (for existing databases)
    await client.query(`
      ALTER TABLE pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP
    `);

    // Create images table
    await client.query(`
      CREATE TABLE IF NOT EXISTS images (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        data BYTEA NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create page history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_history (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        previous_content TEXT,
        diff TEXT,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create page comments table (for Talk pages)
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_comments (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create page views table (for analytics)
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_views (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id),
        viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index for faster analytics queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_page_views_page_id ON page_views(page_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_page_views_user_id ON page_views(user_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_page_views_viewed_at ON page_views(viewed_at)
    `);

    // Create page_drafts table for collaborative editing
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_drafts (
        id SERIAL PRIMARY KEY,
        page_id INTEGER UNIQUE REFERENCES pages(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        title VARCHAR(255) NOT NULL,
        last_modified_by INTEGER REFERENCES users(id),
        last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create editing_sessions table for tracking active editors
    await client.query(`
      CREATE TABLE IF NOT EXISTS editing_sessions (
        id SERIAL PRIMARY KEY,
        page_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        socket_id VARCHAR(100) NOT NULL,
        cursor_position INTEGER DEFAULT 0,
        selection_start INTEGER,
        selection_end INTEGER,
        mode VARCHAR(20) DEFAULT 'editing',
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(page_id, user_id)
      )
    `);

    // Create indexes for editing sessions
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_editing_sessions_page_id ON editing_sessions(page_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_editing_sessions_socket_id ON editing_sessions(socket_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_page_drafts_page_id ON page_drafts(page_id)
    `);

    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, initDB };
