const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const { pool } = require('./db');
const { parseBBCode } = require('./bbcode');
const { generateDiff, parseDiff } = require('./diff');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Auth middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin middleware
const requireAdmin = async (req, res, next) => {
  try {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
};

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ success: true, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Check auth status
router.get('/auth/check', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, cursor_color FROM users WHERE id = $1', [req.userId]);
    res.json({
      authenticated: true,
      userId: result.rows[0].id,
      username: result.rows[0].username,
      role: result.rows[0].role,
      cursorColor: result.rows[0].cursor_color
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all pages (for navigation)
router.get('/pages', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, slug, title, parent_id, display_order, is_expanded, content FROM pages WHERE deleted_at IS NULL ORDER BY display_order, id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching pages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single page by slug
router.get('/pages/:slug', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;
    const result = await pool.query('SELECT * FROM pages WHERE slug = $1 AND deleted_at IS NULL', [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const page = result.rows[0];
    page.html = parseBBCode(page.content);

    // Track page view
    await pool.query(
      'INSERT INTO page_views (page_id, user_id) VALUES ($1, $2)',
      [page.id, req.userId]
    );

    res.json(page);
  } catch (err) {
    console.error('Error fetching page:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create page (protected)
router.post('/pages', authenticate, async (req, res) => {
  try {
    const { slug, title, content, parent_id, display_order } = req.body;

    // Check if a deleted page with this slug exists
    const existingPage = await pool.query(
      'SELECT * FROM pages WHERE slug = $1',
      [slug]
    );

    if (existingPage.rows.length > 0 && existingPage.rows[0].deleted_at) {
      // Restore the deleted page with new content
      const result = await pool.query(
        `UPDATE pages
         SET title = $1, content = $2, parent_id = $3, display_order = $4,
             deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE slug = $5
         RETURNING *`,
        [title, content, parent_id || null, display_order || 0, slug]
      );
      return res.json(result.rows[0]);
    }

    const result = await pool.query(
      `INSERT INTO pages (slug, title, content, parent_id, display_order)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [slug, title, content, parent_id || null, display_order || 0]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error creating page:', err);
    if (err.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Page with this slug already exists' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

// Update page (protected)
router.put('/pages/:slug', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, content, parent_id, display_order, is_expanded } = req.body;

    // Get current page content for history
    const currentPage = await pool.query('SELECT * FROM pages WHERE slug = $1 AND deleted_at IS NULL', [slug]);

    if (currentPage.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const previousContent = currentPage.rows[0].content;
    const pageId = currentPage.rows[0].id;

    // Generate diff
    const diff = generateDiff(previousContent, content);

    // Update the page
    const result = await pool.query(
      `UPDATE pages
       SET title = $1, content = $2, parent_id = $3, display_order = $4,
           is_expanded = $5, updated_at = CURRENT_TIMESTAMP
       WHERE slug = $6
       RETURNING *`,
      [title, content, parent_id || null, display_order, is_expanded, slug]
    );

    // Save to history
    await pool.query(
      `INSERT INTO page_history (page_id, title, content, previous_content, diff, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [pageId, title, content, previousContent, diff, req.userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating page:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete page (soft delete - protected)
router.delete('/pages/:slug', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      'UPDATE pages SET deleted_at = CURRENT_TIMESTAMP WHERE slug = $1 AND deleted_at IS NULL RETURNING id',
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting page:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload image (protected)
router.post('/images', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Validate file type
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' });
    }

    // Validate file size (5MB limit)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (req.file.size > MAX_SIZE) {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }

    const result = await pool.query(
      'INSERT INTO images (filename, data, mime_type) VALUES ($1, $2, $3) RETURNING id',
      [req.file.originalname, req.file.buffer, req.file.mimetype]
    );

    const imageId = result.rows[0].id;
    res.json({
      success: true,
      imageId,
      url: `/api/images/${imageId}`
    });
  } catch (err) {
    console.error('Error uploading image:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get image
router.get('/images/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT data, mime_type, filename FROM images WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }

    const image = result.rows[0];
    res.setHeader('Content-Type', image.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${image.filename}"`);
    res.send(image.data);
  } catch (err) {
    console.error('Error fetching image:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// List all images metadata (for export)
router.get('/images', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, filename, mime_type FROM images ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching images list:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get page history
router.get('/pages/:slug/history', async (req, res) => {
  try {
    const { slug } = req.params;

    // Get page ID
    const pageResult = await pool.query('SELECT id FROM pages WHERE slug = $1', [slug]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Get history
    const historyResult = await pool.query(
      `SELECT h.*, u.username
       FROM page_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.page_id = $1
       ORDER BY h.created_at DESC`,
      [pageId]
    );

    // Parse diffs for structured display
    const history = historyResult.rows.map(row => ({
      ...row,
      diffParsed: parseDiff(row.diff)
    }));

    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Revert page to a specific history entry (protected)
router.post('/pages/:slug/revert/:historyId', authenticate, async (req, res) => {
  try {
    const { slug, historyId } = req.params;

    // Get the history entry
    const historyResult = await pool.query(
      `SELECT h.*, p.id as page_id, p.content as current_content, p.title as current_title
       FROM page_history h
       JOIN pages p ON h.page_id = p.id
       WHERE h.id = $1 AND p.slug = $2 AND p.deleted_at IS NULL`,
      [historyId, slug]
    );

    if (historyResult.rows.length === 0) {
      return res.status(404).json({ error: 'History entry not found' });
    }

    const historyEntry = historyResult.rows[0];
    const previousContent = historyEntry.current_content;
    const previousTitle = historyEntry.current_title;

    // Generate diff for the revert
    const diff = generateDiff(previousContent, historyEntry.content);

    // Update the page with the historical content
    const result = await pool.query(
      `UPDATE pages
       SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
       WHERE slug = $3
       RETURNING *`,
      [historyEntry.title, historyEntry.content, slug]
    );

    // Record the revert in history
    await pool.query(
      `INSERT INTO page_history (page_id, title, content, previous_content, diff, user_id, action_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [historyEntry.page_id, historyEntry.title, historyEntry.content, previousContent, diff, req.userId, 'revert']
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error reverting page:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get page comments (Talk page)
router.get('/pages/:slug/comments', async (req, res) => {
  try {
    const { slug } = req.params;

    // Get page ID
    const pageResult = await pool.query('SELECT id FROM pages WHERE slug = $1', [slug]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Get comments
    const commentsResult = await pool.query(
      `SELECT c.*, u.username
       FROM page_comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.page_id = $1
       ORDER BY c.created_at ASC`,
      [pageId]
    );

    res.json(commentsResult.rows);
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment to Talk page (protected)
router.post('/pages/:slug/comments', authenticate, async (req, res) => {
  try {
    const { slug } = req.params;
    const { content } = req.body;

    // Get page ID
    const pageResult = await pool.query('SELECT id FROM pages WHERE slug = $1', [slug]);

    if (pageResult.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const pageId = pageResult.rows[0].id;

    // Add comment
    const result = await pool.query(
      `INSERT INTO page_comments (page_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [pageId, req.userId, content]
    );

    // Get username for response
    const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [req.userId]);

    res.json({
      ...result.rows[0],
      username: userResult.rows[0].username
    });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// User registration (for admin to create new users)
router.post('/users/register', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role || 'user';

    const result = await pool.query(
      'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id, username, role',
      [username, hashedPassword, userRole]
    );

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (admin only)
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user role (admin only)
router.put('/users/:id/role', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user role:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change own password (authenticated users)
router.put('/users/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    // Get current user
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Verify current password
    const validPassword = await bcrypt.compare(currentPassword, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.userId]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change any user's password (admin only)
router.put('/users/:id/password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ error: 'New password required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, username',
      [hashedPassword, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'Password changed successfully', user: result.rows[0] });
  } catch (err) {
    console.error('Error changing user password:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update own cursor color
router.put('/users/me/cursor-color', authenticate, async (req, res) => {
  try {
    const { color } = req.body;

    if (!color) {
      return res.status(400).json({ error: 'Color is required' });
    }

    // Validate hex color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Invalid color format. Use hex format like #FF5733' });
    }

    const result = await pool.query(
      'UPDATE users SET cursor_color = $1 WHERE id = $2 RETURNING id, username, cursor_color',
      [color, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, cursorColor: result.rows[0].cursor_color });
  } catch (err) {
    console.error('Error updating cursor color:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update any user's cursor color (admin only)
router.put('/users/:id/cursor-color', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { color } = req.body;

    if (!color) {
      return res.status(400).json({ error: 'Color is required' });
    }

    // Validate hex color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Invalid color format. Use hex format like #FF5733' });
    }

    const result = await pool.query(
      'UPDATE users SET cursor_color = $1 WHERE id = $2 RETURNING id, username, cursor_color',
      [color, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Error updating user cursor color:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin - get deleted pages
router.get('/admin/deleted-pages', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, slug, title, deleted_at FROM pages WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching deleted pages:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin - restore deleted page
router.post('/admin/pages/:slug/restore', authenticate, requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query(
      'UPDATE pages SET deleted_at = NULL WHERE slug = $1 AND deleted_at IS NOT NULL RETURNING *',
      [slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deleted page not found' });
    }

    res.json({ success: true, page: result.rows[0] });
  } catch (err) {
    console.error('Error restoring page:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin - permanently delete page (hard delete)
router.delete('/admin/pages/:slug/permanent', authenticate, requireAdmin, async (req, res) => {
  try {
    const { slug } = req.params;

    const result = await pool.query('DELETE FROM pages WHERE slug = $1 RETURNING id', [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error permanently deleting page:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin analytics - page views summary
router.get('/admin/analytics/views', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.slug,
        p.title,
        COUNT(pv.id) as view_count,
        COUNT(DISTINCT pv.user_id) as unique_visitors,
        MAX(pv.viewed_at) as last_viewed
      FROM pages p
      LEFT JOIN page_views pv ON p.id = pv.page_id
      GROUP BY p.id, p.slug, p.title
      ORDER BY view_count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin analytics - recent page views
router.get('/admin/analytics/recent-views', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pv.id,
        pv.viewed_at,
        p.slug,
        p.title,
        u.username
      FROM page_views pv
      JOIN pages p ON pv.page_id = p.id
      JOIN users u ON pv.user_id = u.id
      ORDER BY pv.viewed_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent views:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin analytics - edit history summary
router.get('/admin/analytics/edits', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.slug,
        p.title,
        COUNT(ph.id) as edit_count,
        COUNT(DISTINCT ph.user_id) as unique_editors,
        MAX(ph.created_at) as last_edited
      FROM pages p
      LEFT JOIN page_history ph ON p.id = ph.page_id
      GROUP BY p.id, p.slug, p.title
      ORDER BY edit_count DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching edit analytics:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin analytics - recent edits
router.get('/admin/analytics/recent-edits', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        ph.id,
        ph.created_at,
        ph.action_type,
        p.slug,
        p.title,
        u.username
      FROM page_history ph
      JOIN pages p ON ph.page_id = p.id
      JOIN users u ON ph.user_id = u.id
      ORDER BY ph.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching recent edits:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin analytics - user activity
router.get('/admin/analytics/user-activity', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.username,
        u.role,
        COUNT(DISTINCT pv.id) as page_views,
        COUNT(DISTINCT ph.id) as edits,
        COUNT(DISTINCT pc.id) as comments,
        u.created_at
      FROM users u
      LEFT JOIN page_views pv ON u.id = pv.user_id
      LEFT JOIN page_history ph ON u.id = ph.user_id
      LEFT JOIN page_comments pc ON u.id = pc.user_id
      GROUP BY u.id, u.username, u.role, u.created_at
      ORDER BY page_views DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching user activity:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
