'use client';

import { useEffect, useState } from 'react';
import { getPublished } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface PublishedVideo {
  id: string;
  clipId: string;
  youtubeVideoId: string;
  youtubeUrl: string;
  title: string;
  privacyStatus: string;
  publishedAt: string;
  views: number;
  likes: number;
  comments: number;
  youtubeAccount?: { channelTitle: string };
}

export default function PublishedPage() {
  const [videos, setVideos] = useState<PublishedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getPublished()
      .then((d) => setVideos(Array.isArray(d) ? d : d?.publishedVideos ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Published Shorts</h2>
          <p className="text-gray-400 mt-1">Live YouTube Shorts published by ClipPilot AI</p>
        </div>
        <button onClick={load} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">
          🔄 Refresh
        </button>
      </div>

      {loading && <div className="text-gray-400 text-center py-16">Loading published videos...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && !error && videos.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">✅</p>
          <h3 className="text-white font-semibold mb-2">No videos published yet</h3>
          <p className="text-gray-400">Publish clips to your YouTube channel to see them here.</p>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-750">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-left">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3">Views</th>
                <th className="px-4 py-3">Likes</th>
                <th className="px-4 py-3">Comments</th>
                <th className="px-4 py-3">Link</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t border-gray-700/60 hover:bg-gray-750">
                  <td className="px-4 py-3 text-white font-medium">{v.title}</td>
                  <td className="px-4 py-3 text-gray-300">{v.youtubeAccount?.channelTitle || 'YouTube'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDistanceToNow(new Date(v.publishedAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 text-white font-mono">{v.views.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white font-mono">{v.likes.toLocaleString()}</td>
                  <td className="px-4 py-3 text-white font-mono">{v.comments.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <a
                      href={v.youtubeUrl || `https://youtube.com/shorts/${v.youtubeVideoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-xs underline"
                    >
                      View on YouTube ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
