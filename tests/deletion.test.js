/**
 * Deletion Feature Tests for BBCode Wiki
 *
 * Run with: node tests/deletion.test.js
 *
 * Prerequisites:
 * - Database should be seeded
 * - Server should be running on port 3001
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
    console.log('\n🧪 Running Deletion Feature Tests...\n');

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
let testPageSlug = 'test-deletion-page-' + Date.now();
let testPageId = null;

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
runner.test('Setup: Create a test page for deletion', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: testPageSlug,
    title: 'Test Deletion Page',
    content: '[h1]Test Content[/h1]\nThis page will be deleted.',
    display_order: 999
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.id, 'Should return page with ID');
  testPageId = res.data.id;
});

// Test 3: Update the page to create history
runner.test('Setup: Update page to create history', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'PUT',
    headers: { 'Cookie': authCookie }
  }, {
    title: 'Test Deletion Page',
    content: '[h1]Updated Content[/h1]\nThis is updated content.',
    display_order: 999,
    is_expanded: false
  });

  assertEqual(res.status, 200, 'Status should be 200');
});

// Test 4: Verify page appears in listings
runner.test('Verify: Page appears in pages list before deletion', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  const foundPage = res.data.find(p => p.slug === testPageSlug);
  assert(foundPage, 'Page should be in the list');
});

// Test 5: Soft delete the page
runner.test('DELETE /api/pages/:slug - should soft delete the page', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.success, 'Deletion should succeed');
});

// Test 6: Verify deleted page doesn't appear in regular listings
runner.test('Verify: Deleted page does not appear in pages list', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  const foundPage = res.data.find(p => p.slug === testPageSlug);
  assert(!foundPage, 'Deleted page should not be in the list');
});

// Test 7: Verify deleted page returns 404 when accessed
runner.test('Verify: Accessing deleted page returns 404', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 404, 'Status should be 404');
});

// Test 8: Get deleted pages (admin only)
runner.test('GET /api/admin/deleted-pages - should return deleted pages', async () => {
  const res = await request({
    path: '/api/admin/deleted-pages',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');
  const foundPage = res.data.find(p => p.slug === testPageSlug);
  assert(foundPage, 'Deleted page should be in the deleted pages list');
  assert(foundPage.deleted_at, 'Should have deleted_at timestamp');
});

// Test 9: Restore deleted page
runner.test('POST /api/admin/pages/:slug/restore - should restore deleted page', async () => {
  const res = await request({
    path: `/api/admin/pages/${testPageSlug}/restore`,
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.success, 'Restore should succeed');
});

// Test 10: Verify restored page appears in listings
runner.test('Verify: Restored page appears in pages list', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  const foundPage = res.data.find(p => p.slug === testPageSlug);
  assert(foundPage, 'Restored page should be in the list');
});

// Test 11: Verify restored page can be accessed
runner.test('Verify: Restored page can be accessed', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.content, 'Should have content');
});

// Test 12: Verify history is preserved
runner.test('Verify: Page history is preserved after restore', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}/history`,
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');
  assert(res.data.length > 0, 'Should have history entries');
});

// Test 13: Delete page again for permanent deletion test
runner.test('Setup: Delete page again for permanent deletion test', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
});

// Test 14: Permanently delete the page
runner.test('DELETE /api/admin/pages/:slug/permanent - should permanently delete', async () => {
  const res = await request({
    path: `/api/admin/pages/${testPageSlug}/permanent`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.success, 'Permanent deletion should succeed');
});

// Test 15: Verify permanently deleted page doesn't appear anywhere
runner.test('Verify: Permanently deleted page not in deleted pages list', async () => {
  const res = await request({
    path: '/api/admin/deleted-pages',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  const foundPage = res.data.find(p => p.slug === testPageSlug);
  assert(!foundPage, 'Permanently deleted page should not be in deleted pages list');
});

// Test 16: Test creating page with same slug as deleted page
const testPageSlug2 = 'test-recreation-page-' + Date.now();
runner.test('Setup: Create and delete a page for recreation test', async () => {
  // Create
  let res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: testPageSlug2,
    title: 'Original Page',
    content: '[h1]Original Content[/h1]',
    display_order: 999
  });
  assertEqual(res.status, 200, 'Create should succeed');

  // Delete
  res = await request({
    path: `/api/pages/${testPageSlug2}`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'Delete should succeed');
});

// Test 17: Recreate page with same slug should restore and update
runner.test('POST /api/pages - recreating deleted page should restore it', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: testPageSlug2,
    title: 'Recreated Page',
    content: '[h1]New Content[/h1]',
    display_order: 998
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assertEqual(res.data.slug, testPageSlug2, 'Should have same slug');
  assertEqual(res.data.title, 'Recreated Page', 'Should have new title');
});

// Test 18: Verify recreated page is no longer in deleted list
runner.test('Verify: Recreated page removed from deleted pages list', async () => {
  const res = await request({
    path: '/api/admin/deleted-pages',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  const foundPage = res.data.find(p => p.slug === testPageSlug2);
  assert(!foundPage, 'Recreated page should not be in deleted pages list');
});

// Test 19: Clean up - delete test page
runner.test('Cleanup: Delete recreated test page', async () => {
  const res = await request({
    path: `/api/admin/pages/${testPageSlug2}/permanent`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
});

// Test 20: Test non-admin cannot access deleted pages
runner.test('Security: Non-admin cannot access deleted pages endpoint', async () => {
  // First, create a regular user
  const username = 'testuser-' + Date.now();
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

  // Logout admin
  await request({
    path: '/api/logout',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });

  // Login as regular user
  res = await request({
    path: '/api/login',
    method: 'POST'
  }, {
    username: username,
    password: 'testpass'
  });
  const userCookie = res.headers['set-cookie'][0].split(';')[0];

  // Try to access deleted pages
  res = await request({
    path: '/api/admin/deleted-pages',
    method: 'GET',
    headers: { 'Cookie': userCookie }
  });

  assertEqual(res.status, 403, 'Status should be 403 for non-admin');
});

// Run all tests
runner.run().catch(console.error);
