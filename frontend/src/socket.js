import { io } from 'socket.io-client';
import { CONFIG } from './config';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(CONFIG.WS_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('Socket.io connected to:', CONFIG.WS_URL);
    });

    socket.on('connect_error', (err) => {
      console.warn('Socket.io connection warning:', err.message);
    });
  }
  return socket;
}

export function subscribeToLogs(projectSlug, onMessage) {
  const s = getSocket();
  const channel = `logs:${projectSlug}`;

  s.emit('subscribe', channel);

  const handleMessage = (rawMessage) => {
    try {
      const payload = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
      onMessage(payload);
    } catch {
      onMessage({ log: String(rawMessage), level: 'info', stage: 'build' });
    }
  };

  s.on('message', handleMessage);

  return () => {
    s.off('message', handleMessage);
  };
}
