import React from 'react';

function PresenceBar({ presence, currentUsername }) {
  // Filter out current user and separate editors from viewers
  const others = presence.filter(u => u.username !== currentUsername);
  const editors = others.filter(u => u.mode === 'editing');
  const viewers = others.filter(u => u.mode === 'viewing');

  if (others.length === 0) {
    return null;
  }

  return (
    <div className="presence-bar">
      {editors.length > 0 && (
        <div className="presence-group editing">
          <span className="presence-label">Editing:</span>
          {editors.map(user => (
            <span
              key={user.user_id}
              className="presence-user"
              style={{ borderColor: user.cursor_color }}
            >
              <span
                className="presence-dot"
                style={{ backgroundColor: user.cursor_color }}
              />
              {user.username}
            </span>
          ))}
        </div>
      )}
      {viewers.length > 0 && (
        <div className="presence-group viewing">
          <span className="presence-label">Viewing:</span>
          {viewers.map(user => (
            <span key={user.user_id} className="presence-user viewing">
              <span className="presence-dot viewing" />
              {user.username}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default PresenceBar;
