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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-950/70 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Channel</th>
                  <th className="px-5 py-3.5">Published</th>
                  <th className="px-5 py-3.5">Views</th>
                  <th className="px-5 py-3.5">Likes</th>
                  <th className="px-5 py-3.5">Comments</th>
                  <th className="px-5 py-3.5 text-right">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {videos.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-white font-medium max-w-xs truncate">{v.title}</td>
                    <td className="px-5 py-3.5 text-gray-300 text-xs">{v.youtubeAccount?.channelTitle || 'YouTube'}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {formatDistanceToNow(new Date(v.publishedAt), { addSuffix: true })}
                    </td>
                    <td className="px-5 py-3.5 text-white font-mono text-xs">{v.views.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-white font-mono text-xs">{v.likes.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-white font-mono text-xs">{v.comments.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      <a
                        href={v.youtubeUrl || `https://youtube.com/shorts/${v.youtubeVideoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs inline-flex items-center gap-1 bg-gray-800/80 hover:bg-gray-700/80 px-2.5 py-1 rounded-lg border border-gray-700/50 transition-colors"
                      >
                        <span>Watch</span>
                        <span>↗</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
