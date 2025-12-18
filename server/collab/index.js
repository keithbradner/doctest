const jwt = require('jsonwebtoken');
const { draftManager } = require('./draftManager');
const { presenceManager } = require('./presenceManager');
const { cursorManager } = require('./cursorManager');
const { createHandlers } = require('./handlers');

// Helper to broadcast admin events
const broadcastAdminEvent = (collab, event) => {
  collab.to('admin-live').emit('admin-event', event);
};

module.exports = (io, pool) => {
  const collab = io.of('/collab');

  // Create admin event broadcaster
  const adminBroadcast = (event) => broadcastAdminEvent(collab, event);

  const handlers = createHandlers(pool, collab, adminBroadcast);

  // Authentication middleware for socket connections
  collab.use(async (socket, next) => {
    try {
      // Get token from handshake auth or cookies
      const token = socket.handshake.auth?.token ||
                    parseCookies(socket.handshake.headers.cookie)?.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;

      // Get user info
      const result = await pool.query(
        'SELECT id, username, role, cursor_color FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return next(new Error('User not found'));
      }

      socket.user = result.rows[0];

      // Ensure user has a cursor color
      if (!socket.user.cursor_color) {
        const color = cursorManager.generateCursorColor();
        await pool.query(
          'UPDATE users SET cursor_color = $1 WHERE id = $2',
          [color, socket.userId]
        );
        socket.user.cursor_color = color;
      }

      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Invalid token'));
    }
  });

  collab.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected to collab`);

    // Track which page this socket is on
    socket.currentPageId = null;

    // Admin joins the live feed room
    socket.on('join-admin-live', async () => {
      if (socket.user.role !== 'admin') {
        socket.emit('error', { message: 'Admin access required', code: 'FORBIDDEN' });
        return;
      }
      socket.join('admin-live');
      console.log(`Admin ${socket.user.username} joined admin-live feed`);

      // Send current active sessions
      const activeSessions = await presenceManager.getAllActiveSessions(pool);
      socket.emit('admin-init', { activeSessions });
    });

    // Admin leaves the live feed room
    socket.on('leave-admin-live', () => {
      socket.leave('admin-live');
      console.log(`Admin ${socket.user.username} left admin-live feed`);
    });

    // Join a page for editing/viewing
    socket.on('join-page', async (data) => {
      try {
        await handlers.handleJoinPage(socket, data);
      } catch (err) {
        console.error('Error joining page:', err);
        socket.emit('error', { message: 'Failed to join page', code: 'JOIN_ERROR' });
      }
    });

    // Leave a page
    socket.on('leave-page', async (data) => {
      try {
        await handlers.handleLeavePage(socket, data);
      } catch (err) {
        console.error('Error leaving page:', err);
      }
    });

    // Content changed
    socket.on('content-change', async (data) => {
      try {
        await handlers.handleContentChange(socket, data);
      } catch (err) {
        console.error('Error handling content change:', err);
        socket.emit('error', { message: 'Failed to sync content', code: 'SYNC_ERROR' });
      }
    });

    // Cursor moved
    socket.on('cursor-move', async (data) => {
      try {
        await handlers.handleCursorMove(socket, data);
      } catch (err) {
        console.error('Error handling cursor move:', err);
      }
    });

    // Publish draft
    socket.on('publish', async (data) => {
      try {
        await handlers.handlePublish(socket, data);
      } catch (err) {
        console.error('Error publishing:', err);
        socket.emit('error', { message: 'Failed to publish', code: 'PUBLISH_ERROR' });
      }
    });

    // Revert to published version
    socket.on('revert', async (data) => {
      try {
        await handlers.handleRevert(socket, data);
      } catch (err) {
        console.error('Error reverting:', err);
        socket.emit('error', { message: 'Failed to revert', code: 'REVERT_ERROR' });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected from collab`);
      try {
        await handlers.handleDisconnect(socket);
      } catch (err) {
        console.error('Error handling disconnect:', err);
      }
    });
  });

  // Periodic cleanup of stale sessions (every 5 minutes)
  setInterval(async () => {
    try {
      await presenceManager.cleanupStaleSessions(pool);
    } catch (err) {
      console.error('Error cleaning up stale sessions:', err);
    }
  }, 5 * 60 * 1000);

  return collab;
};

// Helper to parse cookies from header string
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [name, value] = cookie.trim().split('=');
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}
