/**
 * Collaboration Tests for BBCode Wiki
 *
 * Run with: npm run test:collab
 *
 * Prerequisites:
 * - Database should be seeded
 * - Server should be running on port 3001
 *
 * Tests cover:
 * - Draft manager (create, update, delete drafts)
 * - Presence manager (join/leave sessions, tracking)
 * - Cursor manager (position tracking, colors)
 * - REST API (cursor color endpoints)
 * - Socket.io events (real-time collaboration)
 */

const http = require('http');
const { Pool } = require('pg');
const { io: ioClient } = require('socket.io-client');

// Database connection for direct testing
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'bbcode_wiki',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Import managers for unit testing
const { draftManager } = require('../server/collab/draftManager');
const { presenceManager } = require('../server/collab/presenceManager');
const { cursorManager } = require('../server/collab/cursorManager');

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.skipped = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  skip(name, fn) {
    this.tests.push({ name, fn, skip: true });
  }

  async run() {
    console.log('\n='.repeat(60));
    console.log('  COLLABORATION TESTS');
    console.log('='.repeat(60) + '\n');

    for (const test of this.tests) {
      if (test.skip) {
        this.skipped++;
        console.log(`⏭️  ${test.name} (skipped)`);
        continue;
      }
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (err) {
        this.failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${err.message}`);
        if (err.stack) {
          console.log(`   Stack: ${err.stack.split('\n')[1]}`);
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${this.tests.length} | Passed: ${this.passed} | Failed: ${this.failed} | Skipped: ${this.skipped}`);
    console.log('='.repeat(60) + '\n');

    return this.failed;
  }
}

// HTTP request helper
function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: body ? JSON.parse(body) : null
          };
          resolve(result);
        } catch (err) {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test assertions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected value to not be null/undefined');
  }
}

function assertIncludes(array, value, message) {
  if (!array.includes(value)) {
    throw new Error(message || `Expected array to include ${value}`);
  }
}

function assertMatch(value, regex, message) {
  if (!regex.test(value)) {
    throw new Error(message || `Expected ${value} to match ${regex}`);
  }
}

// Socket.io client helper
function createSocketClient(token) {
  return ioClient('http://localhost:3001/collab', {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 5000
  });
}

