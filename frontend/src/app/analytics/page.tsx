'use client';

import { useEffect, useState } from 'react';
import { getAnalytics } from '@/lib/api';

interface AnalyticsData {
  totalPublished: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  successRate: number;
  successfulUploads: number;
  failedUploads: number;
  recentVideos?: Array<{ id: string; title: string; views: number; likes: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getAnalytics()
      .then((d) => setData(d.analytics || d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Performance Analytics</h2>
          <p className="text-gray-400 mt-1">Real YouTube performance statistics for your published Shorts</p>
        </div>
        <button onClick={load} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">
          🔄 Refresh
        </button>
      </div>

      {loading && <div className="text-gray-400 text-center py-16">Loading analytics...</div>}
      {error && <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-4">{error}</div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-blue-500">
              <p className="text-gray-400 text-sm">Total Views</p>
              <p className="text-3xl font-bold text-white mt-1">{data.totalViews.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-green-500">
              <p className="text-gray-400 text-sm">Total Likes</p>
              <p className="text-3xl font-bold text-white mt-1">{data.totalLikes.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-purple-500">
              <p className="text-gray-400 text-sm">Total Comments</p>
              <p className="text-3xl font-bold text-white mt-1">{data.totalComments.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-yellow-500">
              <p className="text-gray-400 text-sm">Publishing Success Rate</p>
              <p className="text-3xl font-bold text-white mt-1">{data.successRate}%</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-750">
            <h3 className="text-white font-semibold text-lg mb-4">Upload Summary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Total Shorts Published</p>
                <p className="text-xl font-bold text-white mt-1">{data.totalPublished}</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Successful Uploads</p>
                <p className="text-xl font-bold text-green-400 mt-1">{data.successfulUploads}</p>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Failed Uploads</p>
                <p className="text-xl font-bold text-red-400 mt-1">{data.failedUploads}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
