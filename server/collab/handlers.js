const { draftManager } = require('./draftManager');
const { presenceManager } = require('./presenceManager');
const { cursorManager } = require('./cursorManager');
const { generateDiff } = require('../diff');

function createHandlers(pool, collab) {
  return {
    // User joins a page for editing or viewing
    async handleJoinPage(socket, { pageId, mode = 'editing' }) {
      if (!pageId) {
        socket.emit('error', { message: 'pageId is required', code: 'INVALID_REQUEST' });
        return;
      }

      // Leave any previous page room
      if (socket.currentPageId) {
        await this.handleLeavePage(socket, { pageId: socket.currentPageId });
      }

      const roomName = `page:${pageId}`;
      socket.join(roomName);
      socket.currentPageId = pageId;

      // Add to editing session
      await presenceManager.joinSession(pool, pageId, socket.userId, socket.id, mode);

      // Get or create draft
      const draft = await draftManager.getOrCreateDraft(pool, pageId);

      // Get presence info
      const presence = await presenceManager.getPagePresence(pool, pageId);

      // Get cursors (only for editors)
      const cursors = await cursorManager.getPageCursors(pool, pageId);

      // Check if there are unsaved changes
      const hasDraft = await draftManager.hasDraftChanges(pool, pageId);

      // Send initial state to the joining user
      socket.emit('joined', {
        pageId,
        draft: draft ? { content: draft.content, title: draft.title, lastModifiedAt: draft.last_modified_at } : null,
        presence,
        cursors,
        hasDraft
      });

      // Notify others that this user joined
      socket.to(roomName).emit('user-joined', {
        userId: socket.userId,
        username: socket.user.username,
        cursorColor: socket.user.cursor_color,
        mode
      });

      console.log(`User ${socket.user.username} joined page ${pageId} in ${mode} mode`);
    },

    // User leaves a page
    async handleLeavePage(socket, { pageId }) {
      if (!pageId) return;

      const roomName = `page:${pageId}`;
      socket.leave(roomName);

      // Remove from editing session
      await presenceManager.leavePageSession(pool, pageId, socket.userId);

      // Notify others
      socket.to(roomName).emit('user-left', {
        userId: socket.userId
      });

      if (socket.currentPageId === pageId) {
        socket.currentPageId = null;
      }

      console.log(`User ${socket.user.username} left page ${pageId}`);
    },

    // Content changed by a user
    async handleContentChange(socket, { pageId, content, title }) {
      if (!pageId || socket.currentPageId !== pageId) {
        return;
      }

      const roomName = `page:${pageId}`;

      // Update draft in database
      await draftManager.updateDraft(pool, pageId, content, title, socket.userId);

      // Update activity
      await presenceManager.updateActivity(pool, socket.id);

      // Broadcast to others in the room
      socket.to(roomName).emit('content-updated', {
        content,
        title,
        userId: socket.userId,
        username: socket.user.username
      });

      // Send save confirmation to sender
      socket.emit('draft-saved', {
        savedAt: new Date().toISOString()
      });
    },

    // Cursor position updated
    async handleCursorMove(socket, { pageId, position, selectionStart, selectionEnd }) {
      if (!pageId || socket.currentPageId !== pageId) {
        return;
      }

      const roomName = `page:${pageId}`;

      // Update cursor in database
      await cursorManager.updateCursor(pool, socket.id, position, selectionStart, selectionEnd);

      // Broadcast to others
      socket.to(roomName).emit('cursor-updated', {
        userId: socket.userId,
        position,
        selectionStart,
        selectionEnd
      });
    },

    // Publish draft to the live page
    async handlePublish(socket, { pageId }) {
      if (!pageId) {
        socket.emit('error', { message: 'pageId is required', code: 'INVALID_REQUEST' });
        return;
      }

      const roomName = `page:${pageId}`;

      // Get the draft
      const draft = await draftManager.getDraft(pool, pageId);
      if (!draft) {
        socket.emit('error', { message: 'No draft to publish', code: 'NO_DRAFT' });
        return;
      }

      // Get current page content for history
      const pageResult = await pool.query(
        'SELECT content, title FROM pages WHERE id = $1',
        [pageId]
      );

      if (pageResult.rows.length === 0) {
        socket.emit('error', { message: 'Page not found', code: 'PAGE_NOT_FOUND' });
        return;
      }

      const currentPage = pageResult.rows[0];

      // Generate diff for history
      const diff = generateDiff(currentPage.content, draft.content);

      // Update the page
      await pool.query(
        `UPDATE pages
         SET content = $1, title = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [draft.content, draft.title, pageId]
      );

      // Record in history
      await pool.query(
        `INSERT INTO page_history (page_id, title, content, previous_content, diff, user_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [pageId, draft.title, draft.content, currentPage.content, diff, socket.userId]
      );

      // Delete the draft
      await draftManager.deleteDraft(pool, pageId);

      // Notify all users in the room
      collab.to(roomName).emit('published', {
        success: true,
        publishedAt: new Date().toISOString(),
        publishedBy: socket.user.username
      });

      console.log(`User ${socket.user.username} published page ${pageId}`);
    },

    // Revert to the last published version
    async handleRevert(socket, { pageId }) {
      if (!pageId) {
        socket.emit('error', { message: 'pageId is required', code: 'INVALID_REQUEST' });
        return;
      }

      const roomName = `page:${pageId}`;

      // Get the published page content
      const pageResult = await pool.query(
        'SELECT content, title FROM pages WHERE id = $1 AND deleted_at IS NULL',
        [pageId]
      );

      if (pageResult.rows.length === 0) {
        socket.emit('error', { message: 'Page not found', code: 'PAGE_NOT_FOUND' });
        return;
      }

      const page = pageResult.rows[0];

      // Delete the draft
      await draftManager.deleteDraft(pool, pageId);

      // Notify all users in the room with the published content
      collab.to(roomName).emit('reverted', {
        content: page.content,
        title: page.title,
        revertedBy: socket.user.username
      });

      console.log(`User ${socket.user.username} reverted page ${pageId}`);
    },

    // Handle user disconnect
    async handleDisconnect(socket) {
      // Get the session to find which page they were on
      const session = await presenceManager.getSessionBySocket(pool, socket.id);

      if (session) {
        const roomName = `page:${session.page_id}`;

        // Remove from editing session
        await presenceManager.leaveSession(pool, socket.id);

        // Notify others
        collab.to(roomName).emit('user-left', {
          userId: socket.userId
        });
      }
    }
  };
}

module.exports = { createHandlers };
