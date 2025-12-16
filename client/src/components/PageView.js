import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useViewingPresence } from '../collab/useViewingPresence';
import EditingIndicator from '../collab/EditingIndicator';

function PageView({ slug, onUpdate }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Track who's editing this page
  const { editors } = useViewingPresence(page?.id);

  useEffect(() => {
    const loadPage = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/pages/${slug}`);
        setPage(response.data);
      } catch (err) {
        console.error('Error loading page:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPage();
  }, [slug]);

  const handleEdit = () => {
    navigate(`/edit/${slug}`);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${page.title}"? This page can be restored by an admin.`)) {
      return;
    }

    try {
      await axios.delete(`/api/pages/${slug}`);
      alert('Page deleted successfully');
      navigate('/');
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Error deleting page:', err);
      alert('Failed to delete page');
    }
  };

  const getPagePath = () => {
    return slug === 'welcome' ? '/' : `/page/${slug}`;
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
        <a href="/">Steamworks Documentation</a> &gt; {page.title}
      </div>

      <div className="page-tabs">
        <button
          className="page-tab active"
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
          className="page-tab"
          onClick={() => navigate(`/page/${slug}/history`)}
        >
          History
        </button>
      </div>

      <div className="page-header">
        <h1 className="page-title">{page.title}</h1>
        <div>
          <button className="edit-btn" onClick={handleEdit}>
            Edit Page
          </button>
          <button className="delete-btn" onClick={handleDelete} style={{ marginLeft: '10px' }}>
            Delete Page
          </button>
        </div>
      </div>

      <EditingIndicator editors={editors} />

      <div
        className="page-content"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
}

export default PageView;
