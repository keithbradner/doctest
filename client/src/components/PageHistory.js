import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function PageHistory({ slug }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDiffs, setExpandedDiffs] = useState({});
  const navigate = useNavigate();

  useEffect(() => {
    loadHistory();
  }, [slug]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/pages/${slug}/history`);
      setHistory(response.data);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDiff = (historyId) => {
    setExpandedDiffs(prev => ({
      ...prev,
      [historyId]: !prev[historyId]
    }));
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

  if (loading) {
    return <div className="loading">Loading history...</div>;
  }

  const getPagePath = () => {
    return slug === 'welcome' ? '/' : `/page/${slug}`;
  };

  if (history.length === 0) {
    return (
      <div className="content-inner">
        <div className="breadcrumb">
          <a href="/">Steamworks Documentation</a> &gt; History
        </div>

        <div className="page-tabs">
          <button
            className="page-tab"
            onClick={() => navigate(getPagePath())}
          >
            Page
          </button>
          <button
            className="page-tab"
            onClick={() => navigate(`/page/${slug}/talk`)}
          >
            Talk
          </button>
          <button
            className="page-tab active"
            onClick={() => navigate(`/page/${slug}/history`)}
          >
            History
          </button>
        </div>

        <h1 className="page-title">History</h1>
        <p>No edit history available for this page yet.</p>
      </div>
    );
  }

  return (
    <div className="content-inner">
      <div className="breadcrumb">
        <a href="/">Steamworks Documentation</a> &gt; History
      </div>

      <div className="page-tabs">
        <button
          className="page-tab"
          onClick={() => navigate(getPagePath())}
        >
          Page
        </button>
        <button
          className="page-tab"
          onClick={() => navigate(`/page/${slug}/talk`)}
        >
          Talk
        </button>
        <button
          className="page-tab active"
          onClick={() => navigate(`/page/${slug}/history`)}
        >
          History
        </button>
      </div>

      <h1 className="page-title">Edit History</h1>

      <div className="history-list">
        {history.map((entry) => (
          <div key={entry.id} className="history-entry">
            <div className="history-header">
              <div className="history-meta">
                <span className="history-date">{formatDate(entry.created_at)}</span>
                <span className="history-user">by {entry.username || 'Unknown'}</span>
              </div>
              <button
                className="history-toggle-btn"
                onClick={() => toggleDiff(entry.id)}
              >
                {expandedDiffs[entry.id] ? 'Hide Changes' : 'Show Changes'}
              </button>
            </div>

            {expandedDiffs[entry.id] && (
              <div className="history-diff">
                <div className="diff-title">
                  <strong>Title:</strong> {entry.title}
                </div>
                <div className="diff-content">
                  {entry.diffParsed && entry.diffParsed.length > 0 ? (
                    entry.diffParsed.map((line, index) => (
                      <div
                        key={index}
                        className={`diff-line diff-${line.type}`}
                      >
                        <span className="diff-marker">
                          {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                        </span>
                        <span className="diff-text">{line.line}</span>
                      </div>
                    ))
                  ) : (
                    <div className="diff-line">No changes</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default PageHistory;
