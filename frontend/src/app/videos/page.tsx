'use client';

import { useEffect, useState } from 'react';
import { getVideos, deleteVideo } from '@/lib/api';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Video {
  id: string;
  title: string;
  durationSeconds?: number;
  status: string;
  editingFormat?: string;
  clipCount?: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-800 text-yellow-200',
  PROCESSING: 'bg-blue-800 text-blue-200',
  DONE: 'bg-green-800 text-green-200',
  ERROR: 'bg-red-800 text-red-200',
  FAILED: 'bg-red-800 text-red-200',
};

function fmtDuration(secs?: number) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getVideos()
      .then((d) => setVideos(Array.isArray(d) ? d : d?.videos ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this video?')) return;
    setDeleting(id);
    try { await deleteVideo(id); load(); } catch { setError('Delete failed'); }
    setDeleting(null);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Source Library</h2>
          <p className="text-gray-400 mt-1">All submitted source videos</p>
        </div>
        <Link href="/submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">+ Submit Video</Link>
      </div>

      {loading && <div className="text-gray-400 text-center py-16">Loading videos...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && !error && videos.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">🎬</p>
          <h3 className="text-white font-semibold mb-2">No videos yet</h3>
          <p className="text-gray-400 mb-4">Submit your first source video to get started.</p>
          <Link href="/submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">Submit Video</Link>
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gray-950/70 border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3.5">Title</th>
                  <th className="px-5 py-3.5">Duration</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Format</th>
                  <th className="px-5 py-3.5">Clips</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {videos.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-800/40 transition-colors">
                    <td className="px-5 py-3.5 text-white font-medium max-w-xs truncate">{v.title}</td>
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{fmtDuration(v.durationSeconds)}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${STATUS_COLORS[v.status] ?? 'bg-gray-800 text-gray-300'}`}>{v.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-300 text-xs">{v.editingFormat ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-300 text-xs font-medium">{v.clipCount ?? 0}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/videos/${v.id}`} className="text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg border border-gray-700/60 transition-colors">View</Link>
                        <button
                          onClick={() => handleDelete(v.id)}
                          disabled={deleting === v.id}
                          className="text-xs bg-red-900/40 hover:bg-red-800 text-red-300 border border-red-700/50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deleting === v.id ? '...' : 'Delete'}
                        </button>
                      </div>
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
