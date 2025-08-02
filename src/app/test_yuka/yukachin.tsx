"use client";

/* ---------------- import ---------------- */
import React, {useEffect, useRef} from 'react'; 

/* ---------------- 型定義（入力フォームの定義とか）　無ければ無い ---------------- */


/* ---------------- 入力ステート（const~~~useStateとか） ---------------- */
export default function App() {
  const socketRef = useRef< WebSocket | null>(null);
  const inputMessage = "シャッター"
  const triggerWord = "シャッター"
  
  useEffect(()=>{
    socketRef.current  = new WebSocket("ws://localhost:3001/ws_test/ws/yuka");

    socketRef.current.onopen = () => {
      console.log("WebSocket接続成功");
    };
    socketRef.current.onerror = (err) => {
      console.error("WebSocket接続エラー", err);
    };

    //socketRef.current.onclose = () => {
      //console.warn("WebSocket接続終了");
    //};

    //アンマウント時にクローズ
    //return() =>{
      //if (socketRef.current){
        //socketRef.current.close();
      //}
    //};
  },[]);

/* ---------------- ユーティリティ（handle~~とかfetch~~とか諸々） ---------------- */
  const handleClick = (e) => {
    console.log("ボタンがクリックされました")

    if(inputMessage.includes(triggerWord)){
      const socket = socketRef.current;

      /*WebSocketが開通しているか確認する*/
      if(socket && socket.readyState === 1){
      socket.send(
        JSON.stringify({ //←app.pyで想定していたJSON形式にする
          type: "chat",
          message: "take_photo", // ← ここは自由に変更OK
      })
    );
      console.log("トリガーを検知！写真撮影命令を送信しました。");
    }else{
      console.log("WebSocketが開いていません");
    }
  }else{
    console.log("トリガーを検知できません");
  }
};
/* ---------------- UI（htmlっぽい部分） ---------------- */


{/* ユーザーインターフェースの構築 */}
  return (
    <div>
     <p>{inputMessage}</p>
     <button 
      onClick={handleClick}
      className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        判定
    </button>
    </div>
  );
}