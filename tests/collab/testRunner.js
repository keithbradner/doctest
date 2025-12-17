/**
 * Test Runner and Helpers for Collaboration Tests
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

    return { passed: this.passed, failed: this.failed, skipped: this.skipped, total: this.tests.length };
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

module.exports = {
  pool,
  TestRunner,
  request,
  assert,
  assertEqual,
  assertNotNull,
  assertIncludes,
  assertMatch,
  createSocketClient,
  waitForEvent,
  sleep,
  ioClient
};
