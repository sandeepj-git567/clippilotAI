'use client';

import { useEffect, useState } from 'react';
import { getJobs, cancelJob } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface Job {
  id: string;
  sourceVideoId: string;
  sourceVideo?: { title: string };
  type: string;
  status: string;
  progress: number;
  currentStage: string;
  errorMessage?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-yellow-900 text-yellow-200',
  RIGHTS_CHECK: 'bg-purple-900 text-purple-200',
  QUEUED: 'bg-blue-900 text-blue-200',
  IMPORTING: 'bg-blue-800 text-blue-200',
  TRANSCRIBING: 'bg-indigo-800 text-indigo-200',
  ANALYZING: 'bg-cyan-800 text-cyan-200',
  CLIPPING: 'bg-teal-800 text-teal-200',
  EDITING: 'bg-amber-800 text-amber-200',
  QUALITY_CHECK: 'bg-orange-800 text-orange-200',
  READY: 'bg-green-800 text-green-200',
  PUBLISHED: 'bg-emerald-800 text-emerald-200',
  FAILED: 'bg-red-900 text-red-200',
  CANCELLED: 'bg-gray-800 text-gray-300',
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = () => {
    getJobs()
      .then((d) => setJobs(Array.isArray(d) ? d : d?.jobs ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadJobs();
    const interval = setInterval(loadJobs, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this job?')) return;
    try {
      await cancelJob(id);
      loadJobs();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel job');
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Processing Jobs</h2>
          <p className="text-gray-400 mt-1">Live AI transcription, analysis, and rendering status</p>
        </div>
        <button
          onClick={loadJobs}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {loading && <div className="text-gray-400 text-center py-16">Loading jobs...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && !error && jobs.length === 0 && (
        <div className="bg-gray-800 rounded-xl p-12 text-center">
          <p className="text-4xl mb-4">⚙️</p>
          <h3 className="text-white font-semibold mb-2">No active or past jobs</h3>
          <p className="text-gray-400 mb-4">Submit a video to begin automated clip extraction.</p>
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-750">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-left">
                <th className="px-4 py-3">Job ID</th>
                <th className="px-4 py-3">Source Video</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-gray-700/60 hover:bg-gray-750 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{j.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-white font-medium">{j.sourceVideo?.title ?? j.sourceVideoId.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-300">{j.currentStage || 'Processing'}</td>
                  <td className="px-4 py-3 w-44">
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(100, Math.max(0, j.progress))}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 font-mono">{j.progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[j.status] ?? 'bg-gray-700 text-gray-300'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {formatDistanceToNow(new Date(j.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3">
                    {!['READY', 'PUBLISHED', 'FAILED', 'CANCELLED'].includes(j.status) && (
                      <button
                        onClick={() => handleCancel(j.id)}
                        className="text-xs text-red-400 hover:text-red-300 hover:underline"
                      >
                        Cancel
                      </button>
                    )}
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
