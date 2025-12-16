const draftManager = {
  // Get existing draft or create one from the published page
  async getOrCreateDraft(pool, pageId) {
    // Check if draft exists (join with users to get last editor's username)
    const draftResult = await pool.query(
      `SELECT d.*, u.username as last_modified_by_username
       FROM page_drafts d
       LEFT JOIN users u ON u.id = d.last_modified_by
       WHERE d.page_id = $1`,
      [pageId]
    );

    if (draftResult.rows.length > 0) {
      return draftResult.rows[0];
    }

    // No draft exists, get the published page content
    const pageResult = await pool.query(
      'SELECT id, title, content FROM pages WHERE id = $1 AND deleted_at IS NULL',
      [pageId]
    );

    if (pageResult.rows.length === 0) {
      return null;
    }

    const page = pageResult.rows[0];

    // Create draft from published content
    const newDraft = await pool.query(
      `INSERT INTO page_drafts (page_id, content, title)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [pageId, page.content, page.title]
    );

    return newDraft.rows[0];
  },

  // Get draft if exists, otherwise return null
  async getDraft(pool, pageId) {
    const result = await pool.query(
      `SELECT d.*, u.username as last_modified_by_username
       FROM page_drafts d
       LEFT JOIN users u ON u.id = d.last_modified_by
       WHERE d.page_id = $1`,
      [pageId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  },

  // Update draft content
  async updateDraft(pool, pageId, content, title, userId) {
    const result = await pool.query(
      `INSERT INTO page_drafts (page_id, content, title, last_modified_by, last_modified_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (page_id) DO UPDATE SET
         content = EXCLUDED.content,
         title = EXCLUDED.title,
         last_modified_by = EXCLUDED.last_modified_by,
         last_modified_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [pageId, content, title, userId]
    );
    return result.rows[0];
  },

  // Delete draft (after publish or revert)
  async deleteDraft(pool, pageId) {
    await pool.query(
      'DELETE FROM page_drafts WHERE page_id = $1',
      [pageId]
    );
  },

  // Check if draft differs from published
  async hasDraftChanges(pool, pageId) {
    const result = await pool.query(
      `SELECT
        d.content as draft_content,
        d.title as draft_title,
        p.content as page_content,
        p.title as page_title
       FROM page_drafts d
       JOIN pages p ON p.id = d.page_id
       WHERE d.page_id = $1`,
      [pageId]
    );

    if (result.rows.length === 0) {
      return false;
    }

    const { draft_content, draft_title, page_content, page_title } = result.rows[0];
    return draft_content !== page_content || draft_title !== page_title;
  }
};

module.exports = { draftManager };
