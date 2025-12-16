import { useState, useEffect, useCallback, useRef } from 'react';
import { connectSocket } from './socketClient';

/**
 * Find the edit point and length change between old and new content.
 * Returns { editStart, lengthDiff } where:
 * - editStart: position where the edit began
 * - lengthDiff: positive for insertions, negative for deletions
 */
function findEditDelta(oldContent, newContent) {
  // Find first difference from start
  let editStart = 0;
  const minLen = Math.min(oldContent.length, newContent.length);
  while (editStart < minLen && oldContent[editStart] === newContent[editStart]) {
    editStart++;
  }

  // Find first difference from end
  let oldEnd = oldContent.length;
  let newEnd = newContent.length;
  while (oldEnd > editStart && newEnd > editStart &&
         oldContent[oldEnd - 1] === newContent[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const lengthDiff = newContent.length - oldContent.length;
  return { editStart, lengthDiff };
}

/**
 * Transform a cursor position based on an edit.
 * If the cursor is at or after the edit point, shift it by the length difference.
 */
function transformPosition(position, editStart, lengthDiff) {
  if (position <= editStart) {
    return position;
  }
  return Math.max(editStart, position + lengthDiff);
}

export function useCollaboration(pageId, initialContent = '', initialTitle = '') {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [presence, setPresence] = useState([]);
  const [cursors, setCursors] = useState({});
  const [hasDraft, setHasDraft] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [editRanges, setEditRanges] = useState([]); // Track recent edits for highlighting

  const socketRef = useRef(null);
  const pendingChangeRef = useRef(null);
  const localChangeRef = useRef(false); // Track if change is local
  const contentRef = useRef(initialContent); // Track content for cursor transformation

  // Update content when initial values change (page load)
  useEffect(() => {
    if (!localChangeRef.current) {
      setContent(initialContent);
      setTitle(initialTitle);
      contentRef.current = initialContent;
    }
  }, [initialContent, initialTitle]);

  // Add an edit range for highlighting (with automatic cleanup)
  const addEditRange = useCallback((start, end, userId, color) => {
    const timestamp = Date.now();
    setEditRanges(prev => {
      // Remove old ranges (older than 2 seconds) and add new one
      const filtered = prev.filter(r => Date.now() - r.timestamp < 2000);
      return [...filtered, { start, end, timestamp, userId, color }];
    });
  }, []);

  // Clean up old edit ranges periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setEditRanges(prev => prev.filter(r => Date.now() - r.timestamp < 2000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Transform all cursor positions based on content change
  const transformCursors = useCallback((oldContent, newContent, excludeUserId = null) => {
    if (oldContent === newContent) return;

    const { editStart, lengthDiff } = findEditDelta(oldContent, newContent);
    if (lengthDiff === 0 && editStart === oldContent.length) return; // No actual change

    setCursors(prev => {
      const newCursors = {};
      for (const [userId, cursorData] of Object.entries(prev)) {
        // Skip the user who made the edit (their cursor is already correct)
        if (excludeUserId !== null && parseInt(userId) === excludeUserId) {
          newCursors[userId] = cursorData;
          continue;
        }

        newCursors[userId] = {
          ...cursorData,
          position: transformPosition(cursorData.position || 0, editStart, lengthDiff),
          selectionStart: transformPosition(cursorData.selectionStart || 0, editStart, lengthDiff),
          selectionEnd: transformPosition(cursorData.selectionEnd || 0, editStart, lengthDiff)
        };
      }
      return newCursors;
    });
  }, []);

  // Connect and join room on mount
  useEffect(() => {
    if (!pageId) return;

    const socket = connectSocket();
    socketRef.current = socket;

    // Connection handlers
    const handleConnect = () => {
      setIsConnected(true);
      setError(null);
      // Join the page room
      socket.emit('join-page', { pageId, mode: 'editing' });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = (err) => {
      setError(`Connection error: ${err.message}`);
      setIsConnected(false);
    };

    // Collaboration event handlers
    const handleJoined = (data) => {
      console.log('Joined page:', data);
      if (data.draft) {
        contentRef.current = data.draft.content;
        setContent(data.draft.content);
        setTitle(data.draft.title);
        setLastSaved(data.draft.lastModifiedAt);
      }
      setPresence(data.presence || []);
      setCursors(data.cursors || {});
      setHasDraft(data.hasDraft || false);
    };

    const handleUserJoined = (data) => {
      console.log('User joined:', data);
      setPresence(prev => {
        // Avoid duplicates
        if (prev.find(u => u.user_id === data.userId)) {
          return prev.map(u =>
            u.user_id === data.userId
              ? { ...u, mode: data.mode, cursor_color: data.cursorColor }
              : u
          );
        }
        return [...prev, {
          user_id: data.userId,
          username: data.username,
          cursor_color: data.cursorColor,
          mode: data.mode
        }];
      });
    };

    const handleUserLeft = (data) => {
      console.log('User left:', data);
      setPresence(prev => prev.filter(u => u.user_id !== data.userId));
      setCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[data.userId];
        return newCursors;
      });
    };

    const handleContentUpdated = (data) => {
      console.log('Content updated by:', data.username);
      // Transform cursor positions before updating content
      const oldContent = contentRef.current;
      transformCursors(oldContent, data.content, data.userId);

      // Track the edit range for highlighting
      const { editStart, lengthDiff } = findEditDelta(oldContent, data.content);
      if (lengthDiff > 0) {
        // Insertion - highlight the new text
        // Get user's cursor color from presence
        const userPresence = presence.find(p => p.user_id === data.userId);
        const color = userPresence?.cursor_color
          ? `${userPresence.cursor_color}40` // Add alpha for softer highlight
          : 'rgba(255, 230, 0, 0.25)';
        addEditRange(editStart, editStart + lengthDiff, data.userId, color);
      }

      // Update content ref and state
      contentRef.current = data.content;
      localChangeRef.current = false;
      setContent(data.content);
      setTitle(data.title);
      setHasDraft(true);
    };

    const handleCursorUpdated = (data) => {
      setCursors(prev => ({
        ...prev,
        [data.userId]: {
          ...prev[data.userId],
          position: data.position,
          selectionStart: data.selectionStart,
          selectionEnd: data.selectionEnd
        }
      }));
    };

    const handleDraftSaved = (data) => {
      setIsSaving(false);
      setLastSaved(data.savedAt);
      setHasDraft(true);
    };

    const handlePublished = (data) => {
      console.log('Published by:', data.publishedBy);
      setHasDraft(false);
      setLastSaved(data.publishedAt);
    };

    const handleReverted = (data) => {
      console.log('Reverted by:', data.revertedBy);
      contentRef.current = data.content;
      localChangeRef.current = false;
      setContent(data.content);
      setTitle(data.title);
      setHasDraft(false);
    };

    const handleError = (data) => {
      console.error('Collaboration error:', data);
      setError(data.message);
    };

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('joined', handleJoined);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('content-updated', handleContentUpdated);
    socket.on('cursor-updated', handleCursorUpdated);
    socket.on('draft-saved', handleDraftSaved);
    socket.on('published', handlePublished);
    socket.on('reverted', handleReverted);
    socket.on('error', handleError);

    // Connect if not already connected
    if (!socket.connected) {
      socket.connect();
    } else {
      // Already connected, just join the room
      socket.emit('join-page', { pageId, mode: 'editing' });
      setIsConnected(true);
    }

    // Cleanup on unmount or page change
    return () => {
      if (pendingChangeRef.current) {
        clearTimeout(pendingChangeRef.current);
      }
      socket.emit('leave-page', { pageId });
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('joined', handleJoined);
      socket.off('user-joined', handleUserJoined);
      socket.off('user-left', handleUserLeft);
      socket.off('content-updated', handleContentUpdated);
      socket.off('cursor-updated', handleCursorUpdated);
      socket.off('draft-saved', handleDraftSaved);
      socket.off('published', handlePublished);
      socket.off('reverted', handleReverted);
      socket.off('error', handleError);
    };
  }, [pageId, transformCursors, addEditRange, presence]);

  // Send content changes (debounced)
  const handleLocalChange = useCallback((newContent, newTitle) => {
    // Transform remote cursor positions based on local edit
    const oldContent = contentRef.current;
    transformCursors(oldContent, newContent);

    // Update content ref and state
    contentRef.current = newContent;
    localChangeRef.current = true;
    setContent(newContent);
    setTitle(newTitle);
    setHasDraft(true);
    setIsSaving(true);

    // Debounce sending to server
    if (pendingChangeRef.current) {
      clearTimeout(pendingChangeRef.current);
    }
    pendingChangeRef.current = setTimeout(() => {
      socketRef.current?.emit('content-change', {
        pageId,
        content: newContent,
        title: newTitle
      });
    }, 150); // 150ms debounce
  }, [pageId, transformCursors]);

  // Send cursor position (called on selection change)
  const handleCursorChange = useCallback((position, selectionStart, selectionEnd) => {
    socketRef.current?.emit('cursor-move', {
      pageId,
      position,
      selectionStart,
      selectionEnd
    });
  }, [pageId]);

  // Publish draft to live page
  const publish = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Not connected'));
        return;
      }

      const handlePublished = (data) => {
        socketRef.current.off('published', handlePublished);
        socketRef.current.off('error', handleError);
        resolve(data);
      };

      const handleError = (data) => {
        socketRef.current.off('published', handlePublished);
        socketRef.current.off('error', handleError);
        reject(new Error(data.message));
      };

      socketRef.current.on('published', handlePublished);
      socketRef.current.on('error', handleError);
      socketRef.current.emit('publish', { pageId });
    });
  }, [pageId]);

  // Revert to published version
  const revert = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!socketRef.current) {
        reject(new Error('Not connected'));
        return;
      }

      const handleReverted = (data) => {
        socketRef.current.off('reverted', handleReverted);
        socketRef.current.off('error', handleError);
        resolve(data);
      };

      const handleError = (data) => {
        socketRef.current.off('reverted', handleReverted);
        socketRef.current.off('error', handleError);
        reject(new Error(data.message));
      };

      socketRef.current.on('reverted', handleReverted);
      socketRef.current.on('error', handleError);
      socketRef.current.emit('revert', { pageId });
    });
  }, [pageId]);

  return {
    content,
    title,
    presence,
    cursors,
    editRanges,
    hasDraft,
    isSaving,
    lastSaved,
    isConnected,
    error,
    handleLocalChange,
    handleCursorChange,
    publish,
    revert
  };
}
