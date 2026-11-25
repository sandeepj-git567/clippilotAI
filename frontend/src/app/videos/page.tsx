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
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-left">
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Format</th>
                <th className="px-4 py-3">Clips</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => (
                <tr key={v.id} className="border-t border-gray-700 hover:bg-gray-750">
                  <td className="px-4 py-3 text-white font-medium">{v.title}</td>
                  <td className="px-4 py-3 text-gray-400">{fmtDuration(v.durationSeconds)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] ?? 'bg-gray-700 text-gray-300'}`}>{v.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{v.editingFormat ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-400">{v.clipCount ?? 0}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDistanceToNow(new Date(v.createdAt), { addSuffix: true })}</td>
                  <td className="px-4 py-3 flex gap-2">
                    <Link href={`/videos/${v.id}`} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded">View</Link>
                    <button
                      onClick={() => handleDelete(v.id)}
                      disabled={deleting === v.id}
                      className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded disabled:opacity-50"
                    >
                      {deleting === v.id ? '...' : 'Delete'}
                    </button>
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
