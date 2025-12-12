import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';
import Login from './components/Login';
import Wiki from './components/Wiki';

axios.defaults.withCredentials = true;

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState('user');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await axios.get('/api/auth/check');
      setAuthenticated(response.data.authenticated);
      setUsername(response.data.username);
      setUserRole(response.data.role || 'user');
    } catch (err) {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (user) => {
    setAuthenticated(true);
    setUsername(user);
    checkAuth(); // Re-fetch to get role
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/logout');
      setAuthenticated(false);
      setUsername('');
      setUserRole('user');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            authenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Login onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/*"
          element={
            authenticated ? (
              <Wiki username={username} userRole={userRole} onLogout={handleLogout} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
