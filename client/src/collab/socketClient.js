import { io } from 'socket.io-client';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    // Determine the server URL based on environment
    const serverUrl = process.env.NODE_ENV === 'production'
      ? window.location.origin
      : 'http://localhost:3001';

    socket = io(`${serverUrl}/collab`, {
      withCredentials: true,
      transports: ['websocket', 'polling'], // WebSocket first, fallback to polling
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000
    });

    // Debug logging
    socket.on('connect', () => {
      console.log('Connected to collaboration server');
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from collaboration server:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
};

export const isConnected = () => {
  return socket && socket.connected;
};
