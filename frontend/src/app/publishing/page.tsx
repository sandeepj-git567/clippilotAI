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
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-950/70 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3.5">Clip</th>
                  <th className="px-5 py-3.5">Channel</th>
                  <th className="px-5 py-3.5">Scheduled Time</th>
                  <th className="px-5 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {queue.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-white font-medium max-w-xs truncate">{item.clip?.title || item.clipId}</td>
                    <td className="px-5 py-3.5 text-gray-300 text-xs">{item.youtubeAccount?.channelTitle || 'YouTube'}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs font-mono">
                      {new Date(item.scheduledTime).toLocaleString()} ({formatDistanceToNow(new Date(item.scheduledTime), { addSuffix: true })})
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-yellow-900/40 text-yellow-300 border border-yellow-700/50">
                        {item.status}
                      </span>
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
