'use client';

import { useEffect, useState } from 'react';
import { getPublishing } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface QueueItem {
  id: string;
  clipId: string;
  clip?: { title: string; durationSec?: number };
  youtubeAccount?: { channelTitle: string };
  scheduledTime: string;
  status: string;
  priority: number;
}

export default function PublishingPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getPublishing()
      .then((d) => setQueue(Array.isArray(d) ? d : d?.queue ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Publishing Queue</h2>
          <p className="text-gray-400 mt-1">Scheduled YouTube Shorts awaiting upload</p>
        </div>
        <button onClick={load} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">
          🔄 Refresh
        </button>
      </div>

      {loading && <div className="text-gray-400 text-center py-16">Loading queue...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && !error && queue.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">📤</p>
          <h3 className="text-white font-semibold mb-2">Publishing queue is empty</h3>
          <p className="text-gray-400">Approve or schedule clips from the Clip Library to queue them.</p>
        </div>
      )}

      {!loading && queue.length > 0 && (
        <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-750">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-left">
                <th className="px-4 py-3">Clip</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Scheduled Time</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id} className="border-t border-gray-700/60 hover:bg-gray-750">
                  <td className="px-4 py-3 text-white font-medium">{item.clip?.title || item.clipId}</td>
                  <td className="px-4 py-3 text-gray-300">{item.youtubeAccount?.channelTitle || 'YouTube'}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {new Date(item.scheduledTime).toLocaleString()} ({formatDistanceToNow(new Date(item.scheduledTime), { addSuffix: true })})
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-yellow-900 text-yellow-200 rounded text-xs">
                      {item.status}
                    </span>
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
