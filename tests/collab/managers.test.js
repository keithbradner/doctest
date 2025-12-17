/**
 * Manager Tests - DraftManager, PresenceManager, CursorManager
 */

const {
  pool,
  TestRunner,
  request,
  assert,
  assertEqual,
  assertNotNull,
  assertMatch,
  sleep
} = require('./testRunner');

const { draftManager } = require('../../server/collab/draftManager');
const { presenceManager } = require('../../server/collab/presenceManager');
const { cursorManager } = require('../../server/collab/cursorManager');

function registerManagerTests(runner, context) {
  // ============================================================
  // DRAFT MANAGER TESTS
  // ============================================================

  runner.test('DraftManager: getOrCreateDraft creates draft from published page', async () => {
    await draftManager.deleteDraft(pool, context.testPageId);
    const draft = await draftManager.getOrCreateDraft(pool, context.testPageId);

    assertNotNull(draft, 'Should create draft');
    assertEqual(draft.page_id, context.testPageId, 'Draft should reference test page');
    assertNotNull(draft.content, 'Draft should have content');
    assertNotNull(draft.title, 'Draft should have title');
  });

  runner.test('DraftManager: getDraft returns existing draft', async () => {
    const draft = await draftManager.getDraft(pool, context.testPageId);
    assertNotNull(draft, 'Should return existing draft');
    assertEqual(draft.page_id, context.testPageId, 'Should be correct page');
  });

  runner.test('DraftManager: updateDraft modifies draft content', async () => {
    const newContent = 'Updated test content ' + Date.now();
    const newTitle = 'Updated Title ' + Date.now();

    const updated = await draftManager.updateDraft(pool, context.testPageId, newContent, newTitle, context.testUserId);

    assertEqual(updated.content, newContent, 'Content should be updated');
    assertEqual(updated.title, newTitle, 'Title should be updated');
    assertEqual(updated.last_modified_by, context.testUserId, 'Should track who modified');
  });

  runner.test('DraftManager: hasDraftChanges detects differences', async () => {
    const uniqueContent = 'Different content ' + Date.now();
    await draftManager.updateDraft(pool, context.testPageId, uniqueContent, 'Different Title', context.testUserId);

    const hasChanges = await draftManager.hasDraftChanges(pool, context.testPageId);
    assertEqual(hasChanges, true, 'Should detect draft differs from published');
  });

  runner.test('DraftManager: deleteDraft removes draft', async () => {
    await draftManager.deleteDraft(pool, context.testPageId);
    const draft = await draftManager.getDraft(pool, context.testPageId);
    assertEqual(draft, null, 'Draft should be deleted');
  });

  runner.test('DraftManager: getOrCreateDraft returns existing draft', async () => {
    await draftManager.updateDraft(pool, context.testPageId, 'Test content', 'Test Title', context.testUserId);
    const draft = await draftManager.getOrCreateDraft(pool, context.testPageId);
    assertNotNull(draft, 'Should return draft');
    assertEqual(draft.content, 'Test content', 'Should be existing draft');
  });

  // ============================================================
  // PRESENCE MANAGER TESTS
  // ============================================================

  runner.test('PresenceManager: joinSession adds user to page', async () => {
    const socketId = 'test-socket-' + Date.now();
    const session = await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId, 'editing');

    assertNotNull(session, 'Should create session');
    assertEqual(session.page_id, context.testPageId, 'Should be correct page');
    assertEqual(session.user_id, context.testUserId, 'Should be correct user');
    assertEqual(session.socket_id, socketId, 'Should have socket ID');
    assertEqual(session.mode, 'editing', 'Should have correct mode');
  });

  runner.test('PresenceManager: joinSession updates existing session', async () => {
    const socketId1 = 'test-socket-1-' + Date.now();
    const socketId2 = 'test-socket-2-' + Date.now();

    await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId1, 'viewing');
    const session = await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId2, 'editing');

    assertEqual(session.socket_id, socketId2, 'Socket ID should be updated');
    assertEqual(session.mode, 'editing', 'Mode should be updated');
  });

  runner.test('PresenceManager: getPagePresence returns all users', async () => {
    const socketId1 = 'test-socket-a-' + Date.now();
    const socketId2 = 'test-socket-b-' + Date.now();

    await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId1, 'editing');
    await presenceManager.joinSession(pool, context.testPageId, context.testUser2Id, socketId2, 'viewing');

    const presence = await presenceManager.getPagePresence(pool, context.testPageId);

    assert(presence.length >= 2, 'Should have at least 2 users');
    const userIds = presence.map(p => p.user_id);
    assert(userIds.includes(context.testUserId), 'Should include user 1');
    assert(userIds.includes(context.testUser2Id), 'Should include user 2');
  });

  runner.test('PresenceManager: leaveSession removes by socket ID', async () => {
    const socketId = 'test-socket-leave-' + Date.now();
    await presenceManager.joinSession(pool, context.testPageId, context.testUser2Id, socketId, 'viewing');

    const removed = await presenceManager.leaveSession(pool, socketId);

    assertNotNull(removed, 'Should return removed session');
    assertEqual(removed.socket_id, socketId, 'Should be correct socket');
  });

  runner.test('PresenceManager: leavePageSession removes by page and user', async () => {
    const socketId = 'test-socket-leavepage-' + Date.now();
    await presenceManager.joinSession(pool, context.testPageId, context.testUser2Id, socketId, 'editing');

    const removed = await presenceManager.leavePageSession(pool, context.testPageId, context.testUser2Id);

    assertNotNull(removed, 'Should return removed session');
    assertEqual(removed.user_id, context.testUser2Id, 'Should be correct user');
  });

  runner.test('PresenceManager: getSessionBySocket returns session', async () => {
    const socketId = 'test-socket-get-' + Date.now();
    await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId, 'editing');

    const session = await presenceManager.getSessionBySocket(pool, socketId);

    assertNotNull(session, 'Should return session');
    assertEqual(session.socket_id, socketId, 'Should be correct socket');
  });

  runner.test('PresenceManager: updateActivity updates timestamp', async () => {
    const socketId = 'test-socket-activity-' + Date.now();
    await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId, 'editing');

    const beforeSession = await presenceManager.getSessionBySocket(pool, socketId);
    await sleep(100);
    await presenceManager.updateActivity(pool, socketId);
    const afterSession = await presenceManager.getSessionBySocket(pool, socketId);

    assert(
      new Date(afterSession.last_activity) >= new Date(beforeSession.last_activity),
      'Activity timestamp should be updated'
    );
  });

  runner.test('PresenceManager: cleanupStaleSessions removes old sessions', async () => {
    const socketId = 'stale-socket-' + Date.now();
    await pool.query(
      `INSERT INTO editing_sessions (page_id, user_id, socket_id, mode, last_activity)
       VALUES ($1, $2, $3, 'editing', NOW() - INTERVAL '15 minutes')`,
      [context.testPageId, context.testUserId, socketId]
    );

    const cleaned = await presenceManager.cleanupStaleSessions(pool);

    assert(cleaned.length > 0, 'Should have cleaned up at least one session');
    const wasRemoved = cleaned.some(s => s.user_id === context.testUserId && s.page_id === context.testPageId);
    assert(wasRemoved, 'Stale session should have been removed');
  });

  // ============================================================
  // CURSOR MANAGER TESTS
  // ============================================================

  runner.test('CursorManager: generateCursorColor returns valid hex color', async () => {
    const color = cursorManager.generateCursorColor();
    assertMatch(color, /^#[0-9A-Fa-f]{6}$/, 'Should be valid hex color');
  });

  runner.test('CursorManager: ensureUserColor generates color for user without one', async () => {
    await pool.query('UPDATE users SET cursor_color = NULL WHERE id = $1', [context.testUser2Id]);
    const color = await cursorManager.ensureUserColor(pool, context.testUser2Id);

    assertNotNull(color, 'Should return color');
    assertMatch(color, /^#[0-9A-Fa-f]{6}$/, 'Should be valid hex color');
  });

  runner.test('CursorManager: ensureUserColor returns existing color', async () => {
    const existingColor = '#FF5733';
    await pool.query('UPDATE users SET cursor_color = $1 WHERE id = $2', [existingColor, context.testUser2Id]);

    const color = await cursorManager.ensureUserColor(pool, context.testUser2Id);

    assertEqual(color, existingColor, 'Should return existing color');
  });

  runner.test('CursorManager: setUserColor updates color', async () => {
    const newColor = '#00FF00';
    const result = await cursorManager.setUserColor(pool, context.testUser2Id, newColor);

    assertEqual(result, newColor, 'Should return new color');

    const res = await pool.query('SELECT cursor_color FROM users WHERE id = $1', [context.testUser2Id]);
    assertEqual(res.rows[0].cursor_color, newColor, 'Should be saved in database');
  });

  runner.test('CursorManager: setUserColor rejects invalid format', async () => {
    let threw = false;
    try {
      await cursorManager.setUserColor(pool, context.testUser2Id, 'not-a-color');
    } catch (err) {
      threw = true;
      assert(err.message.includes('Invalid color format'), 'Should have correct error message');
    }
    assert(threw, 'Should throw error for invalid color');
  });

  runner.test('CursorManager: updateCursor saves position', async () => {
    const socketId = 'test-socket-cursor-' + Date.now();
    await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId, 'editing');

    await cursorManager.updateCursor(pool, socketId, 100, 50, 150);

    const session = await presenceManager.getSessionBySocket(pool, socketId);
    assertEqual(session.cursor_position, 100, 'Should save position');
    assertEqual(session.selection_start, 50, 'Should save selection start');
    assertEqual(session.selection_end, 150, 'Should save selection end');
  });

  runner.test('CursorManager: getPageCursors returns cursor map', async () => {
    const socketId1 = 'test-socket-c1-' + Date.now();
    const socketId2 = 'test-socket-c2-' + Date.now();

    await presenceManager.joinSession(pool, context.testPageId, context.testUserId, socketId1, 'editing');
    await presenceManager.joinSession(pool, context.testPageId, context.testUser2Id, socketId2, 'editing');
    await cursorManager.updateCursor(pool, socketId1, 10, 10, 10);
    await cursorManager.updateCursor(pool, socketId2, 20, 20, 20);

    const cursors = await cursorManager.getPageCursors(pool, context.testPageId);

    assertNotNull(cursors[context.testUserId], 'Should have user 1 cursor');
    assertNotNull(cursors[context.testUser2Id], 'Should have user 2 cursor');
    assertEqual(cursors[context.testUserId].position, 10, 'User 1 position correct');
    assertEqual(cursors[context.testUser2Id].position, 20, 'User 2 position correct');
  });

  // ============================================================
  // REST API TESTS - Cursor Color
  // ============================================================

  runner.test('API: PUT /api/users/me/cursor-color updates own color', async () => {
    const newColor = '#AABBCC';
    const res = await request({
      path: '/api/users/me/cursor-color',
      method: 'PUT',
      headers: { 'Cookie': context.authCookie }
    }, { color: newColor });

    assertEqual(res.status, 200, 'Status should be 200');
    assertEqual(res.data.cursorColor, newColor, 'Should return new color');
  });

  runner.test('API: PUT /api/users/me/cursor-color rejects invalid color', async () => {
    const res = await request({
      path: '/api/users/me/cursor-color',
      method: 'PUT',
      headers: { 'Cookie': context.authCookie }
    }, { color: 'invalid' });

    assertEqual(res.status, 400, 'Status should be 400');
  });

  runner.test('API: PUT /api/users/:id/cursor-color (admin) updates other user color', async () => {
    const newColor = '#DDEEFF';
    const res = await request({
      path: `/api/users/${context.testUser2Id}/cursor-color`,
      method: 'PUT',
      headers: { 'Cookie': context.authCookie }
    }, { color: newColor });

    assertEqual(res.status, 200, 'Status should be 200');
    assertEqual(res.data.user.cursor_color, newColor, 'Should return new color');
  });

  runner.test('API: PUT /api/users/:id/cursor-color (non-admin) forbidden', async () => {
    const res = await request({
      path: `/api/users/${context.testUserId}/cursor-color`,
      method: 'PUT',
      headers: { 'Cookie': context.testUser2Cookie }
    }, { color: '#123456' });

    assertEqual(res.status, 403, 'Status should be 403 for non-admin');
  });

  runner.test('API: GET /api/auth/check returns cursor color', async () => {
    const res = await request({
      path: '/api/auth/check',
      method: 'GET',
      headers: { 'Cookie': context.authCookie }
    });

    assertEqual(res.status, 200, 'Status should be 200');
    assertNotNull(res.data.cursorColor, 'Should include cursor color');
  });
}

module.exports = { registerManagerTests };
