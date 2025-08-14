//沢田つけたし

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: 'photo' | 'notification' | 'connection';
  data: string;
  timestamp: number;
  senderId: string;
}

function buildWsBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_WS_URL;
  return `${explicit}/ws_test/ws`
  const apiBase = process.env.NEXT_PUBLIC_API_ENDPOINT;
  if (apiBase) {
    try {
      const u = new URL(apiBase);
      const protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${u.host}/ws_test/ws`;
    } catch {}
  }
  return 'ws://localhost:8000/ws_test/ws';
}

export function useWebSocket(roomId: string, userId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanupTimer = () => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const scheduleReconnect = useCallback(() => {
    cleanupTimer();
    const attempt = Math.min(retryRef.current + 1, 6);
    retryRef.current = attempt;
    const delayMs = Math.floor(1000 * Math.pow(2, attempt - 1));
    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delayMs);
  }, []);

  const connect = useCallback(() => {
    try {
      const wsBase = buildWsBaseUrl();
      const wsUrl = `${wsBase}/${roomId}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected:', wsUrl);
        setIsConnected(true);
        retryRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);
          if (message.type !== 'connection') {
            console.log('Received message:', message.type);
          }
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = (ev) => {
        console.warn('WebSocket disconnected', ev.code, ev.reason);
        setIsConnected(false);
        scheduleReconnect();
      };

      ws.onerror = () => {
        console.warn('WebSocket error event', { readyState: ws.readyState });
        setIsConnected(false);
        try { ws.close(); } catch {}
      };

      wsRef.current = ws;
    } catch (error) {
      console.warn('Failed to connect WebSocket:', error);
      setIsConnected(false);
      scheduleReconnect();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId]);

  const disconnect = useCallback(() => {
    cleanupTimer();
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp' | 'senderId'>) => {
    if (wsRef.current && isConnected) {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: Date.now(),
        senderId: userId
      };
      wsRef.current.send(JSON.stringify(fullMessage));
    } else {
      console.warn('WebSocket is not connected');
    }
  }, [isConnected, userId]);

  const sendPhoto = useCallback((imageData: string) => {
    sendMessage({ type: 'photo', data: imageData });
  }, [sendMessage]);

  const sendNotification = useCallback((message: string) => {
    sendMessage({ type: 'notification', data: message });
  }, [sendMessage]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { isConnected, lastMessage, sendPhoto, sendNotification, connect, disconnect };
}

//沢田つけたし
