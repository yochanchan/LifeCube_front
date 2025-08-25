// src/app/album/ImageModal.tsx
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { PictureMeta } from "./UI";
import AuthImage from "@/app/components/AuthImage";
import { apiclient } from "@/lib/apiclient";

interface ImageModalProps {
  picture: PictureMeta | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ picture, isOpen, onClose }: ImageModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [locationName, setLocationName] = useState(picture?.location_name || '');
  const [userComment, setUserComment] = useState(picture?.user_comment || '');
  const [isSaving, setIsSaving] = useState(false);

  // 写真が変更された際に状態をリセット
  useEffect(() => {
    if (picture) {
      // ローカルストレージから保存されたデータを読み込み
      const key = `picture_${picture.picture_id}`;
      const savedData = localStorage.getItem(key);
      
      if (savedData) {
        try {
          const savedPicture = JSON.parse(savedData);
          setLocationName(savedPicture.location_name || picture.location_name || '');
          setUserComment(savedPicture.user_comment || picture.user_comment || '');
        } catch (error) {
          console.error('Failed to parse saved data:', error);
          setLocationName(picture.location_name || '');
          setUserComment(picture.user_comment || '');
        }
      } else {
        setLocationName(picture.location_name || '');
        setUserComment(picture.user_comment || '');
      }
      setIsEditing(false);
    }
  }, [picture]);

  // 写真情報を保存する関数
  const handleSave = useCallback(async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      // 一時的にローカルストレージに保存（バックエンドAPIが実装されるまで）
      const updatedPicture = {
        ...picture,
        location_name: locationName || null,
        user_comment: userComment || null,
      };
      
      // ローカルストレージに保存
      const key = `picture_${picture?.picture_id}`;
      localStorage.setItem(key, JSON.stringify(updatedPicture));
      
      // 成功時の処理
      setIsEditing(false);
      alert('写真情報を保存しました（ローカル保存）');
      
      // TODO: バックエンドAPIが実装されたら以下のコードを使用
      // await apiclient.postJSON(`/api/pictures/${picture?.picture_id}`, {
      //   location_name: locationName || null,
      //   user_comment: userComment || null,
      // });
      
    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  }, [picture?.picture_id, locationName, userComment, isSaving]);

  // 編集モードを切り替える関数
  const toggleEditMode = useCallback(() => {
    if (isEditing) {
      // 編集モードを終了する際は元の値に戻す
      setLocationName(picture?.location_name || '');
      setUserComment(picture?.user_comment || '');
    }
    setIsEditing(!isEditing);
  }, [isEditing, picture?.location_name, picture?.user_comment]);

  // キャンセル処理
  const handleCancel = useCallback(() => {
    if (picture) {
      // ローカルストレージから保存されたデータを読み込み
      const key = `picture_${picture.picture_id}`;
      const savedData = localStorage.getItem(key);
      
      if (savedData) {
        try {
          const savedPicture = JSON.parse(savedData);
          setLocationName(savedPicture.location_name || picture.location_name || '');
          setUserComment(savedPicture.user_comment || picture.user_comment || '');
        } catch (error) {
          console.error('Failed to parse saved data:', error);
          setLocationName(picture.location_name || '');
          setUserComment(picture.user_comment || '');
        }
      } else {
        setLocationName(picture.location_name || '');
        setUserComment(picture.user_comment || '');
      }
    }
    setIsEditing(false);
  }, [picture]);

  if (!isOpen || !picture) return null;

  // 画像はパスのみで渡す（JWT付与のため）
  const imagePath = `/api/pictures/${picture.picture_id}/image`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 font-zen-maru-gothic p-4">
      <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-colors"
              style={{ backgroundColor: "#2B578A" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              アルバムに戻る
            </button>
            
            {/* 編集ボタン */}
            <button
              onClick={toggleEditMode}
              className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors ${
                isEditing 
                  ? 'bg-gray-600 text-white' 
                  : 'bg-white text-gray-700 ring-1 ring-gray-300 hover:bg-gray-50'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {isEditing ? '編集終了' : '編集'}
            </button>
          </div>

          {/* 時刻表示 */}
          <div className="text-right">
            <div className="text-sm text-gray-600">
              {new Date(picture.pictured_at).toLocaleDateString("ja-JP", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
            <div className="text-lg font-medium" style={{ color: "#2B578A" }}>
              {picture.pictured_at.slice(11, 19)}
            </div>
          </div>
        </div>

        {/* 画像表示エリア */}
        <div className="p-4 flex-shrink-0">
          <AuthImage
            path={imagePath}
            alt={picture.user_comment ?? picture.situation_for_quiz ?? "写真"}
            className="w-full h-auto max-h-[50vh] object-contain rounded-lg"
          />
        </div>

        {/* フッター：詳細 */}
        <div className="p-4 bg-gray-50 border-t flex-1 overflow-y-auto">
                     {isEditing ? (
             /* 編集モード */
             <div className="space-y-4 min-h-0">
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   場所名
                 </label>
                 <input
                   type="text"
                   value={locationName}
                   onChange={(e) => setLocationName(e.target.value)}
                   placeholder="例：東京タワー、富士山"
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                 />
               </div>
               
               <div>
                 <label className="block text-sm font-medium text-gray-700 mb-2">
                   コメント
                 </label>
                 <textarea
                   value={userComment}
                   onChange={(e) => setUserComment(e.target.value)}
                   placeholder="この写真についてのコメント"
                   rows={3}
                   className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                 />
               </div>
               
               <div className="flex gap-3 flex-shrink-0">
                 <button
                   onClick={handleSave}
                   disabled={isSaving}
                   className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isSaving ? '保存中...' : '保存'}
                 </button>
                                   <button
                    onClick={handleCancel}
                    className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-400"
                  >
                    キャンセル
                  </button>
               </div>
             </div>
          ) : (
                         /* 表示モード */
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
               {/* 場所情報 */}
               {(locationName || picture.location_name) && (
                 <div>
                   <span className="font-medium text-gray-700">場所:</span>
                   <p className="text-gray-600 mt-1">{locationName || picture.location_name}</p>
                 </div>
               )}
               
               {/* コメント */}
               {(userComment || picture.user_comment) && (
                 <div>
                   <span className="font-medium text-gray-700">コメント:</span>
                   <p className="text-gray-600 mt-1">{userComment || picture.user_comment}</p>
                 </div>
               )}
               
               {/* 状況 */}
               {picture.situation_for_quiz && (
                 <div>
                   <span className="font-medium text-gray-700">状況:</span>
                   <p className="text-gray-600 mt-1">{picture.situation_for_quiz}</p>
                 </div>
               )}
               
               {/* 音声コメント */}
               {picture.audio_comment && (
                 <div>
                   <span className="font-medium text-gray-700">音声コメント:</span>
                   <p className="text-gray-600 mt-1">{picture.audio_comment}</p>
                 </div>
               )}
               
               
               
               {/* 音声 */}
               {picture.speech && (
                 <div>
                   <span className="font-medium text-gray-700">音声:</span>
                   <p className="text-gray-600 mt-1">{picture.speech}</p>
                 </div>
               )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
