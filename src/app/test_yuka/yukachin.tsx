"use client";

/* ---------------- import ---------------- */
import React, {useState} from 'react'; 

/* ---------------- 型定義（入力フォームの定義とか）　無ければ無い ---------------- */


/* ---------------- 入力ステート（const~~~useStateとか） ---------------- */
export default function Home() {
  // useStateを使った値（状態）管理
  const [actorName, setActorName] = useState(''); 
  const [popularMovie, setPopularMovie] = useState('');

/* ---------------- ユーティリティ（handle~~とかfetch~~とか諸々） ---------------- */
 const handleActorNameSearch = () => {
    setPopularMovie("リリー・コリンズ（Lily Collins）。アメリカの女優・モデル。代表作：エミリー、あといろいろ。");
  };

/* ---------------- UI（htmlっぽい部分） ---------------- */


{/* ユーザーインターフェースの構築 */}
  return (
    <div className="p-8">
      <video 
        src="/background_video.mp4" 
        autoPlay 
        muted 
        loop 
        playsInline 
        style={{
          objectFit: "cover",
          width: "100vw",
          height: "100vh",
          top: 0,
          left: 0,
          position:"absolute",
        }}
      />
      <img style={{position:"absolute", top:"40px", left:"700px", width: "450px", height:"auto"}} src="/logo_NFS.png" />
      <h1 className="text-2xl font-bold mb-6">NETFLIX ACTOR SEARCH APP</h1>
      <div className="space-y-8">
        
        <section style={{position:"absolute", top: "440px", left:"680px"}}>
          <h2 className="text-xl font-bold mb-4" style={{color:"#fff"}}>視聴しているプログラム名および役名を入力してください。</h2>
          <div className="flex gap-2">
          <input
              type="text"
              size={50}
              value={actorName}
              onChange={(e) => setActorName(e.target.value)} 
              className="border rounded px-2 py-1"
              placeholder="エミリーパリへ行く, エミリー・クーパー"
            />
            <button
              onClick={handleActorNameSearch}  // ✅ 関数をここで呼び出す
              className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded"  
            >
              Search
            </button>

          </div>
          {popularMovie && (
            <ul className="mt-2" style={{color:"#fff", width:"550px"}}>この役を演じている役者について: {popularMovie}</ul>
          )}
        </section>

      </div>
    </div>
  );
}