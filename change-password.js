const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

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

async function changePassword(username, newPassword) {
  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE username = $2 RETURNING username',
      [hashedPassword, username]
    );

    if (result.rows.length === 0) {
      console.log(`❌ User '${username}' not found`);
    } else {
      console.log(`✅ Password updated successfully for user '${username}'`);
    }

    await pool.end();
  } catch (err) {
    console.error('Error updating password:', err);
    process.exit(1);
  }
}

// Get username and password from command line arguments
const username = process.argv[2];
const newPassword = process.argv[3];

if (!username || !newPassword) {
  console.log('Usage: node change-password.js <username> <new-password>');
  console.log('Example: node change-password.js admin MyNewSecurePassword123');
  process.exit(1);
}

changePassword(username, newPassword);
