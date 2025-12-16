import React, { useState, useEffect } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import axios from 'axios';
import Sidebar from './Sidebar';
import PageView from './PageView';
import PageEdit from './PageEdit';
import PageHistory from './PageHistory';
import PageTalk from './PageTalk';
import AdminDashboard from './AdminDashboard';
import NewPageModal from './NewPageModal';

function Wiki({ username, userId, userRole, onLogout }) {
  const [pages, setPages] = useState([]);
  const [showNewPageModal, setShowNewPageModal] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    try {
      const response = await axios.get('/api/pages');
      setPages(response.data);
    } catch (err) {
      console.error('Error loading pages:', err);
    }
  };

  const handlePageCreated = () => {
    loadPages();
    setShowNewPageModal(false);
  };

  const handlePageUpdated = () => {
    loadPages();
  };

  return (
    <>
      <div className="header">
        <div className="header-title">Steamworks Documentation</div>
        <div className="header-user">
          <span>Welcome, {username}</span>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>

      <div className="app-container">
        <Sidebar pages={pages} userRole={userRole} onAddPage={() => setShowNewPageModal(true)} />

        <div className="content">
          <Routes>
            <Route path="/" element={<PageView slug="welcome" onUpdate={handlePageUpdated} />} />
            <Route path="/page/:slug" element={<PageViewWrapper onUpdate={handlePageUpdated} />} />
            <Route path="/page/:slug/talk" element={<PageTalkWrapper />} />
            <Route path="/page/:slug/history" element={<PageHistoryWrapper />} />
            <Route path="/edit/:slug" element={<PageEditWrapper onUpdate={handlePageUpdated} username={username} userId={userId} />} />
            {userRole === 'admin' && <Route path="/admin" element={<AdminDashboard />} />}
          </Routes>
        </div>
      </div>

      {showNewPageModal && (
        <NewPageModal
          pages={pages}
          onClose={() => setShowNewPageModal(false)}
          onCreate={handlePageCreated}
        />
      )}
    </>
  );
}

function PageViewWrapper({ onUpdate }) {
  const { slug } = useParams();
  return <PageView slug={slug} onUpdate={onUpdate} />;
}

function PageEditWrapper({ onUpdate, username, userId }) {
  const { slug } = useParams();
  return <PageEdit slug={slug} onUpdate={onUpdate} username={username} userId={userId} />;
}

function PageTalkWrapper() {
  const { slug } = useParams();
  return <PageTalk slug={slug} />;
}

function PageHistoryWrapper() {
  const { slug } = useParams();
  return <PageHistory slug={slug} />;
}

export default Wiki;
