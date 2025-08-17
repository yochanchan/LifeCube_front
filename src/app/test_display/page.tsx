'use client';

import { useEffect, useRef, useState, useId, useCallback } from "react";
import { useWebSocket } from '@/app/lib/websocket';

export default function TestDisplay() {
  const room = "test_room2";
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [photoComment, setPhotoComment] = useState<string>("");

  // WebSocket: test_camera と同じルームで共有
  const roomId = room;
  // useIdフックを使用して安定したIDを生成
  const uniqueId = useId();
  const userId = `display_${uniqueId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;
  const { isConnected, lastMessage } = useWebSocket(roomId, userId);

  // 写真に合わせたコメントを生成する関数
  const generatePhotoComment = () => {
    const comments = [
      "素敵な写真です！",
      "ナイスショット！",
      "よく撮れています！"
    ];
    
    // ランダムにコメントを選択
    const randomIndex = Math.floor(Math.random() * comments.length);
    return comments[randomIndex];
  };

  // lastMessageの状態変更を監視
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'photo') {
      console.log('📨 写真メッセージを受信しました');
      setImageSrc(lastMessage.data);
      // 写真受信時にコメントを生成
      setPhotoComment(generatePhotoComment());
    }
  }, [lastMessage]);

  return (
    <main style={{ 
      width: "100vw", 
      height: "100vh", 
      margin: 0, 
      padding: 0, 
      fontFamily: "sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f8f9fa"
    }}>
      <h1 style={{ 
        textAlign: "center", 
        marginBottom: "2rem", 
        color: "#333",
        fontSize: "2rem",
        fontWeight: "600"
      }}>
        撮影した写真
      </h1>
      
      {imageSrc ? (
        <div style={{ 
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flex: 1,
          width: "100%",
          maxWidth: "90vw"
        }}>
          <img 
            src={imageSrc} 
            alt="受信した写真" 
            style={{ 
              maxWidth: "100%", 
              maxHeight: "70vh",
              objectFit: "contain",
              border: "3px solid #e9ecef", 
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.15)"
            }} 
          />
          
          {/* 写真コメント */}
          {photoComment && (
            <div style={{
              marginTop: "1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              maxWidth: "85%"
            }}>
              {/* コメント枠 */}
              <div style={{
                padding: "1.5rem 2rem",
                backgroundColor: "#e3f2fd",
                borderRadius: "30px",
                border: "3px solid #1976d2",
                boxShadow: "0 6px 20px rgba(25,118,210,0.25)",
                flex: 1
              }}>
                <p style={{
                  fontSize: "1.3rem",
                  color: "#1565c0",
                  fontWeight: "700",
                  margin: "0",
                  textAlign: "center",
                  textShadow: "1px 1px 2px rgba(255,255,255,0.8)"
                }}>
                  {photoComment}
                </p>
              </div>
              
              {/* 車のキャラクター画像 */}
              <div style={{
                width: "160px",
                height: "160px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <img 
                  src="/車.png" 
                  alt="車のキャラクター" 
                  style={{ 
                    width: "100%", 
                    height: "100%", 
                    objectFit: "contain"
                  }}
                />
              </div>
            </div>
          )}
          
          <p style={{ 
            marginTop: "1.5rem", 
            fontSize: "1.1rem", 
            color: "#666",
            fontStyle: "italic",
            backgroundColor: "rgba(255,255,255,0.8)",
            padding: "0.5rem 1rem",
            borderRadius: "20px"
          }}>
            最終更新: {new Date().toLocaleTimeString()}
          </p>
        </div>
      ) : (
        <div style={{ 
          padding: "3rem", 
          textAlign: "center", 
          backgroundColor: "#ffffff", 
          borderRadius: "16px",
          border: "3px dashed #dee2e6",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          maxWidth: "500px",
          width: "90%"
        }}>
          <p style={{ fontSize: "1.3rem", color: "#495057", marginBottom: "1rem" }}>
            まだ画像が届いていません
          </p>
          <p style={{ fontSize: "1rem", color: "#6c757d" }}>
            カメラ側で撮影してください
          </p>
          <div style={{ 
            marginTop: "2rem", 
            padding: "1rem", 
            backgroundColor: "#f8f9fa", 
            borderRadius: "8px",
            display: "inline-block",
            border: "1px solid #e9ecef"
          }}>
            <p style={{ fontSize: "1rem", color: "#495057", margin: "0" }}>
              WebSocket接続状態: {isConnected ? '🟢 接続中' : '🔴 未接続'}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}