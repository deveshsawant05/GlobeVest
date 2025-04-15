"use client";

import { useState, useEffect } from 'react';
import io from 'socket.io-client';

export function useSocket(url) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!url) return;

    // Initialize socket connection
    const socketConnection = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Set socket in state
    setSocket(socketConnection);

    socketConnection.on('connect', () => {
      console.log('Socket connected');
    });

    socketConnection.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socketConnection.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    // Cleanup on unmount
    return () => {
      if (socketConnection) {
        socketConnection.disconnect();
      }
    };
  }, [url]);

  return socket;
} 