'use client';

import { useEffect, useState } from 'react';
import { getAnalytics, getJobs } from '@/lib/api';

interface Analytics {
  totalSourceVideos?: number;
  totalPublished?: number;
  totalViews?: number;
  successRate?: number;
}

interface Job {
  id: string;
  status: string;
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className={`bg-gray-800 rounded-xl p-6 border-l-4 ${color}`}>
      <p className="text-gray-400 text-sm">{label}</p>
      <p className="text-3xl font-bold text-white mt-1">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAnalytics(), getJobs()])
      .then(([analyticsData, jobsData]) => {
        setAnalytics(analyticsData);
        setJobs(Array.isArray(jobsData) ? jobsData : jobsData?.jobs ?? []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const activeJobs = jobs.filter((j) => ['PENDING', 'RUNNING', 'PROCESSING'].includes(j.status)).length;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold text-white mb-2">Dashboard Overview</h2>
      <p className="text-gray-400 mb-8">Your YouTube Shorts automation at a glance.</p>

      {loading && (
        <div className="text-gray-400 text-center py-16">Loading dashboard...</div>
      )}

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-4 mb-6">
          Could not load dashboard data: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              label="Total Source Videos"
              value={analytics?.totalSourceVideos ?? 0}
              color="border-blue-500"
            />
            <StatCard
              label="Active Jobs"
              value={activeJobs}
              color="border-yellow-500"
            />
            <StatCard
              label="Clips Ready"
              value={analytics?.totalPublished !== undefined ? '—' : 0}
              color="border-green-500"
            />
            <StatCard
              label="Published Shorts"
              value={analytics?.totalPublished ?? 0}
              color="border-purple-500"
            />
          </div>

          {analytics?.totalSourceVideos === 0 && jobs.length === 0 && (
            <div className="bg-gray-800 rounded-xl p-12 text-center">
              <p className="text-4xl mb-4">🎬</p>
              <h3 className="text-white text-lg font-semibold mb-2">No data yet</h3>
              <p className="text-gray-400">
                Submit your first video to get started with ClipPilot AI.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
