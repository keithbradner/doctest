/**
 * Admin Live Feed Tests
 *
 * Tests the real-time admin dashboard live feed functionality
 */

const {
  pool,
  assert,
  assertEqual,
  assertNotNull,
  createSocketClient,
  waitForEvent,
  sleep
} = require('./testRunner');

function registerAdminLiveTests(runner, context) {
  // ============================================================
  // ADMIN LIVE FEED TESTS
  // ============================================================

  runner.test('AdminLive: Admin can join admin-live room', async () => {
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

      socket.emit('join-admin-live');
      const initData = await waitForEvent(socket, 'admin-init', 5000);

      assertNotNull(initData, 'Should receive admin-init event');
      assert('activeSessions' in initData, 'Should include activeSessions');
      assert(Array.isArray(initData.activeSessions), 'activeSessions should be an array');
    } finally {
      socket.emit('leave-admin-live');
      socket.disconnect();
    }
  });

  runner.test('AdminLive: Non-admin is rejected from admin-live room', async () => {
    const socket = createSocketClient(context.testUser2Token);

    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
        socket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.on('connect_error', reject);
      });

      const errorPromise = waitForEvent(socket, 'error', 5000);
      socket.emit('join-admin-live');

      const errorData = await errorPromise;

      assertNotNull(errorData, 'Should receive error event');
      assertEqual(errorData.code, 'FORBIDDEN', 'Should have FORBIDDEN error code');
    } finally {
      socket.disconnect();
    }
  });

  runner.test('AdminLive: Receives event when user joins page', async () => {
    const adminSocket = createSocketClient(context.authToken);
    const userSocket = createSocketClient(context.testUser2Token);

    try {
      // Connect both sockets
      await Promise.all([
        new Promise((resolve, reject) => {
          adminSocket.on('connect', resolve);
          adminSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          userSocket.on('connect', resolve);
          userSocket.on('connect_error', reject);
        })
      ]);

      // Admin joins live feed
      adminSocket.emit('join-admin-live');
      await waitForEvent(adminSocket, 'admin-init', 5000);

      // Set up listener for admin event
      const adminEventPromise = waitForEvent(adminSocket, 'admin-event', 5000);

      // User joins a page
      userSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(userSocket, 'joined', 5000);

      // Check admin received the event
      const adminEvent = await adminEventPromise;

      assertNotNull(adminEvent, 'Admin should receive admin-event');
      assertEqual(adminEvent.type, 'user-joined-page', 'Event type should be user-joined-page');
      assertEqual(adminEvent.userId, context.testUser2Id, 'Should include correct userId');
      assertNotNull(adminEvent.username, 'Should include username');
      assertNotNull(adminEvent.pageTitle, 'Should include pageTitle');
      assertNotNull(adminEvent.pageSlug, 'Should include pageSlug');
      assertEqual(adminEvent.mode, 'editing', 'Should include correct mode');
      assertNotNull(adminEvent.timestamp, 'Should include timestamp');
    } finally {
      userSocket.emit('leave-page', { pageId: context.testPageId });
      adminSocket.emit('leave-admin-live');
      adminSocket.disconnect();
      userSocket.disconnect();
    }
  });

  runner.test('AdminLive: Receives event when user leaves page', async () => {
    const adminSocket = createSocketClient(context.authToken);
    const userSocket = createSocketClient(context.testUser2Token);

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          adminSocket.on('connect', resolve);
          adminSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          userSocket.on('connect', resolve);
          userSocket.on('connect_error', reject);
        })
      ]);

      // Admin joins live feed
      adminSocket.emit('join-admin-live');
      await waitForEvent(adminSocket, 'admin-init', 5000);

      // User joins then leaves
      userSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(userSocket, 'joined', 5000);
      await waitForEvent(adminSocket, 'admin-event', 5000); // consume join event

      // Set up listener for leave event
      const leaveEventPromise = waitForEvent(adminSocket, 'admin-event', 5000);

      userSocket.emit('leave-page', { pageId: context.testPageId });

      const leaveEvent = await leaveEventPromise;

      assertNotNull(leaveEvent, 'Admin should receive leave event');
      assertEqual(leaveEvent.type, 'user-left-page', 'Event type should be user-left-page');
      assertEqual(leaveEvent.userId, context.testUser2Id, 'Should include correct userId');
      assertNotNull(leaveEvent.pageTitle, 'Should include pageTitle');
    } finally {
      adminSocket.emit('leave-admin-live');
      adminSocket.disconnect();
      userSocket.disconnect();
    }
  });

  runner.test('AdminLive: Receives event when draft is saved', async () => {
    const adminSocket = createSocketClient(context.authToken);
    const userSocket = createSocketClient(context.testUser2Token);

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          adminSocket.on('connect', resolve);
          adminSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          userSocket.on('connect', resolve);
          userSocket.on('connect_error', reject);
        })
      ]);

      // Admin joins live feed
      adminSocket.emit('join-admin-live');
      await waitForEvent(adminSocket, 'admin-init', 5000);

      // User joins page
      userSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(userSocket, 'joined', 5000);
      await waitForEvent(adminSocket, 'admin-event', 5000); // consume join event

      // Set up listener for draft-saved event
      const draftEventPromise = waitForEvent(adminSocket, 'admin-event', 5000);

      // User makes a content change
      userSocket.emit('content-change', {
        pageId: context.testPageId,
        content: 'Admin live test content ' + Date.now(),
        title: 'Admin Live Test'
      });

      const draftEvent = await draftEventPromise;

      assertNotNull(draftEvent, 'Admin should receive draft-saved event');
      assertEqual(draftEvent.type, 'draft-saved', 'Event type should be draft-saved');
      assertEqual(draftEvent.userId, context.testUser2Id, 'Should include correct userId');
      assertNotNull(draftEvent.pageTitle, 'Should include pageTitle');
      assertNotNull(draftEvent.timestamp, 'Should include timestamp');
    } finally {
      userSocket.emit('leave-page', { pageId: context.testPageId });
      adminSocket.emit('leave-admin-live');
      adminSocket.disconnect();
      userSocket.disconnect();
    }
  });

  runner.test('AdminLive: Receives event when page is published', async () => {
    const adminSocket = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        adminSocket.on('connect', resolve);
        adminSocket.on('connect_error', reject);
      });

      // Admin joins live feed AND the page (to publish)
      adminSocket.emit('join-admin-live');
      await waitForEvent(adminSocket, 'admin-init', 5000);

      adminSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(adminSocket, 'joined', 5000);
      await waitForEvent(adminSocket, 'admin-event', 5000); // consume join event

      // Make a change first
      adminSocket.emit('content-change', {
        pageId: context.testPageId,
        content: 'Publish test content ' + Date.now(),
        title: 'Publish Test'
      });
      await waitForEvent(adminSocket, 'admin-event', 5000); // consume draft-saved event

      // Set up listener for publish event
      const publishEventPromise = waitForEvent(adminSocket, 'admin-event', 5000);

      // Publish
      adminSocket.emit('publish', { pageId: context.testPageId, parentId: null });

      const publishEvent = await publishEventPromise;

      assertNotNull(publishEvent, 'Admin should receive publish event');
      assertEqual(publishEvent.type, 'page-published', 'Event type should be page-published');
      assertNotNull(publishEvent.pageTitle, 'Should include pageTitle');
      assertNotNull(publishEvent.timestamp, 'Should include timestamp');
    } finally {
      adminSocket.emit('leave-page', { pageId: context.testPageId });
      adminSocket.emit('leave-admin-live');
      adminSocket.disconnect();
    }
  });

  runner.test('AdminLive: Receives event when page is reverted', async () => {
    const adminSocket = createSocketClient(context.authToken);

    try {
      await new Promise((resolve, reject) => {
        adminSocket.on('connect', resolve);
        adminSocket.on('connect_error', reject);
      });

      // Admin joins live feed AND the page
      adminSocket.emit('join-admin-live');
      await waitForEvent(adminSocket, 'admin-init', 5000);

      adminSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(adminSocket, 'joined', 5000);
      await waitForEvent(adminSocket, 'admin-event', 5000); // consume join event

      // Make a draft change
      adminSocket.emit('content-change', {
        pageId: context.testPageId,
        content: 'Revert test content ' + Date.now(),
        title: 'Revert Test'
      });
      await waitForEvent(adminSocket, 'admin-event', 5000); // consume draft-saved event

      // Set up listener for revert event
      const revertEventPromise = waitForEvent(adminSocket, 'admin-event', 5000);

      // Revert
      adminSocket.emit('revert', { pageId: context.testPageId });

      const revertEvent = await revertEventPromise;

      assertNotNull(revertEvent, 'Admin should receive revert event');
      assertEqual(revertEvent.type, 'page-reverted', 'Event type should be page-reverted');
      assertNotNull(revertEvent.pageTitle, 'Should include pageTitle');
      assertNotNull(revertEvent.timestamp, 'Should include timestamp');
    } finally {
      adminSocket.emit('leave-page', { pageId: context.testPageId });
      adminSocket.emit('leave-admin-live');
      adminSocket.disconnect();
    }
  });

  runner.test('AdminLive: Receives event when user disconnects', async () => {
    const adminSocket = createSocketClient(context.authToken);
    const userSocket = createSocketClient(context.testUser2Token);

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          adminSocket.on('connect', resolve);
          adminSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          userSocket.on('connect', resolve);
          userSocket.on('connect_error', reject);
        })
      ]);

      // Admin joins live feed
      adminSocket.emit('join-admin-live');
      await waitForEvent(adminSocket, 'admin-init', 5000);

      // User joins page
      userSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(userSocket, 'joined', 5000);
      await waitForEvent(adminSocket, 'admin-event', 5000); // consume join event

      // Set up listener for disconnect event
      const disconnectEventPromise = waitForEvent(adminSocket, 'admin-event', 5000);

      // User disconnects (without leaving page first)
      userSocket.disconnect();

      const disconnectEvent = await disconnectEventPromise;

      assertNotNull(disconnectEvent, 'Admin should receive disconnect event');
      assertEqual(disconnectEvent.type, 'user-disconnected', 'Event type should be user-disconnected');
      assertEqual(disconnectEvent.userId, context.testUser2Id, 'Should include correct userId');
      assertNotNull(disconnectEvent.pageTitle, 'Should include pageTitle');
    } finally {
      adminSocket.emit('leave-admin-live');
      adminSocket.disconnect();
    }
  });

  runner.test('AdminLive: Active sessions list is accurate', async () => {
    const adminSocket = createSocketClient(context.authToken);
    const userSocket = createSocketClient(context.testUser2Token);

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          adminSocket.on('connect', resolve);
          adminSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          userSocket.on('connect', resolve);
          userSocket.on('connect_error', reject);
        })
      ]);

      // User joins page first
      userSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(userSocket, 'joined', 5000);

      // Wait a moment for session to be recorded
      await sleep(100);

      // Admin joins live feed
      adminSocket.emit('join-admin-live');
      const initData = await waitForEvent(adminSocket, 'admin-init', 5000);

      assertNotNull(initData.activeSessions, 'Should have activeSessions');
      assert(initData.activeSessions.length >= 1, 'Should have at least 1 active session');

      const userSession = initData.activeSessions.find(s => s.user_id === context.testUser2Id);
      assertNotNull(userSession, 'Should find user2 in active sessions');
      assertEqual(userSession.page_id, context.testPageId, 'Should have correct page_id');
      assertEqual(userSession.mode, 'editing', 'Should have correct mode');
      assertNotNull(userSession.username, 'Should have username');
      assertNotNull(userSession.page_title, 'Should have page_title');
      assertNotNull(userSession.page_slug, 'Should have page_slug');
    } finally {
      userSocket.emit('leave-page', { pageId: context.testPageId });
      adminSocket.emit('leave-admin-live');
      adminSocket.disconnect();
      userSocket.disconnect();
    }
  });

  runner.test('AdminLive: Multiple admins can watch live feed simultaneously', async () => {
    // Create a third admin user for this test
    const admin2name = 'admin2-' + Date.now();
    const { request } = require('./testRunner');

    const admin2Res = await request({
      path: '/api/users/register',
      method: 'POST',
      headers: { 'Cookie': context.authCookie }
    }, {
      username: admin2name,
      password: 'testpass',
      role: 'admin'
    });

    const login2Res = await request({
      path: '/api/login',
      method: 'POST'
    }, {
      username: admin2name,
      password: 'testpass'
    });

    const admin2Cookie = login2Res.headers['set-cookie'][0].split(';')[0];
    const admin2Token = admin2Cookie.match(/token=([^;]+)/)?.[1];

    const adminSocket1 = createSocketClient(context.authToken);
    const adminSocket2 = createSocketClient(admin2Token);
    const userSocket = createSocketClient(context.testUser2Token);

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          adminSocket1.on('connect', resolve);
          adminSocket1.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          adminSocket2.on('connect', resolve);
          adminSocket2.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          userSocket.on('connect', resolve);
          userSocket.on('connect_error', reject);
        })
      ]);

      // Both admins join live feed
      adminSocket1.emit('join-admin-live');
      adminSocket2.emit('join-admin-live');
      await Promise.all([
        waitForEvent(adminSocket1, 'admin-init', 5000),
        waitForEvent(adminSocket2, 'admin-init', 5000)
      ]);

      // Set up listeners for both admins
      const admin1EventPromise = waitForEvent(adminSocket1, 'admin-event', 5000);
      const admin2EventPromise = waitForEvent(adminSocket2, 'admin-event', 5000);

      // User joins page
      userSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(userSocket, 'joined', 5000);

      // Both admins should receive the event
      const [admin1Event, admin2Event] = await Promise.all([
        admin1EventPromise,
        admin2EventPromise
      ]);

      assertNotNull(admin1Event, 'Admin 1 should receive event');
      assertNotNull(admin2Event, 'Admin 2 should receive event');
      assertEqual(admin1Event.type, 'user-joined-page', 'Admin 1 event type correct');
      assertEqual(admin2Event.type, 'user-joined-page', 'Admin 2 event type correct');
    } finally {
      userSocket.emit('leave-page', { pageId: context.testPageId });
      adminSocket1.emit('leave-admin-live');
      adminSocket2.emit('leave-admin-live');
      adminSocket1.disconnect();
      adminSocket2.disconnect();
      userSocket.disconnect();
    }
  });

  runner.test('AdminLive: Leaving admin-live stops receiving events', async () => {
    const adminSocket = createSocketClient(context.authToken);
    const userSocket = createSocketClient(context.testUser2Token);

    try {
      await Promise.all([
        new Promise((resolve, reject) => {
          adminSocket.on('connect', resolve);
          adminSocket.on('connect_error', reject);
        }),
        new Promise((resolve, reject) => {
          userSocket.on('connect', resolve);
          userSocket.on('connect_error', reject);
        })
      ]);

      // Admin joins then leaves live feed
      adminSocket.emit('join-admin-live');
      await waitForEvent(adminSocket, 'admin-init', 5000);
      adminSocket.emit('leave-admin-live');

      // Give time for leave to process
      await sleep(100);

      // Track if admin receives any events
      let eventReceived = false;
      adminSocket.on('admin-event', () => {
        eventReceived = true;
      });

      // User joins page
      userSocket.emit('join-page', { pageId: context.testPageId, mode: 'editing' });
      await waitForEvent(userSocket, 'joined', 5000);

      // Wait to see if admin gets event
      await sleep(500);

      assertEqual(eventReceived, false, 'Admin should NOT receive events after leaving admin-live');
    } finally {
      userSocket.emit('leave-page', { pageId: context.testPageId });
      adminSocket.disconnect();
      userSocket.disconnect();
    }
  });
}

module.exports = { registerAdminLiveTests };
