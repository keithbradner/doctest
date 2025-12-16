import { useState, useEffect, useCallback, useRef } from 'react';
import { connectSocket } from './socketClient';

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

  const socketRef = useRef(null);
  const pendingChangeRef = useRef(null);
  const localChangeRef = useRef(false); // Track if change is local

  // Update content when initial values change (page load)
  useEffect(() => {
    if (!localChangeRef.current) {
      setContent(initialContent);
      setTitle(initialTitle);
    }
  }, [initialContent, initialTitle]);

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
      // Only update if it's from another user
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
  }, [pageId]);

  // Send content changes (debounced)
  const handleLocalChange = useCallback((newContent, newTitle) => {
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
  }, [pageId]);

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
