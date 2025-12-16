import { useState, useEffect, useRef } from 'react';
import { connectSocket } from './socketClient';

/**
 * Lightweight hook to show who's editing a page (for viewers).
 * Connects in 'viewing' mode so it doesn't affect the editing session.
 */
export function useViewingPresence(pageId) {
  const [editors, setEditors] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const joinedPageRef = useRef(null);
  const handlersRef = useRef(null); // Store handlers so we can remove exactly these handlers

  useEffect(() => {
    if (!pageId) return;

    // Skip if already joined this page
    if (joinedPageRef.current === pageId) return;

    const socket = connectSocket();

    // Clean up previous handlers if they exist (for page changes)
    if (handlersRef.current) {
      const h = handlersRef.current;
      socket.off('connect', h.handleConnect);
      socket.off('disconnect', h.handleDisconnect);
      socket.off('joined', h.handleJoined);
      socket.off('user-joined', h.handleUserJoined);
      socket.off('user-left', h.handleUserLeft);
    }

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('join-page', { pageId, mode: 'viewing' });
      joinedPageRef.current = pageId;
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleJoined = (data) => {
      // Filter to only show users in editing mode
      const editingUsers = (data.presence || []).filter(u => u.mode === 'editing');
      setEditors(editingUsers);
    };

    const handleUserJoined = (data) => {
      if (data.mode === 'editing') {
        setEditors(prev => {
          if (prev.find(u => u.user_id === data.userId)) {
            return prev;
          }
          return [...prev, {
            user_id: data.userId,
            username: data.username,
            cursor_color: data.cursorColor,
            mode: data.mode
          }];
        });
      }
    };

    const handleUserLeft = (data) => {
      setEditors(prev => prev.filter(u => u.user_id !== data.userId));
    };

    // Store handlers in ref so we can remove exactly these handlers later
    handlersRef.current = {
      handleConnect,
      handleDisconnect,
      handleJoined,
      handleUserJoined,
      handleUserLeft
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('joined', handleJoined);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);

    if (!socket.connected) {
      socket.connect();
    } else {
      socket.emit('join-page', { pageId, mode: 'viewing' });
      joinedPageRef.current = pageId;
      setIsConnected(true);
    }

    return () => {
      if (joinedPageRef.current === pageId) {
        socket.emit('leave-page', { pageId });
        joinedPageRef.current = null;
      }
      // Remove only our specific handlers (not all handlers for these events)
      if (handlersRef.current) {
        const h = handlersRef.current;
        socket.off('connect', h.handleConnect);
        socket.off('disconnect', h.handleDisconnect);
        socket.off('joined', h.handleJoined);
        socket.off('user-joined', h.handleUserJoined);
        socket.off('user-left', h.handleUserLeft);
        handlersRef.current = null;
      }
    };
  }, [pageId]);

  return { editors, isConnected };
}
