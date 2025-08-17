"use client";

import React, { useEffect, useState } from "react";

type Picture = {
  picture_id: number;
  account_id: number;
  trip_id: number | null;
  pictured_at: string;
  gps_lat: number | null;
  gps_lng: number | null;
  device_id: string | null;
  speech: string | null;
  situation_for_quiz: string | null;
  user_comment: string | null;
  content_type: string;
  image_size: number;
  sha256_hex: string | null;
  created_at: string;
  thumbnail_path: string;
};

type ImageModalProps = {
  picture: Picture;
  apiBase: string;
  onClose: () => void;
};

export default function ImageModal({ picture, apiBase, onClose }: ImageModalProps) {
  const [fullImageUrl, setFullImageUrl] = useState<string>("");
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    // フル画像のURLを生成
    setFullImageUrl(`${apiBase}/api/pictures/${picture.picture_id}/image`);
  }, [apiBase, picture.picture_id]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown as any);
    return () => {
      document.removeEventListener('keydown', handleKeyDown as any);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={handleBackdropClick}
    >
      <div className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-2xl bg-white shadow-2xl">
        {/* ヘッダー */}
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4">
          <h3 className="text-lg font-semibold text-rose-800">
            画像詳細 - ID: {picture.picture_id}
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="閉じる"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* コンテンツ */}
        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 画像表示 */}
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
                {imageLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="rounded-lg bg-white p-4 shadow-lg">
                      <div className="text-rose-600">読み込み中...</div>
                    </div>
                  </div>
                )}
                <img
                  src={fullImageUrl}
                  alt={`画像 ${picture.picture_id}`}
                  className="h-full w-full object-contain"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              </div>
              
              {/* ダウンロードボタン */}
              <a
                href={fullImageUrl}
                download={`image_${picture.picture_id}.jpg`}
                className="inline-flex w-full items-center justify-center rounded-lg bg-rose-500 px-4 py-2 text-white hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                画像をダウンロード
              </a>
            </div>

            {/* 詳細情報 */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-rose-700">画像情報</h4>
              
              <div className="space-y-3">
                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-700">基本情報</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>画像ID: {picture.picture_id}</div>
                    <div>アカウントID: {picture.account_id}</div>
                    {picture.trip_id && <div>トリップID: {picture.trip_id}</div>}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-700">撮影情報</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>撮影日時: {formatDateTime(picture.pictured_at)}</div>
                    <div>デバイス: {picture.device_id || '不明'}</div>
                    {picture.gps_lat && picture.gps_lng && (
                      <div>位置情報: {picture.gps_lat.toFixed(6)}, {picture.gps_lng.toFixed(6)}</div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-700">ファイル情報</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>ファイルサイズ: {formatFileSize(picture.image_size)}</div>
                    <div>コンテンツタイプ: {picture.content_type}</div>
                    {picture.sha256_hex && (
                      <div className="truncate" title={picture.sha256_hex}>
                        SHA256: {picture.sha256_hex.substring(0, 16)}...
                      </div>
                    )}
                  </div>
                </div>

                {picture.speech && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-sm font-medium text-gray-700">音声認識結果</div>
                    <div className="mt-2 text-sm text-gray-600">{picture.speech}</div>
                  </div>
                )}

                {picture.situation_for_quiz && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-sm font-medium text-gray-700">状況説明</div>
                    <div className="mt-2 text-sm text-gray-600">{picture.situation_for_quiz}</div>
                  </div>
                )}

                {picture.user_comment && (
                  <div className="rounded-lg bg-gray-50 p-3">
                    <div className="text-sm font-medium text-gray-700">ユーザーコメント</div>
                    <div className="mt-2 text-sm text-gray-600">{picture.user_comment}</div>
                  </div>
                )}

                <div className="rounded-lg bg-gray-50 p-3">
                  <div className="text-sm font-medium text-gray-700">システム情報</div>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>作成日時: {formatDateTime(picture.created_at)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
