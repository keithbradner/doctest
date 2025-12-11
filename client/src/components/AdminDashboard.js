import React, { useState, useEffect } from 'react';
import axios from 'axios';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [viewStats, setViewStats] = useState([]);
  const [editStats, setEditStats] = useState([]);
  const [recentViews, setRecentViews] = useState([]);
  const [recentEdits, setRecentEdits] = useState([]);
  const [userActivity, setUserActivity] = useState([]);
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
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
        const usersRes = await axios.get('/api/users');
        setUsers(usersRes.data);

        const activityRes = await axios.get('/api/admin/analytics/user-activity');
        setUserActivity(activityRes.data);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
      if (err.response?.status === 403) {
        alert('Admin access required');
      }
    } finally {
      setLoading(false);
    }
  };

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
                  <th>Actions</th>
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
                      <button className="view-activity-btn" disabled>View Details</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
