/**
 * Export Feature Tests for BBCode Wiki
 *
 * Run with: node tests/export.test.js
 *
 * Prerequisites:
 * - Database should be seeded (npm run seed)
 * - Server should be running on port 3001 (npm run server)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

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
    console.log('\n🧪 Running Export Feature Tests...\n');

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
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks);
        try {
          // Try to parse as JSON
          const result = {
            status: res.statusCode,
            headers: res.headers,
            data: JSON.parse(body.toString()),
            raw: body
          };
          resolve(result);
        } catch (err) {
          // Return raw buffer for binary data
          resolve({ status: res.statusCode, headers: res.headers, data: null, raw: body });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Connection failed: ${err.message}. Make sure the server is running on port 3001.`));
    });

    if (data) {
      if (Buffer.isBuffer(data)) {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }

    req.end();
  });
}

// Multipart form data helper for image upload
function uploadImage(authCookie, imageBuffer, filename, mimeType) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).substring(2);

    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="${filename}"\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`
    );

    const footer = Buffer.from(`\r\n--${boundary}--\r\n`);

    const body = Buffer.concat([header, imageBuffer, footer]);

    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: '/api/images',
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Cookie': authCookie
      }
    }, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(responseBody)
          });
        } catch (err) {
          resolve({ status: res.statusCode, data: responseBody });
        }
      });
    });

    req.on('error', reject);
    req.write(body);
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

// Create a simple test PNG image (1x1 red pixel)
function createTestPNG() {
  // Minimal valid PNG: 1x1 red pixel
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02,             // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00,       // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, // compressed data
    0x01, 0x01, 0x01, 0x00, // checksum
    0x18, 0xDD, 0x8D, 0xB4, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
}

// Run tests
const runner = new TestRunner();
let authCookie = '';
const testPageSlug = 'test-export-page-' + Date.now();
let uploadedImageId = null;
let uploadedImageId2 = null;

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

// Test 2: Upload first test image
runner.test('Setup: Upload first test image', async () => {
  const imageBuffer = createTestPNG();
  const res = await uploadImage(authCookie, imageBuffer, 'test-image-1.png', 'image/png');

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.success, 'Upload should succeed');
  assert(res.data.imageId, 'Should return image ID');
  uploadedImageId = res.data.imageId;
});

// Test 3: Upload second test image
runner.test('Setup: Upload second test image', async () => {
  const imageBuffer = createTestPNG();
  const res = await uploadImage(authCookie, imageBuffer, 'test-image-2.png', 'image/png');

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.success, 'Upload should succeed');
  assert(res.data.imageId, 'Should return image ID');
  uploadedImageId2 = res.data.imageId;
});

// Test 4: Create test page with image references
runner.test('Setup: Create test page with image references', async () => {
  const content = `[h1]Test Export Page[/h1]
This page has images for export testing.

[img]/api/images/${uploadedImageId}[/img]

Some text between images.

[img]/api/images/${uploadedImageId2}[/img]

End of page.`;

  const res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: testPageSlug,
    title: 'Test Export Page',
    content: content,
    display_order: 999
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.data.id, 'Should return page with ID');
});

// Test 5: GET /api/images returns image list
runner.test('GET /api/images - should return list of images', async () => {
  const res = await request({
    path: '/api/images',
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(Array.isArray(res.data), 'Should return array');

  // Find our uploaded images
  const img1 = res.data.find(img => img.id === uploadedImageId);
  const img2 = res.data.find(img => img.id === uploadedImageId2);

  assert(img1, 'Should find first uploaded image');
  assert(img2, 'Should find second uploaded image');

  // Verify metadata fields
  assert(img1.filename, 'Image should have filename');
  assert(img1.mime_type, 'Image should have mime_type');
  assertEqual(img1.mime_type, 'image/png', 'Mime type should be image/png');
});

// Test 6: GET /api/images requires authentication
runner.test('GET /api/images - should require authentication', async () => {
  const res = await request({
    path: '/api/images',
    method: 'GET'
    // No cookie
  });

  assertEqual(res.status, 401, 'Status should be 401 for unauthenticated request');
});

// Test 7: GET /api/images/:id returns image data
runner.test('GET /api/images/:id - should return image binary data', async () => {
  const res = await request({
    path: `/api/images/${uploadedImageId}`,
    method: 'GET'
  });

  assertEqual(res.status, 200, 'Status should be 200');
  assert(res.headers['content-type'].includes('image/png'), 'Content-Type should be image/png');
  assert(res.raw.length > 0, 'Should return image data');

  // Verify PNG signature
  assert(res.raw[0] === 0x89 && res.raw[1] === 0x50, 'Should be valid PNG data');
});

// Test 8: Verify page content contains correct image references
runner.test('Verify: Page content contains image references', async () => {
  const res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'GET',
    headers: { 'Cookie': authCookie }
  });

  assertEqual(res.status, 200, 'Status should be 200');

  const content = res.data.content;
  assert(content.includes(`[img]/api/images/${uploadedImageId}[/img]`), 'Should contain first image reference');
  assert(content.includes(`[img]/api/images/${uploadedImageId2}[/img]`), 'Should contain second image reference');
});

// Test 9: Verify export can find images in page content (simulate export logic)
runner.test('Verify: Export logic can extract image IDs from page content', async () => {
  const pagesRes = await request({
    path: '/api/pages',
    method: 'GET'
  });

  assertEqual(pagesRes.status, 200, 'Status should be 200');

  const testPage = pagesRes.data.find(p => p.slug === testPageSlug);
  assert(testPage, 'Should find test page');

  // Simulate the export regex logic
  const imageRefRegex = /\[img\]\/api\/images\/(\d+)\[\/img\]/gi;
  const foundImages = [];
  let match;

  while ((match = imageRefRegex.exec(testPage.content)) !== null) {
    foundImages.push(parseInt(match[1]));
  }

  assertEqual(foundImages.length, 2, 'Should find 2 image references');
  assert(foundImages.includes(uploadedImageId), 'Should find first image ID');
  assert(foundImages.includes(uploadedImageId2), 'Should find second image ID');
});

// Test 10: Create second page with shared image
runner.test('Setup: Create second page with shared image', async () => {
  const secondPageSlug = testPageSlug + '-second';
  const content = `[h1]Second Test Page[/h1]
This page shares an image with the first page.

[img]/api/images/${uploadedImageId}[/img]`;

  const res = await request({
    path: '/api/pages',
    method: 'POST',
    headers: { 'Cookie': authCookie }
  }, {
    slug: secondPageSlug,
    title: 'Second Test Page',
    content: content,
    display_order: 998
  });

  assertEqual(res.status, 200, 'Status should be 200');
});

// Test 11: Verify multiple pages can reference same image
runner.test('Verify: Multiple pages can reference same image', async () => {
  const pagesRes = await request({
    path: '/api/pages',
    method: 'GET'
  });

  const imageRefRegex = /\[img\]\/api\/images\/(\d+)\[\/img\]/gi;
  const pageImageMap = {};

  pagesRes.data.forEach(page => {
    const foundImages = new Set();
    let match;
    while ((match = imageRefRegex.exec(page.content)) !== null) {
      foundImages.add(parseInt(match[1]));
    }
    imageRefRegex.lastIndex = 0;

    if (foundImages.size > 0) {
      pageImageMap[page.slug] = Array.from(foundImages);
    }
  });

  // Both test pages should reference the first image
  assert(pageImageMap[testPageSlug], 'First page should have images');
  assert(pageImageMap[testPageSlug + '-second'], 'Second page should have images');

  assert(pageImageMap[testPageSlug].includes(uploadedImageId), 'First page should reference image 1');
  assert(pageImageMap[testPageSlug + '-second'].includes(uploadedImageId), 'Second page should also reference image 1');
});

// Test 12: GET /api/images/:id returns 404 for non-existent image
runner.test('GET /api/images/:id - should return 404 for non-existent image', async () => {
  const res = await request({
    path: '/api/images/999999',
    method: 'GET'
  });

  assertEqual(res.status, 404, 'Status should be 404');
});

// Test 13: Cleanup - delete test pages
runner.test('Cleanup: Delete test pages', async () => {
  // Delete first page
  let res = await request({
    path: `/api/pages/${testPageSlug}`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'First page soft delete should succeed');

  res = await request({
    path: `/api/admin/pages/${testPageSlug}/permanent`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'First page permanent delete should succeed');

  // Delete second page
  const secondPageSlug = testPageSlug + '-second';
  res = await request({
    path: `/api/pages/${secondPageSlug}`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'Second page soft delete should succeed');

  res = await request({
    path: `/api/admin/pages/${secondPageSlug}/permanent`,
    method: 'DELETE',
    headers: { 'Cookie': authCookie }
  });
  assertEqual(res.status, 200, 'Second page permanent delete should succeed');
});

// Run all tests
runner.run().catch(console.error);
