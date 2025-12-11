import React, { useState } from 'react';
import axios from 'axios';

function NewPageModal({ pages, onClose, onCreate }) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!slug || !title) {
      setError('Slug and title are required');
      return;
    }

    // Validate slug (alphanumeric and hyphens only)
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens');
      return;
    }

    try {
      await axios.post('/api/pages', {
        slug,
        title,
        content: `[h1]${title}[/h1]\n\nStart editing this page...`,
        parent_id: parentId || null,
        display_order: 0
      });
      onCreate();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create page');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Page</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Page Slug (URL)</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="e.g., my-new-page"
              required
            />
            <small style={{ color: '#8b9cb5', fontSize: '12px' }}>
              Lowercase letters, numbers, and hyphens only
            </small>
          </div>

          <div className="form-group">
            <label>Page Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., My New Page"
              required
            />
          </div>

          <div className="form-group">
            <label>Parent Page (Optional)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">None (Top Level)</option>
              {pages.map(page => (
                <option key={page.id} value={page.id}>
                  {page.title}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              Create Page
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewPageModal;
