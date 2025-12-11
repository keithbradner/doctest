import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

function Sidebar({ pages, userRole, onAddPage }) {
  const location = useLocation();
  const [expandedPages, setExpandedPages] = useState({});

  // Build hierarchical structure
  const buildTree = (pages) => {
    const pageMap = {};
    const rootPages = [];

    // Create a map of all pages
    pages.forEach(page => {
      pageMap[page.id] = { ...page, children: [] };
    });

    // Build the tree
    pages.forEach(page => {
      if (page.parent_id === null) {
        rootPages.push(pageMap[page.id]);
      } else if (pageMap[page.parent_id]) {
        pageMap[page.parent_id].children.push(pageMap[page.id]);
      }
    });

    return rootPages;
  };

  const toggleExpand = (pageId) => {
    setExpandedPages(prev => ({
      ...prev,
      [pageId]: !prev[pageId]
    }));
  };

  const renderNavItem = (page, depth = 0) => {
    const hasChildren = page.children && page.children.length > 0;
    const isExpanded = expandedPages[page.id] || page.is_expanded;
    const currentPath = location.pathname;
    const pagePath = page.slug === 'welcome' ? '/' : `/page/${page.slug}`;
    const isActive = currentPath === pagePath;

    const childClass = depth === 1 ? 'child' : depth === 2 ? 'child-2' : '';

    return (
      <div key={page.id}>
        <Link
          to={pagePath}
          className={`nav-item ${childClass} ${isActive ? 'active' : ''}`}
        >
          {hasChildren && (
            <span
              className={`nav-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}
              onClick={(e) => {
                e.preventDefault();
                toggleExpand(page.id);
              }}
            />
          )}
          {!hasChildren && <span className="nav-toggle no-children" />}
          <span>{page.title}</span>
        </Link>
        {hasChildren && isExpanded && (
          <div>
            {page.children.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const tree = buildTree(pages);

  return (
    <div className="sidebar">
      {tree.map(page => renderNavItem(page))}
      {userRole === 'admin' && (
        <Link
          to="/admin"
          className={`nav-item ${location.pathname === '/admin' ? 'active' : ''}`}
        >
          <span className="nav-toggle no-children" />
          <span>⚙️ Admin Dashboard</span>
        </Link>
      )}
      <button className="add-page-btn" onClick={onAddPage}>
        + New Page
      </button>
    </div>
  );
}

export default Sidebar;
