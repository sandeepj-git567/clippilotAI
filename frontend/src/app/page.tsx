'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAnalytics, getJobs, getClips, getVideos, getYouTubeStatus } from '@/lib/api';

interface Stats {
  totalSources: number;
  totalClips: number;
  pendingApproval: number;
  scheduledClips: number;
  totalPublished: number;
  totalViews: number;
}

interface Job {
  id: string;
  sourceVideo?: { title: string };
  status: string;
  stage?: string;
  progressPercent?: number;
  createdAt?: string;
}

interface Clip {
  id: string;
  title: string;
  durationSec: number;
  editingFormat: string;
  status: string;
  qualityScore?: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalSources: 0,
    totalClips: 0,
    pendingApproval: 0,
    scheduledClips: 0,
    totalPublished: 0,
    totalViews: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [recentClips, setRecentClips] = useState<Clip[]>([]);
  const [youtubeConnected, setYoutubeConnected] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);

    Promise.all([
      getAnalytics().catch(() => null),
      getJobs().catch(() => []),
      getClips().catch(() => []),
      getVideos().catch(() => []),
      getYouTubeStatus().catch(() => null),
    ])
      .then(([analyticsData, jobsData, clipsData, videosData, ytData]) => {
        const jobsList: Job[] = Array.isArray(jobsData) ? jobsData : jobsData?.jobs ?? [];
        const clipsList: Clip[] = Array.isArray(clipsData) ? clipsData : clipsData?.clips ?? [];
        const videosList = Array.isArray(videosData) ? videosData : videosData?.videos ?? [];

        const pending = clipsList.filter((c) => c.status === 'GENERATED' || c.status === 'READY').length;
        const scheduled = clipsList.filter((c) => c.status === 'SCHEDULED').length;
        const publishedCount = analyticsData?.analytics?.totalPublished ?? clipsList.filter((c) => c.status === 'PUBLISHED').length;
        const viewsCount = analyticsData?.analytics?.totalViews ?? 0;

        setStats({
          totalSources: videosList.length,
          totalClips: clipsList.length,
          pendingApproval: pending,
          scheduledClips: scheduled,
          totalPublished: publishedCount,
          totalViews: viewsCount,
        });

        setRecentJobs(jobsList.slice(0, 5));
        setRecentClips(clipsList.slice(0, 4));
        setYoutubeConnected(ytData?.connected ?? false);
      })
      .catch((err) => setError(err.message || 'Failed to load dashboard metrics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Overview Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time pipeline statistics, processing queue, and generated Shorts
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/60 text-xs font-medium text-gray-300 hover:text-white transition-all disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <Link
            href="/submit"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5"
          >
            <span>➕</span>
            <span>Submit Video</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-900/30 border border-red-700/50 text-red-300 text-xs flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Source Videos</span>
            <span className="text-base p-1.5 rounded-lg bg-blue-500/10 text-blue-400">🎬</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.totalSources}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">Submitted media</p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Clips Extracted</span>
            <span className="text-base p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">✂️</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{stats.totalClips}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">Total 9:16 Shorts</p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Needs Review</span>
            <span className="text-base p-1.5 rounded-lg bg-amber-500/10 text-amber-400">⏱️</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-amber-400 tracking-tight">{stats.pendingApproval}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">Awaiting approval</p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-gray-700 transition-all">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Scheduled</span>
            <span className="text-base p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">📅</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-cyan-400 tracking-tight">{stats.scheduledClips}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">In publishing queue</p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-gray-700 transition-all col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Published</span>
            <span className="text-base p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">✅</span>
          </div>
          <p className="text-2xl sm:text-3xl font-bold text-emerald-400 tracking-tight">{stats.totalPublished}</p>
          <p className="text-[11px] text-gray-500 mt-1.5">Live on YouTube</p>
        </div>
      </div>

      {/* Main Content Grid: Left (Recent Clips) & Right (Pipeline Activity & Channel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Clips (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <span>🎬</span>
              <span>Recent Generated Clips</span>
            </h2>
            <Link
              href="/clips"
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              View all ({stats.totalClips}) →
            </Link>
          </div>

          {recentClips.length === 0 ? (
            <div className="bg-gray-900/60 border border-gray-800/80 rounded-2xl p-8 text-center">
              <span className="text-3xl mb-2 inline-block">✂️</span>
              <p className="text-sm font-medium text-gray-300">No clips generated yet</p>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-4">
                Submit a video file or YouTube URL to extract viral moments automatically.
              </p>
              <Link
                href="/submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-sm transition-all"
              >
                Submit First Video
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {recentClips.map((clip) => (
                <div
                  key={clip.id}
                  className="bg-gray-900/80 border border-gray-800 hover:border-gray-700/80 rounded-2xl p-3.5 flex flex-col justify-between transition-all group"
                >
                  <div>
                    {/* Thumbnail placeholder or preview */}
                    <div className="w-full aspect-[9/16] max-h-48 bg-gray-950 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden border border-gray-800">
                      <video
                        src={`/api/clips/${clip.id}/preview`}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        preload="metadata"
                      />
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-gray-200">
                        {clip.durationSec}s
                      </div>
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-blue-600/80 backdrop-blur-sm text-[10px] font-medium text-white uppercase">
                        {clip.editingFormat.replace('_', ' ')}
                      </div>
                    </div>

                    <h3 className="text-xs font-medium text-white line-clamp-2 leading-relaxed">
                      {clip.title}
                    </h3>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-gray-800/80 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        clip.status === 'PUBLISHED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : clip.status === 'SCHEDULED'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {clip.status}
                    </span>

                    <Link
                      href="/clips"
                      className="text-[11px] text-gray-400 hover:text-white transition-colors"
                    >
                      Review →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Pipeline Activity & Channel (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active / Recent Jobs */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span>⚙️</span>
                <span>Processing Pipeline</span>
              </h2>
              <Link
                href="/jobs"
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
              >
                View all ({recentJobs.length}) →
              </Link>
            </div>

            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 divide-y divide-gray-800/80">
              {recentJobs.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">No active or past jobs</p>
              ) : (
                recentJobs.map((job) => (
                  <div key={job.id} className="py-3 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-white truncate max-w-[200px]">
                        {job.sourceVideo?.title || `Job ${job.id.substring(0, 8)}...`}
                      </span>
                      <span
                        className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                          job.status === 'READY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : job.status === 'FAILED'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {job.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span className="truncate">{job.stage || 'Processing'}</span>
                        <span>{job.progressPercent ?? (job.status === 'READY' ? 100 : 0)}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            job.status === 'READY'
                              ? 'bg-emerald-500'
                              : job.status === 'FAILED'
                              ? 'bg-red-500'
                              : 'bg-blue-500'
                          }`}
                          style={{
                            width: `${job.progressPercent ?? (job.status === 'READY' ? 100 : 0)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* YouTube Account Integration Card */}
          <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                YouTube Connection
              </span>
              <span
                className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                  youtubeConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {youtubeConnected ? 'Connected' : 'Not Connected'}
              </span>
            </div>

            <p className="text-xs text-gray-400 leading-relaxed">
              {youtubeConnected
                ? 'Your YouTube channel is authenticated and authorized for automated Shorts publishing.'
                : 'Connect your YouTube channel to enable direct Shorts uploading and schedule automation.'}
            </p>

            <Link
              href="/youtube"
              className="block w-full py-2 px-3 text-center text-xs font-medium rounded-xl bg-gray-800 hover:bg-gray-700/80 border border-gray-700/50 text-white transition-colors"
            >
              {youtubeConnected ? 'Manage Channel & Tokens' : 'Connect YouTube Account'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
