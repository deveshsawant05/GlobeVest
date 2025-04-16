"use client";

import { useState, useEffect } from 'react';
import io from 'socket.io-client';

export function useSocket(url) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!url) {
      console.warn("No WebSocket URL provided, skipping connection");
      return;
    }

    console.log(`Initializing WebSocket connection to: ${url}`);

    // Initialize socket connection
    const socketConnection = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true,
      withCredentials: true
    });

    // Set socket in state
    setSocket(socketConnection);

    socketConnection.on('connect', () => {
      console.log(`Socket connected to ${url} with ID: ${socketConnection.id}`);
    });

    socketConnection.on('connect_error', (error) => {
      console.error(`Socket connection error to ${url}:`, error.message);
    });

    socketConnection.on('error', (error) => {
      console.error(`Socket error on ${url}:`, error);
    });

    socketConnection.on('disconnect', (reason) => {
      console.log(`Socket disconnected from ${url}. Reason: ${reason}`);
      if (reason === 'io server disconnect') {
        // the disconnection was initiated by the server, reconnect manually
        console.log('Attempting manual reconnection...');
        socketConnection.connect();
      }
    });

    socketConnection.on('reconnect', (attemptNumber) => {
      console.log(`Successfully reconnected to ${url} after ${attemptNumber} attempts`);
    });

    socketConnection.on('reconnect_attempt', (attemptNumber) => {
      console.log(`Reconnection attempt ${attemptNumber} to ${url}`);
    });

    socketConnection.on('reconnect_error', (error) => {
      console.error(`Reconnection error to ${url}:`, error.message);
    });

    socketConnection.on('reconnect_failed', () => {
      console.error(`Failed to reconnect to ${url} after multiple attempts`);
    });

    // Cleanup on unmount
    return () => {
      if (socketConnection) {
        console.log(`Closing WebSocket connection to ${url}`);
        socketConnection.disconnect();
      }
    };
  }, [url]);

  return socket;
} 