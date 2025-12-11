import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function PageView({ slug, onUpdate }) {
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadPage();
  }, [slug]);

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

  const handleEdit = () => {
    navigate(`/edit/${slug}`);
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

      <div className="page-header">
        <h1 className="page-title">{page.title}</h1>
        <button className="edit-btn" onClick={handleEdit}>
          Edit Page
        </button>
      </div>

      <div
        className="page-content"
        dangerouslySetInnerHTML={{ __html: page.html }}
      />
    </div>
  );
}

export default PageView;
