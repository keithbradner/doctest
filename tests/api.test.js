/**
 * API Tests for BBCode Wiki
 *
 * Run with: node tests/api.test.js
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
    console.log('\n🧪 Running API Tests...\n');

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

// Run tests
const runner = new TestRunner();
let authCookie = '';

// Test 1: Login
runner.test('POST /api/login - should login with admin credentials', async () => {
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

  // Store cookie for subsequent requests
  authCookie = res.headers['set-cookie'][0].split(';')[0];
});

// Test 2: Auth check
runner.test('GET /api/auth/check - should return authenticated user', async () => {
  const res = await request({
    path: '/api/auth/check',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.authenticated, 'Should be authenticated');
  assertEqual(res.data.username, 'admin', 'Username should be admin');
  assertEqual(res.data.role, 'admin', 'Role should be admin');
});

// Test 3: Get all pages
runner.test('GET /api/pages - should return list of pages', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');
  assert(res.data.length > 0, 'Should have at least one page');
});

// Test 4: Get single page
runner.test('GET /api/pages/welcome - should return welcome page', async () => {
  const res = await request({
    path: '/api/pages/welcome',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.slug === 'welcome', 'Slug should be welcome');
  assert(res.data.html, 'Should have rendered HTML');
});

// Test 5: Create page
runner.test('POST /api/pages - should create a new page', async () => {
  const res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: 'test-page-' + Date.now(),
    title: 'Test Page',
    content: '[h1]Test[/h1]',
    display_order: 10
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.id, 'Should return page with ID');
});

// Test 6: Admin analytics - views
runner.test('GET /api/admin/analytics/views - should return view stats', async () => {
  const res = await request({
    path: '/api/admin/analytics/views',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');
});

// Test 7: Admin analytics - edits
runner.test('GET /api/admin/analytics/edits - should return edit stats', async () => {
  const res = await request({
    path: '/api/admin/analytics/edits',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');
});

// Test 8: Get users (admin only)
runner.test('GET /api/users - should return list of users', async () => {
  const res = await request({
    path: '/api/users',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');
  assert(res.data.length > 0, 'Should have at least one user');
});

// Test 9: Create user (admin only)
runner.test('POST /api/users/register - should create a new user', async () => {
  const res = await request({
    path: '/api/users/register',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    username: 'testuser-' + Date.now(),
    password: 'testpass',
    role: 'user'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.id, 'Should return user with ID');
});

// Test 10: Logout
runner.test('POST /api/logout - should logout user', async () => {
  const res = await request({
    path: '/api/logout',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.success, 'Should succeed');
});

// Test 11: Auth check after logout
runner.test('GET /api/auth/check - should fail after logout', async () => {
  const res = await request({
    path: '/api/auth/check',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 401, 'Status should be 401');
});

// Run all tests
runner.run().catch(console.error);
