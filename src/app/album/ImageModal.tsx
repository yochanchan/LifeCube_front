// src/app/album/ImageModal.tsx
"use client";

import React from "react";
import { PictureMeta, endpoints } from "./UI";

interface ImageModalProps {
  picture: PictureMeta | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ImageModal({ picture, isOpen, onClose }: ImageModalProps) {
  if (!isOpen || !picture) return null;

  const imageSrc = endpoints.image(picture.picture_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden">
        {/* ヘッダー部分 */}
        <div className="flex items-center justify-between p-4 bg-gray-50 border-b">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 text-white font-medium rounded-lg transition-colors"
              style={{ backgroundColor: '#2B578A' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              アルバムに戻る
            </button>
          </div>
          
          {/* 時刻表示 */}
          <div className="text-right">
            <div className="text-sm text-gray-600">
              {new Date(picture.pictured_at).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
            <div className="text-lg font-medium" style={{ color: '#2B578A' }}>
              {picture.pictured_at.slice(11, 19)}
            </div>
          </div>
        </div>

        {/* 画像表示エリア */}
        <div className="p-4">
          <img
            src={imageSrc}
            alt={picture.user_comment ?? picture.situation_for_quiz ?? "写真"}
            className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
          />
        </div>

        {/* フッター部分 - 写真の詳細情報 */}
        <div className="p-4 bg-gray-50 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {picture.user_comment && (
              <div>
                <span className="font-medium text-gray-700">コメント:</span>
                <p className="text-gray-600 mt-1">{picture.user_comment}</p>
              </div>
            )}
            
            {picture.situation_for_quiz && (
              <div>
                <span className="font-medium text-gray-700">状況:</span>
                <p className="text-gray-600 mt-1">{picture.situation_for_quiz}</p>
              </div>
            )}
            
            {picture.device_id && (
              <div>
                <span className="font-medium text-gray-700">デバイス:</span>
                <p className="text-gray-600 mt-1">{picture.device_id}</p>
              </div>
            )}
            
            {picture.speech && (
              <div>
                <span className="font-medium text-gray-700">音声:</span>
                <p className="text-gray-600 mt-1">{picture.speech}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
