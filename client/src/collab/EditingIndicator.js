import React from 'react';

/**
 * Shows a banner when someone is editing the page.
 */
function EditingIndicator({ editors }) {
  if (!editors || editors.length === 0) {
    return null;
  }

  const names = editors.map(e => e.username).join(', ');
  const isPlural = editors.length > 1;

  return (
    <div className="editing-indicator">
      <span className="editing-indicator-dot"></span>
      <span className="editing-indicator-text">
        {names} {isPlural ? 'are' : 'is'} currently editing this page
      </span>
    </div>
  );
}

export default EditingIndicator;
