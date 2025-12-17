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
 * - Cursor transformation (position adjustments)
 */

const {
  pool,
  TestRunner,
  request,
  assert,
  assertNotNull
} = require('./collab/testRunner');

const { registerManagerTests } = require('./collab/managers.test');
const { registerSocketTests } = require('./collab/socket.test');
const { registerTransformTests } = require('./collab/transform.test');

// ============================================================
// TEST CONTEXT
// ============================================================

const context = {
  authCookie: '',
  authToken: '',
  testUserId: null,
  testPageId: null,
  testUser2Cookie: '',
  testUser2Token: '',
  testUser2Id: null
};

// ============================================================
// MAIN TEST RUNNER
// ============================================================

const runner = new TestRunner();

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

  assert(res.status === 200, 'Status should be 200');
  assert(res.data.success, 'Login should succeed');
  assert(res.headers['set-cookie'], 'Should set cookie');

  context.authCookie = res.headers['set-cookie'][0].split(';')[0];
  const cookieMatch = context.authCookie.match(/token=([^;]+)/);
  if (cookieMatch) {
    context.authToken = cookieMatch[1];
  }

  const authRes = await request({
    path: '/api/auth/check',
    method: 'GET',
    headers: { 'Cookie': context.authCookie }
  });
  context.testUserId = authRes.data.userId;
  assertNotNull(context.testUserId, 'Should have user ID');
});

runner.test('Setup: Create or get test page', async () => {
  const res = await request({
    path: '/api/pages/welcome',
    method: 'GET',
    headers: { 'Cookie': context.authCookie }
  });

  if (res.status === 200) {
    context.testPageId = res.data.id;
  } else {
    const createRes = await request({
      path: '/api/pages',
      method: 'POST',
      headers: { 'Cookie': context.authCookie }
    }, {
      slug: 'collab-test-' + Date.now(),
      title: 'Collaboration Test Page',
      content: '[h1]Test Content[/h1]',
      display_order: 100
    });
    context.testPageId = createRes.data.id;
  }

  assertNotNull(context.testPageId, 'Should have test page ID');
});

runner.test('Setup: Create second test user', async () => {
  const username = 'collabtest-' + Date.now();

  const res = await request({
    path: '/api/users/register',
    method: 'POST',
    headers: { 'Cookie': context.authCookie }
  }, {
    username,
    password: 'testpass',
    role: 'user'
  });

  assert(res.status === 200, 'Status should be 200');
  context.testUser2Id = res.data.id;

  const loginRes = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username,
    password: 'testpass'
  });

  assert(loginRes.status === 200, 'User 2 login should succeed');
  context.testUser2Cookie = loginRes.headers['set-cookie'][0].split(';')[0];
  const cookieMatch = context.testUser2Cookie.match(/token=([^;]+)/);
  if (cookieMatch) {
    context.testUser2Token = cookieMatch[1];
  }
});

// ============================================================
// REGISTER ALL TEST SUITES
// ============================================================

registerManagerTests(runner, context);
registerSocketTests(runner, context);
registerTransformTests(runner);

// ============================================================
// CLEANUP
// ============================================================

runner.test('Cleanup: Remove test drafts and sessions', async () => {
  await pool.query('DELETE FROM page_drafts WHERE page_id = $1', [context.testPageId]);
  await pool.query('DELETE FROM editing_sessions WHERE page_id = $1', [context.testPageId]);
  assert(true, 'Cleanup completed');
});

// ============================================================
// RUN TESTS
// ============================================================

async function main() {
  console.log('Starting collaboration tests...');
  console.log('Ensure server is running on port 3001\n');

  console.log('\n' + '='.repeat(60));
  console.log('  COLLABORATION TESTS');
  console.log('='.repeat(60) + '\n');

  try {
    const results = await runner.run();

    console.log('\n' + '='.repeat(60));
    console.log(`Total: ${results.total} | Passed: ${results.passed} | Failed: ${results.failed} | Skipped: ${results.skipped}`);
    console.log('='.repeat(60) + '\n');

    await pool.end();
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test runner error:', err);
    await pool.end();
    process.exit(1);
  }
}

main();
