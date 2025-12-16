const cursorManager = {
  // Update cursor position for a session
  async updateCursor(pool, socketId, position, selectionStart, selectionEnd) {
    await pool.query(
      `UPDATE editing_sessions
       SET cursor_position = $1,
           selection_start = $2,
           selection_end = $3,
           last_activity = CURRENT_TIMESTAMP
       WHERE socket_id = $4`,
      [position, selectionStart, selectionEnd, socketId]
    );
  },

  // Get all cursors for a page (returns user info with cursor positions)
  async getPageCursors(pool, pageId) {
    const result = await pool.query(
      `SELECT
        es.user_id,
        es.cursor_position,
        es.selection_start,
        es.selection_end,
        u.username,
        u.cursor_color
       FROM editing_sessions es
       JOIN users u ON u.id = es.user_id
       WHERE es.page_id = $1 AND es.mode = 'editing'`,
      [pageId]
    );

    // Return as a map keyed by user_id
    const cursors = {};
    for (const row of result.rows) {
      cursors[row.user_id] = {
        position: row.cursor_position,
        selectionStart: row.selection_start,
        selectionEnd: row.selection_end,
        username: row.username,
        color: row.cursor_color
      };
    }
    return cursors;
  },

  // Generate a random cursor color (bright, distinguishable colors)
  generateCursorColor() {
    const colors = [
      '#E53935', // Red
      '#D81B60', // Pink
      '#8E24AA', // Purple
      '#5E35B1', // Deep Purple
      '#3949AB', // Indigo
      '#1E88E5', // Blue
      '#039BE5', // Light Blue
      '#00ACC1', // Cyan
      '#00897B', // Teal
      '#43A047', // Green
      '#7CB342', // Light Green
      '#C0CA33', // Lime
      '#FDD835', // Yellow
      '#FFB300', // Amber
      '#FB8C00', // Orange
      '#F4511E', // Deep Orange
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  // Ensure user has a cursor color assigned
  async ensureUserColor(pool, userId) {
    const result = await pool.query(
      'SELECT cursor_color FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    if (result.rows[0].cursor_color) {
      return result.rows[0].cursor_color;
    }

    // Generate and save new color
    const color = cursorManager.generateCursorColor();
    await pool.query(
      'UPDATE users SET cursor_color = $1 WHERE id = $2',
      [color, userId]
    );
    return color;
  },

  // Update user's cursor color
  async setUserColor(pool, userId, color) {
    // Validate hex color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      throw new Error('Invalid color format. Use hex format like #FF5733');
    }

    await pool.query(
      'UPDATE users SET cursor_color = $1 WHERE id = $2',
      [color, userId]
    );
    return color;
  }
};

module.exports = { cursorManager };
