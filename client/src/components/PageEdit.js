import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function PageEdit({ slug, onUpdate }) {
  const [page, setPage] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [activeTab, setActiveTab] = useState('edit');
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPage();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'preview') {
      generatePreview();
    }
  }, [activeTab, content]);

  const loadPage = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/pages/${slug}`);
      setPage(response.data);
      setTitle(response.data.title);
      setContent(response.data.content);
    } catch (err) {
      console.error('Error loading page:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePreview = () => {
    // Simple client-side BBCode parsing for preview
    let html = content;

    // Headers
    html = html.replace(/\[h1\](.*?)\[\/h1\]/gi, '<h1>$1</h1>');
    html = html.replace(/\[h2\](.*?)\[\/h2\]/gi, '<h2>$1</h2>');
    html = html.replace(/\[h3\](.*?)\[\/h3\]/gi, '<h3>$1</h3>');

    // Text formatting
    html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
    html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
    html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
    html = html.replace(/\[strike\](.*?)\[\/strike\]/gi, '<del>$1</del>');

    // Spoiler
    html = html.replace(/\[spoiler\](.*?)\[\/spoiler\]/gi, '<span class="spoiler">$1</span>');

    // Horizontal rule
    html = html.replace(/\[hr\]/gi, '<hr />');

    // Links
    html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank">$2</a>');
    html = html.replace(/\[url\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank">$1</a>');

    // Images
    html = html.replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" alt="Image" />');

    // Quote
    html = html.replace(/\[quote=(.*?)\](.*?)\[\/quote\]/gs, '<blockquote class="quote"><div class="quote-author">Originally posted by $1:</div>$2</blockquote>');
    html = html.replace(/\[quote\](.*?)\[\/quote\]/gs, '<blockquote class="quote">$1</blockquote>');

    // Lists
    html = html.replace(/\[list\](.*?)\[\/list\]/gs, (match, items) => {
      const listItems = items.replace(/\[\*\]/g, '<li>');
      return `<ul>${listItems}</ul>`;
    });
    html = html.replace(/\[olist\](.*?)\[\/olist\]/gs, (match, items) => {
      const listItems = items.replace(/\[\*\]/g, '<li>');
      return `<ol>${listItems}</ol>`;
    });

    // Code
    html = html.replace(/\[code\](.*?)\[\/code\]/gs, '<pre><code>$1</code></pre>');

    // Noparse
    html = html.replace(/\[noparse\](.*?)\[\/noparse\]/gs, '$1');

    // Newlines
    html = html.replace(/\n/g, '<br>');

    setPreview(html);
  };

  const insertBBCode = (openTag, closeTag = null) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    let newText;
    if (closeTag) {
      newText = content.substring(0, start) + openTag + selectedText + closeTag + content.substring(end);
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + openTag.length + selectedText.length;
    } else {
      newText = content.substring(0, start) + openTag + content.substring(end);
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + openTag.length;
    }

    setContent(newText);
    textarea.focus();
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await axios.post('/api/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      insertBBCode(`[img]${response.data.url}[/img]`);
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Failed to upload image');
    }
  };

  const handleSave = async () => {
    try {
      await axios.put(`/api/pages/${slug}`, {
        title,
        content,
        parent_id: page.parent_id,
        display_order: page.display_order,
        is_expanded: page.is_expanded
      });
      onUpdate();
      navigate(slug === 'welcome' ? '/' : `/page/${slug}`);
    } catch (err) {
      console.error('Error saving page:', err);
      alert('Failed to save page');
    }
  };

  const handleCancel = () => {
    navigate(slug === 'welcome' ? '/' : `/page/${slug}`);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!page) {
    return <div className="content-inner">Page not found</div>;
  }

  return (
    <div className="content-inner">
      <div className="breadcrumb">
        <a href="/">Steamworks Documentation</a> &gt; {page.title} &gt; Edit
      </div>

      <div className="page-header">
        <h1 className="page-title">Edit: {page.title}</h1>
        <div>
          <button className="cancel-btn" onClick={handleCancel}>
            Cancel
          </button>
          <button className="save-btn" onClick={handleSave}>
            Save Changes
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>Page Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="editor-tabs">
        <button
          className={`editor-tab ${activeTab === 'edit' ? 'active' : ''}`}
          onClick={() => setActiveTab('edit')}
        >
          Edit
        </button>
        <button
          className={`editor-tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          Preview
        </button>
      </div>

      {activeTab === 'edit' ? (
        <div className="editor-container">
          <div className="editor-toolbar">
            <button className="toolbar-btn" onClick={() => insertBBCode('[h1]', '[/h1]')}>H1</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[h2]', '[/h2]')}>H2</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[h3]', '[/h3]')}>H3</button>
            <div className="toolbar-separator"></div>
            <button className="toolbar-btn" onClick={() => insertBBCode('[b]', '[/b]')}><strong>B</strong></button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[i]', '[/i]')}><em>I</em></button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[u]', '[/u]')}><u>U</u></button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[strike]', '[/strike]')}>S</button>
            <div className="toolbar-separator"></div>
            <button className="toolbar-btn" onClick={() => insertBBCode('[url=]', '[/url]')}>Link</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[list]\n[*]', '\n[/list]')}>List</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[olist]\n[*]', '\n[/olist]')}>OList</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[code]', '[/code]')}>Code</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[quote]', '[/quote]')}>Quote</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[spoiler]', '[/spoiler]')}>Spoiler</button>
            <button className="toolbar-btn" onClick={() => insertBBCode('[hr]')}>HR</button>
            <div className="toolbar-separator"></div>
            <label className="toolbar-btn image-upload-btn">
              Upload Image
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <textarea
            ref={textareaRef}
            className="editor-textarea"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
      ) : (
        <div className="preview-content">
          <div className="page-content" dangerouslySetInnerHTML={{ __html: preview }} />
        </div>
      )}
    </div>
  );
}

export default PageEdit;