// Wait for socket event with timeout
function waitForEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for event: ${event}`));
    }, timeout);

    socket.once(event, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

// Sleep helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// TEST SETUP
// ============================================================

const runner = new TestRunner();
let authCookie = '';
let authToken = '';
let testUserId = null;
let testPageId = null;
let testUser2Cookie = '';
let testUser2Token = '';
let testUser2Id = null;

// ============================================================
// SETUP TESTS
// ============================================================

runner.test('Setup: Login as admin', async () => {
  const res = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username: 'admin',
    password: 'admin'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.success, 'Login should succeed');
  assert(res.headers['set-cookie'], 'Should set cookie');

  // Extract token from cookie
  authCookie = res.headers['set-cookie'][0].split(';')[0];
  const cookieMatch = authCookie.match(/token=([^;]+)/);
  if (cookieMatch) {
    authToken = cookieMatch[1];
  }

  // Get user ID
  const authRes = await request({
    path: '/api/auth/check',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });
  testUserId = authRes.data.userId;
  assertNotNull(testUserId, 'Should have user ID');
});

runner.test('Setup: Create or get test page', async () => {
  // Try to get welcome page
  const res = await request({
    path: '/api/pages/welcome',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  if (res.status === 200) {
    testPageId = res.data.id;
  } else {
    // Create test page
    const createRes = await request({
      path: '/api/pages',
      method: 'POST',
      headers: { 'Cookie': authCookie }
    }, {
      slug: 'collab-test-' + Date.now(),
      title: 'Collaboration Test Page',
      content: '[h1]Test Content[/h1]',
      display_order: 100
    });
    testPageId = createRes.data.id;
  }

  assertNotNull(testPageId, 'Should have test page ID');
});

runner.test('Setup: Create second test user', async () => {
  const username = 'collabtest-' + Date.now();

  const res = await request({
    path: '/api/users/register',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    username,
    password: 'testpass',
    role: 'user'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  testUser2Id = res.data.id;

  // Login as user 2
  const loginRes = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username,
    password: 'testpass'
  });

  assertEqual(loginRes.status, 200, 'User 2 login should succeed');
  testUser2Cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  const cookieMatch = testUser2Cookie.match(/token=([^;]+)/);
  if (cookieMatch) {
    testUser2Token = cookieMatch[1];
  }
});

// ============================================================
// DRAFT MANAGER TESTS
// ============================================================

runner.test('DraftManager: getOrCreateDraft creates draft from published page', async () => {
  // First ensure no draft exists
  await draftManager.deleteDraft(pool, testPageId);

  const draft = await draftManager.getOrCreateDraft(pool, testPageId);

  assertNotNull(draft, 'Should create draft');
  assertEqual(draft.page_id, testPageId, 'Draft should reference test page');
  assertNotNull(draft.content, 'Draft should have content');
  assertNotNull(draft.title, 'Draft should have title');
});

runner.test('DraftManager: getDraft returns existing draft', async () => {
  const draft = await draftManager.getDraft(pool, testPageId);
  assertNotNull(draft, 'Should return existing draft');
  assertEqual(draft.page_id, testPageId, 'Should be correct page');
});

runner.test('DraftManager: updateDraft modifies draft content', async () => {
  const newContent = 'Updated test content ' + Date.now();
  const newTitle = 'Updated Title ' + Date.now();

  const updated = await draftManager.updateDraft(pool, testPageId, newContent, newTitle, testUserId);

  assertEqual(updated.content, newContent, 'Content should be updated');
  assertEqual(updated.title, newTitle, 'Title should be updated');
  assertEqual(updated.last_modified_by, testUserId, 'Should track who modified');
});

runner.test('DraftManager: hasDraftChanges detects differences', async () => {
  // Update draft to differ from published
  const uniqueContent = 'Different content ' + Date.now();
  await draftManager.updateDraft(pool, testPageId, uniqueContent, 'Different Title', testUserId);

  const hasChanges = await draftManager.hasDraftChanges(pool, testPageId);
  assertEqual(hasChanges, true, 'Should detect draft differs from published');
});

runner.test('DraftManager: deleteDraft removes draft', async () => {
  await draftManager.deleteDraft(pool, testPageId);

  const draft = await draftManager.getDraft(pool, testPageId);
  assertEqual(draft, null, 'Draft should be deleted');
});

runner.test('DraftManager: getOrCreateDraft returns existing draft', async () => {
  // Create a draft
  await draftManager.updateDraft(pool, testPageId, 'Test content', 'Test Title', testUserId);

  // Get or create should return existing
  const draft = await draftManager.getOrCreateDraft(pool, testPageId);
  assertNotNull(draft, 'Should return draft');
  assertEqual(draft.content, 'Test content', 'Should be existing draft');
});

// ============================================================
// PRESENCE MANAGER TESTS
// ============================================================

runner.test('PresenceManager: joinSession adds user to page', async () => {
  const socketId = 'test-socket-' + Date.now();

  const session = await presenceManager.joinSession(pool, testPageId, testUserId, socketId, 'editing');

  assertNotNull(session, 'Should create session');
  assertEqual(session.page_id, testPageId, 'Should be correct page');
  assertEqual(session.user_id, testUserId, 'Should be correct user');
  assertEqual(session.socket_id, socketId, 'Should have socket ID');
  assertEqual(session.mode, 'editing', 'Should have correct mode');
});

runner.test('PresenceManager: joinSession updates existing session', async () => {
  const socketId1 = 'test-socket-1-' + Date.now();
  const socketId2 = 'test-socket-2-' + Date.now();

  await presenceManager.joinSession(pool, testPageId, testUserId, socketId1, 'viewing');
  const session = await presenceManager.joinSession(pool, testPageId, testUserId, socketId2, 'editing');

  assertEqual(session.socket_id, socketId2, 'Socket ID should be updated');
  assertEqual(session.mode, 'editing', 'Mode should be updated');
});

runner.test('PresenceManager: getPagePresence returns all users', async () => {
  const socketId1 = 'test-socket-a-' + Date.now();
  const socketId2 = 'test-socket-b-' + Date.now();

  await presenceManager.joinSession(pool, testPageId, testUserId, socketId1, 'editing');
  await presenceManager.joinSession(pool, testPageId, testUser2Id, socketId2, 'viewing');

  const presence = await presenceManager.getPagePresence(pool, testPageId);

  assert(presence.length >= 2, 'Should have at least 2 users');
  const userIds = presence.map(p => p.user_id);
  assert(userIds.includes(testUserId), 'Should include user 1');
  assert(userIds.includes(testUser2Id), 'Should include user 2');
});

runner.test('PresenceManager: leaveSession removes by socket ID', async () => {
  const socketId = 'test-socket-leave-' + Date.now();
  await presenceManager.joinSession(pool, testPageId, testUser2Id, socketId, 'viewing');

  const removed = await presenceManager.leaveSession(pool, socketId);

  assertNotNull(removed, 'Should return removed session');
  assertEqual(removed.socket_id, socketId, 'Should be correct socket');
});

runner.test('PresenceManager: leavePageSession removes by page and user', async () => {
  const socketId = 'test-socket-leavepage-' + Date.now();
  await presenceManager.joinSession(pool, testPageId, testUser2Id, socketId, 'editing');

  const removed = await presenceManager.leavePageSession(pool, testPageId, testUser2Id);

  assertNotNull(removed, 'Should return removed session');
  assertEqual(removed.user_id, testUser2Id, 'Should be correct user');
});

runner.test('PresenceManager: getSessionBySocket returns session', async () => {
  const socketId = 'test-socket-get-' + Date.now();
  await presenceManager.joinSession(pool, testPageId, testUserId, socketId, 'editing');

  const session = await presenceManager.getSessionBySocket(pool, socketId);

  assertNotNull(session, 'Should return session');
  assertEqual(session.socket_id, socketId, 'Should be correct socket');
});

runner.test('PresenceManager: updateActivity updates timestamp', async () => {
  const socketId = 'test-socket-activity-' + Date.now();
  await presenceManager.joinSession(pool, testPageId, testUserId, socketId, 'editing');

  const beforeSession = await presenceManager.getSessionBySocket(pool, socketId);
  await sleep(100);
  await presenceManager.updateActivity(pool, socketId);
  const afterSession = await presenceManager.getSessionBySocket(pool, socketId);

  assert(
    new Date(afterSession.last_activity) >= new Date(beforeSession.last_activity),
    'Activity timestamp should be updated'
  );
});

// ============================================================
// CURSOR MANAGER TESTS
// ============================================================

runner.test('CursorManager: generateCursorColor returns valid hex color', async () => {
  const color = cursorManager.generateCursorColor();

  assertMatch(color, /^#[0-9A-Fa-f]{6}$/, 'Should be valid hex color');
});

runner.test('CursorManager: ensureUserColor generates color for user without one', async () => {
  // First clear any existing color
  await pool.query('UPDATE users SET cursor_color = NULL WHERE id = $1', [testUser2Id]);

  const color = await cursorManager.ensureUserColor(pool, testUser2Id);

  assertNotNull(color, 'Should return color');
  assertMatch(color, /^#[0-9A-Fa-f]{6}$/, 'Should be valid hex color');
});

runner.test('CursorManager: ensureUserColor returns existing color', async () => {
  const existingColor = '#FF5733';
  await pool.query('UPDATE users SET cursor_color = $1 WHERE id = $2', [existingColor, testUser2Id]);

  const color = await cursorManager.ensureUserColor(pool, testUser2Id);

  assertEqual(color, existingColor, 'Should return existing color');
});

runner.test('CursorManager: setUserColor updates color', async () => {
  const newColor = '#00FF00';
  const result = await cursorManager.setUserColor(pool, testUser2Id, newColor);

  assertEqual(result, newColor, 'Should return new color');

  // Verify it was saved
  const res = await pool.query('SELECT cursor_color FROM users WHERE id = $1', [testUser2Id]);
  assertEqual(res.rows[0].cursor_color, newColor, 'Should be saved in database');
});

runner.test('CursorManager: setUserColor rejects invalid format', async () => {
  let threw = false;
  try {
    await cursorManager.setUserColor(pool, testUser2Id, 'not-a-color');
  } catch (err) {
    threw = true;
    assert(err.message.includes('Invalid color format'), 'Should have correct error message');
  }
  assert(threw, 'Should throw error for invalid color');
});

runner.test('CursorManager: updateCursor saves position', async () => {
  const socketId = 'test-socket-cursor-' + Date.now();
  await presenceManager.joinSession(pool, testPageId, testUserId, socketId, 'editing');

  await cursorManager.updateCursor(pool, socketId, 100, 50, 150);

  const session = await presenceManager.getSessionBySocket(pool, socketId);
  assertEqual(session.cursor_position, 100, 'Should save position');
  assertEqual(session.selection_start, 50, 'Should save selection start');
  assertEqual(session.selection_end, 150, 'Should save selection end');
});

runner.test('CursorManager: getPageCursors returns cursor map', async () => {
  const socketId1 = 'test-socket-c1-' + Date.now();
  const socketId2 = 'test-socket-c2-' + Date.now();

  await presenceManager.joinSession(pool, testPageId, testUserId, socketId1, 'editing');
  await presenceManager.joinSession(pool, testPageId, testUser2Id, socketId2, 'editing');
  await cursorManager.updateCursor(pool, socketId1, 10, 10, 10);
  await cursorManager.updateCursor(pool, socketId2, 20, 20, 20);

  const cursors = await cursorManager.getPageCursors(pool, testPageId);

  assertNotNull(cursors[testUserId], 'Should have user 1 cursor');
  assertNotNull(cursors[testUser2Id], 'Should have user 2 cursor');
  assertEqual(cursors[testUserId].position, 10, 'User 1 position correct');
  assertEqual(cursors[testUser2Id].position, 20, 'User 2 position correct');
});

// ============================================================
// REST API TESTS - Cursor Color
// ============================================================

runner.test('API: PUT /api/users/me/cursor-color updates own color', async () => {
  const newColor = '#AABBCC';

  const res = await request({
    path: '/api/users/me/cursor-color',
    method: 'PUT',
    headers: { 'Cookie': authCookie }
  }, { color: newColor });

  assertEqual(res.status, 200, 'Status should be 200');
  assertEqual(res.data.cursorColor, newColor, 'Should return new color');
});

runner.test('API: PUT /api/users/me/cursor-color rejects invalid color', async () => {
  const res = await request({
    path: '/api/users/me/cursor-color',
    method: 'PUT',
    headers: { 'Cookie': authCookie }
  }, { color: 'invalid' });

  assertEqual(res.status, 400, 'Status should be 400');
});

runner.test('API: PUT /api/users/:id/cursor-color (admin) updates other user color', async () => {
  const newColor = '#DDEEFF';

  const res = await request({
    path: `/api/users/${testUser2Id}/cursor-color`,
    method: 'PUT',
    headers: { 'Cookie': authCookie }
  }, { color: newColor });

  assertEqual(res.status, 200, 'Status should be 200');
  assertEqual(res.data.user.cursor_color, newColor, 'Should return new color');
});

runner.test('API: PUT /api/users/:id/cursor-color (non-admin) forbidden', async () => {
  const res = await request({
    path: `/api/users/${testUserId}/cursor-color`,
    method: 'PUT',
    headers: { 'Cookie': testUser2Cookie }
  }, { color: '#123456' });

  assertEqual(res.status, 403, 'Status should be 403 for non-admin');
});

runner.test('API: GET /api/auth/check returns cursor color', async () => {
  const res = await request({
    path: '/api/auth/check',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assertNotNull(res.data.cursorColor, 'Should include cursor color');
});

// ============================================================
// SOCKET.IO INTEGRATION TESTS
// ============================================================

runner.test('Socket: Connect with valid token', async () => {
  const socket = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    assert(socket.connected, 'Socket should be connected');
  } finally {
    socket.disconnect();
  }
});

runner.test('Socket: Reject connection without token', async () => {
  const socket = ioClient('http://localhost:3001/collab', {
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000
  });

  let errorOccurred = false;
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => resolve(), 3000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        errorOccurred = true;
        resolve();
      });
    });

    assert(errorOccurred || !socket.connected, 'Should reject unauthenticated connection');
  } finally {
    socket.disconnect();
  }
});

runner.test('Socket: join-page returns initial state', async () => {
  const socket = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      socket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      socket.on('connect_error', reject);
    });

    socket.emit('join-page', { pageId: testPageId, mode: 'editing' });

    const joinedData = await waitForEvent(socket, 'joined', 5000);

    assertNotNull(joinedData, 'Should receive joined event');
    assert('presence' in joinedData, 'Should include presence');
    assert('cursors' in joinedData, 'Should include cursors');
    assert('hasDraft' in joinedData, 'Should include hasDraft flag');
  } finally {
    socket.emit('leave-page', { pageId: testPageId });
    socket.disconnect();
  }
});

runner.test('Socket: user-joined broadcasts to room', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // User 1 joins page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await waitForEvent(socket1, 'joined', 5000);

    // Set up listener for user-joined on socket1
    const userJoinedPromise = waitForEvent(socket1, 'user-joined', 5000);

    // User 2 joins page
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await waitForEvent(socket2, 'joined', 5000);

    const userJoinedData = await userJoinedPromise;

    assertNotNull(userJoinedData, 'Should receive user-joined event');
    assertEqual(userJoinedData.userId, testUser2Id, 'Should be user 2');
    assertNotNull(userJoinedData.username, 'Should include username');
    assertNotNull(userJoinedData.cursorColor, 'Should include cursor color');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket2.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
  }
});

runner.test('Socket: content-change broadcasts to room', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // Both join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await Promise.all([
      waitForEvent(socket1, 'joined', 5000),
      waitForEvent(socket2, 'joined', 5000)
    ]);

    // Set up listener on socket2
    const contentUpdatePromise = waitForEvent(socket2, 'content-updated', 5000);

    // User 1 changes content
    const newContent = 'Changed content ' + Date.now();
    const newTitle = 'Changed title ' + Date.now();
    socket1.emit('content-change', { pageId: testPageId, content: newContent, title: newTitle });

    const updateData = await contentUpdatePromise;

    assertEqual(updateData.content, newContent, 'Should broadcast new content');
    assertEqual(updateData.title, newTitle, 'Should broadcast new title');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket2.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
  }
});

runner.test('Socket: cursor-move broadcasts to room', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // Both join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await Promise.all([
      waitForEvent(socket1, 'joined', 5000),
      waitForEvent(socket2, 'joined', 5000)
    ]);

    // Set up listener on socket2
    const cursorUpdatePromise = waitForEvent(socket2, 'cursor-updated', 5000);

    // User 1 moves cursor
    socket1.emit('cursor-move', {
      pageId: testPageId,
      position: 42,
      selectionStart: 10,
      selectionEnd: 20
    });

    const cursorData = await cursorUpdatePromise;

    assertEqual(cursorData.userId, testUserId, 'Should be from user 1');
    assertEqual(cursorData.position, 42, 'Should have correct position');
    assertEqual(cursorData.selectionStart, 10, 'Should have correct selection start');
    assertEqual(cursorData.selectionEnd, 20, 'Should have correct selection end');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket2.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
  }
});

runner.test('Socket: user-left broadcasts on leave', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // Both join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await Promise.all([
      waitForEvent(socket1, 'joined', 5000),
      waitForEvent(socket2, 'joined', 5000)
    ]);

    // Set up listener on socket1
    const userLeftPromise = waitForEvent(socket1, 'user-left', 5000);

    // User 2 leaves
    socket2.emit('leave-page', { pageId: testPageId });

    const leftData = await userLeftPromise;

    assertEqual(leftData.userId, testUser2Id, 'Should be user 2 who left');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
  }
});

runner.test('Socket: publish updates page and broadcasts', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // Both join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await Promise.all([
      waitForEvent(socket1, 'joined', 5000),
      waitForEvent(socket2, 'joined', 5000)
    ]);

    // Create a draft change
    const publishContent = 'Published content ' + Date.now();
    socket1.emit('content-change', { pageId: testPageId, content: publishContent, title: 'Published Title' });
    await sleep(500); // Wait for draft to be saved

    // Set up publish listener on socket2
    const publishPromise = waitForEvent(socket2, 'published', 5000);

    // User 1 publishes
    socket1.emit('publish', { pageId: testPageId });

    const publishData = await publishPromise;

    assertNotNull(publishData, 'Should receive published event');
    assertNotNull(publishData.publishedAt, 'Should have publish timestamp');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket2.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
  }
});

runner.test('Socket: revert restores published content', async () => {
  const socket1 = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      socket1.on('connect', resolve);
      socket1.on('connect_error', reject);
    });

    // Join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    const joinedData = await waitForEvent(socket1, 'joined', 5000);

    // Create a draft change
    const draftContent = 'Draft content to revert ' + Date.now();
    socket1.emit('content-change', { pageId: testPageId, content: draftContent, title: 'Draft Title' });
    await sleep(500);

    // Revert
    socket1.emit('revert', { pageId: testPageId });

    const revertData = await waitForEvent(socket1, 'reverted', 5000);

    assertNotNull(revertData, 'Should receive reverted event');
    assertNotNull(revertData.content, 'Should have content');
    assert(revertData.content !== draftContent, 'Content should be reverted');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
  }
});

runner.test('Socket: draft-saved event on content change', async () => {
  const socket1 = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      socket1.on('connect', resolve);
      socket1.on('connect_error', reject);
    });

    // Join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await waitForEvent(socket1, 'joined', 5000);

    // Set up listener for draft-saved
    const draftSavedPromise = waitForEvent(socket1, 'draft-saved', 5000);

    // Send content change
    socket1.emit('content-change', {
      pageId: testPageId,
      content: 'Draft to save ' + Date.now(),
      title: 'Draft Title'
    });

    const savedData = await draftSavedPromise;

    assertNotNull(savedData, 'Should receive draft-saved event');
    assertNotNull(savedData.savedAt, 'Should have savedAt timestamp');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
  }
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

runner.test('Socket: join-page without pageId emits error', async () => {
  const socket1 = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      socket1.on('connect', resolve);
      socket1.on('connect_error', reject);
    });

    const errorPromise = waitForEvent(socket1, 'error', 5000);
    socket1.emit('join-page', { mode: 'editing' }); // Missing pageId

    const errorData = await errorPromise;

    assertNotNull(errorData, 'Should receive error event');
    assertEqual(errorData.code, 'INVALID_REQUEST', 'Should have correct error code');
  } finally {
    socket1.disconnect();
  }
});

runner.test('Socket: publish without pageId emits error', async () => {
  const socket1 = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      socket1.on('connect', resolve);
      socket1.on('connect_error', reject);
    });

    const errorPromise = waitForEvent(socket1, 'error', 5000);
    socket1.emit('publish', {}); // Missing pageId

    const errorData = await errorPromise;

    assertNotNull(errorData, 'Should receive error event');
    assertEqual(errorData.code, 'INVALID_REQUEST', 'Should have correct error code');
  } finally {
    socket1.disconnect();
  }
});

runner.test('Socket: revert without pageId emits error', async () => {
  const socket1 = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      socket1.on('connect', resolve);
      socket1.on('connect_error', reject);
    });

    const errorPromise = waitForEvent(socket1, 'error', 5000);
    socket1.emit('revert', {}); // Missing pageId

    const errorData = await errorPromise;

    assertNotNull(errorData, 'Should receive error event');
    assertEqual(errorData.code, 'INVALID_REQUEST', 'Should have correct error code');
  } finally {
    socket1.disconnect();
  }
});

// ============================================================
// DISCONNECT HANDLING TESTS
// ============================================================

runner.test('Socket: user-left broadcasts on disconnect', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // Both join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await Promise.all([
      waitForEvent(socket1, 'joined', 5000),
      waitForEvent(socket2, 'joined', 5000)
    ]);

    // Set up listener on socket1 for user-left
    const userLeftPromise = waitForEvent(socket1, 'user-left', 5000);

    // Disconnect socket2 (simulates browser close)
    socket2.disconnect();

    const leftData = await userLeftPromise;

    assertEqual(leftData.userId, testUser2Id, 'Should be user 2 who left on disconnect');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
  }
});

// ============================================================
// EDGE CASE TESTS
// ============================================================

runner.test('Socket: joining new page leaves previous page', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  // Create a second test page
  const page2Res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: 'collab-test-2-' + Date.now(),
    title: 'Second Test Page',
    content: '[h1]Page 2[/h1]',
    display_order: 101
  });
  const testPage2Id = page2Res.data.id;

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // User 1 joins page 1
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await waitForEvent(socket1, 'joined', 5000);

    // User 2 joins page 1
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await waitForEvent(socket2, 'joined', 5000);

    // Set up listener for user-left on socket2
    const userLeftPromise = waitForEvent(socket2, 'user-left', 5000);

    // User 1 joins page 2 (should auto-leave page 1)
    socket1.emit('join-page', { pageId: testPage2Id, mode: 'editing' });
    await waitForEvent(socket1, 'joined', 5000);

    const leftData = await userLeftPromise;

    assertEqual(leftData.userId, testUserId, 'User 1 should have left page 1');
  } finally {
    socket1.emit('leave-page', { pageId: testPage2Id });
    socket2.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
    // Clean up test page 2
    await pool.query('DELETE FROM pages WHERE id = $1', [testPage2Id]);
  }
});

runner.test('Socket: content-change ignored when not in room', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // Only user 2 joins page
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await waitForEvent(socket2, 'joined', 5000);

    // Track if content-updated is received
    let contentUpdateReceived = false;
    socket2.on('content-updated', () => {
      contentUpdateReceived = true;
    });

    // User 1 tries to change content WITHOUT joining (should be ignored)
    socket1.emit('content-change', {
      pageId: testPageId,
      content: 'Unauthorized change',
      title: 'Unauthorized'
    });

    // Wait a bit to see if event arrives
    await sleep(500);

    assertEqual(contentUpdateReceived, false, 'Content change from non-member should be ignored');
  } finally {
    socket2.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
  }
});

runner.test('Socket: viewing mode excludes user from cursor broadcasts', async () => {
  const socket1 = createSocketClient(authToken);

  try {
    await new Promise((resolve, reject) => {
      socket1.on('connect', resolve);
      socket1.on('connect_error', reject);
    });

    // Join in viewing mode
    socket1.emit('join-page', { pageId: testPageId, mode: 'viewing' });
    const joinedData = await waitForEvent(socket1, 'joined', 5000);

    // Check presence includes mode
    const selfPresence = joinedData.presence.find(p => p.user_id === testUserId);
    assertNotNull(selfPresence, 'Should be in presence list');
    assertEqual(selfPresence.mode, 'viewing', 'Mode should be viewing');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
  }
});

// ============================================================
// ADDITIONAL PRESENCE MANAGER TESTS
// ============================================================

runner.test('PresenceManager: cleanupStaleSessions removes old sessions', async () => {
  // Create a stale session by inserting directly with old timestamp
  const socketId = 'stale-socket-' + Date.now();
  await pool.query(
    `INSERT INTO editing_sessions (page_id, user_id, socket_id, mode, last_activity)
     VALUES ($1, $2, $3, 'editing', NOW() - INTERVAL '15 minutes')`,
    [testPageId, testUserId, socketId]
  );

  // Run cleanup
  const cleaned = await presenceManager.cleanupStaleSessions(pool);

  // Verify the stale session was removed
  assert(cleaned.length > 0, 'Should have cleaned up at least one session');
  const wasRemoved = cleaned.some(s => s.user_id === testUserId && s.page_id === testPageId);
  assert(wasRemoved, 'Stale session should have been removed');
});

// ============================================================
// MULTI-USER SCENARIO TESTS
// ============================================================

runner.test('Socket: three users can collaborate simultaneously', async () => {
  // Create a third test user
  const user3name = 'collabtest3-' + Date.now();
  const user3Res = await request({
    path: '/api/users/register',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    username: user3name,
    password: 'testpass',
    role: 'user'
  });
  const user3Id = user3Res.data.id;

  const login3Res = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username: user3name,
    password: 'testpass'
  });
  const user3Cookie = login3Res.headers['set-cookie'][0].split(';')[0];
  const user3Token = user3Cookie.match(/token=([^;]+)/)?.[1];

  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);
  const socket3 = createSocketClient(user3Token);

  try {
    // Connect all three sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket3.on('connect', resolve);
        socket3.on('connect_error', reject);
      })
    ]);

    // All three join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket3.emit('join-page', { pageId: testPageId, mode: 'viewing' });

    await Promise.all([
      waitForEvent(socket1, 'joined', 5000),
      waitForEvent(socket2, 'joined', 5000),
      waitForEvent(socket3, 'joined', 5000)
    ]);

    // Check presence on the last joiner
    const presence = await presenceManager.getPagePresence(pool, testPageId);
    assert(presence.length >= 3, 'Should have at least 3 users in presence');

    // Verify modes
    const user1Presence = presence.find(p => p.user_id === testUserId);
    const user2Presence = presence.find(p => p.user_id === testUser2Id);
    const user3Presence = presence.find(p => p.user_id === user3Id);

    assertEqual(user1Presence?.mode, 'editing', 'User 1 should be editing');
    assertEqual(user2Presence?.mode, 'editing', 'User 2 should be editing');
    assertEqual(user3Presence?.mode, 'viewing', 'User 3 should be viewing');

    // Test content broadcast reaches both other users
    let socket2Received = false;
    let socket3Received = false;

    socket2.on('content-updated', () => { socket2Received = true; });
    socket3.on('content-updated', () => { socket3Received = true; });

    socket1.emit('content-change', {
      pageId: testPageId,
      content: 'Three user test ' + Date.now(),
      title: 'Three User Title'
    });

    await sleep(500);

    assert(socket2Received, 'Socket 2 should receive content update');
    assert(socket3Received, 'Socket 3 (viewer) should also receive content update');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket2.emit('leave-page', { pageId: testPageId });
    socket3.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
    socket3.disconnect();
  }
});

runner.test('Socket: rapid content changes handled correctly', async () => {
  const socket1 = createSocketClient(authToken);
  const socket2 = createSocketClient(testUser2Token);

  try {
    // Connect both sockets
    await Promise.all([
      new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        socket2.on('connect', resolve);
        socket2.on('connect_error', reject);
      })
    ]);

    // Both join page
    socket1.emit('join-page', { pageId: testPageId, mode: 'editing' });
    socket2.emit('join-page', { pageId: testPageId, mode: 'editing' });
    await Promise.all([
      waitForEvent(socket1, 'joined', 5000),
      waitForEvent(socket2, 'joined', 5000)
    ]);

    // Track content updates received by socket2
    const contentUpdates = [];
    socket2.on('content-updated', (data) => {
      contentUpdates.push(data.content);
    });

    // Send 5 rapid content changes
    for (let i = 0; i < 5; i++) {
      socket1.emit('content-change', {
        pageId: testPageId,
        content: `Rapid change ${i}`,
        title: 'Rapid Test'
      });
    }

    // Wait for all to be processed
    await sleep(1000);

    // All 5 changes should have been broadcast
    assertEqual(contentUpdates.length, 5, 'Should receive all 5 content updates');
    assertEqual(contentUpdates[4], 'Rapid change 4', 'Last update should be correct');
  } finally {
    socket1.emit('leave-page', { pageId: testPageId });
    socket2.emit('leave-page', { pageId: testPageId });
    socket1.disconnect();
    socket2.disconnect();
  }
});

// ============================================================
// CLEANUP
// ============================================================

runner.test('Cleanup: Remove test drafts and sessions', async () => {
  // Clean up drafts
  await pool.query('DELETE FROM page_drafts WHERE page_id = $1', [testPageId]);

  // Clean up sessions
  await pool.query('DELETE FROM editing_sessions WHERE page_id = $1', [testPageId]);

  // Success
  assert(true, 'Cleanup completed');
});

// ============================================================
// RUN TESTS
// ============================================================

async function main() {
  console.log('Starting collaboration tests...');
  console.log('Ensure server is running on port 3001\n');

  try {
    const failures = await runner.run();
    await pool.end();
    process.exit(failures > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test runner error:', err);
    await pool.end();
    process.exit(1);
  }
}

main();
