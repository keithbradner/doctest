import React from 'react';

function CollabControls({
  hasDraft,
  isSaving,
  lastSaved,
  lastEditedBy,
  onPublish,
  onRevert,
  isConnected,
  error
}) {
  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="collab-controls">
      <div className="collab-status">
        <span className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Reconnecting...'}
        </span>

        {error && (
          <span className="error-indicator" title={error}>
            Error
          </span>
        )}

        {hasDraft && !error && (
          <span className="draft-indicator">
            Draft{lastEditedBy ? ` by ${lastEditedBy}` : ''} (unpublished)
          </span>
        )}

        {isSaving && <span className="saving-indicator">Saving...</span>}

        {lastSaved && !isSaving && (
          <span className="last-saved">
            Last saved: {formatTime(lastSaved)}
          </span>
        )}
      </div>

      <div className="collab-actions">
        <button
          className="revert-btn"
          onClick={onRevert}
          disabled={!hasDraft || !isConnected}
          title="Discard draft and revert to last published version"
        >
          Revert
        </button>

        <button
          className="publish-btn"
          onClick={onPublish}
          disabled={!hasDraft || !isConnected}
          title="Publish current draft as the live version"
        >
          Publish
        </button>
      </div>
    </div>
  );
}

export default CollabControls;
