'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getVideoById, deleteVideo, analyzeVideo } from '@/lib/api';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [video, setVideo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reanalyzing, setReanalyzing] = useState(false);

  const fetchVideo = useCallback(async () => {
    if (!id) return;
    try {
      const d = await getVideoById(id);
      setVideo(d?.video || d);
    } catch (e: any) {
      setError(e.message || 'Failed to load video details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  // Auto-poll if job is processing
  useEffect(() => {
    if (!video) return;
    const isProcessing = ['SUBMITTED', 'QUEUED', 'PROCESSING', 'IMPORTING', 'TRANSCRIBING', 'ANALYZING', 'EDITING'].includes(video.status);
    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchVideo();
    }, 4000);
    return () => clearInterval(interval);
  }, [video?.status, fetchVideo]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this source video and its clips?')) return;
    try {
      await deleteVideo(id);
      router.push('/videos');
    } catch (e: any) {
      alert(e.message || 'Failed to delete');
    }
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      await analyzeVideo(id);
      await fetchVideo();
    } catch (e: any) {
      alert(e.message || 'Failed to trigger re-analysis');
    } finally {
      setReanalyzing(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-gray-400 text-center">Loading video details...</div>;
  }

  if (error || !video) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="bg-red-950/60 border border-red-700 text-red-200 p-6 rounded-xl text-center">
          <h3 className="text-lg font-bold mb-2">Video Not Found</h3>
          <p className="text-sm mb-4">{error || 'Could not find the requested source video.'}</p>
          <Link href="/videos" className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  const latestJob = video.processingJobs?.[0];
  const progressPct = latestJob?.progress || (video.status === 'READY' ? 100 : 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <Link href="/videos" className="text-xs text-blue-400 hover:underline mb-1.5 block">
            ← Back to Source Library
          </Link>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{video.title}</h2>
          <p className="text-gray-400 text-xs mt-1">
            Submitted {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleReanalyze}
            disabled={reanalyzing}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-medium shadow-sm transition-colors"
          >
            {reanalyzing ? 'Starting...' : '⚡ Process Video'}
          </button>
          <Link href="/clips" className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-medium shadow-sm transition-colors">
            View Clips ({video.clips?.length || 0})
          </Link>
          <button
            onClick={handleDelete}
            className="bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700/60 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Processing Status Banner */}
      <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Processing Status</span>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
            video.status === 'READY' ? 'bg-green-900 text-green-200' :
            video.status === 'FAILED' ? 'bg-red-900 text-red-200' : 'bg-blue-900 text-blue-200'
          }`}>
            {video.status}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-750 rounded-full h-2.5 my-3 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              video.status === 'READY' ? 'bg-green-500' :
              video.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {latestJob && (
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>{latestJob.currentStage || 'Processing...'}</span>
              <span>{progressPct}%</span>
            </div>
            {latestJob.errorMessage && (
              <p className="text-red-400 text-xs bg-red-950/40 border border-red-800/50 p-3 rounded-lg mt-2">
                {latestJob.errorMessage}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Video Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Video Specifications</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Format:</span>
              <span className="text-white font-medium">{video.editingFormat || 'SPLIT_SCREEN'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Duration:</span>
              <span className="text-white font-medium">{video.durationSeconds ? `${Math.round(video.durationSeconds)}s` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Category:</span>
              <span className="text-white font-medium">{video.contentCategory || 'Entertainment'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Resolution:</span>
              <span className="text-white font-medium">{video.width && video.height ? `${video.width}x${video.height}` : '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5">
          <h3 className="text-white font-semibold mb-4 text-sm uppercase tracking-wide">Extracted Highlights</h3>
          <p className="text-xs text-gray-400 mb-3">
            {video.highlights?.length || 0} moments detected for clipping
          </p>
          <div className="space-y-2 max-h-[220px] overflow-y-auto">
            {video.highlights?.map((h: any, idx: number) => (
              <div key={h.id || idx} className="bg-gray-900/60 border border-gray-750 p-2.5 rounded-lg text-xs">
                <div className="flex justify-between text-gray-300 font-medium mb-1">
                  <span>Clip {idx + 1}: {Math.round(h.startSec)}s - {Math.round(h.endSec)}s ({Math.round(h.durationSec)}s)</span>
                  <span className="text-green-400">⭐ {h.overallScore}</span>
                </div>
                <p className="text-gray-400 line-clamp-1">{h.hook || h.transcriptText}</p>
              </div>
            ))}
            {(!video.highlights || video.highlights.length === 0) && (
              <p className="text-xs text-gray-500 italic">No highlights extracted yet. Click 'Process Video' above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
