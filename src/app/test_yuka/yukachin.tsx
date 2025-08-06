"use client";

/* ---------------- import ---------------- */
import React, { useEffect, useRef} from 'react'; 

/* ---------------- 型定義（入力フォームの定義とか）　無ければ無い ---------------- */


/* ---------------- 入力ステート（const~~~useStateとか） ---------------- */
export default function App() {
  const socketRef = useRef<WebSocket | null>(null);
  const inputMessage = "シャッター";
  const triggerWord = "シャッター";

    /* 接続 URL */
  const cid = useRef("yuka"); // 固定でもOK、ランダムでもOK
  const base = process.env.NEXT_PUBLIC_WS_FRONT ?? "ws://localhost:3001";
  const wsFRONT = `${base}/ws_test/ws/${cid.current}`;
  
  useEffect(()=>{
   console.log("WebSocket接続開始:", wsFRONT); // 確認用ログ
  socketRef.current = new WebSocket(wsFRONT);
   
  socketRef.current.onopen = () => {
    console.log("WebSocket接続成功");
  };

  socketRef.current.onerror = (err) =>{
    console.error("WebSocket接続エラー", err);
  };

  //socketRef.current.onclose = () => {
    //console.warn("WebSocket接続終了");
  //}

  },[]);
/* ---------------- ユーティリティ（handle~~とかfetch~~とか諸々） ---------------- */
const handleClick = (e) => {
  console.log("ボタンがクリックされました")

  if(inputMessage.includes(triggerWord)){
    const socket = socketRef.current;

    /*WebSocketが開通いているか確認する*/
    if(socket && socket.readyState ===1){
      socket.send(
        JSON.stringify({
          type:"chat",
          message:"take_photo",
        })
      )
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
       className = "rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
        判定
       </button>
    </div>
  );
}