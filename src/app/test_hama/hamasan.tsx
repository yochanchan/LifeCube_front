"use client";

/* ---------------- import ---------------- */


/* ---------------- 型定義（入力フォームの定義とか）　無ければ無い ---------------- */


/* ---------------- 入力ステート（const~~~useStateとか） ---------------- */


/* ---------------- ユーティリティ（handle~~とかfetch~~とか諸々） ---------------- */


/* ---------------- UI（htmlっぽい部分） ---------------- */



import React from 'react';  

const HamasanContent: React.FC = () => {
  return (
    <div>      
      <p>このページは、はまさんが追加したコンポーネントです。</p>
      <p>まずfrontendだけ作って多分うまくいったので、これからbackendも含めた機能を作っていくぞ～！</p>
      <ul>
        <li>機能1</li>
        <li>機能2</li>
      </ul>
    </div>
  );
};

export default HamasanContent;