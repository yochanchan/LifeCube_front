//沢田つけたし

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: 'photo' | 'notification' | 'connection';
  data: string;
  timestamp: number;
  senderId: string;
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

  const connect = useCallback(() => {
    try {
      // 既存の接続があれば閉じる
      if (wsRef.current) {
        console.log('Closing existing WebSocket connection');
        wsRef.current.close();
        wsRef.current = null;
      }

      // 直接URLを構築（環境変数や複雑なロジックを使わない）
      const wsUrl = `ws://localhost:8000/ws_test/ws/${roomId}`;
      console.log('🔌 WebSocket接続試行:', {
        roomId,
        fullUrl: wsUrl
      });
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket接続成功:', wsUrl);
        console.log('✅ WebSocket状態:', ws.readyState);
        console.log('✅ WebSocket URL:', ws.url);
        console.log('✅ 接続時刻:', new Date().toISOString());
        console.log('✅ ルームID:', roomId);
        console.log('✅ ユーザーID:', userId);
        setIsConnected(true);
        retryRef.current = 0;
      };

      ws.onmessage = (event) => {
        console.log('📨 WebSocket onmessage イベント受信開始');
        console.log('📨 生データ:', event.data);
        console.log('📨 データタイプ:', typeof event.data);
        console.log('📨 データ長:', event.data?.length || 0);
        console.log('📨 WebSocket状態:', ws.readyState);
        console.log('📨 WebSocket URL:', ws.url);
        
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('📨 JSON解析成功:', {
            type: message.type,
            dataLength: message.data?.length || 0,
            dataPrefix: message.data?.substring(0, 100) || '',
            timestamp: message.timestamp,
            senderId: message.senderId
          });
          
          console.log('📨 setLastMessageを実行します');
          console.log('📨 実行前のlastMessage:', lastMessage);
          setLastMessage(message);
          console.log('📨 setLastMessage実行完了');
          console.log('📨 実行後のlastMessage:', message);
          
          if (message.type !== 'connection') {
            console.log('📨 Received message:', message.type);
          }
        } catch (error) {
          console.warn('❌ Failed to parse WebSocket message:', error);
          console.warn('❌ 生データ:', event.data);
        }
        
        console.log('📨 WebSocket onmessage イベント処理完了');
      };

      ws.onclose = (ev) => {
        const closeInfo = {
          code: ev.code,
          reason: ev.reason || 'No reason provided',
          wasClean: ev.wasClean,
          type: ev.type || 'close'
        };
        
        console.log('🔌 WebSocket切断:', closeInfo);
        console.log('🔌 切断詳細:', {
          code: ev.code,
          reason: ev.reason,
          wasClean: ev.wasClean,
          type: ev.type,
          targetReadyState: (ev.target as WebSocket)?.readyState
        });
        
        setIsConnected(false);
        
        // 正常終了（1000）、意図的な切断（1001）の場合は再接続しない
        if (ev.code !== 1000 && ev.code !== 1001) {
          console.log('🔄 異常切断のため再接続をスケジュール');
          // 直接再接続ロジックを実行
          setTimeout(() => {
            if (retryRef.current < 5) {
              retryRef.current++;
              console.log(`🔄 再接続試行 ${retryRef.current}/5`);
              connect();
            }
          }, 1000 * Math.pow(2, retryRef.current));
        } else {
          console.log('✅ 正常切断、再接続しません');
        }
      };

      ws.onerror = (error) => {
        const errorInfo = {
          readyState: ws.readyState,
          readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState],
          error: error,
          url: ws.url
        };
        
        console.error('❌ WebSocketエラー:', errorInfo);
        console.error('❌ エラー詳細:', {
          readyState: ws.readyState,
          readyStateText: ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][ws.readyState],
          error: error,
          url: ws.url,
          bufferedAmount: ws.bufferedAmount
        });
        
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ WebSocket接続作成エラー:', error);
      setIsConnected(false);
    }
  }, [roomId]);

  const disconnect = useCallback(() => {
    console.log('🔄 Manually disconnecting WebSocket');
    cleanupTimer();
    
    if (wsRef.current) {
      try { 
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'Manual disconnect'); 
        }
      } catch (error) {
        console.warn('Error during manual disconnect:', error);
      }
      wsRef.current = null;
    }
    setIsConnected(false);
    retryRef.current = 0;
  }, []);

  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'timestamp' | 'senderId'>) => {
    console.log('📤 メッセージ送信開始:', {
      type: message.type,
      dataLength: message.data?.length || 0,
      isConnected,
      wsReadyState: wsRef.current?.readyState,
      roomId,
      userId
    });

    if (wsRef.current && isConnected && wsRef.current.readyState === WebSocket.OPEN) {
      const fullMessage: WebSocketMessage = {
        ...message,
        timestamp: Date.now(),
        senderId: userId
      };
      try {
        wsRef.current.send(JSON.stringify(fullMessage));
        console.log('📤 Message sent successfully:', message.type);
        console.log('📤 送信完了:', {
          type: message.type,
          dataLength: message.data?.length || 0,
          timestamp: fullMessage.timestamp,
          senderId: fullMessage.senderId
        });
      } catch (error) {
        console.error('❌ Failed to send message:', error);
      }
    } else {
      console.warn('⚠️ WebSocket is not connected or ready');
      console.warn('⚠️ 接続状態:', {
        wsRefExists: !!wsRef.current,
        isConnected,
        wsReadyState: wsRef.current?.readyState,
        wsReadyStateText: wsRef.current ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsRef.current.readyState] : 'NO_WS'
      });
    }
  }, [isConnected, userId, roomId]);

  const sendPhoto = useCallback((imageData: string) => {
    sendMessage({ type: 'photo', data: imageData });
  }, [sendMessage]);

  const sendNotification = useCallback((message: string) => {
    sendMessage({ type: 'notification', data: message });
  }, [sendMessage]);

  useEffect(() => {
    console.log('🚀 Initializing WebSocket connection');
    connect();
    return () => {
      console.log('🧹 Cleaning up WebSocket connection');
      disconnect();
    };
  }, [roomId]); // roomIdが変更された時に再実行

  return { isConnected, lastMessage, sendPhoto, sendNotification, connect, disconnect };
}

// //沢田つけたし
