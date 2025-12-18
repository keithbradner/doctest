/**
 * Revert Feature Tests for BBCode Wiki
 *
 * Run with: node tests/revert.test.js
 *
 * Prerequisites:
 * - Database should be seeded (npm run seed)
 * - Server should be running on port 3001 (npm run server)
 */

const http = require('http');

// Simple test framework
class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('\n🧪 Running Revert Feature Tests...\n');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        console.log(`✅ ${test.name}`);
      } catch (err) {
        this.failed++;
        console.log(`❌ ${test.name}`);
        console.log(`   Error: ${err.message}\n`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`Total: ${this.tests.length} | Passed: ${this.passed} | Failed: ${this.failed}`);
    console.log('='.repeat(50) + '\n');

    process.exit(this.failed > 0 ? 1 : 0);
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

    req.on('error', (err) => {
      reject(new Error(`Connection failed: ${err.message}. Make sure the server is running on port 3001.`));
    });

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

// Run tests
const runner = new TestRunner();
let authCookie = '';
let userCookie = '';
const testPageSlug = 'test-revert-page-' + Date.now();
let historyEntries = [];

// Test 1: Login as admin
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
  authCookie = res.headers['set-cookie'][0].split(';')[0];
});

// Test 2: Create a test page
runner.test('Setup: Create a test page', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: testPageSlug,
    title: 'Original Title',
    content: '[h1]Version 1[/h1]\nOriginal content.',
    display_order: 999
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.id, 'Should return page with ID');
});

// Test 3: First update to create history
runner.test('Setup: First update to create history entry', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'PUT',
    headers: { 'Cookie': authCookie }
  }, {
    title: 'Updated Title v2',
    content: '[h1]Version 2[/h1]\nSecond version content.',
    display_order: 999,
    is_expanded: false
  });

  assertEqual(res.status, 200, 'Status should be 200');
});

// Test 4: Second update to create another history entry
runner.test('Setup: Second update to create another history entry', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'PUT',
    headers: { 'Cookie': authCookie }
  }, {
    title: 'Updated Title v3',
    content: '[h1]Version 3[/h1]\nThird version content.',
    display_order: 999,
    is_expanded: false
  });

  assertEqual(res.status, 200, 'Status should be 200');
});

// Test 5: Get history entries
runner.test('Verify: History has multiple entries', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');
  assert(res.data.length >= 2, 'Should have at least 2 history entries');
  historyEntries = res.data;
});

// Test 6: Verify current page content
runner.test('Verify: Current page has latest content', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assertEqual(res.data.title, 'Updated Title v3', 'Should have v3 title');
  assert(res.data.content.includes('Version 3'), 'Should have v3 content');
});

// Test 7: Revert to an older version
runner.test('POST /api/pages/:slug/revert/:historyId - should revert to older version', async () => {
  // Get the oldest history entry (last in array since sorted by created_at DESC)
  const oldestEntry = historyEntries[historyEntries.length - 1];

  const res = await request({
    path: `/api/pages/${testPageSlug}/revert/${oldestEntry.id}`,
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.title, 'Should return updated page');
});

// Test 8: Verify page was reverted
runner.test('Verify: Page content was reverted', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  // Should have the content from the oldest history entry
  const oldestEntry = historyEntries[historyEntries.length - 1];
  assertEqual(res.data.title, oldestEntry.title, 'Title should match reverted version');
  assertEqual(res.data.content, oldestEntry.content, 'Content should match reverted version');
});

// Test 9: Verify revert created a new history entry with action_type='revert'
runner.test('Verify: Revert action recorded in history with action_type', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.length > historyEntries.length, 'Should have more history entries after revert');

  // The newest entry (first in array) should be the revert
  const newestEntry = res.data[0];
  assertEqual(newestEntry.action_type, 'revert', 'Newest entry should have action_type=revert');
});

