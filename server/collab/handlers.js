const { draftManager } = require('./draftManager');
const { presenceManager } = require('./presenceManager');
const { cursorManager } = require('./cursorManager');
const { generateDiff } = require('../diff');

function createHandlers(pool, collab, adminBroadcast = () => {}) {
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
        draft: draft ? {
          content: draft.content,
          title: draft.title,
          lastModifiedAt: draft.last_modified_at,
          lastModifiedBy: draft.last_modified_by_username
        } : null,
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

      // Broadcast to admin live feed
      const pageInfo = await pool.query('SELECT title, slug FROM pages WHERE id = $1', [pageId]);
      adminBroadcast({
        type: 'user-joined-page',
        timestamp: new Date().toISOString(),
        userId: socket.userId,
        username: socket.user.username,
        cursorColor: socket.user.cursor_color,
        pageId,
        pageTitle: pageInfo.rows[0]?.title,
        pageSlug: pageInfo.rows[0]?.slug,
        mode
      });

      console.log(`User ${socket.user.username} joined page ${pageId} in ${mode} mode`);
    },

    // User leaves a page
    async handleLeavePage(socket, { pageId }) {
      if (!pageId) return;

      const roomName = `page:${pageId}`;
      socket.leave(roomName);

      // Get page info before leaving
      const pageInfo = await pool.query('SELECT title, slug FROM pages WHERE id = $1', [pageId]);

      // Remove from editing session
      await presenceManager.leavePageSession(pool, pageId, socket.userId);

      // Notify others
      socket.to(roomName).emit('user-left', {
        userId: socket.userId
      });

      // Broadcast to admin live feed
      adminBroadcast({
        type: 'user-left-page',
        timestamp: new Date().toISOString(),
        userId: socket.userId,
        username: socket.user.username,
        pageId,
        pageTitle: pageInfo.rows[0]?.title,
        pageSlug: pageInfo.rows[0]?.slug
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
      const savedAt = new Date().toISOString();
      socket.emit('draft-saved', {
        savedAt,
        savedBy: socket.user.username
      });

      // Broadcast to admin live feed
      const pageInfo = await pool.query('SELECT title, slug FROM pages WHERE id = $1', [pageId]);
      adminBroadcast({
        type: 'draft-saved',
        timestamp: savedAt,
        userId: socket.userId,
        username: socket.user.username,
        pageId,
        pageTitle: pageInfo.rows[0]?.title,
        pageSlug: pageInfo.rows[0]?.slug
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
    async handlePublish(socket, { pageId, parentId }) {
      if (!pageId) {
        socket.emit('error', { message: 'pageId is required', code: 'INVALID_REQUEST' });
        return;
      }

      const roomName = `page:${pageId}`;

      // Get the draft (may be null if only parent changed)
      const draft = await draftManager.getDraft(pool, pageId);

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

      // Use draft content if available, otherwise keep current
      const newContent = draft ? draft.content : currentPage.content;
      const newTitle = draft ? draft.title : currentPage.title;

      // Generate diff for history (only if content changed)
      const diff = draft ? generateDiff(currentPage.content, newContent) : '';

      // Update the page (including parent_id)
      await pool.query(
        `UPDATE pages
         SET content = $1, title = $2, parent_id = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [newContent, newTitle, parentId, pageId]
      );

      // Record in history (only if there was actual content change)
      if (draft) {
        await pool.query(
          `INSERT INTO page_history (page_id, title, content, previous_content, diff, user_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pageId, newTitle, newContent, currentPage.content, diff, socket.userId]
        );
      }

      // Delete the draft if it exists
      if (draft) {
        await draftManager.deleteDraft(pool, pageId);
      }

      // Notify all users in the room
      const publishedAt = new Date().toISOString();
      collab.to(roomName).emit('published', {
        success: true,
        publishedAt,
        publishedBy: socket.user.username
      });

      // Broadcast to admin live feed
      const pageInfoForAdmin = await pool.query('SELECT title, slug FROM pages WHERE id = $1', [pageId]);
      adminBroadcast({
        type: 'page-published',
        timestamp: publishedAt,
        userId: socket.userId,
        username: socket.user.username,
        pageId,
        pageTitle: pageInfoForAdmin.rows[0]?.title,
        pageSlug: pageInfoForAdmin.rows[0]?.slug
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
        'SELECT content, title, parent_id, slug FROM pages WHERE id = $1 AND deleted_at IS NULL',
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
        parentId: page.parent_id,
        revertedBy: socket.user.username
      });

      // Broadcast to admin live feed
      adminBroadcast({
        type: 'page-reverted',
        timestamp: new Date().toISOString(),
        userId: socket.userId,
        username: socket.user.username,
        pageId,
        pageTitle: page.title,
        pageSlug: page.slug
      });

      console.log(`User ${socket.user.username} reverted page ${pageId}`);
    },

    // Handle user disconnect
    async handleDisconnect(socket) {
      // Get the session to find which page they were on
      const session = await presenceManager.getSessionBySocket(pool, socket.id);

      if (session) {
        const roomName = `page:${session.page_id}`;

        // Get page info before removing session
        const pageInfo = await pool.query('SELECT title, slug FROM pages WHERE id = $1', [session.page_id]);

        // Remove from editing session
        await presenceManager.leaveSession(pool, socket.id);

        // Notify others
        collab.to(roomName).emit('user-left', {
          userId: socket.userId
        });

        // Broadcast to admin live feed
        adminBroadcast({
          type: 'user-disconnected',
          timestamp: new Date().toISOString(),
          userId: socket.userId,
          username: socket.user.username,
          pageId: session.page_id,
          pageTitle: pageInfo.rows[0]?.title,
          pageSlug: pageInfo.rows[0]?.slug
        });
      }
    }
  };
}

module.exports = { createHandlers };
