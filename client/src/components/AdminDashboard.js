import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import JSZip from 'jszip';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewStats, setViewStats] = useState([]);
  const [editStats, setEditStats] = useState([]);
  const [recentViews, setRecentViews] = useState([]);
  const [recentEdits, setRecentEdits] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [deletedPages, setDeletedPages] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(true);
  const [passwordChange, setPasswordChange] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [adminPasswordChange, setAdminPasswordChange] = useState({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview' || activeTab === 'views') {
        const viewsRes = await axios.get('/api/admin/analytics/views');
        setViewStats(viewsRes.data);

        const recentViewsRes = await axios.get('/api/admin/analytics/recent-views');
        setRecentViews(recentViewsRes.data);
      }

      if (activeTab === 'overview' || activeTab === 'edits') {
        const editsRes = await axios.get('/api/admin/analytics/edits');
        setEditStats(editsRes.data);

        const recentEditsRes = await axios.get('/api/admin/analytics/recent-edits');
        setRecentEdits(recentEditsRes.data);
      }

      if (activeTab === 'users') {
        const activityRes = await axios.get('/api/admin/analytics/user-activity');
        setUserActivity(activityRes.data);
      }

      if (activeTab === 'deleted') {
        const deletedRes = await axios.get('/api/admin/deleted-pages');
        setDeletedPages(deletedRes.data);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
      if (err.response?.status === 403) {
        alert('Admin access required');
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/users/register', newUser);
      setNewUser({ username: '', password: '', role: 'user' });
      loadData();
      alert('User created successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await axios.put(`/api/users/${userId}/role`, { role: newRole });
      loadData();
    } catch (err) {
      alert('Failed to update role');
    }
  };

  const handleChangeOwnPassword = async (e) => {
    e.preventDefault();

    if (passwordChange.newPassword !== passwordChange.confirmPassword) {
      alert('New passwords do not match');
      return;
    }

    if (passwordChange.newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await axios.put('/api/users/change-password', {
        currentPassword: passwordChange.currentPassword,
        newPassword: passwordChange.newPassword
      });
      setPasswordChange({ currentPassword: '', newPassword: '', confirmPassword: '' });
      alert('Password changed successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to change password');
    }
  };

  const handleAdminChangePassword = async (userId, username) => {
    const newPassword = adminPasswordChange[userId];

    if (!newPassword) {
      alert('Please enter a new password');
      return;
    }

    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    if (!window.confirm(`Change password for user "${username}"?`)) {
      return;
    }

    try {
      await axios.put(`/api/users/${userId}/password`, { newPassword });
      setAdminPasswordChange({ ...adminPasswordChange, [userId]: '' });
      alert('Password changed successfully');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to change password');
    }
  };

  const handleRestorePage = async (slug) => {
    if (!window.confirm('Are you sure you want to restore this page?')) {
      return;
    }

    try {
      await axios.post(`/api/admin/pages/${slug}/restore`);
      alert('Page restored successfully');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to restore page');
    }
  };

  const handlePermanentDelete = async (slug, title) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete "${title}"? This action cannot be undone and all history will be lost!`)) {
      return;
    }

    try {
      await axios.delete(`/api/admin/pages/${slug}/permanent`);
      alert('Page permanently deleted');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to permanently delete page');
    }
  };

  const handleExportAllPages = async () => {
    try {
      const response = await axios.get('/api/pages');
      const pages = response.data;

      const zip = new JSZip();

      pages.forEach(page => {
        const filename = `${page.slug}.txt`;
        zip.file(filename, page.content);
      });

      const blob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wiki-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting pages:', err);
      alert('Failed to export pages');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && activeTab !== 'users') {
    return <div className="loading">Loading admin dashboard...</div>;
  }

  return (
    <div className="content-inner">
      <h1 className="page-title">Admin Dashboard</h1>

      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`admin-tab ${activeTab === 'views' ? 'active' : ''}`}
          onClick={() => setActiveTab('views')}
        >
          Page Views
        </button>
        <button
          className={`admin-tab ${activeTab === 'edits' ? 'active' : ''}`}
          onClick={() => setActiveTab('edits')}
        >
          Edits
        </button>
        <button
          className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`admin-tab ${activeTab === 'deleted' ? 'active' : ''}`}
          onClick={() => setActiveTab('deleted')}
        >
          Deleted Pages
        </button>
        <button
          className={`admin-tab ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          Account
        </button>
        <button
          className={`admin-tab ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => setActiveTab('export')}
        >
          Export
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="admin-overview">
          <div className="admin-section">
            <h2>Top Viewed Pages</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Total Views</th>
                  <th>Unique Visitors</th>
                  <th>Last Viewed</th>
                </tr>
              </thead>
              <tbody>
                {viewStats.slice(0, 10).map(stat => (
                  <tr key={stat.id}>
                    <td><a href={`/page/${stat.slug}`}>{stat.title}</a></td>
                    <td>{stat.view_count}</td>
                    <td>{stat.unique_visitors}</td>
                    <td>{stat.last_viewed ? formatDate(stat.last_viewed) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-section">
            <h2>Most Edited Pages</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Total Edits</th>
                  <th>Unique Editors</th>
                  <th>Last Edited</th>
                </tr>
              </thead>
              <tbody>
                {editStats.slice(0, 10).map(stat => (
                  <tr key={stat.id}>
                    <td><a href={`/page/${stat.slug}`}>{stat.title}</a></td>
                    <td>{stat.edit_count}</td>
                    <td>{stat.unique_editors}</td>
                    <td>{stat.last_edited ? formatDate(stat.last_edited) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'views' && (
        <div>
          <div className="admin-section">
            <h2>Page View Statistics</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Total Views</th>
                  <th>Unique Visitors</th>
                  <th>Last Viewed</th>
                </tr>
              </thead>
              <tbody>
                {viewStats.map(stat => (
                  <tr key={stat.id}>
                    <td><a href={`/page/${stat.slug}`}>{stat.title}</a></td>
                    <td>{stat.view_count}</td>
                    <td>{stat.unique_visitors}</td>
                    <td>{stat.last_viewed ? formatDate(stat.last_viewed) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-section">
            <h2>Recent Page Views</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Page</th>
                </tr>
              </thead>
              <tbody>
                {recentViews.map(view => (
                  <tr key={view.id}>
                    <td>{formatDate(view.viewed_at)}</td>
                    <td>{view.username}</td>
                    <td><a href={`/page/${view.slug}`}>{view.title}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'edits' && (
        <div>
          <div className="admin-section">
            <h2>Edit Statistics</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Total Edits</th>
                  <th>Unique Editors</th>
                  <th>Last Edited</th>
                </tr>
              </thead>
              <tbody>
                {editStats.map(stat => (
                  <tr key={stat.id}>
                    <td><a href={`/page/${stat.slug}`}>{stat.title}</a></td>
                    <td>{stat.edit_count}</td>
                    <td>{stat.unique_editors}</td>
                    <td>{stat.last_edited ? formatDate(stat.last_edited) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-section">
            <h2>Recent Edits</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Page</th>
                </tr>
              </thead>
              <tbody>
                {recentEdits.map(edit => (
                  <tr key={edit.id}>
                    <td>{formatDate(edit.created_at)}</td>
                    <td>{edit.username}</td>
                    <td><a href={`/page/${edit.slug}`}>{edit.title}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div>
          <div className="admin-section">
            <h2>Create New User</h2>
            <form onSubmit={handleCreateUser} className="admin-form">
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Username"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  required
                />
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <button type="submit" className="create-user-btn">Create User</button>
              </div>
            </form>
          </div>

          <div className="admin-section">
            <h2>User Activity</h2>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Page Views</th>
                  <th>Edits</th>
                  <th>Comments</th>
                  <th>Member Since</th>
                  <th>Change Password</th>
                </tr>
              </thead>
              <tbody>
                {userActivity.map(user => (
                  <tr key={user.id}>
                    <td>{user.username}</td>
                    <td>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="role-select"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td>{user.page_views}</td>
                    <td>{user.edits}</td>
                    <td>{user.comments}</td>
                    <td>{formatDate(user.created_at)}</td>
                    <td>
                      <div className="password-change-inline">
                        <input
                          type="password"
                          placeholder="New password"
                          value={adminPasswordChange[user.id] || ''}
                          onChange={(e) => setAdminPasswordChange({...adminPasswordChange, [user.id]: e.target.value})}
                          className="password-input"
                        />
                        <button
                          className="change-password-btn"
                          onClick={() => handleAdminChangePassword(user.id, user.username)}
                        >
                          Change
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'deleted' && (
        <div>
          <div className="admin-section">
            <h2>Deleted Pages</h2>
            {deletedPages.length === 0 ? (
              <p>No deleted pages found.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Slug</th>
                    <th>Deleted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deletedPages.map(page => (
                    <tr key={page.id}>
                      <td>{page.title}</td>
                      <td>{page.slug}</td>
                      <td>{formatDate(page.deleted_at)}</td>
                      <td>
                        <button
                          className="restore-btn"
                          onClick={() => handleRestorePage(page.slug)}
                          style={{ marginRight: '10px' }}
                        >
                          Restore
                        </button>
                        <button
                          className="delete-permanent-btn"
                          onClick={() => handlePermanentDelete(page.slug, page.title)}
                        >
                          Delete Forever
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'account' && (
        <div>
          <div className="admin-section">
            <h2>Change Your Password</h2>
            <form onSubmit={handleChangeOwnPassword} className="password-change-form">
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordChange.currentPassword}
                  onChange={(e) => setPasswordChange({...passwordChange, currentPassword: e.target.value})}
                  required
                  placeholder="Enter your current password"
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordChange.newPassword}
                  onChange={(e) => setPasswordChange({...passwordChange, newPassword: e.target.value})}
                  required
                  placeholder="At least 6 characters"
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordChange.confirmPassword}
                  onChange={(e) => setPasswordChange({...passwordChange, confirmPassword: e.target.value})}
                  required
                  placeholder="Re-enter new password"
                />
              </div>
              <button type="submit" className="save-btn">Change Password</button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'export' && (
        <div>
          <div className="admin-section">
            <h2>Export All Pages</h2>
            <p>Download all wiki pages as a zip file. Each page will be saved as a .txt file containing the raw BBCode content.</p>
            <button className="save-btn" onClick={handleExportAllPages}>
              Download All Pages (.zip)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
