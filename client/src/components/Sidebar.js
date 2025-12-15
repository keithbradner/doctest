import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { extractSections } from '../utils/bbcode';

function Sidebar({ pages, userRole, onAddPage }) {
  const location = useLocation();
  const [expandedPages, setExpandedPages] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

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

  const toggleSectionExpand = (sectionKey) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const renderSections = (sections, pageSlug, baseDepth = 1) => {
    if (!sections || sections.length === 0) return null;

    return (
      <div>
        {sections.map((section, idx) => {
          const sectionKey = `${pageSlug}-section-${idx}`;
          const hasSubsections = section.subsections && section.subsections.length > 0;
          const isSectionExpanded = expandedSections[sectionKey];
          const sectionDepthClass = baseDepth === 1 ? 'child' : 'child-2';

          return (
            <div key={sectionKey}>
              <a
                href={section.anchor ? `/page/${pageSlug}#${encodeURIComponent(section.anchor)}` : `/page/${pageSlug}`}
                className={`nav-item ${sectionDepthClass}`}
              >
                {hasSubsections && (
                  <span
                    className={`nav-toggle ${isSectionExpanded ? 'expanded' : 'collapsed'}`}
                    onClick={(e) => {
                      e.preventDefault();
                      toggleSectionExpand(sectionKey);
                    }}
                  />
                )}
                {!hasSubsections && <span className="nav-toggle no-children" />}
                <span>{section.title}</span>
              </a>
              {hasSubsections && isSectionExpanded && (
                <div>
                  {section.subsections.map((subsection, subIdx) => (
                    <a
                      key={`${sectionKey}-sub-${subIdx}`}
                      href={subsection.anchor ? `/page/${pageSlug}#${encodeURIComponent(subsection.anchor)}` : `/page/${pageSlug}`}
                      className="nav-item child-2"
                    >
                      <span className="nav-toggle no-children" />
                      <span>{subsection.title}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderNavItem = (page, depth = 0) => {
    const hasChildren = page.children && page.children.length > 0;
    const isExpanded = expandedPages[page.id] || page.is_expanded;
    const currentPath = location.pathname;
    const pagePath = page.slug === 'welcome' ? '/' : `/page/${page.slug}`;
    const isActive = currentPath === pagePath || currentPath === `/edit/${page.slug}`;

    // Extract sections from content for the active page
    const sections = isActive && page.content ? extractSections(page.content) : [];
    const hasSections = sections.length > 0;

    const childClass = depth === 1 ? 'child' : depth === 2 ? 'child-2' : '';

    return (
      <div key={page.id}>
        <Link
          to={pagePath}
          className={`nav-item ${childClass} ${isActive ? 'active' : ''}`}
        >
          {(hasChildren || hasSections) && (
            <span
              className={`nav-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}
              onClick={(e) => {
                e.preventDefault();
                toggleExpand(page.id);
              }}
            />
          )}
          {!hasChildren && !hasSections && <span className="nav-toggle no-children" />}
          <span>{page.title}</span>
        </Link>
        {isActive && hasSections && renderSections(sections, page.slug)}
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