// Test 10: Verify admin analytics includes action_type
runner.test('Verify: Admin recent-edits includes action_type', async () => {
  const res = await request({
    path: '/api/admin/analytics/recent-edits',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');

  // Find our revert entry
  const revertEntry = res.data.find(e =>
    e.slug === testPageSlug && e.action_type === 'revert'
  );
  assert(revertEntry, 'Should find revert entry in admin analytics');
});

// Test 11: Test reverting to non-existent history entry
runner.test('POST /api/pages/:slug/revert/:historyId - should fail for invalid history ID', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}/revert/999999`,
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 404, 'Status should be 404');
});

// Test 12: Test reverting wrong page's history entry
runner.test('POST /api/pages/:slug/revert/:historyId - should fail for mismatched page', async () => {
  // Try to use welcome page's history entry on our test page
  const welcomeHistoryRes = await request({
    path: '/api/pages/welcome/history',
    method: 'GET'
  });

  if (welcomeHistoryRes.data && welcomeHistoryRes.data.length > 0) {
    const welcomeHistoryId = welcomeHistoryRes.data[0].id;

    const res = await request({
      path: `/api/pages/${testPageSlug}/revert/${welcomeHistoryId}`,
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assertEqual(res.status, 404, 'Status should be 404 for mismatched page/history');
  }
});

// Test 13: Create regular user for security test
runner.test('Setup: Create regular user', async () => {
  const username = 'revert-test-user-' + Date.now();
  let res = await request({
    path: '/api/users/register',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    username: username,
    password: 'testpass',
    role: 'user'
  });

  assertEqual(res.status, 200, 'User creation should succeed');

  // Login as regular user
  res = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username: username,
    password: 'testpass'
  });

  assertEqual(res.status, 200, 'Login should succeed');
  userCookie = res.headers['set-cookie'][0].split(';')[0];
});

// Test 14: Regular user CAN revert (it's a normal edit operation)
runner.test('Security: Regular user can revert pages', async () => {
  // Get current history
  const historyRes = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  const historyEntry = historyRes.data[1]; // Get second entry

  const res = await request({
    path: `/api/pages/${testPageSlug}/revert/${historyEntry.id}`,
    method: 'POST',
    headers: { 'Cookie': userCookie }
  });

  assertEqual(res.status, 200, 'Regular users should be able to revert');
});

// Test 15: Unauthenticated user cannot revert
runner.test('Security: Unauthenticated user cannot revert', async () => {
  const historyRes = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  const historyEntry = historyRes.data[0];

  const res = await request({
    path: `/api/pages/${testPageSlug}/revert/${historyEntry.id}`,
    method: 'POST'
    // No cookie
  });

  assertEqual(res.status, 401, 'Status should be 401 for unauthenticated user');
});

// Test 16: Revert preserves the diff in history
runner.test('Verify: Revert history entry has diff', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  const revertEntries = res.data.filter(e => e.action_type === 'revert');
  assert(revertEntries.length > 0, 'Should have revert entries');

  const revertEntry = revertEntries[0];
  assert(revertEntry.diff !== null && revertEntry.diff !== undefined, 'Revert entry should have diff');
  assert(revertEntry.diffParsed, 'Revert entry should have parsed diff');
});

// Test 17: Multiple consecutive reverts work correctly
runner.test('Verify: Multiple reverts work correctly', async () => {
  // Re-login as admin first to ensure we have valid auth
  let loginRes = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username: 'admin',
    password: 'admin'
  });
  if (loginRes.headers['set-cookie']) {
    authCookie = loginRes.headers['set-cookie'][0].split(';')[0];
  }

  // Get history
  let historyRes = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  // Revert to a version (pick one that exists)
  const targetEntry = historyRes.data[Math.min(2, historyRes.data.length - 1)];
  let res = await request({
    path: `/api/pages/${testPageSlug}/revert/${targetEntry.id}`,
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'First revert should succeed');

  // Get updated history
  historyRes = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  // Revert to another version
  const anotherEntry = historyRes.data[Math.min(3, historyRes.data.length - 1)];
  res = await request({
    path: `/api/pages/${testPageSlug}/revert/${anotherEntry.id}`,
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'Second revert should succeed');

  // Verify content matches the second reverted version
  const pageRes = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(pageRes.data.content, anotherEntry.content, 'Content should match second reverted version');
});

// Test 18: Cleanup - delete test page
runner.test('Cleanup: Delete test page', async () => {
  // Re-login as admin for cleanup
  let res = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username: 'admin',
    password: 'admin'
  });
  if (res.headers['set-cookie']) {
    authCookie = res.headers['set-cookie'][0].split(';')[0];
  }

  // Soft delete
  res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'Soft delete should succeed');

  // Permanent delete
  res = await request({
    path: `/api/admin/pages/${testPageSlug}/permanent`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'Permanent delete should succeed');
});

// Run all tests
runner.run().catch(console.error);
