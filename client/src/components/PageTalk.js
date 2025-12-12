import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function PageTalk({ slug }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadComments();
  }, [slug]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/pages/${slug}/comments`);
      setComments(response.data);
    } catch (err) {
      console.error('Error loading comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const response = await axios.post(`/api/pages/${slug}/comments`, {
        content: newComment
      });
      setComments([...comments, response.data]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      alert('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const insertBBCode = (openTag, closeTag = null) => {
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = newComment.substring(start, end);

    let newText;
    if (closeTag) {
      newText = newComment.substring(0, start) + openTag + selectedText + closeTag + newComment.substring(end);
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + openTag.length + selectedText.length;
    } else {
      newText = newComment.substring(0, start) + openTag + newComment.substring(end);
      textarea.selectionStart = start + openTag.length;
      textarea.selectionEnd = start + openTag.length;
    }

    setNewComment(newText);
    textarea.focus();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Simple BBCode rendering for comments
  const renderBBCode = (text) => {
    let html = text;

    html = html.replace(/\[b\](.*?)\[\/b\]/gi, '<strong>$1</strong>');
    html = html.replace(/\[i\](.*?)\[\/i\]/gi, '<em>$1</em>');
    html = html.replace(/\[u\](.*?)\[\/u\]/gi, '<u>$1</u>');
    html = html.replace(/\[code\](.*?)\[\/code\]/gs, '<code>$1</code>');
    html = html.replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank">$2</a>');
    html = html.replace(/\n/g, '<br>');

    return html;
  };

  const getPagePath = () => {
    return slug === 'welcome' ? '/' : `/page/${slug}`;
  };

  if (loading) {
    return <div className="loading">Loading discussion...</div>;
  }

  return (
    <div className="content-inner">
      <div className="breadcrumb">
        <a href="/">Steamworks Documentation</a> &gt; Talk
      </div>

      <div className="page-tabs">
        <button
          className="page-tab"
          onClick={() => navigate(getPagePath())}
        >
          Page
        </button>
        <button
          className="page-tab active"
          onClick={() => navigate(`/page/${slug}/talk`)}
        >
          Talk
        </button>
        <button
          className="page-tab"
          onClick={() => navigate(`/page/${slug}/history`)}
        >
          History
        </button>
      </div>

      <h1 className="page-title">Discussion</h1>

      <div className="talk-container">
        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Start the discussion!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="comment">
                <div className="comment-header">
                  <span className="comment-author">{comment.username || 'Unknown'}</span>
                  <span className="comment-date">{formatDate(comment.created_at)}</span>
                </div>
                <div
                  className="comment-content"
                  dangerouslySetInnerHTML={{ __html: renderBBCode(comment.content) }}
                />
              </div>
            ))
          )}
        </div>

        <div className="add-comment">
          <h3>Add a Comment</h3>
          <form onSubmit={handleSubmit}>
            <div className="editor-toolbar">
              <button type="button" className="toolbar-btn" onClick={() => insertBBCode('[b]', '[/b]')}>
                <strong>B</strong>
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertBBCode('[i]', '[/i]')}>
                <em>I</em>
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertBBCode('[u]', '[/u]')}>
                <u>U</u>
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertBBCode('[code]', '[/code]')}>
                Code
              </button>
              <button type="button" className="toolbar-btn" onClick={() => insertBBCode('[url=]', '[/url]')}>
                Link
              </button>
            </div>
            <textarea
              ref={textareaRef}
              className="comment-textarea"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write your comment here... (BBCode supported)"
              rows="6"
            />
            <button
              type="submit"
              className="submit-comment-btn"
              disabled={submitting || !newComment.trim()}
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default PageTalk;
