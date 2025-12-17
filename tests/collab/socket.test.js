/**
 * Socket.io Integration Tests
 */

const {
  pool,
  TestRunner,
  request,
  assert,
  assertEqual,
  assertNotNull,
  createSocketClient,
  waitForEvent,
  sleep,
  ioClient
} = require('./testRunner');

const { presenceManager } = require('../../server/collab/presenceManager');

function registerSocketTests(runner, context) {
  // ============================================================
  // SOCKET.IO INTEGRATION TESTS
  // ============================================================

  runner.test('Socket: Connect with valid token', async () => {
    const socket = createSocketClient(context.authToken);

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
    const socket = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        socket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.on('connect_error', reject);
      });

      socket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      const joinedData = await waitForEvent(socket, 'joined', 5000);

      assertNotNull(joinedData, 'Should receive joined event');
      assert('presence' in joinedData, 'Should include presence');
      assert('cursors' in joinedData, 'Should include cursors');
      assert('hasDraft' in joinedData, 'Should include hasDraft flag');
    } finally {
      socket.emit('leave-page', { pageId: context.testPageId });
      socket.disconnect();
    }
  });

  runner.test('Socket: user-joined broadcasts to room', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(socket1, 'joined', 5000);

      const userJoinedPromise = waitForEvent(socket1, 'user-joined', 5000);

      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(socket2, 'joined', 5000);

      const userJoinedData = await userJoinedPromise;

      assertNotNull(userJoinedData, 'Should receive user-joined event');
      assertEqual(userJoinedData.userId, context.testUser2Id, 'Should be user 2');
      assertNotNull(userJoinedData.username, 'Should include username');
      assertNotNull(userJoinedData.cursorColor, 'Should include cursor color');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });

  runner.test('Socket: content-change broadcasts to room', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000)
      ]);

      const contentUpdatePromise = waitForEvent(socket2, 'content-updated', 5000);

      const newContent = 'Changed content ' + Date.now();
      const newTitle = 'Changed title ' + Date.now();
      socket1.emit('content-change', { pageId: context.testPageId, content: newContent, title: newTitle });

      const updateData = await contentUpdatePromise;

      assertEqual(updateData.content, newContent, 'Should broadcast new content');
      assertEqual(updateData.title, newTitle, 'Should broadcast new title');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });

  runner.test('Socket: cursor-move broadcasts to room', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000)
      ]);

      const cursorUpdatePromise = waitForEvent(socket2, 'cursor-updated', 5000);

      socket1.emit('cursor-move', {
        pageId: context.testPageId,
        position: 42,
        selectionStart: 10,
        selectionEnd: 20
      });

      const cursorData = await cursorUpdatePromise;

      assertEqual(cursorData.userId, context.testUserId, 'Should be from user 1');
      assertEqual(cursorData.position, 42, 'Should have correct position');
      assertEqual(cursorData.selectionStart, 10, 'Should have correct selection start');
      assertEqual(cursorData.selectionEnd, 20, 'Should have correct selection end');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });

  runner.test('Socket: user-left broadcasts on leave', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000)
      ]);

      const userLeftPromise = waitForEvent(socket1, 'user-left', 5000);

      socket2.emit('leave-page', { pageId: context.testPageId });

      const leftData = await userLeftPromise;

      assertEqual(leftData.userId, context.testUser2Id, 'Should be user 2 who left');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });

  runner.test('Socket: publish updates page and broadcasts', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000)
      ]);

      const publishContent = 'Published content ' + Date.now();
      socket1.emit('content-change', { pageId: context.testPageId, content: publishContent, title: 'Published Title' });
      await sleep(500);

      const publishPromise = waitForEvent(socket2, 'published', 5000);

      socket1.emit('publish', { pageId: context.testPageId });

      const publishData = await publishPromise;

      assertNotNull(publishData, 'Should receive published event');
      assertNotNull(publishData.publishedAt, 'Should have publish timestamp');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });

  runner.test('Socket: revert restores published content', async () => {
    const socket1 = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      });

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(socket1, 'joined', 5000);

      const draftContent = 'Draft content to revert ' + Date.now();
      socket1.emit('content-change', { pageId: context.testPageId, content: draftContent, title: 'Draft Title' });
      await sleep(500);

      socket1.emit('revert', { pageId: context.testPageId });

      const revertData = await waitForEvent(socket1, 'reverted', 5000);

      assertNotNull(revertData, 'Should receive reverted event');
      assertNotNull(revertData.content, 'Should have content');
      assert(revertData.content !== draftContent, 'Content should be reverted');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
    }
  });

  runner.test('Socket: draft-saved event on content change', async () => {
    const socket1 = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      });

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(socket1, 'joined', 5000);

      const draftSavedPromise = waitForEvent(socket1, 'draft-saved', 5000);

      socket1.emit('content-change', {
        pageId: context.testPageId,
        content: 'Draft to save ' + Date.now(),
        title: 'Draft Title'
      });

      const savedData = await draftSavedPromise;

      assertNotNull(savedData, 'Should receive draft-saved event');
      assertNotNull(savedData.savedAt, 'Should have savedAt timestamp');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
    }
  });

  // ============================================================
  // ERROR HANDLING TESTS
  // ============================================================

  runner.test('Socket: join-page without pageId emits error', async () => {
    const socket1 = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      });

      const errorPromise = waitForEvent(socket1, 'error', 5000);
      socket1.emit('join-page', { mode: 'editing' });

      const errorData = await errorPromise;

      assertNotNull(errorData, 'Should receive error event');
      assertEqual(errorData.code, 'INVALID_REQUEST', 'Should have correct error code');
    } finally {
      socket1.disconnect();
    }
  });

  runner.test('Socket: publish without pageId emits error', async () => {
    const socket1 = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      });

      const errorPromise = waitForEvent(socket1, 'error', 5000);
      socket1.emit('publish', {});

      const errorData = await errorPromise;

      assertNotNull(errorData, 'Should receive error event');
      assertEqual(errorData.code, 'INVALID_REQUEST', 'Should have correct error code');
    } finally {
      socket1.disconnect();
    }
  });

  runner.test('Socket: revert without pageId emits error', async () => {
    const socket1 = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      });

      const errorPromise = waitForEvent(socket1, 'error', 5000);
      socket1.emit('revert', {});

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
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000)
      ]);

      const userLeftPromise = waitForEvent(socket1, 'user-left', 5000);

      socket2.disconnect();

      const leftData = await userLeftPromise;

      assertEqual(leftData.userId, context.testUser2Id, 'Should be user 2 who left on disconnect');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
    }
  });

  // ============================================================
  // EDGE CASE TESTS
  // ============================================================

  runner.test('Socket: joining new page leaves previous page', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    const page2Res = await request({
      path: '/api/pages',
      method: 'POST',
      headers: { 'Cookie': context.authCookie }
    }, {
      slug: 'collab-test-2-' + Date.now(),
      title: 'Second Test Page',
      content: '[h1]Page 2[/h1]',
      display_order: 101
    });
    const testPage2Id = page2Res.data.id;

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(socket1, 'joined', 5000);

      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(socket2, 'joined', 5000);

      const userLeftPromise = waitForEvent(socket2, 'user-left', 5000);

      socket1.emit('join-page', { pageId: testPage2Id, mode: 'editing' });
      await waitForEvent(socket1, 'joined', 5000);

      const leftData = await userLeftPromise;

      assertEqual(leftData.userId, context.testUserId, 'User 1 should have left page 1');
    } finally {
      socket1.emit('leave-page', { pageId: testPage2Id });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
      await pool.query('DELETE FROM pages WHERE id = $1', [testPage2Id]);
    }
  });

  runner.test('Socket: content-change ignored when not in room', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(socket2, 'joined', 5000);

      let contentUpdateReceived = false;
      socket2.on('content-updated', () => {
        contentUpdateReceived = true;
      });

      socket1.emit('content-change', {
        pageId: context.testPageId,
        content: 'Unauthorized change',
        title: 'Unauthorized'
      });

      await sleep(500);

      assertEqual(contentUpdateReceived, false, 'Content change from non-member should be ignored');
    } finally {
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });

  runner.test('Socket: viewing mode excludes user from cursor broadcasts', async () => {
    const socket1 = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        socket1.on('connect', resolve);
        socket1.on('connect_error', reject);
      });

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'viewing' });
      const joinedData = await waitForEvent(socket1, 'joined', 5000);

      const selfPresence = joinedData.presence.find(p => p.user_id === context.testUserId);
      assertNotNull(selfPresence, 'Should be in presence list');
      assertEqual(selfPresence.mode, 'viewing', 'Mode should be viewing');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
    }
  });

  // ============================================================
  // MULTI-USER SCENARIO TESTS
  // ============================================================

  runner.test('Socket: three users can collaborate simultaneously', async () => {
    const user3name = 'collabtest3-' + Date.now();
    const user3Res = await request({
      path: '/api/users/register',
      method: 'POST',
      headers: { 'Cookie': context.authCookie }
    }, {
      username: user3name,
      password: 'testpass',
      role: 'user'
    });
    assertEqual(user3Res.status, 200, 'User 3 registration should succeed');
    const user3Id = user3Res.data.id;

    const login3Res = await request({
      path: '/api/login',
      method: 'POST'
    }, {
      username: user3name,
      password: 'testpass'
    });
    assertEqual(login3Res.status, 200, 'User 3 login should succeed');
    assert(login3Res.headers['set-cookie'], 'User 3 should receive cookie');
    const user3Cookie = login3Res.headers['set-cookie'][0].split(';')[0];
    const user3Token = user3Cookie.match(/token=([^;]+)/)?.[1];
    assertNotNull(user3Token, 'User 3 should have token');

    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);
    const socket3 = createSocketClient(user3Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket3.emit('join-page', { pageId: context.testPageId, mode: 'viewing' });

      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000),
        waitForEvent(socket3, 'joined', 5000)
      ]);

      const presence = await presenceManager.getPagePresence(pool, context.testPageId);
      assert(presence.length >= 3, 'Should have at least 3 users in presence');

      const user1Presence = presence.find(p => p.user_id === context.testUserId);
      const user2Presence = presence.find(p => p.user_id === context.testUser2Id);
      const user3Presence = presence.find(p => p.user_id === user3Id);

      assertEqual(user1Presence?.mode, 'editing', 'User 1 should be editing');
      assertEqual(user2Presence?.mode, 'editing', 'User 2 should be editing');
      assertEqual(user3Presence?.mode, 'viewing', 'User 3 should be viewing');

      let socket2Received = false;
      let socket3Received = false;

      socket2.on('content-updated', () => { socket2Received = true; });
      socket3.on('content-updated', () => { socket3Received = true; });

      socket1.emit('content-change', {
        pageId: context.testPageId,
        content: 'Three user test ' + Date.now(),
        title: 'Three User Title'
      });

      await sleep(500);

      assert(socket2Received, 'Socket 2 should receive content update');
      assert(socket3Received, 'Socket 3 (viewer) should also receive content update');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket3.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
      socket3.disconnect();
    }
  });

  runner.test('Socket: rapid content changes handled correctly', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000)
      ]);

      const contentUpdates = [];
      socket2.on('content-updated', (data) => {
        contentUpdates.push(data.content);
      });

      for (let i = 0; i < 5; i++) {
        socket1.emit('content-change', {
          pageId: context.testPageId,
          content: `Rapid change ${i}`,
          title: 'Rapid Test'
        });
        await sleep(50);
      }

      await sleep(1500);

      assert(contentUpdates.length >= 5, `Should receive at least 5 content updates, got ${contentUpdates.length}`);
      assertEqual(contentUpdates[contentUpdates.length - 1], 'Rapid change 4', 'Last update should be correct');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });

  // ============================================================
  // EDIT HIGHLIGHT TESTS
  // ============================================================

  runner.test('EditHighlight: content-updated includes userId for highlight tracking', async () => {
    const socket1 = createSocketClient(context.authToken);
    const socket2 = createSocketClient(context.testUser2Token);

    try {
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

      socket1.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      socket2.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await Promise.all([
        waitForEvent(socket1, 'joined', 5000),
        waitForEvent(socket2, 'joined', 5000)
      ]);

      const contentUpdatePromise = waitForEvent(socket2, 'content-updated', 5000);

      socket1.emit('content-change', {
        pageId: context.testPageId,
        content: 'Highlight test content ' + Date.now(),
        title: 'Highlight Test'
      });

      const updateData = await contentUpdatePromise;

      assertNotNull(updateData.userId, 'content-updated should include userId');
      assertEqual(updateData.userId, context.testUserId, 'userId should match the editing user');
      assertNotNull(updateData.content, 'content-updated should include content');
      assertNotNull(updateData.username, 'content-updated should include username');
    } finally {
      socket1.emit('leave-page', { pageId: context.testPageId });
      socket2.emit('leave-page', { pageId: context.testPageId });
      socket1.disconnect();
      socket2.disconnect();
    }
  });
}

module.exports = { registerSocketTests };
