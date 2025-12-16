import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { parseBBCode } from '../utils/bbcode';

function PageEdit({ slug, onUpdate }) {
  const [page, setPage] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [parentId, setParentId] = useState('');
  const [allPages, setAllPages] = useState([]);
  const [activeTab, setActiveTab] = useState('edit');
  const [splitMode, setSplitMode] = useState(false);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [pageResponse, pagesResponse] = await Promise.all([
          axios.get(`/api/pages/${slug}`),
          axios.get('/api/pages')
        ]);
        setPage(pageResponse.data);
        setTitle(pageResponse.data.title);
        setContent(pageResponse.data.content);
        setParentId(pageResponse.data.parent_id || '');
        setAllPages(pagesResponse.data);
      } catch (err) {
        console.error('Error loading page:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [slug]);

  useEffect(() => {
    const generatePreview = () => {
      // Use shared BBCode parser (same as server-side)
      const html = parseBBCode(content);
      setPreview(html);
    };

    if (activeTab === 'preview' || splitMode) {
      generatePreview();
    }
  }, [activeTab, content, splitMode]);

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
        parent_id: parentId || null,
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

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        insertBBCode('[b]', '[/b]');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        insertBBCode('[i]', '[/i]');
      }
    }
  };

  const uploadImageFromUrl = async (imgUrl) => {
    try {
      let blob;

      if (imgUrl.startsWith('data:')) {
        // Handle data URLs (base64 encoded images)
        const response = await fetch(imgUrl);
        blob = await response.blob();
      } else {
        // For external URLs, try to fetch (may fail due to CORS)
        const response = await fetch(imgUrl, { mode: 'cors' });
        if (!response.ok) return null;
        blob = await response.blob();
      }

      const formData = new FormData();
      formData.append('image', blob, 'pasted-image.png');

      const uploadResponse = await axios.post('/api/images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return uploadResponse.data.url;
    } catch (err) {
      // CORS or network error - silently skip this image
      console.error('Error fetching/uploading image:', err);
      return null;
    }
  };

  const handlePaste = async (e) => {
    const clipboardData = e.clipboardData;

    // Check for pasted images first (screenshots, direct image pastes)
    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        try {
          const textarea = textareaRef.current;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;

          const response = await axios.post('/api/images', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          const imgTag = `[img]${response.data.url}[/img]`;
          const newContent = content.substring(0, start) + imgTag + content.substring(end);
          setContent(newContent);

          setTimeout(() => {
            textarea.selectionStart = start + imgTag.length;
            textarea.selectionEnd = start + imgTag.length;
            textarea.focus();
          }, 0);
        } catch (err) {
          console.error('Error uploading image:', err);
          alert('Failed to upload image');
        }
        return;
      }
    }

    const html = clipboardData.getData('text/html');

    // Check if HTML contains images (e.g., from Google Docs)
    if (html) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.querySelectorAll('img[src]');

      if (images.length > 0) {
        e.preventDefault();
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        let insertedText = '';

        for (const img of images) {
          const src = img.getAttribute('src');
          if (src) {
            // Try to upload the image
            const uploadedUrl = await uploadImageFromUrl(src);
            if (uploadedUrl) {
              insertedText += `[img]${uploadedUrl}[/img]\n`;
            }
          }
        }

        if (insertedText) {
          const newContent = content.substring(0, start) + insertedText.trim() + content.substring(end);
          setContent(newContent);

          setTimeout(() => {
            textarea.selectionStart = start + insertedText.trim().length;
            textarea.selectionEnd = start + insertedText.trim().length;
            textarea.focus();
          }, 0);
          return;
        }
      }
    }

    if (html) {
      // Parse HTML and convert to BBCode
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Check if there's any meaningful formatting to convert
      const hasLinks = doc.querySelectorAll('a[href]').length > 0;
      const hasBold = doc.querySelectorAll('b, strong').length > 0;
      const hasItalic = doc.querySelectorAll('i, em').length > 0;
      const hasUnderline = doc.querySelectorAll('u').length > 0;
      const hasLists = doc.querySelectorAll('ul, ol').length > 0;

      if (!hasLinks && !hasBold && !hasItalic && !hasUnderline && !hasLists) {
        // No formatting to convert, let default paste handle it
        return;
      }

      // Check if body has a single wrapper element that contains all content
      // This detects when apps wrap everything in a formatting tag
      const isWrapperElement = (node, tagNames) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return false;
        const tagName = node.tagName.toLowerCase();
        if (!tagNames.includes(tagName)) return false;
        // Check if this is the only meaningful child of its parent
        const siblings = Array.from(node.parentNode.childNodes).filter(n =>
          n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && n.textContent.trim())
        );
        return siblings.length === 1;
      };

      // Convert HTML nodes to BBCode
      const convertNode = (node, isTopLevel = false) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.textContent;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = node.tagName.toLowerCase();
          let childContent = Array.from(node.childNodes).map(n => convertNode(n, false)).join('');

          // Links
          if (tagName === 'a' && node.href) {
            const href = node.getAttribute('href');
            if (childContent.trim() === href) {
              return `[url]${href}[/url]`;
            }
            return `[url=${href}]${childContent}[/url]`;
          }

          // Bold - skip if it's a top-level wrapper
          if (tagName === 'b' || tagName === 'strong') {
            if (isTopLevel && isWrapperElement(node, ['b', 'strong'])) {
              return childContent;
            }
            return `[b]${childContent}[/b]`;
          }

          // Italic - skip if it's a top-level wrapper
          if (tagName === 'i' || tagName === 'em') {
            if (isTopLevel && isWrapperElement(node, ['i', 'em'])) {
              return childContent;
            }
            return `[i]${childContent}[/i]`;
          }

          // Underline - skip if it's a top-level wrapper
          if (tagName === 'u') {
            if (isTopLevel && isWrapperElement(node, ['u'])) {
              return childContent;
            }
            return `[u]${childContent}[/u]`;
          }

          // Lists
          if (tagName === 'ul') {
            const items = Array.from(node.querySelectorAll(':scope > li'))
              .map(li => `[*]${convertNode(li, false).trim()}`)
              .join('\n');
            return `[list]\n${items}\n[/list]`;
          }
          if (tagName === 'ol') {
            const items = Array.from(node.querySelectorAll(':scope > li'))
              .map(li => `[*]${convertNode(li, false).trim()}`)
              .join('\n');
            return `[olist]\n${items}\n[/olist]`;
          }
          if (tagName === 'li') {
            return childContent;
          }

          // Line breaks and blocks
          if (tagName === 'br') {
            return '\n';
          }
          if (tagName === 'p' || tagName === 'div') {
            return childContent + '\n';
          }

          return childContent;
        }

        return '';
      };

      const convertedText = Array.from(doc.body.childNodes)
        .map(n => convertNode(n, true))
        .join('')
        .trim();

      // Only use converted text if it actually contains BBCode
      if (convertedText.includes('[url') || convertedText.includes('[b]') ||
          convertedText.includes('[i]') || convertedText.includes('[u]') ||
          convertedText.includes('[list]') || convertedText.includes('[olist]')) {
        e.preventDefault();

        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;

        const newContent = content.substring(0, start) + convertedText + content.substring(end);
        setContent(newContent);

        setTimeout(() => {
          textarea.selectionStart = start + convertedText.length;
          textarea.selectionEnd = start + convertedText.length;
          textarea.focus();
        }, 0);
      }
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!page) {
    return <div className="content-inner">Page not found</div>;
  }

  return (
    <div className="content-inner full-width">
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

      <div className="form-group">
        <label>Parent Page</label>
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
        >
          <option value="">None (Top Level)</option>
          {allPages
            .filter(p => p.id !== page.id)
            .map(p => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
        </select>
      </div>

      <div className="editor-controls">
        <div className="editor-tabs">
          <button
            className={`editor-tab ${!splitMode && activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => { setSplitMode(false); setActiveTab('edit'); }}
            disabled={splitMode}
          >
            Edit
          </button>
          <button
            className={`editor-tab ${!splitMode && activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => { setSplitMode(false); setActiveTab('preview'); }}
            disabled={splitMode}
          >
            Preview
          </button>
          <button
            className={`editor-tab ${splitMode ? 'active' : ''}`}
            onClick={() => setSplitMode(!splitMode)}
          >
            Split View
          </button>
        </div>
      </div>

      {splitMode ? (
        <div className="editor-split-view">
          <div className="editor-split-pane">
            <h3 className="split-pane-title">Editor</h3>
            <div className="editor-container">
              <div className="editor-toolbar">
                <button className="toolbar-btn" onClick={() => insertBBCode('[h1]', '[/h1]')}>H1</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[h2]', '[/h2]')}>H2</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[h3]', '[/h3]')}>H3</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[section=]', '[/section]')} title="Section with anchor (appears in nav)">Section</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[subsection=]', '[/subsection]')} title="Subsection with anchor (appears in nav)">Subsect</button>
                <div className="toolbar-separator"></div>
                <button className="toolbar-btn" onClick={() => insertBBCode('[b]', '[/b]')}><strong>B</strong></button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[i]', '[/i]')}><em>I</em></button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[u]', '[/u]')}><u>U</u></button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[strike]', '[/strike]')}>S</button>
                <div className="toolbar-separator"></div>
                <button className="toolbar-btn" onClick={() => insertBBCode('[url=]', '[/url]')}>Link</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[doclink=]', '[/doclink]')} title="Link to another wiki page by slug">DocLink</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[list]\n[*]', '\n[/list]')}>List</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[olist]\n[*]', '\n[/olist]')}>OList</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[code]', '[/code]')}>Code</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[quote]', '[/quote]')}>Quote</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[callout]', '[/callout]')}>Callout</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[spoiler]', '[/spoiler]')}>Spoiler</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[todo=]', '[/todo]')} title="TODO note with tooltip">TODO</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[hr]')}>HR</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('\n\n')} title="Insert blank line">⏎</button>
                <button className="toolbar-btn" onClick={() => insertBBCode('[previewyoutube]', '[/previewyoutube]')} title="YouTube video (paste video ID)">YouTube</button>
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
                className="editor-textarea split-editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
              />
            </div>
          </div>
          <div className="editor-split-pane">
            <h3 className="split-pane-title">Preview</h3>
            <div className="preview-content split-preview-content">
              <div className="page-content" dangerouslySetInnerHTML={{ __html: preview }} />
            </div>
          </div>
        </div>
      ) : (
        activeTab === 'edit' ? (
          <div className="editor-container">
            <div className="editor-toolbar">
              <button className="toolbar-btn" onClick={() => insertBBCode('[h1]', '[/h1]')}>H1</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[h2]', '[/h2]')}>H2</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[h3]', '[/h3]')}>H3</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[section=]', '[/section]')} title="Section with anchor (appears in nav)">Section</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[subsection=]', '[/subsection]')} title="Subsection with anchor (appears in nav)">Subsect</button>
              <div className="toolbar-separator"></div>
              <button className="toolbar-btn" onClick={() => insertBBCode('[b]', '[/b]')}><strong>B</strong></button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[i]', '[/i]')}><em>I</em></button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[u]', '[/u]')}><u>U</u></button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[strike]', '[/strike]')}>S</button>
              <div className="toolbar-separator"></div>
              <button className="toolbar-btn" onClick={() => insertBBCode('[url=]', '[/url]')}>Link</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[doclink=]', '[/doclink]')} title="Link to another wiki page by slug">DocLink</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[list]\n[*]', '\n[/list]')}>List</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[olist]\n[*]', '\n[/olist]')}>OList</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[code]', '[/code]')}>Code</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[quote]', '[/quote]')}>Quote</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[callout]', '[/callout]')}>Callout</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[spoiler]', '[/spoiler]')}>Spoiler</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[todo=]', '[/todo]')} title="TODO note with tooltip">TODO</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[hr]')}>HR</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('\n\n')} title="Insert blank line">⏎</button>
              <button className="toolbar-btn" onClick={() => insertBBCode('[previewyoutube]', '[/previewyoutube]')} title="YouTube video (paste video ID)">YouTube</button>
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
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
            />
          </div>
        ) : (
          <div className="preview-content">
            <div className="page-content" dangerouslySetInnerHTML={{ __html: preview }} />
          </div>
        )
      )}
    </div>
  );
}

export default PageEdit;
