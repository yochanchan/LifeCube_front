
// 沢田つけたし
'use client';

import { useState, useEffect } from 'react';

export default function WebSocketTest() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [testMessage, setTestMessage] = useState('');

  const addMessage = (msg: string) => {
    setMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const connect = () => {
    try {
      const wsUrl = 'ws://localhost:8000/ws_test/ws/test_room2';
      addMessage(`接続試行: ${wsUrl}`);
      
      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        addMessage('✅ WebSocket接続成功');
        addMessage(`🔗 接続URL: ${wsUrl}`);
        addMessage(`🔗 接続時刻: ${new Date().toLocaleTimeString()}`);
        setIsConnected(true);
      };
      
      websocket.onmessage = (event) => {
        addMessage(`📨 受信開始`);
        addMessage(`📨 データタイプ: ${typeof event.data}`);
        addMessage(`📨 データ長: ${event.data?.length || 0}`);
        addMessage(`📨 データ内容: ${event.data.substring(0, 100)}...`);
        addMessage(`📨 受信時刻: ${new Date().toLocaleTimeString()}`);
      };
      
      websocket.onclose = (event) => {
        addMessage(`🔌 切断開始`);
        addMessage(`🔌 切断コード: ${event.code}`);
        addMessage(`🔌 切断理由: ${event.reason || '理由なし'}`);
        addMessage(`🔌 正常切断: ${event.wasClean ? 'はい' : 'いいえ'}`);
        addMessage(`🔌 切断時刻: ${new Date().toLocaleTimeString()}`);
        setIsConnected(false);
      };
      
      websocket.onerror = (error) => {
        addMessage(`❌ エラー発生`);
        addMessage(`❌ エラー詳細: ${error}`);
        addMessage(`❌ エラー時刻: ${new Date().toLocaleTimeString()}`);
      };
      
      setWs(websocket);
    } catch (error) {
      addMessage(`❌ 接続エラー: ${error}`);
    }
  };

  const disconnect = () => {
    if (ws) {
      ws.close();
      setWs(null);
      setIsConnected(false);
      addMessage('🔄 手動切断');
    }
  };

  const sendTestMessage = () => {
    if (ws && isConnected) {
      const message = {
        type: 'test',
        data: testMessage,
        timestamp: Date.now(),
        senderId: 'test_user'
      };
      
      addMessage(`📤 送信開始`);
      addMessage(`📤 メッセージタイプ: ${message.type}`);
      addMessage(`📤 メッセージ内容: ${message.data}`);
      addMessage(`📤 送信時刻: ${new Date().toLocaleTimeString()}`);
      
      ws.send(JSON.stringify(message));
      
      addMessage(`📤 送信完了`);
      setTestMessage('');
    } else {
      addMessage(`❌ 送信失敗: WebSocket未接続`);
    }
  };

  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  return (
    <div style={{ padding: '1rem', border: '1px solid #ddd', borderRadius: '4px', margin: '1rem 0' }}>
      <h3>WebSocket接続テスト</h3>
      
      <div style={{ marginBottom: '1rem' }}>
        <button 
          onClick={connect} 
          disabled={isConnected}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#28a745', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            marginRight: '0.5rem'
          }}
        >
          接続
        </button>
        
        <button 
          onClick={disconnect} 
          disabled={!isConnected}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#dc3545', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px',
            marginRight: '0.5rem'
          }}
        >
          切断
        </button>
        
        <button 
          onClick={() => setMessages([])}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#6c757d', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px'
          }}
        >
          ログクリア
        </button>
        
        <span style={{ marginLeft: '1rem' }}>
          状態: <span style={{ color: isConnected ? '#28a745' : '#dc3545' }}>
            {isConnected ? '接続中' : '未接続'}
          </span>
        </span>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          placeholder="テストメッセージ"
          style={{ 
            padding: '0.5rem', 
            marginRight: '0.5rem',
            border: '1px solid #ddd',
            borderRadius: '4px',
            width: '200px'
          }}
        />
        <button 
          onClick={sendTestMessage}
          disabled={!isConnected}
          style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px'
          }}
        >
          送信
        </button>
      </div>

      <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px' }}>
        <h4>ログ</h4>
        <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid #ddd", borderRadius: "4px", padding: "0.5rem" }}>
          {messages.map((msg, index) => (
            <div key={index} style={{ fontSize: '0.9rem', margin: '0.25rem 0' }}>
              {msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 沢田つけたし
