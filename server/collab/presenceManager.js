const presenceManager = {
  // Add user to editing session
  async joinSession(pool, pageId, userId, socketId, mode = 'editing') {
    const result = await pool.query(
      `INSERT INTO editing_sessions (page_id, user_id, socket_id, mode, last_activity)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (page_id, user_id) DO UPDATE SET
         socket_id = EXCLUDED.socket_id,
         mode = EXCLUDED.mode,
         last_activity = CURRENT_TIMESTAMP
       RETURNING *`,
      [pageId, userId, socketId, mode]
    );
    return result.rows[0];
  },

  // Remove user from session by socket ID
  async leaveSession(pool, socketId) {
    const result = await pool.query(
      'DELETE FROM editing_sessions WHERE socket_id = $1 RETURNING *',
      [socketId]
    );
    return result.rows[0];
  },

  // Remove user from specific page session
  async leavePageSession(pool, pageId, userId) {
    const result = await pool.query(
      'DELETE FROM editing_sessions WHERE page_id = $1 AND user_id = $2 RETURNING *',
      [pageId, userId]
    );
    return result.rows[0];
  },

  // Get all users editing/viewing a page (with user details)
  async getPagePresence(pool, pageId) {
    const result = await pool.query(
      `SELECT
        es.user_id,
        es.cursor_position,
        es.selection_start,
        es.selection_end,
        es.mode,
        es.last_activity,
        u.username,
        u.cursor_color
       FROM editing_sessions es
       JOIN users u ON u.id = es.user_id
       WHERE es.page_id = $1
       ORDER BY es.last_activity DESC`,
      [pageId]
    );
    return result.rows;
  },

  // Update user's last activity
  async updateActivity(pool, socketId) {
    await pool.query(
      'UPDATE editing_sessions SET last_activity = CURRENT_TIMESTAMP WHERE socket_id = $1',
      [socketId]
    );
  },

  // Update user's mode (editing/viewing)
  async updateMode(pool, socketId, mode) {
    await pool.query(
      'UPDATE editing_sessions SET mode = $1, last_activity = CURRENT_TIMESTAMP WHERE socket_id = $1',
      [mode, socketId]
    );
  },

  // Cleanup stale sessions (inactive for more than 10 minutes)
  async cleanupStaleSessions(pool) {
    const result = await pool.query(
      `DELETE FROM editing_sessions
       WHERE last_activity < NOW() - INTERVAL '10 minutes'
       RETURNING page_id, user_id`
    );
    if (result.rows.length > 0) {
      console.log(`Cleaned up ${result.rows.length} stale editing sessions`);
    }
    return result.rows;
  },

  // Get session by socket ID
  async getSessionBySocket(pool, socketId) {
    const result = await pool.query(
      'SELECT * FROM editing_sessions WHERE socket_id = $1',
      [socketId]
    );
    return result.rows[0];
  },

  // Get all active sessions (for admin dashboard)
  async getAllActiveSessions(pool) {
    const result = await pool.query(
      `SELECT
        es.page_id,
        es.mode,
        es.last_activity,
        u.id as user_id,
        u.username,
        u.cursor_color,
        p.title as page_title,
        p.slug as page_slug
       FROM editing_sessions es
       JOIN users u ON u.id = es.user_id
       JOIN pages p ON p.id = es.page_id
       ORDER BY es.last_activity DESC`
    );
    return result.rows;
  }
};

module.exports = { presenceManager };
