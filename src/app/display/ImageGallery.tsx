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

type ImageGalleryProps = {
  apiBase: string;
  accountId: number;
};

export default function ImageGallery({ apiBase, accountId }: ImageGalleryProps) {
  const [picture, setPicture] = useState<Picture | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 最新の画像1枚を取得
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const fetchLatestImage = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const res = await fetch(
          `${apiBase}/api/pictures/by-date?date=${today}&thumb_w=400`,
          {
            credentials: "include",
            cache: "no-store",
          }
        );
        
        if (!res.ok) throw new Error("画像の取得に失敗しました");
        
        const data = await res.json() as Picture[];
        if (!cancelled) {
          setPicture(data[0] || null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "予期しないエラーが発生しました");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchLatestImage();

    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-orange-700">最新画像</h2>
        <div className="flex justify-center py-8">
          <div className="rounded-lg bg-orange-50 p-4 text-orange-600">
            読み込み中...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-orange-700">最新画像</h2>
        <div className="rounded-lg bg-red-50 p-4 text-red-600">
          エラー: {error}
        </div>
      </div>
    );
  }

  if (!picture) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-orange-700">最新画像</h2>
        <div className="rounded-lg bg-orange-50 p-8 text-center text-orange-600">
          <p className="text-lg">最新の画像はありません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-orange-700">最新画像</h2>
      
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-orange-100 overflow-hidden">
          {/* 画像表示 */}
          <div className="aspect-video overflow-hidden bg-gray-100">
            <img
              src={`${apiBase}${picture.thumbnail_path}`}
              alt={`最新画像 ${picture.picture_id}`}
              className="w-full h-full object-cover"
            />
          </div>
          
          {/* 画像情報 */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-orange-800">
                画像ID: {picture.picture_id}
              </h3>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-700">
                {picture.device_id || '不明'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-orange-600">
              <div>
                <span className="font-medium">撮影日時:</span>
                <div className="mt-1">{formatDateTime(picture.pictured_at)}</div>
              </div>
              <div>
                <span className="font-medium">ファイルサイズ:</span>
                <div className="mt-1">{formatFileSize(picture.image_size)}</div>
              </div>
            </div>
            
            {picture.speech && (
              <div>
                <span className="font-medium text-orange-700">音声認識結果:</span>
                <div className="mt-1 p-3 bg-orange-50 rounded-lg text-orange-800">
                  {picture.speech}
                </div>
              </div>
            )}
            
            {/* 編集ボタン */}
            <div className="pt-4 border-t border-orange-100">
              <button
                className="w-full bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                onClick={() => {
                  alert('編集機能は現在開発中です');
                }}
              >
                編集
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
